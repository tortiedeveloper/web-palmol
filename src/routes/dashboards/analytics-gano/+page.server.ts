// src/routes/dashboards/analytics-gano/+page.server.ts
import { ganoAIDb } from '$lib/firebase/ganoAIClient';
import { collection, doc, getDoc, getDocs, query, where, Timestamp as FirebaseTimestampType, orderBy, getCountFromServer } from 'firebase/firestore';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoadEvent, PageServerLoad } from './$types';
import type { StatisticCardType, Company, Tree, TreeGeoJSONProperties, User, FirebaseTimestamp, TreeDate, UserSessionData } from '$lib/types';
import type { FeatureCollection, Point, Feature } from 'geojson';

// Hapus interface MonthlyTreeData dan ProblemTree jika sudah ada di $lib/types atau tidak spesifik hanya di sini
// Interface ini bisa dipindah ke $lib/types jika dipakai di tempat lain juga
interface MonthlyTreeData { /* ... definisi ... */
    month: string;
    newTrees: number;
    newlySickTrees: number;
}
interface ProblemTree { /* ... definisi ... */
    id: string;
    name: string;
    last_status: string;
    updatedDate: string;
    reportedBy?: string;
    img?: string;
    description?: string;
}


function formatDisplayDate(timestamp: FirebaseTimestampType | undefined | null): string {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return timestamp.toDate().toLocaleDateString('id-ID', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

export const load: PageServerLoad = async (event: PageServerLoadEvent) => {
    const userSession = event.locals.user as UserSessionData | undefined;

    // PERBAIKAN UTAMA: Gunakan companyId dari userSession yang diisi oleh hooks.server.ts
    if (!userSession || !userSession.hasGanoAIAccess || !userSession.ganoAICompanyId) {
       
        console.warn("[AnalyticsGano Load] Sesi GanoAI tidak valid atau companyId tidak ada, redirecting ke login.");
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ganoAICompanyId;
   

    console.log(`[AnalyticsGano Load] Memuat data untuk perusahaan ID GanoAI: ${companyIdToLoad}`);

    try {
        const companyRef = doc(ganoAIDb, 'company', companyIdToLoad);
        const companyDocSnap = await getDoc(companyRef);

        if (!companyDocSnap.exists()) {
            throw new Error(`Perusahaan dengan ID ${companyIdToLoad} tidak ditemukan di GanoAI.`);
        }
        const companyData = { id: companyDocSnap.id, ...companyDocSnap.data() } as Company;

        const usersMap = new Map<string, string>();
        const usersColRef = collection(ganoAIDb, 'users');
        const companyUsersQuery = query(usersColRef, where('companyId', '==', companyIdToLoad));
        const usersSnapshot = await getDocs(companyUsersQuery);
        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data() as User;
            usersMap.set(userDoc.id, userData.name || 'Tanpa Nama');
        });

        const treesColRef = collection(ganoAIDb, `company/${companyIdToLoad}/tree`);
        const allTreesQuery = query(treesColRef, orderBy('date.updatedDate', 'desc'));
        const allTreesSnapshot = await getDocs(allTreesQuery);
        
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

        allTreesSnapshot.forEach(treeDoc => {
            totalTrees++;
            const rawTreeData = treeDoc.data();
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
            const createdDateFirestore = rawTreeData.date?.createdDate as FirebaseTimestampType | undefined;
            const updatedDateFirestore = rawTreeData.date?.updatedDate as FirebaseTimestampType | undefined;
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
                { name: 'Pohon Baru', type: 'bar', data: sortedMonths.map(month => monthlyDataAgg[month].newTrees) },
                { name: 'Pohon Sakit Dilaporkan', type: 'line', data: sortedMonths.map(month => monthlyDataAgg[month].newlySickTrees) }
            ]
        };

        return {
            mapboxAccessToken: 'pk.eyJ1IjoidG9ydGlla3JlYXRpZiIsImEiOiJjbTc3bWlpY24weGYyMmpwamxzYnMyYzg2In0.vkOZJGRpZusCylE9PVVmOQ', // Sebaiknya dari environment variable
            companyName: companyData.company_name,
            statistics: statisticsData,
            treeDataGeoJSON: treeDataGeoJSON,
            initialMapCenter: calculatedInitialMapCenter,
            treeStatusCompositionData,
            treeTrendData,
            problemTreesList
        };

    } catch (error: any) {
        console.error(`Error di load function analytics-gano untuk companyId ${companyIdToLoad}:`, error);
        return {
            // ... (struktur data error yang sama seperti sebelumnya, pastikan semua field ada)
            mapboxAccessToken: 'pk.eyJ1IjoidG9ydGlla3JlYXRpZiIsImEiOiJjbTc3bWlpY24weGYyMmpwamxzYnMyYzg2In0.vkOZJGRpZusCylE9PVVmOQ',
            companyName: "Error", statistics: [],
            treeDataGeoJSON: { type: 'FeatureCollection', features: [] } as FeatureCollection<Point, TreeGeoJSONProperties>,
            initialMapCenter: { latitude: -2.5489, longitude: 118.0149, zoom: 5 },
            treeStatusCompositionData: { series: [], labels: [] }, treeTrendData: { categories: [], series: [] },
            problemTreesList: [],
            error: `Gagal memuat data analytics: ${error.message}`
        };
    }
};