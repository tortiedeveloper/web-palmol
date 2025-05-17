// src/routes/dashboards/analytics-ripeness/+page.server.ts
import { ripenessDb } from '$lib/firebase/ripenessClient'; // Gunakan DB Ripeness
import { collection, doc, getDoc, getDocs, query, where, Timestamp as FirebaseTimestampType, orderBy } from 'firebase/firestore';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoadEvent, PageServerLoad } from './$types';
import type { 
    StatisticCardType, Company, Tree as RipenessTree, TreeGeoJSONProperties, User, FirebaseTimestamp, UserSessionData 
} from '$lib/types'; // Kita bisa reuse tipe Tree jika field intinya sama, atau buat RipenessTreeType
import type { FeatureCollection, Point, Feature } from 'geojson';


interface RipenessMonthlyData {
    month: string;
    totalMatang: number;
    // tambahkan metrik lain jika perlu, misal totalPanen
}

interface HarvestReadyTree { // Mirip ProblemTree tapi untuk Ripeness
    id: string;
    name: string;
    fruitCounts: { belumMatang: number; matang: number; terlaluMatang: number; };
    updatedDate: string;
    reportedBy?: string;
    img?: string;
}

function formatDisplayDate(timestamp: FirebaseTimestampType | undefined | null): string {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return timestamp.toDate().toLocaleDateString('id-ID', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

export const load: PageServerLoad = async (event: PageServerLoadEvent) => {
    const userSession = event.locals.user as UserSessionData | undefined;

    if (!userSession || !userSession.hasRipenessAccess || !userSession.ripenessCompanyId) {
        console.warn("[AnalyticsRipeness Load] Sesi Ripeness tidak valid atau companyId tidak ada, redirecting ke login.");
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;
    const mapboxAccessToken = 'pk.eyJ1IjoidG9ydGlla3JlYXRpZiIsImEiOiJjbTc3bWlpY24weGYyMmpwamxzYnMyYzg2In0.vkOZJGRpZusCylE9PVVmOQ'; // Dari env var idealnya

    console.log(`[AnalyticsRipeness Load] Memuat data untuk perusahaan ID Ripeness: ${companyIdToLoad}`);

    try {
        const companyRef = doc(ripenessDb, 'company', companyIdToLoad);
        const companyDocSnap = await getDoc(companyRef);

        if (!companyDocSnap.exists()) {
            throw new Error(`Perusahaan dengan ID ${companyIdToLoad} tidak ditemukan di Ripeness.`);
        }
        const companyData = { id: companyDocSnap.id, ...companyDocSnap.data() } as Company;

        const usersMap = new Map<string, string>();
        const usersColRef = collection(ripenessDb, 'users'); // Ambil dari users di Ripeness DB
        const companyUsersQuery = query(usersColRef, where('companyId', '==', companyIdToLoad));
        const usersSnapshot = await getDocs(companyUsersQuery);
        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data() as User;
            usersMap.set(userDoc.id, userData.name || 'Tanpa Nama');
        });

        const treesColRef = collection(ripenessDb, `company/${companyIdToLoad}/tree`);
        const allTreesQuery = query(treesColRef, orderBy('date.updatedDate', 'desc'));
        const allTreesSnapshot = await getDocs(allTreesQuery);
        
        let totalRipenessTrees = 0;
        let totalBuahMatang = 0;
        let totalBuahBelumMatang = 0;
        let totalBuahTerlaluMatang = 0;
        
        const treeFeatures: Feature<Point, TreeGeoJSONProperties>[] = []; // Anda mungkin perlu TreeGeoJSONProperties versi Ripeness
        let calculatedInitialMapCenter = { latitude: -2.5489, longitude: 118.0149, zoom: 5 };
        let foundTreeForCenter = false;
        const monthlyRipenessDataAgg: Record<string, { totalMatang: number }> = {};
        const harvestReadyTreesList: HarvestReadyTree[] = [];

        allTreesSnapshot.forEach(treeDoc => {
            totalRipenessTrees++;
            const rawTreeData = treeDoc.data();
            const tree = { id: treeDoc.id, ...rawTreeData } as RipenessTree; // Gunakan tipe RipenessTree

            const fc = tree.fruitCounts || { belumMatang: 0, matang: 0, terlaluMatang: 0 };
            totalBuahMatang += fc.matang;
            totalBuahBelumMatang += fc.belumMatang;
            totalBuahTerlaluMatang += fc.terlaluMatang;

            console.log(`Pohon ID: ${treeDoc.id}, Nama: ${rawTreeData.name}, Raw FruitCounts:`, rawTreeData.fruitCounts, "Processed fc:", fc); // DEBUG BARU

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
                        id: treeDoc.id, 
                        name: rawTreeData.name || `Pohon ID ${treeDoc.id.substring(0,6)}`,
                        img: rawTreeData.img, 
                        description: rawTreeData.description,
                        // Pastikan fc adalah objek POJO sederhana
                        fruitCounts: { 
                            matang: fc.matang || 0, 
                            belumMatang: fc.belumMatang || 0, 
                            terlaluMatang: fc.terlaluMatang || 0 
                        }
                    } as TreeGeoJSONProperties
                });
            }

            const updatedDateFirestore = rawTreeData.date?.updatedDate as FirebaseTimestampType | undefined;
            if (updatedDateFirestore && typeof updatedDateFirestore.toDate === 'function') {
                const jsUpdatedDate = updatedDateFirestore.toDate();
                const monthYear = `${jsUpdatedDate.getFullYear()}-${String(jsUpdatedDate.getMonth() + 1).padStart(2, '0')}`;
                if (!monthlyRipenessDataAgg[monthYear]) monthlyRipenessDataAgg[monthYear] = { totalMatang: 0 };
                monthlyRipenessDataAgg[monthYear].totalMatang += fc.matang;
            }

            if (fc.matang > 0 && harvestReadyTreesList.length < 10) { // Contoh sederhana untuk "siap panen"
                harvestReadyTreesList.push({
                    id: treeDoc.id,
                    name: rawTreeData.name || `Pohon ID ${treeDoc.id.substring(0,6)}`,
                    fruitCounts: fc,
                    updatedDate: formatDisplayDate(updatedDateFirestore),
                    reportedBy: rawTreeData.userId ? usersMap.get(rawTreeData.userId) || rawTreeData.userId : 'Tidak diketahui',
                    img: rawTreeData.img,
                });
            }
        });
        
        const treeDataGeoJSON: FeatureCollection<Point, TreeGeoJSONProperties> = { type: 'FeatureCollection', features: treeFeatures };
        const totalSemuaBuah = totalBuahMatang + totalBuahBelumMatang + totalBuahTerlaluMatang;
        const persentaseMatangIdeal = totalSemuaBuah > 0 ? parseFloat(((totalBuahMatang / totalSemuaBuah) * 100).toFixed(1)) : 0;

        const statisticsData: StatisticCardType[] = [
            { icon: 'mdi:office-building-cog-outline', variant: 'primary', title: companyData.company_name || 'Nama Perusahaan', statistic: '' },
            { icon: 'mdi:tree-outline', variant: 'info', title: 'Total Pohon (Ripeness)', statistic: totalRipenessTrees },
            { icon: 'mdi:fruit-cherries', variant: 'success', title: 'Estimasi Buah Matang', statistic: totalBuahMatang, suffix: ' buah' },
            { icon: 'mdi:chart-line-variant', variant: 'warning', title: 'Persentase Kematangan', statistic: `${persentaseMatangIdeal}%` },
        ];
        
        const fruitCompositionData = {
            series: [totalBuahMatang, totalBuahBelumMatang, totalBuahTerlaluMatang],
            labels: ['Matang', 'Belum Matang', 'Terlalu Matang']
        };
        
        const sortedMonths = Object.keys(monthlyRipenessDataAgg).sort().slice(-12);
        const fruitTrendData = {
            categories: sortedMonths.map(month => { /* ... format bulan ... */
                const [year, m] = month.split('-');
                return `${new Date(Number(year), Number(m) - 1).toLocaleString('id-ID', { month: 'short' })} '${year.substring(2)}`;
            }),
            series: [
                { name: 'Total Buah Matang', type: 'line', data: sortedMonths.map(month => monthlyRipenessDataAgg[month].totalMatang) }
            ]
        };

        return {
            mapboxAccessToken, companyName: companyData.company_name, statistics: statisticsData,
            treeDataGeoJSON, initialMapCenter: calculatedInitialMapCenter,
            fruitCompositionData, fruitTrendData, harvestReadyTreesList
        };

    } catch (error: any) {
        console.error(`Error di load function analytics-ripeness untuk companyId ${companyIdToLoad}:`, error);
        // PERBAIKAN: Kembalikan null atau FeatureCollection yang valid untuk treeDataGeoJSON
        return {
            mapboxAccessToken,
            companyName: "Error", 
            statistics: [],
            treeDataGeoJSON: null, // Lebih aman mengembalikan null
            // Atau jika ingin tetap objek FeatureCollection:
            // treeDataGeoJSON: { type: 'FeatureCollection', features: [] as Feature<Point, TreeGeoJSONProperties>[] } ,
            initialMapCenter: { latitude: -2.5489, longitude: 118.0149, zoom: 5 },
            fruitCompositionData: { series: [], labels: [] }, 
            fruitTrendData: { categories: [], series: [] },
            harvestReadyTreesList: [],
            error: `Gagal memuat data Ripeness Analytics: ${error.message}`
        };
    }
};