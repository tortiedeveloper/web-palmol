// src/routes/dashboards/analytics-gano/+page.server.ts
import { ganoAIDb, ganoAIApp } from '$lib/firebase/ganoAIClient';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    Timestamp as FirebaseTimestampType, // Tetap sebagai FirebaseTimestampType untuk kejelasan
    orderBy,
    limit, // Jika masih dipakai untuk debug
    type QueryDocumentSnapshot,    // <-- PERBAIKAN: Impor tipe
    type DocumentData             // <-- PERBAIKAN: Impor tipe
} from 'firebase/firestore';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoadEvent, PageServerLoad } from './$types';
import type { StatisticCardType, Company, Tree, TreeGeoJSONProperties, User, FirebaseTimestamp, TreeDate, UserSessionData } from '$lib/types';
import type { FeatureCollection, Point, Feature } from 'geojson';

// PERBAIKAN SEMENTARA untuk Mapbox Token (REKOMENDASI: Gunakan PUBLIC_MAPBOX_ACCESS_TOKEN di .env dan '$env/static/public')
const MAPBOX_ACCESS_TOKEN_SERVER = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoidG9ydGlla3JlYXRpZiIsImEiOiJjbTc3bWlpY24weGYyMmpwamxzYnMyYzg2In0.vkOZJGRpZusCylE9PVVmOQ'; // Fallback jika env var tidak ada

interface MonthlyTreeData {
    month: string;
    newTrees: number;
    newlySickTrees: number;
}
interface ProblemTree {
    id: string;
    name: string;
    last_status: string;
    updatedDate: string;
    reportedBy?: string;
    img?: string;
    description?: string;
}

function formatDisplayDate(timestamp: FirebaseTimestamp | undefined | null): string { // Ubah FirebaseTimestampType menjadi FirebaseTimestamp dari $lib/types jika itu yang Anda maksud
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return timestamp.toDate().toLocaleDateString('id-ID', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

const defaultErrorReturn = (errorMessage: string) => ({
    mapboxAccessToken: MAPBOX_ACCESS_TOKEN_SERVER,
    companyName: "Error Data",
    statistics: [] as StatisticCardType[], // Pastikan tipe eksplisit untuk array kosong
    treeDataGeoJSON: null as FeatureCollection<Point, TreeGeoJSONProperties> | null, // KUNCI PERBAIKAN
    initialMapCenter: { latitude: -2.5489, longitude: 118.0149, zoom: 5 },
    treeStatusCompositionData: { series: [] as number[], labels: [] as string[] },
    treeTrendData: { categories: [] as string[], series: [] as {name: string; type?: string; data: number[]}[] },
    problemTreesList: [] as ProblemTree[],
    error: errorMessage
});

export const load: PageServerLoad = async (event: PageServerLoadEvent) => {
    const loadStartTime = Date.now();
    const logPrefix = `[AnalyticsGano Load - ${new Date(loadStartTime).toISOString()}]`;

    console.log(`${logPrefix} Function execution started.`);
    const userSession = event.locals.user as UserSessionData | undefined;

    if (!userSession || !userSession.hasGanoAIAccess || !userSession.ganoAICompanyId) {
        console.warn(`${logPrefix} Invalid session or missing GanoAI companyId. Redirecting to sign-in.`);
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ganoAICompanyId;
    console.log(`${logPrefix} Target Company ID: ${companyIdToLoad}. User email: ${userSession.email}`);

    if (!ganoAIApp || !ganoAIDb) {
        console.error(`${logPrefix} CRITICAL: Firebase ganoAIApp or ganoAIDb is NOT INITIALIZED!`);
        return defaultErrorReturn('Konfigurasi Firebase GanoAI bermasalah.');
    }
    console.log(`${logPrefix} Firebase ganoAIApp and ganoAIDb instances appear available.`);

    try {
        let stepStartTime = Date.now();
        console.log(`${logPrefix} STEP 1: Fetching company document... (Company ID: ${companyIdToLoad})`);
        const companyRef = doc(ganoAIDb, 'company', companyIdToLoad);
        const companyDocSnap = await getDoc(companyRef);
        console.log(`${logPrefix} STEP 1 DONE. companyDocSnap.exists(): ${companyDocSnap.exists()}. Duration: ${Date.now() - stepStartTime}ms`);

        if (!companyDocSnap.exists()) {
            const msg = `Perusahaan dengan ID ${companyIdToLoad} tidak ditemukan di GanoAI.`;
            console.warn(`${logPrefix} ${msg}. Total time: ${Date.now() - loadStartTime}ms`);
            return defaultErrorReturn(msg);
        }
        const companyData = { id: companyDocSnap.id, ...companyDocSnap.data() } as Company;
        console.log(`${logPrefix} Company data for "${companyData.company_name}" (ID: ${companyData.id}) processed.`);

        stepStartTime = Date.now();
        console.log(`${logPrefix} STEP 2: Fetching users for company ${companyIdToLoad}...`);
        const usersMap = new Map<string, string>();
        const usersColRef = collection(ganoAIDb, 'users');
        const companyUsersQuery = query(usersColRef, where('companyId', '==', companyIdToLoad));
        const usersSnapshot = await getDocs(companyUsersQuery);
        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data() as User;
            usersMap.set(userDoc.id, userData.name || 'Tanpa Nama');
        });
        console.log(`${logPrefix} STEP 2 DONE. Fetched and mapped ${usersSnapshot.size} users. Duration: ${Date.now() - stepStartTime}ms`);

        stepStartTime = Date.now();
        console.log(`${logPrefix} STEP 3: Fetching trees for company ${companyIdToLoad}...`);
        const treesColRef = collection(ganoAIDb, `company/${companyIdToLoad}/tree`);
        const allTreesQuery = query(treesColRef, orderBy('date.updatedDate', 'desc'));
        const allTreesSnapshot = await getDocs(allTreesQuery);
        console.log(`${logPrefix} STEP 3 DONE. Fetched ${allTreesSnapshot.size} trees. Duration: ${Date.now() - stepStartTime}ms`);

        console.log(`${logPrefix} STEP 4: Processing ${allTreesSnapshot.size} trees...`);
        stepStartTime = Date.now();
        
        let totalTrees = 0;
        let kpiSickTrees = 0;
        let chartSickCount = 0;
        let chartRecoveredCount = 0;
        let chartMaintenanceCount = 0;
        let chartOtherStatusCount = 0;
        const treeFeatures: Feature<Point, TreeGeoJSONProperties>[] = [];
        let calculatedInitialMapCenter = { latitude: -2.5489, longitude: 118.0149, zoom: 5 };
        let foundTreeForCenter = false;
        const monthlyDataAgg: Record<string, { newTrees: number; newlySickTrees: number }> = {};
        const problemTreesList: ProblemTree[] = [];

        allTreesSnapshot.forEach((treeDoc: QueryDocumentSnapshot<DocumentData>) => { // <-- PERBAIKAN TIPE DI SINI
            totalTrees++;
            const rawTreeData = treeDoc.data();
            if (!rawTreeData) {
                console.warn(`${logPrefix} Found treeDoc with no data. ID: ${treeDoc.id}. Skipping.`);
                return; 
            }

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
                    geometry: { type: 'Point', coordinates: [rawTreeData.location.longitude, rawTreeData.location.latitude] },
                    properties: {
                        id: treeDoc.id, name: rawTreeData.name || `Pohon ID ${treeDoc.id.substring(0,6)}`,
                        last_status: rawTreeData.last_status || 'unknown', img: rawTreeData.img, description: rawTreeData.description
                    }
                });
            }
            // PERBAIKAN: Gunakan tipe FirebaseTimestamp dari $lib/types jika itu yang dimaksud untuk rawTreeData.date.createdDate
            const createdDateFirestore = rawTreeData.date?.createdDate as FirebaseTimestamp | undefined; 
            const updatedDateFirestore = rawTreeData.date?.updatedDate as FirebaseTimestamp | undefined;

            if (createdDateFirestore && typeof createdDateFirestore.toDate === 'function') {
                const jsCreatedDate = createdDateFirestore.toDate();
                const monthYear = `${jsCreatedDate.getFullYear()}-${String(jsCreatedDate.getMonth() + 1).padStart(2, '0')}`;
                if (!monthlyDataAgg[monthYear]) monthlyDataAgg[monthYear] = { newTrees: 0, newlySickTrees: 0 };
                monthlyDataAgg[monthYear].newTrees++;
            }
            if (rawTreeData.last_status === 'sick' && updatedDateFirestore && typeof updatedDateFirestore.toDate === 'function') {
                const jsUpdatedDate = updatedDateFirestore.toDate();
                const monthYear = `${jsUpdatedDate.getFullYear()}-${String(jsUpdatedDate.getMonth() + 1).padStart(2, '0')}`;
                if (!monthlyDataAgg[monthYear]) monthlyDataAgg[monthYear] = { newTrees: 0, newlySickTrees: 0 };
                monthlyDataAgg[monthYear].newlySickTrees++;
            }
            if (rawTreeData.last_status === 'sick' && problemTreesList.length < 10 && updatedDateFirestore && typeof updatedDateFirestore.toDate === 'function') {
                problemTreesList.push({
                    id: treeDoc.id,
                    name: rawTreeData.name || `Pohon ID ${treeDoc.id.substring(0,6)}`,
                    last_status: rawTreeData.last_status,
                    updatedDate: updatedDateFirestore.toDate().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }),
                    reportedBy: rawTreeData.userId ? usersMap.get(rawTreeData.userId) || rawTreeData.userId : 'Tidak diketahui',
                    img: rawTreeData.img,
                    description: rawTreeData.description?.substring(0, 50) + (rawTreeData.description && rawTreeData.description.length > 50 ? '...' : '')
                });
            }
        });
        console.log(`${logPrefix} STEP 4 DONE. Trees processed. Duration: ${Date.now() - stepStartTime}ms`);
        
        console.log(`${logPrefix} STEP 5: Constructing final data objects...`);
        stepStartTime = Date.now();
        const treeDataGeoJSON: FeatureCollection<Point, TreeGeoJSONProperties> = { type: 'FeatureCollection', features: treeFeatures };
        const percentageSickForKPI = totalTrees > 0 ? parseFloat(((kpiSickTrees / totalTrees) * 100).toFixed(1)) : 0;
        const statisticsData: StatisticCardType[] = [
            { icon: 'mdi:office-building-cog-outline', variant: 'primary', title: companyData.company_name || 'Nama Perusahaan', statistic: '' },
            { icon: 'mdi:tree-outline', variant: 'success', title: 'Total Pohon', statistic: totalTrees },
            { icon: 'mdi:virus-off-outline', variant: 'danger', title: 'Pohon Sakit (Ganoderma)', statistic: kpiSickTrees },
            { icon: 'mdi:chart-pie', variant: 'warning', title: 'Persentase Sakit', statistic: `${percentageSickForKPI}%` },
        ];
        const treeStatusCompositionData = {
            series: [chartRecoveredCount, chartSickCount, chartMaintenanceCount],
            labels: ['Sudah Pulih', 'Terkena Ganoderma', 'Dalam Perawatan']
        };
        if (chartOtherStatusCount > 0) {
            treeStatusCompositionData.series.push(chartOtherStatusCount);
            treeStatusCompositionData.labels.push('Status Lain');
        }
        const sortedMonths = Object.keys(monthlyDataAgg).sort().slice(-12);
        const treeTrendData = {
            categories: sortedMonths.map(month => {
                const [year, m] = month.split('-');
                return `${new Date(Number(year), Number(m) - 1).toLocaleString('id-ID', { month: 'short' })} '${year.substring(2)}`;
            }),
            series: [
                { name: 'Pohon Baru', type: 'bar', data: sortedMonths.map(month => monthlyDataAgg[month]?.newTrees || 0) },
                { name: 'Pohon Sakit Dilaporkan', type: 'line', data: sortedMonths.map(month => monthlyDataAgg[month]?.newlySickTrees || 0) }
            ]
        };
        console.log(`${logPrefix} STEP 5 DONE. Final data objects constructed. Duration: ${Date.now() - stepStartTime}ms`);

        console.log(`${logPrefix} All data processing complete. Total execution time: ${Date.now() - loadStartTime}ms. Returning successful data for company ${companyData.company_name}.`);
        return {
            mapboxAccessToken: MAPBOX_ACCESS_TOKEN_SERVER,
            companyName: companyData.company_name,
            statistics: statisticsData,
            treeDataGeoJSON: treeDataGeoJSON,
            initialMapCenter: calculatedInitialMapCenter,
            treeStatusCompositionData,
            treeTrendData,
            problemTreesList,
            error: null
        };

    } catch (error: any) {
        const errorMessage = `Gagal memuat data analytics (GanoAI): Terjadi kesalahan pada server - ${error.message}`;
        console.error(`${logPrefix} EXCEPTION CAUGHT. Total execution time before error: ${Date.now() - loadStartTime}ms.`);
        console.error(`${logPrefix} Error Message: ${error.message}`);
        console.error(`${logPrefix} Error Stack: ${error.stack}`);
        if (error.code) console.error(`${logPrefix} Firebase Error Code: ${error.code}`);
        
        return defaultErrorReturn(errorMessage);
    }
};