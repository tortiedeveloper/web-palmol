// src/routes/dashboards/analytics-palmol/+page.server.ts
import { ripenessDbAdmin } from '$lib/server/adminRipeness';
import admin from 'firebase-admin';
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type {
    UserSessionData,
    PKS,
    PKSTeam,
    PKSUser,
    PKSReport,
    StatisticCardType
    // AppError tidak perlu diimpor jika kita throw svelteKitError
} from '$lib/types';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
dayjs.locale('id');

// Interface untuk data yang dikembalikan ke klien
interface PalmolAnalyticsPageData {
    statistics: StatisticCardType[];
    trendChartData: ChartData | null;
    pksContributionChartData: { series: number[]; labels: string[] } | null;
    topTeams: TopPerformer[];
    topReporters: TopPerformer[];
    pksListForFilter: PKSFilterItem[];
    selectedPksId?: string; // Opsional
    startDate?: string;     // Opsional
    endDate?: string;       // Opsional
    isCurrentlyFiltered: boolean;
    companyName?: string;
    message: string | null;
    mapboxAccessToken: string; // Tambahkan ini
}

interface AggregateData { /* ... sama seperti sebelumnya ... */
    totalBeratKeseluruhan: number;
    totalLaporan: number;
    jumlahPksAktif: number;
    jumlahTimAktif: number;
    avgBeratPerLaporan: number;
}
interface ChartData { /* ... sama seperti sebelumnya ... */
    categories: string[];
    series: { name: string; data: number[]; type?: string }[];
}
interface PKSFilterItem { id: string; name: string; }
interface TopPerformer { /* ... sama seperti sebelumnya ... */
    id: string;
    name: string;
    totalBerat: number;
    reportCount: number;
    avgBeratPerReport: number;
    pksName?: string;
}

function serializeAdminTimestamp(timestamp: admin.firestore.Timestamp | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

function formatDisplayDateFromISO(isoString: string | null | undefined): string {
    if (!isoString) return 'N/A';
    return dayjs(isoString).format('DD MMM YY, HH:mm');
}

export const load: PageServerLoad = async ({ locals, url }): Promise<PalmolAnalyticsPageData> => {
    const userSession = locals.user as UserSessionData | undefined;

    if (!userSession?.hasRipenessAccess || !userSession.ripenessCompanyId) {
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;
    const mapboxAccessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

    if (!ripenessDbAdmin) {
        console.error("[AnalyticsPalmol Server Load] Ripeness Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data analitik Palmol tidak tersedia saat ini.");
    }

    const startDateStr = url.searchParams.get('startDate'); // string | null
    const endDateStr = url.searchParams.get('endDate');     // string | null
    const filterPksId = url.searchParams.get('pksId');       // string | null

    let filterStartDateForQuery: Date | undefined = undefined;
    let filterEndDateForQuery: Date | undefined = undefined;
    let isDateEffectivelyFiltered = false;
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
        const db = ripenessDbAdmin; // Gunakan variabel lokal non-null
        const pksCollectionRef = db.collection('pks');
        const pksBaseQuery = pksCollectionRef.where('companyId', '==', companyIdToLoad).orderBy('pksName', 'asc');
        const pksFilterSnapshots = await pksBaseQuery.get();
        const allPksData: PKS[] = pksFilterSnapshots.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<PKS, 'id'>) }));
        const pksListForFilter = allPksData.map(p => ({ id: p.id, name: p.pksName || `PKS (${p.id.substring(0, 6)})` }));
        const pksNameCache = new Map<string, string>(allPksData.map(p => [p.id, p.pksName || `PKS (${p.id.substring(0, 6)})`]));

        let pksDocsToQueryFrom = filterPksId ? allPksData.filter(p => p.id === filterPksId) : allPksData;

        // Penanganan jika PKS yang difilter tidak valid atau tidak ada PKS sama sekali
        if (filterPksId && pksDocsToQueryFrom.length === 0) {
            return {
                statistics: [], trendChartData: null, pksContributionChartData: null, topTeams: [], topReporters: [],
                pksListForFilter,
                selectedPksId: filterPksId || undefined, // Konversi null ke undefined
                startDate: startDateStr || undefined,   // Konversi null ke undefined
                endDate: endDateStr || undefined,       // Konversi null ke undefined
                isCurrentlyFiltered, companyName: userSession.email, mapboxAccessToken,
                message: `PKS dengan ID "${filterPksId}" tidak ditemukan atau bukan milik perusahaan Anda.`
            };
        }
        if (pksDocsToQueryFrom.length === 0 && allPksData.length === 0) {
             return {
                statistics: [], trendChartData: null, pksContributionChartData: null, topTeams: [], topReporters: [],
                pksListForFilter,
                selectedPksId: filterPksId || undefined,
                startDate: startDateStr || undefined,
                endDate: endDateStr || undefined,
                isCurrentlyFiltered, companyName: userSession.email, mapboxAccessToken,
                message: 'Tidak ada PKS yang terdaftar untuk perusahaan Anda.'
            };
        }

        const allReports: PKSReport[] = [];
        const usersCache = new Map<string, string>();
        const teamsCacheOnServer = new Map<string, string>();

        for (const pks of pksDocsToQueryFrom) {
            const reportsColRef = db.collection(`pks/${pks.id}/reports`);
            let currentReportsQuery: admin.firestore.Query = reportsColRef;

            if (filterStartDateForQuery) {
                currentReportsQuery = currentReportsQuery.where('date', '>=', admin.firestore.Timestamp.fromDate(filterStartDateForQuery));
            }
            if (filterEndDateForQuery) {
                currentReportsQuery = currentReportsQuery.where('date', '<=', admin.firestore.Timestamp.fromDate(filterEndDateForQuery));
            }
            // Tidak ada orderBy('date') di sini, akan di-sort nanti setelah semua data terkumpul

            const reportDocsSnapshot = await currentReportsQuery.get();
            for (const reportDoc of reportDocsSnapshot.docs) {
                const data = reportDoc.data();
                const reportDateFirestore = data.date as admin.firestore.Timestamp | undefined;
                const originalDateISO = serializeAdminTimestamp(reportDateFirestore);

                let userName = data.userId || 'N/A';
                if (data.userId && usersCache.has(data.userId)) { userName = usersCache.get(data.userId)!; }
                else if (data.userId) {
                    try {
                        const userDocRef = db.collection('pksUsers').doc(data.userId);
                        const userDocSnap = await userDocRef.get();
                        if (userDocSnap.exists) {
                            userName = (userDocSnap.data() as PKSUser).name || data.userId;
                            usersCache.set(data.userId, userName);
                        } else { usersCache.set(data.userId, data.userId); }
                    } catch (e) { console.warn(`Error fetching user ${data.userId}:`, e); usersCache.set(data.userId, data.userId); }
                }

                let teamNameResolved = data.teamId ? `Tim (${data.teamId.substring(0, 6)})` : 'Laporan PKS';
                if (data.teamId) {
                    const teamCacheKey = `${pks.id}_${data.teamId}`;
                    if (teamsCacheOnServer.has(teamCacheKey)) { teamNameResolved = teamsCacheOnServer.get(teamCacheKey)!; }
                    else {
                        try {
                            const teamDocRef = db.collection(`pks/${pks.id}/teams`).doc(data.teamId);
                            const teamDocSnap = await teamDocRef.get();
                            if (teamDocSnap.exists) {
                                teamNameResolved = (teamDocSnap.data() as PKSTeam).teamName || teamNameResolved;
                                teamsCacheOnServer.set(teamCacheKey, teamNameResolved);
                            } else { teamsCacheOnServer.set(teamCacheKey, teamNameResolved); }
                        } catch (e) { console.warn(`Error fetching team ${data.teamId} for PKS ${pks.id}:`, e); teamsCacheOnServer.set(teamCacheKey, teamNameResolved); }
                    }
                }

                allReports.push({
                    id: reportDoc.id, pksId: pks.id, pksName: pks.pksName, teamId: data.teamId, teamName: teamNameResolved,
                    userId: data.userId, userName: userName, jumlahBerat: Number(data.jumlahBerat) || 0,
                    date: formatDisplayDateFromISO(originalDateISO),
                    originalDate: originalDateISO, img: data.imgUrl || data.img || null,
                });
            }
        }

        allReports.sort((a, b) => (a.originalDate && b.originalDate) ? new Date(b.originalDate).getTime() - new Date(a.originalDate).getTime() : 0);

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
        const trendEndDate = filterEndDateForQuery ? dayjs(filterEndDateForQuery) : dayjs();
        for (let i = 11; i >= 0; i--) {
            const monthTarget = trendEndDate.subtract(i, 'month');
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
        const trendChartData: ChartData = {
            categories: Object.keys(monthlyTrend).map(my => dayjs(my + '-01').format('MMM YY')),
            series: [
                { name: 'Total Berat (kg)', type: 'area', data: Object.values(monthlyTrend).map(d => d.totalBerat) },
                { name: 'Jumlah Laporan', type: 'line', data: Object.values(monthlyTrend).map(d => d.reportCount) }
            ]
        };

        const pksContribution: { [pksId: string]: number } = {};
        allReports.forEach(report => { pksContribution[report.pksId] = (pksContribution[report.pksId] || 0) + report.jumlahBerat; });
        const sortedPksContribution = Object.entries(pksContribution)
            .map(([id, value]) => ({ id, name: pksNameCache.get(id) || `PKS (${id.substring(0,6)})`, value }))
            .sort((a, b) => b.value - a.value);
        
        const topPksCountForPie = 5;
        const pksPieData: number[] = [];
        const pksPieLabels: string[] = [];
        let othersValue = 0;
        sortedPksContribution.forEach((p, index) => {
            if (index < topPksCountForPie) { pksPieLabels.push(p.name); pksPieData.push(p.value); }
            else { othersValue += p.value; }
        });
        if (othersValue > 0 && sortedPksContribution.length > topPksCountForPie) {
            pksPieLabels.push("PKS Lainnya"); pksPieData.push(othersValue);
        }
        const pksContributionChartData = (pksPieData.length > 0) ? { series: pksPieData, labels: pksPieLabels } : null;

        const teamProductivity: { [teamKey: string]: { name: string; pksName: string; totalBerat: number; reportCount: number; } } = {};
        allReports.forEach(report => {
            if (report.teamId && report.teamName && report.pksName) {
                const key = `${report.pksId}_${report.teamId}`;
                if (!teamProductivity[key]) {
                    teamProductivity[key] = { name: report.teamName, pksName: report.pksName, totalBerat: 0, reportCount: 0 };
                }
                teamProductivity[key].totalBerat += report.jumlahBerat;
                teamProductivity[key].reportCount++;
            }
        });
        const topTeams: TopPerformer[] = Object.entries(teamProductivity)
            .map(([key, t]) => ({
                id: key, name: `${t.name} (${t.pksName})`,
                totalBerat: t.totalBerat, reportCount: t.reportCount,
                avgBeratPerReport: t.reportCount > 0 ? parseFloat((t.totalBerat / t.reportCount).toFixed(1)) : 0
            }))
            .sort((a, b) => b.totalBerat - a.totalBerat).slice(0, 10);

        const reporterProductivity: { [userId: string]: { name: string; totalBerat: number; reportCount: number; } } = {};
        allReports.forEach(report => {
            if (report.userId && report.userName && report.userName !== 'N/A' && report.userName !== 'Tidak Diketahui') {
                if (!reporterProductivity[report.userId]) {
                    reporterProductivity[report.userId] = { name: report.userName, totalBerat: 0, reportCount: 0 };
                }
                reporterProductivity[report.userId].totalBerat += report.jumlahBerat;
                reporterProductivity[report.userId].reportCount++;
            }
        });
        const topReporters: TopPerformer[] = Object.values(reporterProductivity)
            .map(r => ({
                id: r.name, // Atau userId jika lebih unik
                name: r.name, totalBerat: r.totalBerat, reportCount: r.reportCount,
                avgBeratPerReport: r.reportCount > 0 ? parseFloat((r.totalBerat / r.reportCount).toFixed(1)) : 0
            }))
            .sort((a, b) => b.totalBerat - a.totalBerat).slice(0, 10);

        return {
            statistics, trendChartData, pksContributionChartData, topTeams, topReporters,
            pksListForFilter,
            selectedPksId: filterPksId || undefined, // Pastikan undefined jika null
            startDate: startDateStr || undefined,     // Pastikan undefined jika null
            endDate: endDateStr || undefined,         // Pastikan undefined jika null
            isCurrentlyFiltered,
            companyName: userSession.email,
            message: allReports.length === 0 ? (isCurrentlyFiltered ? 'Tidak ada data laporan untuk filter yang dipilih.' : 'Belum ada laporan yang tercatat.') : null,
            mapboxAccessToken
        };

    } catch (error: any) {
        console.error(`[AnalyticsPalmol Server Load] Gagal memuat data analitik:`, error.stack || error);
        throw svelteKitError(500, `Gagal memuat data analitik Palmol: ${error.message}`);
    }
};