// src/routes/dashboards/analytics-gano/+page.server.ts
import { ganoAIDbAdmin } from '$lib/server/adminGanoAI'; // Menggunakan Admin SDK
import admin from 'firebase-admin'; // Untuk tipe Timestamp Admin SDK
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type {
    StatisticCardType,
    Company,
    // Tree, // Tipe Tree dari $lib/types mungkin tidak sepenuhnya cocok dengan data mentah Firestore
    TreeGeoJSONProperties,
    User, // Tipe User dari $lib/types
    UserSessionData
} from '$lib/types';
import type { FeatureCollection, Point, Feature } from 'geojson';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
dayjs.locale('id');

const MAPBOX_ACCESS_TOKEN_SERVER = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidG9ydGlla3JlYXRpZiIsImEiOiJjbTc3bWlpY24weGYyMmpwamxzYnMyYzg2In0.vkOZJGRpZusCylE9PVVmOQ';
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
}

function formatDisplayDateForServer(dateInput: admin.firestore.Timestamp | Date | string | undefined | null): string {
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
        console.error("Error formatting date on server:", e);
        return 'Format Error';
    }
}

function promiseWithTimeout<T>(promise: Promise<T>, ms: number, timeoutErrorMessage = 'Operasi memakan waktu terlalu lama'): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(timeoutErrorMessage));
        }, ms);
    });
    return Promise.race([
        promise.finally(() => clearTimeout(timeoutId)),
        timeoutPromise
    ]);
}

// defaultErrorReturn sekarang mungkin tidak terlalu sering digunakan jika kita throw svelteKitError
// tapi bisa berguna untuk mengembalikan struktur data default dengan pesan error
const defaultErrorReturnStructure = (errorMessage: string): AnalyticsGanoPageData => {
    const maxGanodermaTreeLimit = parseInt(MAX_GANODERMA_TREE_STRING || '5', 10);
    return {
        mapboxAccessToken: MAPBOX_ACCESS_TOKEN_SERVER,
        companyName: "Error",
        statistics: [],
        treeDataGeoJSON: null,
        initialMapCenter: { latitude: -2.5489, longitude: 118.0149, zoom: 5 },
        treeStatusCompositionData: { series: [], labels: ["Data tidak tersedia"] },
        treeTrendData: { categories: [], series: [] },
        problemTreesList: [],
        error: errorMessage,
        showGanodermaWarning: false,
        sickTreesCountForWarning: 0,
        maxGanodermaTreeLimitForWarning: maxGanodermaTreeLimit,
    };
};


export const load: PageServerLoad = async ({ locals }): Promise<AnalyticsGanoPageData> => {
    const loadStartTime = Date.now();
    const logPrefix = `[AnalyticsGano Server Load - ${new Date(loadStartTime).toISOString()}]`;
    console.log(`${logPrefix} Function execution started.`);

    const userSession = locals.user as UserSessionData | undefined;
    const maxGanodermaTreeLimit = parseInt(MAX_GANODERMA_TREE_STRING || '5', 10);

    if (!userSession?.hasGanoAIAccess || !userSession.ganoAICompanyId) {
        console.warn(`${logPrefix} Invalid session for GanoAI, redirecting. User: ${JSON.stringify(userSession)}`);
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ganoAICompanyId;

    if (!ganoAIDbAdmin) {
        console.error(`${logPrefix} CRITICAL: GanoAI Admin DB is NOT INITIALIZED!`);
        throw svelteKitError(503, 'Layanan data GanoAI tidak tersedia (DB Admin Error).');
    }

    const TIMEOUT_DURATION = 28000; // Kurangi sedikit jika 30s terlalu mepet dengan timeout platform

    try {
        let stepStartTime = Date.now();
        console.log(`${logPrefix} STEP 1: Fetching company document for ID: ${companyIdToLoad}`);
        const companyRef = ganoAIDbAdmin.collection('company').doc(companyIdToLoad);
        const companyDocSnap = await promiseWithTimeout(companyRef.get(), TIMEOUT_DURATION, `Firestore getDoc('company') timed out`);

        if (!companyDocSnap.exists) {
            const msg = `Perusahaan GanoAI dengan ID ${companyIdToLoad} tidak ditemukan.`;
            console.warn(`${logPrefix} ${msg}`);
            throw svelteKitError(404, msg);
        }
        const companyData = { id: companyDocSnap.id, ...companyDocSnap.data() } as Company;
        console.log(`${logPrefix} STEP 1 DONE. Company: ${companyData.company_name}. Duration: ${Date.now() - stepStartTime}ms`);

        stepStartTime = Date.now();
        console.log(`${logPrefix} STEP 2: Fetching users for company ${companyIdToLoad}`);
        const usersMap = new Map<string, string>();
        const usersColRef = ganoAIDbAdmin.collection('users');
        const companyUsersQuery = usersColRef.where('companyId', '==', companyIdToLoad);
        const usersSnapshot = await promiseWithTimeout(companyUsersQuery.get(), TIMEOUT_DURATION, `Firestore getDocs('users') timed out`);
        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            usersMap.set(userDoc.id, userData.name || 'Tanpa Nama');
        });
        console.log(`${logPrefix} STEP 2 DONE. Fetched ${usersSnapshot.size} users. Duration: ${Date.now() - stepStartTime}ms`);

        stepStartTime = Date.now();
        console.log(`${logPrefix} STEP 3: Fetching trees for company ${companyIdToLoad}`);
        const treesColRef = ganoAIDbAdmin.collection(`company/${companyIdToLoad}/tree`);
        const allTreesQuery = treesColRef.orderBy('date.updatedDate', 'desc');
        const allTreesSnapshot = await promiseWithTimeout(allTreesQuery.get(), TIMEOUT_DURATION, `Firestore getDocs('trees') timed out`);
        console.log(`${logPrefix} STEP 3 DONE. Fetched ${allTreesSnapshot.size} trees. Duration: ${Date.now() - stepStartTime}ms`);

        stepStartTime = Date.now();
        console.log(`${logPrefix} STEP 4: Processing ${allTreesSnapshot.size} trees...`);
        let totalTrees = 0;
        let kpiSickTrees = 0;
        let chartSickCount = 0, chartRecoveredCount = 0, chartMaintenanceCount = 0, chartOtherStatusCount = 0;
        const treeFeatures: Feature<Point, TreeGeoJSONProperties>[] = [];
        let calculatedInitialMapCenter = { latitude: -2.5489, longitude: 118.0149, zoom: 5 };
        let foundTreeForCenter = false;
        const monthlyDataAgg: Record<string, { newTrees: number; newlySickTrees: number }> = {};
        const problemTreesList: ProblemTree[] = [];

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
                    calculatedInitialMapCenter = { latitude: rawTreeData.location.latitude, longitude: rawTreeData.location.longitude, zoom: 12 };
                    foundTreeForCenter = true;
                }
                treeFeatures.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [rawTreeData.location.longitude, rawTreeData.location.latitude] },
                    properties: {
                        id: treeDoc.id, name: rawTreeData.name || `Pohon ID ${treeDoc.id.substring(0,6)}`,
                        last_status: rawTreeData.last_status || 'unknown', img: rawTreeData.img, description: rawTreeData.description
                    }
                });
            }
            const createdDateFirestore = rawTreeData.date?.createdDate as admin.firestore.Timestamp | undefined;
            const updatedDateFirestore = rawTreeData.date?.updatedDate as admin.firestore.Timestamp | undefined;

            if (createdDateFirestore?.toDate) {
                const jsCreatedDate = createdDateFirestore.toDate();
                const monthYear = dayjs(jsCreatedDate).format('YYYY-MM');
                if (!monthlyDataAgg[monthYear]) monthlyDataAgg[monthYear] = { newTrees: 0, newlySickTrees: 0 };
                monthlyDataAgg[monthYear].newTrees++;
            }
            if (rawTreeData.last_status === 'sick' && updatedDateFirestore?.toDate) {
                const jsUpdatedDate = updatedDateFirestore.toDate();
                const monthYear = dayjs(jsUpdatedDate).format('YYYY-MM');
                if (!monthlyDataAgg[monthYear]) monthlyDataAgg[monthYear] = { newTrees: 0, newlySickTrees: 0 };
                monthlyDataAgg[monthYear].newlySickTrees++;

                if (problemTreesList.length < 10) {
                    problemTreesList.push({
                        id: treeDoc.id,
                        name: rawTreeData.name || `Pohon ID ${treeDoc.id.substring(0,6)}`,
                        last_status: rawTreeData.last_status,
                        updatedDate: formatDisplayDateForServer(jsUpdatedDate),
                        reportedBy: rawTreeData.userId ? (usersMap.get(rawTreeData.userId) || rawTreeData.userId) : 'Tidak diketahui',
                        img: rawTreeData.img,
                        description: rawTreeData.description?.substring(0, 50) + (rawTreeData.description && rawTreeData.description.length > 50 ? '...' : '')
                    });
                }
            }
        });
        console.log(`${logPrefix} STEP 4 DONE. Duration: ${Date.now() - stepStartTime}ms`);

        stepStartTime = Date.now();
        console.log(`${logPrefix} STEP 5: Constructing final data objects...`);
        const treeDataGeoJSON: FeatureCollection<Point, TreeGeoJSONProperties> | null = treeFeatures.length > 0 ? { type: 'FeatureCollection', features: treeFeatures } : null;
        const percentageSickForKPI = totalTrees > 0 ? parseFloat(((kpiSickTrees / totalTrees) * 100).toFixed(1)) : 0;
        const statisticsData: StatisticCardType[] = [
            { icon: 'mdi:office-building-cog-outline', variant: 'primary', title: companyData.company_name || 'Nama Perusahaan', statistic: '' },
            { icon: 'mdi:tree-outline', variant: 'success', title: 'Total Pohon Terdata', statistic: totalTrees },
            { icon: 'mdi:virus-off-outline', variant: 'danger', title: 'Pohon Sakit (Ganoderma)', statistic: kpiSickTrees },
            { icon: 'mdi:chart-pie', variant: 'warning', title: 'Persentase Sakit', statistic: `${percentageSickForKPI}%` },
        ];
        const treeStatusCompositionDataSeries = [chartRecoveredCount, chartSickCount, chartMaintenanceCount];
        const treeStatusCompositionDataLabels = ['Sudah Pulih', 'Terkena Ganoderma', 'Dalam Perawatan'];
        const otherTreesCount = totalTrees - (chartRecoveredCount + chartSickCount + chartMaintenanceCount);
        if (otherTreesCount > 0) { // Lebih akurat menghitung sisa
            treeStatusCompositionDataSeries.push(otherTreesCount);
            treeStatusCompositionDataLabels.push('Status Lain/N.A');
        }
        const treeStatusCompositionData = { series: treeStatusCompositionDataSeries, labels: treeStatusCompositionDataLabels };

        const trendCategories: string[] = [];
        const newTreesSeries: number[] = [];
        const newlySickTreesSeries: number[] = [];
        const currentMonth = dayjs();
        for (let i = 11; i >= 0; i--) {
            const monthTarget = currentMonth.subtract(i, 'month');
            const monthYearKey = monthTarget.format('YYYY-MM');
            trendCategories.push(monthTarget.format('MMM YY'));
            newTreesSeries.push(monthlyDataAgg[monthYearKey]?.newTrees || 0);
            newlySickTreesSeries.push(monthlyDataAgg[monthYearKey]?.newlySickTrees || 0);
        }
        const treeTrendData = {
            categories: trendCategories,
            series: [
                { name: 'Pohon Baru Ditanam', type: 'bar', data: newTreesSeries },
                { name: 'Pohon Sakit Dilaporkan', type: 'line', data: newlySickTreesSeries }
            ]
        };

        // PERBAIKAN untuk Error TS2322:
        const isPremiumUser = userSession?.isGanoAIPremium === true; // Hasilnya pasti boolean
        const calculatedShowGanodermaWarning = isPremiumUser && kpiSickTrees > maxGanodermaTreeLimit;

        if (calculatedShowGanodermaWarning) {
            console.warn(`${logPrefix} GANODERMA WARNING! Sick trees (${kpiSickTrees}) exceed limit (${maxGanodermaTreeLimit}) for premium user.`);
        }
        console.log(`${logPrefix} STEP 5 DONE. Duration: ${Date.now() - stepStartTime}ms`);
        console.log(`${logPrefix} Total execution time: ${Date.now() - loadStartTime}ms. Returning data for ${companyData.company_name}.`);

        return {
            mapboxAccessToken: MAPBOX_ACCESS_TOKEN_SERVER,
            companyName: companyData.company_name,
            statistics: statisticsData,
            treeDataGeoJSON: treeDataGeoJSON,
            initialMapCenter: calculatedInitialMapCenter,
            treeStatusCompositionData,
            treeTrendData,
            problemTreesList,
            error: null, // Tidak ada error non-kritis yang dikembalikan di sini
            showGanodermaWarning: calculatedShowGanodermaWarning, // Ini sudah boolean
            sickTreesCountForWarning: kpiSickTrees,
            maxGanodermaTreeLimitForWarning: maxGanodermaTreeLimit
        } satisfies AnalyticsGanoPageData;

    } catch (error: any) {
        const errorMessage = `Gagal memuat data analitik GanoAI: ${error.message || 'Kesalahan tidak diketahui'}`;
        console.error(`${logPrefix} MAIN EXCEPTION. Duration: ${Date.now() - loadStartTime}ms. Error:`, error.stack || error);
        throw svelteKitError( (error.name === 'Error' && error.message.includes('timed out')) ? 504 : 500, errorMessage);
    }
};