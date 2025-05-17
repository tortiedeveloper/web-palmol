// src/routes/dashboards/analytics-palmol/+page.server.ts
import { ripenessDb } from '$lib/firebase/ripenessClient';
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    Timestamp, // Impor Timestamp sebagai nilai
    orderBy, 
    type Timestamp as FirebaseTimestampType, 
    type QueryDocumentSnapshot,
    type DocumentData
} from 'firebase/firestore';
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { 
    UserSessionData, 
    PKS, 
    PKSTeam, 
    PKSUser, 
    PKSReport,
    StatisticCardType,
    AppError // Pastikan AppError diimpor jika PageData Anda secara eksplisit mereferensikannya
} from '$lib/types';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
dayjs.locale('id');

interface AggregateData {
    totalBeratKeseluruhan: number;
    totalLaporan: number;
    jumlahPksAktif: number;
    jumlahTimAktif: number;
    avgBeratPerLaporan: number;
}

interface ChartData {
    categories: string[];
    series: { name: string; data: number[]; type?: string }[];
}

interface PKSFilterItem { 
    id: string; 
    name: string; 
}

// Tipe ini digunakan untuk hasil akhir peringkat
interface TopPerformer {
    id: string;
    name: string;
    totalBerat: number;
    reportCount: number; // Menggunakan reportCount konsisten
    avgBeratPerReport: number;
}

// Tipe untuk agregasi internal sebelum mapping ke TopPerformer
interface TeamProductivityDetail {
    name: string;           // Nama Tim
    pksName: string;        // Nama PKS asal tim
    totalBerat: number;
    reportCount: number;
}

interface ReporterProductivityDetail {
    name: string;           // Nama Reporter
    totalBerat: number;
    reportCount: number;
}


export const load: PageServerLoad = async ({ locals, url }) => {
    const userSession = locals.user as UserSessionData | undefined;

    if (!userSession || !userSession.hasRipenessAccess || !userSession.ripenessCompanyId) {
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;
    const mapboxAccessToken = 'pk.eyJ1IjoidG9ydGlla3JlYXRpZiIsImEiOiJjbTc3bWlpY24weGYyMmpwamxzYnMyYzg2In0.vkOZJGRpZusCylE9PVVmOQ';

    const startDateStr = url.searchParams.get('startDate');
    const endDateStr = url.searchParams.get('endDate');
    const filterPksId = url.searchParams.get('pksId');

    let filterStartDateForQuery: Date | undefined = undefined;
    let filterEndDateForQuery: Date | undefined = undefined;
    let isDateEffectivelyFiltered = false; // Deklarasi
    let isPksFiltered = !!filterPksId;

    if (startDateStr) {
        const parsed = dayjs(startDateStr);
        if (parsed.isValid()) { filterStartDateForQuery = parsed.startOf('day').toDate(); isDateEffectivelyFiltered = true; }
    }
    if (endDateStr) {
        const parsed = dayjs(endDateStr);
        if (parsed.isValid()) { filterEndDateForQuery = parsed.endOf('day').toDate(); isDateEffectivelyFiltered = true; }
    }
    if (filterStartDateForQuery && !filterEndDateForQuery && startDateStr) {
        filterEndDateForQuery = dayjs().endOf('day').toDate();
    }
    if (filterStartDateForQuery && filterEndDateForQuery && filterStartDateForQuery > filterEndDateForQuery) {
        filterStartDateForQuery = undefined; filterEndDateForQuery = undefined; isDateEffectivelyFiltered = false;
    }
    const isCurrentlyFiltered = isDateEffectivelyFiltered || isPksFiltered;

    try {
        const pksQuery = query(collection(ripenessDb, 'pks'), where('companyId', '==', companyIdToLoad), orderBy('pksName', 'asc'));
        const pksSnapshots = await getDocs(pksQuery);
        const allPksData: PKS[] = pksSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as PKS));
        const pksListForFilter = allPksData.map(p => ({ id: p.id, name: p.pksName || `PKS (${p.id.substring(0,6)})` }));
        const pksNameCache = new Map<string, string>(allPksData.map(p => [p.id, p.pksName || `PKS (${p.id.substring(0,6)})`]));

        let allReports: PKSReport[] = [];
        const pksToQueryFrom = filterPksId ? allPksData.filter(p => p.id === filterPksId) : allPksData;

        if (filterPksId && pksToQueryFrom.length === 0) {
             return {
                statistics: [], trendChartData: null, pksContributionChartData: null, topTeams: [], topReporters: [],
                pksListForFilter, selectedPksId: filterPksId, startDate: startDateStr, endDate: endDateStr,
                isCurrentlyFiltered, companyName: userSession.email,
                message: `PKS dengan ID ${filterPksId} tidak ditemukan atau bukan milik perusahaan Anda.`
            };
        }
         if (pksToQueryFrom.length === 0 && allPksData.length === 0) {
             return {
                statistics: [], trendChartData: null, pksContributionChartData: null, topTeams: [], topReporters: [],
                pksListForFilter, selectedPksId: filterPksId, startDate: startDateStr, endDate: endDateStr,
                isCurrentlyFiltered, companyName: userSession.email,
                message: 'Tidak ada PKS yang terdaftar untuk perusahaan Anda.'
            };
        }

        const usersCache = new Map<string, string>();
        const teamsCache = new Map<string, string>(); // Cukup simpan nama tim berdasarkan teamId_pksId

        for (const pks of pksToQueryFrom) {
            const reportsColRef = collection(ripenessDb, `pks/${pks.id}/reports`);
            let q = query(reportsColRef);
            if (filterStartDateForQuery) q = query(q, where('date', '>=', Timestamp.fromDate(filterStartDateForQuery)));
            if (filterEndDateForQuery) q = query(q, where('date', '<=', Timestamp.fromDate(filterEndDateForQuery)));   
            
            const reportDocs = await getDocs(q);
            for (const reportDoc of reportDocs.docs) {
                const data = reportDoc.data();
                let userName = data.userId || 'N/A';
                if (data.userId && usersCache.has(data.userId)) { userName = usersCache.get(data.userId)!; }
                else if (data.userId) { 
                    try {
                        const userDocRef = doc(ripenessDb, 'pksUsers', data.userId);
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            userName = (userDocSnap.data() as PKSUser).name || data.userId;
                            usersCache.set(data.userId, userName);
                        } else { usersCache.set(data.userId, data.userId); }
                    } catch (e) { console.error("Error fetching user:", data.userId, e); usersCache.set(data.userId, data.userId); }
                }

                let teamNameResolved = data.teamId ? `Tim (${data.teamId.substring(0,6)})` : 'Laporan PKS';
                if (data.teamId) {
                     const teamCacheKey = `${pks.id}_${data.teamId}`;
                    if (teamsCache.has(teamCacheKey)) { teamNameResolved = teamsCache.get(teamCacheKey)!; }
                    else { try {
                            const teamDocRef = doc(ripenessDb, `pks/${pks.id}/teams`, data.teamId);
                            const teamDocSnap = await getDoc(teamDocRef);
                            if (teamDocSnap.exists()) {
                                teamNameResolved = (teamDocSnap.data() as PKSTeam).teamName || teamNameResolved;
                                teamsCache.set(teamCacheKey, teamNameResolved);
                            } else { teamsCache.set(teamCacheKey, teamNameResolved); }
                        } catch (e) { console.error("Error fetching team:", data.teamId, e); teamsCache.set(teamCacheKey, teamNameResolved);}
                    }
                }
                
                const reportDate = (data.date as FirebaseTimestampType)?.toDate();
                allReports.push({
                    id: reportDoc.id, pksId: pks.id, pksName: pks.pksName, teamId: data.teamId, teamName: teamNameResolved,
                    userId: data.userId, userName: userName, jumlahBerat: Number(data.jumlahBerat) || 0,
                    date: reportDate ? dayjs(reportDate).format('DD MMM YY, HH:mm') : 'N/A',
                    originalDate: reportDate ? reportDate.toISOString() : null, img: data.imgUrl || data.img || null,
                });
            }
        }
        allReports.sort((a, b) => (new Date(b.originalDate!).getTime()) - (new Date(a.originalDate!).getTime()));

        const totalBeratKeseluruhan = allReports.reduce((sum, r) => sum + r.jumlahBerat, 0);
        const totalLaporan = allReports.length;
        const uniquePksIdsInReports = new Set(allReports.map(r => r.pksId));
        const uniqueTeamIdsInReports = new Set(allReports.map(r => r.teamId).filter(Boolean));
        const aggregateData: AggregateData = {
            totalBeratKeseluruhan, totalLaporan,
            jumlahPksAktif: uniquePksIdsInReports.size, jumlahTimAktif: uniqueTeamIdsInReports.size,
            avgBeratPerLaporan: totalLaporan > 0 ? parseFloat((totalBeratKeseluruhan / totalLaporan).toFixed(2)) : 0,
        };
        const statistics: StatisticCardType[] = [
            { icon: 'mdi:weight-kilogram', variant: 'primary', title: 'Total Berat Panen', statistic: `${aggregateData.totalBeratKeseluruhan.toLocaleString('id-ID')} kg` },
            { icon: 'mdi:file-chart-outline', variant: 'info', title: 'Total Laporan', statistic: aggregateData.totalLaporan.toLocaleString('id-ID') },
            { icon: 'mdi:factory', variant: 'success', title: 'PKS Berkontribusi', statistic: aggregateData.jumlahPksAktif },
            { icon: 'mdi:account-group-outline', variant: 'warning', title: 'Tim Berkontribusi', statistic: aggregateData.jumlahTimAktif },
        ];
        
        const monthlyTrend: { [monthYear: string]: { totalBerat: number, reportCount: number } } = {};
        const endDateForTrend = filterEndDateForQuery ? dayjs(filterEndDateForQuery) : dayjs();
        for (let i = 11; i >= 0; i--) { 
            const monthTarget = endDateForTrend.subtract(i, 'month');
            monthlyTrend[monthTarget.format('YYYY-MM')] = { totalBerat: 0, reportCount: 0 };
        }
        allReports.forEach(report => {
            if (report.originalDate) {
                const monthYear = dayjs(report.originalDate).format('YYYY-MM');
                if (monthlyTrend[monthYear]) {
                    monthlyTrend[monthYear].totalBerat += report.jumlahBerat;
                    monthlyTrend[monthYear].reportCount++;
                }
            }
        });
        const trendChartData = {
            categories: Object.keys(monthlyTrend).map(my => dayjs(my + '-01').format('MMM YY')),
            series: [
                { name: 'Total Berat (kg)', type: 'area', data: Object.values(monthlyTrend).map(d => d.totalBerat) },
                { name: 'Jumlah Laporan', type: 'line', data: Object.values(monthlyTrend).map(d => d.reportCount) }
            ]
        };

        const pksContribution: { [pksId: string]: number } = {};
        allReports.forEach(report => { pksContribution[report.pksId] = (pksContribution[report.pksId] || 0) + report.jumlahBerat; });
        const sortedPksContribution = Object.entries(pksContribution).map(([id, value]) => ({ id, name: pksNameCache.get(id) || id, value })).sort((a, b) => b.value - a.value);
        const topPksCount = 5;
        const pksPieData: number[] = [];
        const pksPieLabels: string[] = [];
        let othersValue = 0;
        sortedPksContribution.forEach((p, index) => {
            if (index < topPksCount) { pksPieLabels.push(p.name); pksPieData.push(p.value); } 
            else { othersValue += p.value; }
        });
        if (othersValue > 0) { pksPieLabels.push("PKS Lainnya"); pksPieData.push(othersValue); }
        
        // PERBAIKAN: Gunakan TeamProductivityDetail untuk agregasi internal
        const teamProductivity: { [teamKey: string]: TeamProductivityDetail } = {};
        allReports.forEach(report => {
            if (report.teamId && report.teamName && report.pksName) { 
                const key = `${report.pksId}_${report.teamId}`;
                if (!teamProductivity[key]) {
                    teamProductivity[key] = { 
                        name: report.teamName, 
                        pksName: report.pksName, 
                        totalBerat: 0, 
                        reportCount: 0 
                    };
                }
                teamProductivity[key].totalBerat += report.jumlahBerat;
                teamProductivity[key].reportCount++;
            }
        });
        const topTeams: TopPerformer[] = Object.values(teamProductivity)
            .map(t => ({ 
                id: `${t.pksName}-${t.name}`, // Buat ID yang lebih unik untuk key
                name: `${t.name} (${t.pksName})`, 
                totalBerat: t.totalBerat, 
                reportCount: t.reportCount, 
                avgBeratPerReport: t.reportCount > 0 ? parseFloat((t.totalBerat / t.reportCount).toFixed(1)) : 0 
            }))
            .sort((a, b) => b.totalBerat - a.totalBerat).slice(0, 10);

        // PERBAIKAN: Gunakan ReporterProductivityDetail untuk agregasi internal
        const reporterProductivity: { [userId: string]: ReporterProductivityDetail } = {};
         allReports.forEach(report => {
            if (report.userId && report.userName) {
                if (!reporterProductivity[report.userId]) {
                    reporterProductivity[report.userId] = { 
                        name: report.userName, 
                        totalBerat: 0, 
                        reportCount: 0 
                    };
                }
                reporterProductivity[report.userId].totalBerat += report.jumlahBerat;
                reporterProductivity[report.userId].reportCount++;
            }
        });
        const topReporters: TopPerformer[] = Object.values(reporterProductivity)
            .map(r => ({ 
                id: r.name, // Asumsi nama reporter cukup unik untuk key, atau gunakan userId jika perlu
                name: r.name, 
                totalBerat: r.totalBerat, 
                reportCount: r.reportCount, 
                avgBeratPerReport: r.reportCount > 0 ? parseFloat((r.totalBerat / r.reportCount).toFixed(1)) : 0 
            }))
            .sort((a, b) => b.totalBerat - a.totalBerat).slice(0, 10);

        return {
            statistics, trendChartData,
            pksContributionChartData: pksPieData.length > 0 ? { series: pksPieData, labels: pksPieLabels } : null,
            topTeams, topReporters,
            pksListForFilter, 
            selectedPksId: filterPksId || undefined,
            startDate: startDateStr || undefined,
            endDate: endDateStr || undefined,
            isCurrentlyFiltered,
            companyName: userSession.email,
            message: allReports.length === 0 ? (isCurrentlyFiltered ? 'Tidak ada data untuk filter ini.' : 'Belum ada laporan.') : null,
            mapboxAccessToken
        };
    } catch (error: any) {
        console.error(`[AnalyticsPalmol Load] Error:`, error);
        throw svelteKitError(500, `Gagal memuat data analitik: ${error.message}`);
    }
};