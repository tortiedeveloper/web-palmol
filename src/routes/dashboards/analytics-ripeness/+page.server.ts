// src/routes/dashboards/analytics-ripeness/+page.server.ts
import { ripenessDbAdmin } from '$lib/server/adminRipeness';
import admin from 'firebase-admin';
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type {
    StatisticCardType, Company, Tree as RipenessTree, TreeGeoJSONProperties, User, UserSessionData, FruitCounts
} from '$lib/types';
import type { FeatureCollection, Point, Feature } from 'geojson'; // Pastikan Feature diimpor
import dayjs from 'dayjs';
import 'dayjs/locale/id';
dayjs.locale('id');

const MAPBOX_ACCESS_TOKEN_SERVER = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidG9ydGlla3JlYXRpZiIsImEiOiJjbTc3bWlpY24weGYyMmpwamxzYnMyYzg2In0.vkOZJGRpZusCylE9PVVmOQ';

// Definisikan tipe data spesifik untuk halaman ini yang akan dikembalikan oleh load function
interface AnalyticsRipenessPageData {
    mapboxAccessToken: string;
    companyName: string;
    statistics: StatisticCardType[];
    treeDataGeoJSON: FeatureCollection<Point, TreeGeoJSONProperties> | null;
    initialMapCenter: { latitude: number; longitude: number; zoom: number };
    fruitCompositionData: { series: number[]; labels: string[] } | null;
    fruitTrendData: { categories: string[]; series: { name: string; type?: string; data: number[] }[] } | null;
    harvestReadyTreesList: HarvestReadyTree[];
    error?: string | null; // Untuk pesan error non-kritis atau informasi
    startDate?: string;    // Opsional, pastikan string | undefined
    endDate?: string;      // Opsional, pastikan string | undefined
    isCurrentlyFiltered?: boolean; // Opsional
}

interface HarvestReadyTree {
    id: string;
    name: string;
    fruitCounts: FruitCounts;
    updatedDate: string;
    reportedBy?: string;
    img?: string;
}

function formatDisplayDateForServer(dateInput: admin.firestore.Timestamp | Date | string | undefined | null): string {
    if (!dateInput) return 'N/A';
    try {
        let dateObj: Date;
        if (typeof dateInput === 'string') dateObj = new Date(dateInput);
        else if (dateInput instanceof Date) dateObj = dateInput;
        else if (typeof (dateInput as admin.firestore.Timestamp).toDate === 'function') dateObj = (dateInput as admin.firestore.Timestamp).toDate();
        else return 'Invalid Date Input';
        if (isNaN(dateObj.getTime())) return 'Invalid Date';
        return dayjs(dateObj).format('DD MMM YY');
    } catch (e) { return 'Format Error'; }
}

export const load: PageServerLoad = async ({ locals, url }): Promise<AnalyticsRipenessPageData> => {
    const userSession = locals.user as UserSessionData | undefined;
    const logPrefix = `[AnalyticsRipeness Server Load - ${new Date().toISOString()}]`;

    if (!userSession?.hasRipenessAccess || !userSession.ripenessCompanyId) {
        console.warn(`${logPrefix} Invalid session for Ripeness, redirecting.`);
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;

    if (!ripenessDbAdmin) {
        console.error(`${logPrefix} CRITICAL: Ripeness Admin DB is NOT INITIALIZED!`);
        throw svelteKitError(503, 'Layanan data Ripeness tidak tersedia.');
    }
    const db = ripenessDbAdmin;

    const startDateStr = url.searchParams.get('startDate'); // string | null
    const endDateStr = url.searchParams.get('endDate');     // string | null

    let filterStartDateForQuery: Date | undefined = undefined;
    let filterEndDateForQuery: Date | undefined = undefined;
    let isDateEffectivelyFiltered = false;

    if (startDateStr) {
        const parsed = dayjs(startDateStr);
        if (parsed.isValid()) { filterStartDateForQuery = parsed.startOf('day').toDate(); isDateEffectivelyFiltered = true; }
    }
    if (endDateStr) {
        const parsed = dayjs(endDateStr);
        if (parsed.isValid()) { filterEndDateForQuery = parsed.endOf('day').toDate(); isDateEffectivelyFiltered = true; }
    }
    if (filterStartDateForQuery && !filterEndDateForQuery && startDateStr) {
        filterEndDateForQuery = dayjs(filterStartDateForQuery).endOf('month').toDate();
    }
    if (filterStartDateForQuery && filterEndDateForQuery && filterStartDateForQuery > filterEndDateForQuery) {
        filterStartDateForQuery = undefined; filterEndDateForQuery = undefined; isDateEffectivelyFiltered = false;
    }

    try {
        const companyRef = db.collection('company').doc(companyIdToLoad);
        const companyDocSnap = await companyRef.get();
        if (!companyDocSnap.exists) { // PERBAIKAN: akses .exists sebagai properti
            throw svelteKitError(404, `Perusahaan Ripeness ID ${companyIdToLoad} tidak ditemukan.`);
        }
        const companyData = { id: companyDocSnap.id, ...companyDocSnap.data() } as Company;

        const usersMap = new Map<string, string>();
        const usersColRef = db.collection('users');
        const companyUsersQuery = usersColRef.where('companyId', '==', companyIdToLoad);
        const usersSnapshot = await companyUsersQuery.get();
        usersSnapshot.forEach(userDoc => {
            usersMap.set(userDoc.id, userDoc.data().name || 'Tanpa Nama');
        });

        const treesColRef = db.collection(`company/${companyIdToLoad}/tree`);
        let treesQuery: admin.firestore.Query = treesColRef;
        if (filterStartDateForQuery) {
            treesQuery = treesQuery.where('date.updatedDate', '>=', admin.firestore.Timestamp.fromDate(filterStartDateForQuery));
        }
        if (filterEndDateForQuery) {
            treesQuery = treesQuery.where('date.updatedDate', '<=', admin.firestore.Timestamp.fromDate(filterEndDateForQuery));
        }
        treesQuery = treesQuery.orderBy('date.updatedDate', 'desc');
        const allTreesSnapshot = await treesQuery.get();

        let totalRipenessTrees = 0;
        let totalBuahMatang = 0, totalBuahBelumMatang = 0, totalBuahTerlaluMatang = 0;
        const treeFeatures: Feature<Point, TreeGeoJSONProperties>[] = [];
        let calculatedInitialMapCenter = { latitude: -2.5489, longitude: 118.0149, zoom: 5 };
        let foundTreeForCenter = false;
        const monthlyRipenessDataAgg: Record<string, { totalMatang: number }> = {};
        const harvestReadyTreesList: HarvestReadyTree[] = [];

        allTreesSnapshot.forEach(treeDoc => {
            totalRipenessTrees++;
            const rawTreeData = treeDoc.data();
            const treeId = treeDoc.id;
            const fc: FruitCounts = rawTreeData.fruitCounts ? {
                matang: Number(rawTreeData.fruitCounts.matang) || 0,
                belumMatang: Number(rawTreeData.fruitCounts.belumMatang) || 0,
                terlaluMatang: Number(rawTreeData.fruitCounts.terlaluMatang) || 0,
            } : { belumMatang: 0, matang: 0, terlaluMatang: 0 };

            totalBuahMatang += fc.matang;
            totalBuahBelumMatang += fc.belumMatang;
            totalBuahTerlaluMatang += fc.terlaluMatang;

            if (rawTreeData.location?.latitude != null && rawTreeData.location?.longitude != null) {
                if (!foundTreeForCenter) {
                    calculatedInitialMapCenter = { latitude: rawTreeData.location.latitude, longitude: rawTreeData.location.longitude, zoom: 12 };
                    foundTreeForCenter = true;
                }
                treeFeatures.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [rawTreeData.location.longitude, rawTreeData.location.latitude] },
                    properties: {
                        id: treeId, name: rawTreeData.name || `Pohon ${treeId.substring(0,6)}`,
                        img: rawTreeData.img, description: rawTreeData.description,
                        fruitCounts: fc
                    }
                });
            }

            const updatedDateFirestore = rawTreeData.date?.updatedDate as admin.firestore.Timestamp | undefined;
            if (updatedDateFirestore?.toDate && fc.matang > 0) {
                const jsUpdatedDate = updatedDateFirestore.toDate();
                const monthYear = dayjs(jsUpdatedDate).format('YYYY-MM');
                if (!monthlyRipenessDataAgg[monthYear]) monthlyRipenessDataAgg[monthYear] = { totalMatang: 0 };
                monthlyRipenessDataAgg[monthYear].totalMatang += fc.matang;
            }

            if (fc.matang > 0 && harvestReadyTreesList.length < 10) {
                harvestReadyTreesList.push({
                    id: treeId, name: rawTreeData.name || `Pohon ${treeId.substring(0,6)}`,
                    fruitCounts: fc, updatedDate: formatDisplayDateForServer(updatedDateFirestore),
                    reportedBy: rawTreeData.userId ? (usersMap.get(rawTreeData.userId) || rawTreeData.userId) : 'N/A',
                    img: rawTreeData.img,
                });
            }
        });
        const treeDataGeoJSON: FeatureCollection<Point, TreeGeoJSONProperties> | null = treeFeatures.length > 0 ? { type: 'FeatureCollection', features: treeFeatures } : null;
        const totalSemuaBuah = totalBuahMatang + totalBuahBelumMatang + totalBuahTerlaluMatang;
        const persentaseMatangIdeal = totalSemuaBuah > 0 ? parseFloat(((totalBuahMatang / totalSemuaBuah) * 100).toFixed(1)) : 0;

        const statistics: StatisticCardType[] = [
            { icon: 'mdi:office-building-cog-outline', variant: 'primary', title: companyData.company_name || 'Perusahaan', statistic: '' },
            { icon: 'mdi:tree-outline', variant: 'info', title: 'Pohon (Filter Aktif)', statistic: totalRipenessTrees },
            { icon: 'mdi:fruit-cherries', variant: 'success', title: 'Est. Buah Matang', statistic: totalBuahMatang, suffix: ' buah' },
            { icon: 'mdi:chart-line-variant', variant: 'warning', title: '% Kematangan', statistic: `${persentaseMatangIdeal}%` },
        ];
        const fruitCompositionData = (totalSemuaBuah > 0) ? {
            series: [totalBuahMatang, totalBuahBelumMatang, totalBuahTerlaluMatang],
            labels: ['Matang', 'Belum Matang', 'Terlalu Matang']
        } : null;

        const trendCategories: string[] = [];
        const totalMatangSeries: number[] = [];
        const trendLoopEndDate = filterEndDateForQuery ? dayjs(filterEndDateForQuery) : dayjs();
        for (let i = 11; i >= 0; i--) {
            const monthTarget = trendLoopEndDate.subtract(i, 'month');
            const monthYearKey = monthTarget.format('YYYY-MM');
            trendCategories.push(monthTarget.format('MMM YY'));
            totalMatangSeries.push(monthlyRipenessDataAgg[monthYearKey]?.totalMatang || 0);
        }
        const fruitTrendData = (totalMatangSeries.some(val => val > 0)) ? {
            categories: trendCategories,
            series: [{ name: 'Total Buah Matang', type: 'line', data: totalMatangSeries }]
        } : null;

        return {
            mapboxAccessToken: MAPBOX_ACCESS_TOKEN_SERVER,
            companyName: companyData.company_name,
            statistics, treeDataGeoJSON,
            initialMapCenter: calculatedInitialMapCenter, // Pastikan nama variabel benar
            fruitCompositionData, fruitTrendData, harvestReadyTreesList,
            error: null,
            startDate: startDateStr || undefined, // Mengembalikan string | undefined
            endDate: endDateStr || undefined,     // Mengembalikan string | undefined
            isCurrentlyFiltered: isDateEffectivelyFiltered
        };

    } catch (error: any) {
        console.error(`${logPrefix} Gagal memuat data analitik Ripeness:`, error.stack || error);
        // Mengembalikan struktur yang konsisten saat error
        return {
            mapboxAccessToken: MAPBOX_ACCESS_TOKEN_SERVER,
            companyName: "Error", statistics: [], treeDataGeoJSON: null,
            initialMapCenter: { latitude: -2.5489, longitude: 118.0149, zoom: 5 },
            fruitCompositionData: null, fruitTrendData: null, harvestReadyTreesList: [],
            error: `Gagal memuat data analitik Ripeness: ${error.message}`,
            startDate: startDateStr || undefined, // Konsisten
            endDate: endDateStr || undefined,     // Konsisten
            isCurrentlyFiltered: isDateEffectivelyFiltered // Atau false
        };
    }
};