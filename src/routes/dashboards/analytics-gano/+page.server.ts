// src/routes/dashboards/analytics-gano/+page.server.ts
import { ganoAIDbAdmin } from '$lib/server/adminGanoAI'; // Menggunakan Admin SDK
import admin from 'firebase-admin'; // Untuk tipe Timestamp Admin SDK
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type {
	StatisticCardType,
	Company,
	TreeGeoJSONProperties,
	User, // Tipe User dari $lib/types
	UserSessionData
} from '$lib/types';
import type { FeatureCollection, Point, Feature } from 'geojson';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
dayjs.locale('id');

const MAPBOX_ACCESS_TOKEN_SERVER =
	import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
	'pk.eyJ1IjoidG9ydGlla3JlYXRpZiIsImEiOiJjbTc3bWlpY24weGYyMmpwamxzYnMyYzg2In0.vkOZJGRpZusCylE9PVVmOQ';
const MAX_GANODERMA_TREE_STRING = import.meta.env.VITE_MAX_GANODERMA_TREE;

interface ProblemTree {
	id: string;
	name: string;
	last_status: string;
	updatedDate: string; // Akan menjadi string tanggal yang sudah diformat
	reportedBy?: string;
	img?: string;
	description?: string;
}

// Definisikan tipe data spesifik untuk halaman ini yang akan dikembalikan oleh load function
interface AnalyticsGanoPageData {
	mapboxAccessToken: string;
	companyName: string;
	statistics: StatisticCardType[];
	treeDataGeoJSON: FeatureCollection<Point, TreeGeoJSONProperties> | null;
	initialMapCenter: { latitude: number; longitude: number; zoom: number };
	treeStatusCompositionData: { series: number[]; labels: string[] };
	treeTrendData: { categories: string[]; series: { name: string; type?: string; data: number[] }[] };
	problemTreesList: ProblemTree[];
	error: string | null; // Untuk pesan error non-kritis dari load function ini
	showGanodermaWarning: boolean;
	sickTreesCountForWarning: number;
	maxGanodermaTreeLimitForWarning: number;
	timeframe: 'daily' | 'monthly'; // Tambahkan timeframe
}

function formatDisplayDateForServer(
	dateInput: admin.firestore.Timestamp | Date | string | undefined | null
): string {
	if (!dateInput) return 'N/A';
	try {
		let dateObj: Date;
		if (typeof dateInput === 'string') {
			dateObj = new Date(dateInput);
		} else if (dateInput instanceof Date) {
			dateObj = dateInput;
		} else if (typeof (dateInput as admin.firestore.Timestamp).toDate === 'function') {
			dateObj = (dateInput as admin.firestore.Timestamp).toDate();
		} else {
			return 'Invalid Date Input';
		}
		if (isNaN(dateObj.getTime())) return 'Invalid Date';
		return dayjs(dateObj).format('DD MMM YYYY'); // Format contoh
	} catch (e) {
		console.error('Error formatting date on server:', e);
		return 'Format Error';
	}
}

function promiseWithTimeout<T>(
	promise: Promise<T>,
	ms: number,
	timeoutErrorMessage = 'Operasi memakan waktu terlalu lama'
): Promise<T> {
	let timeoutId: NodeJS.Timeout;
	const timeoutPromise = new Promise<T>((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error(timeoutErrorMessage));
		}, ms);
	});
	return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeoutPromise]);
}

export const load: PageServerLoad = async ({ locals, url }): Promise<AnalyticsGanoPageData> => {
	const loadStartTime = Date.now();
	const logPrefix = `[AnalyticsGano Server Load - ${new Date(loadStartTime).toISOString()}]`;

	const timeframe = url.searchParams.get('timeframe') === 'daily' ? 'daily' : 'monthly';
	console.log(`${logPrefix} Function execution started for timeframe: ${timeframe}.`);

	const userSession = locals.user as UserSessionData | undefined;
	const maxGanodermaTreeLimit = parseInt(MAX_GANODERMA_TREE_STRING || '5', 10);

	if (!userSession?.hasGanoAIAccess || !userSession.ganoAICompanyId) {
		throw redirect(303, '/auth/sign-in');
	}
	const companyIdToLoad = userSession.ganoAICompanyId;

	if (!ganoAIDbAdmin) {
		console.error(`${logPrefix} CRITICAL: GanoAI Admin DB is NOT INITIALIZED!`);
		throw svelteKitError(503, 'Layanan data GanoAI tidak tersedia (DB Admin Error).');
	}

	const TIMEOUT_DURATION = 28000;

	try {
		const companyRef = ganoAIDbAdmin.collection('company').doc(companyIdToLoad);
		const companyDocSnap = await promiseWithTimeout(companyRef.get(), TIMEOUT_DURATION);
		if (!companyDocSnap.exists) {
			throw svelteKitError(404, `Perusahaan GanoAI dengan ID ${companyIdToLoad} tidak ditemukan.`);
		}
		const companyData = { id: companyDocSnap.id, ...companyDocSnap.data() } as Company;

		const usersMap = new Map<string, string>();
		const usersColRef = ganoAIDbAdmin.collection('users');
		const usersSnapshot = await usersColRef.where('companyId', '==', companyIdToLoad).get();
		usersSnapshot.forEach((userDoc) => {
			usersMap.set(userDoc.id, userDoc.data().name || 'Tanpa Nama');
		});

		const treesColRef = ganoAIDbAdmin.collection(`company/${companyIdToLoad}/tree`);
		const allTreesQuery = treesColRef.orderBy('date.updatedDate', 'desc');
		const allTreesSnapshot = await promiseWithTimeout(allTreesQuery.get(), TIMEOUT_DURATION);

		let totalTrees = 0,
			kpiSickTrees = 0;
		let chartSickCount = 0,
			chartRecoveredCount = 0,
			chartMaintenanceCount = 0,
			chartOtherStatusCount = 0;
		const treeFeatures: Feature<Point, TreeGeoJSONProperties>[] = [];
		let calculatedInitialMapCenter = { latitude: -2.5489, longitude: 118.0149, zoom: 5 };
		let foundTreeForCenter = false;
		const problemTreesList: ProblemTree[] = [];

		const statusChangesAgg: Record<string, { sick: number; recovered: number; maintenance: number }> =
			{};
		const dateFormatKey = timeframe === 'daily' ? 'YYYY-MM-DD' : 'YYYY-MM';

		allTreesSnapshot.forEach((treeDoc) => {
			totalTrees++;
			const rawTreeData = treeDoc.data();
			if (!rawTreeData) return;

			if (rawTreeData.last_status === 'sick') kpiSickTrees++;
			const currentStatus = rawTreeData.last_status?.toLowerCase();
			if (currentStatus === 'sick') chartSickCount++;
			else if (currentStatus === 'recovered') chartRecoveredCount++;
			else if (currentStatus === 'maintenance') chartMaintenanceCount++;
			else chartOtherStatusCount++;

			if (rawTreeData.location?.latitude != null && rawTreeData.location?.longitude != null) {
				if (!foundTreeForCenter) {
					calculatedInitialMapCenter = {
						latitude: rawTreeData.location.latitude,
						longitude: rawTreeData.location.longitude,
						zoom: 12
					};
					foundTreeForCenter = true;
				}
				treeFeatures.push({
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates: [rawTreeData.location.longitude, rawTreeData.location.latitude]
					},
					properties: {
						id: treeDoc.id,
						name: rawTreeData.name || `Pohon ID ${treeDoc.id.substring(0, 6)}`,
						last_status: rawTreeData.last_status || 'unknown',
						img: rawTreeData.img,
						description: rawTreeData.description
					}
				});
			}

			const updatedDateFirestore = rawTreeData.date?.updatedDate as
				| admin.firestore.Timestamp
				| undefined;

			if (updatedDateFirestore?.toDate && currentStatus) {
				const jsUpdatedDate = updatedDateFirestore.toDate();
				const dateKey = dayjs(jsUpdatedDate).format(dateFormatKey);

				if (!statusChangesAgg[dateKey]) {
					statusChangesAgg[dateKey] = { sick: 0, recovered: 0, maintenance: 0 };
				}

				if (currentStatus === 'sick') statusChangesAgg[dateKey].sick++;
				else if (currentStatus === 'recovered') statusChangesAgg[dateKey].recovered++;
				else if (currentStatus === 'maintenance') statusChangesAgg[dateKey].maintenance++;
			}

			if (rawTreeData.last_status === 'sick' && problemTreesList.length < 10) {
				problemTreesList.push({
					id: treeDoc.id,
					name: rawTreeData.name || `Pohon ID ${treeDoc.id.substring(0, 6)}`,
					last_status: rawTreeData.last_status,
					updatedDate: formatDisplayDateForServer(updatedDateFirestore),
					reportedBy: rawTreeData.userId
						? usersMap.get(rawTreeData.userId) || rawTreeData.userId
						: 'Tidak diketahui',
					img: rawTreeData.img,
					description:
						rawTreeData.description?.substring(0, 50) +
						(rawTreeData.description && rawTreeData.description.length > 50 ? '...' : '')
				});
			}
		});

		const treeDataGeoJSON: FeatureCollection<Point, TreeGeoJSONProperties> | null =
			treeFeatures.length > 0 ? { type: 'FeatureCollection', features: treeFeatures } : null;
		const percentageSickForKPI =
			totalTrees > 0 ? parseFloat(((kpiSickTrees / totalTrees) * 100).toFixed(1)) : 0;
		const statisticsData: StatisticCardType[] = [
			{
				icon: 'mdi:office-building-cog-outline',
				variant: 'primary',
				title: companyData.company_name || 'Nama Perusahaan',
				statistic: ''
			},
			{
				icon: 'mdi:tree-outline',
				variant: 'success',
				title: 'Total Pohon Terdata',
				statistic: totalTrees
			},
			{
				icon: 'mdi:virus-off-outline',
				variant: 'danger',
				title: 'Pohon Sakit (Ganoderma)',
				statistic: kpiSickTrees
			},
			{
				icon: 'mdi:chart-pie',
				variant: 'warning',
				title: 'Persentase Sakit',
				statistic: `${percentageSickForKPI}%`
			}
		];
		const treeStatusCompositionDataSeries = [
			chartRecoveredCount,
			chartSickCount,
			chartMaintenanceCount
		];
		const treeStatusCompositionDataLabels = [
			'Sudah Pulih',
			'Terkena Ganoderma',
			'Dalam Perawatan'
		];
		const otherTreesCount =
			totalTrees - (chartRecoveredCount + chartSickCount + chartMaintenanceCount);
		if (otherTreesCount > 0) {
			treeStatusCompositionDataSeries.push(otherTreesCount);
			treeStatusCompositionDataLabels.push('Status Lain/N.A');
		}
		const treeStatusCompositionData = {
			series: treeStatusCompositionDataSeries,
			labels: treeStatusCompositionDataLabels
		};

		const trendCategories: string[] = [];
		const sickSeries: number[] = [];
		const recoveredSeries: number[] = [];
		const maintenanceSeries: number[] = [];
		const currentDay = dayjs();

		if (timeframe === 'daily') {
			for (let i = 29; i >= 0; i--) {
				const dayTarget = currentDay.subtract(i, 'day');
				const dateKey = dayTarget.format('YYYY-MM-DD');
				trendCategories.push(dayTarget.format('D MMM'));

				sickSeries.push(statusChangesAgg[dateKey]?.sick || 0);
				recoveredSeries.push(statusChangesAgg[dateKey]?.recovered || 0);
				maintenanceSeries.push(statusChangesAgg[dateKey]?.maintenance || 0);
			}
		} else {
			for (let i = 11; i >= 0; i--) {
				const monthTarget = currentDay.subtract(i, 'month');
				const monthYearKey = monthTarget.format('YYYY-MM');
				trendCategories.push(monthTarget.format('MMM YY'));

				sickSeries.push(statusChangesAgg[monthYearKey]?.sick || 0);
				recoveredSeries.push(statusChangesAgg[monthYearKey]?.recovered || 0);
				maintenanceSeries.push(statusChangesAgg[monthYearKey]?.maintenance || 0);
			}
		}

		const treeTrendData = {
			categories: trendCategories,
			series: [
				{ name: 'Sakit', type: 'line', data: sickSeries },
				{ name: 'Pulih', type: 'line', data: recoveredSeries },
				{ name: 'Dirawat', type: 'line', data: maintenanceSeries }
			]
		};

		const isPremiumUser = userSession?.isGanoAIPremium === true;
		const calculatedShowGanodermaWarning = isPremiumUser && kpiSickTrees > maxGanodermaTreeLimit;

		return {
			mapboxAccessToken: MAPBOX_ACCESS_TOKEN_SERVER,
			companyName: companyData.company_name,
			statistics: statisticsData,
			treeDataGeoJSON: treeDataGeoJSON,
			initialMapCenter: calculatedInitialMapCenter,
			treeStatusCompositionData,
			treeTrendData,
			problemTreesList,
			error: null,
			showGanodermaWarning: calculatedShowGanodermaWarning,
			sickTreesCountForWarning: kpiSickTrees,
			maxGanodermaTreeLimitForWarning: maxGanodermaTreeLimit,
			timeframe: timeframe
		};
	} catch (error: any) {
		const errorMessage = `Gagal memuat data analitik GanoAI: ${error.message || 'Kesalahan tidak diketahui'}`;
		console.error(
			`${logPrefix} MAIN EXCEPTION. Duration: ${Date.now() - loadStartTime}ms. Error:`,
			error.stack || error
		);
		throw svelteKitError(
			error.name === 'Error' && error.message.includes('timed out') ? 504 : 500,
			errorMessage
		);
	}
};