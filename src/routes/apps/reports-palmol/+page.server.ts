// src/routes/apps/reports-palmol/+page.server.ts
import type { PageServerLoad } from './$types';
import { ripenessDbAdmin as ripenessDbAdminInstance } from '$lib/server/adminRipeness'; // Ganti nama impor
import admin from 'firebase-admin';
import { error as svelteKitError, redirect } from '@sveltejs/kit';
import type { PKSReport, UserSessionData, PKS, PKSTeam, PKSUser } from '$lib/types';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
dayjs.locale('id');

interface FilterChoice {
    id: string;
    name: string;
}

function serializeAdminTimestamp(timestamp: admin.firestore.Timestamp | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

function formatDisplayDate(isoString: string | null | undefined): string {
    if (!isoString) return 'N/A';
    return dayjs(isoString).format('DD MMM YY, HH:mm');
}

export const load: PageServerLoad = async ({ url, locals }) => {
    const userSession = locals.user as UserSessionData | undefined;

    if (!userSession?.hasRipenessAccess || !userSession.ripenessCompanyId) {
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;

    // Pengecekan null untuk instance Admin SDK
    if (!ripenessDbAdminInstance) { // Menggunakan nama impor yang baru
        console.error("[ReportsPalmol Server Load] Ripeness Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data laporan Palmol tidak tersedia saat ini (DB Admin Error).");
    }
    // Setelah pengecekan, kita bisa yakin ripenessDbAdminInstance tidak null.
    // Assign ke variabel const baru agar TypeScript melacaknya sebagai non-null.
    const db = ripenessDbAdminInstance;

    const startDateStr = url.searchParams.get('startDate');
    const endDateStr = url.searchParams.get('endDate');
    const filterPksId = url.searchParams.get('pksId');
    const filterTeamId = url.searchParams.get('teamId');

    let filterStartDateForQuery: Date | undefined = undefined;
    let filterEndDateForQuery: Date | undefined = undefined;
    let isDateEffectivelyFiltered = false;
    let isPksFiltered = !!filterPksId;
    let isTeamFiltered = !!(filterPksId && filterTeamId);

    if (startDateStr) {
        const parsedStart = dayjs(startDateStr);
        if (parsedStart.isValid()) { filterStartDateForQuery = parsedStart.startOf('day').toDate(); isDateEffectivelyFiltered = true; }
    }
    if (endDateStr) {
        const parsedEnd = dayjs(endDateStr);
        if (parsedEnd.isValid()) { filterEndDateForQuery = parsedEnd.endOf('day').toDate(); isDateEffectivelyFiltered = true; }
    }
    if (filterStartDateForQuery && !filterEndDateForQuery && startDateStr) {
        filterEndDateForQuery = dayjs().endOf('day').toDate();
    }
    if (filterStartDateForQuery && filterEndDateForQuery && filterStartDateForQuery > filterEndDateForQuery) {
        filterStartDateForQuery = undefined; filterEndDateForQuery = undefined; isDateEffectivelyFiltered = false;
    }
    const finalIsCurrentlyFiltered = isDateEffectivelyFiltered || isPksFiltered || isTeamFiltered;

    try {
        const pksCollectionRef = db.collection('pks'); // Menggunakan 'db'
        let pksBaseQuery: admin.firestore.Query = pksCollectionRef
            .where('companyId', '==', companyIdToLoad)
            .orderBy('pksName', 'asc');

        const pksFilterSnapshots = await pksBaseQuery.get();
        const pksListForFilter: FilterChoice[] = pksFilterSnapshots.docs.map(d => ({
            id: d.id,
            name: (d.data() as PKS).pksName || `PKS (${d.id.substring(0, 6)})`
        }));

        let teamListForFilter: FilterChoice[] = [];
        let currentPksNameForDisplay: string | undefined = "Semua PKS";
        let currentTeamNameForDisplay: string | undefined = "Semua Tim";
        let pksDocsToQueryReportsFrom: admin.firestore.QueryDocumentSnapshot[] = [];

        if (filterPksId) {
            const pksDocRef = db.collection('pks').doc(filterPksId); // Menggunakan 'db'
            const pksDocSnap = await pksDocRef.get();
            if (pksDocSnap.exists && pksDocSnap.data()?.companyId === companyIdToLoad) {
                pksDocsToQueryReportsFrom.push(pksDocSnap as admin.firestore.QueryDocumentSnapshot);
                currentPksNameForDisplay = (pksDocSnap.data() as PKS).pksName || `PKS (${filterPksId.substring(0, 6)})`;

                const teamsCollectionRef = db.collection(`pks/${filterPksId}/teams`); // Menggunakan 'db'
                const teamsQuery = teamsCollectionRef.orderBy('teamName', 'asc');
                const teamsSnapshot = await teamsQuery.get();
                teamListForFilter = teamsSnapshot.docs.map(d => ({
                    id: d.id,
                    name: (d.data() as PKSTeam).teamName || `Tim (${d.id.substring(0, 6)})`
                }));

                if (filterTeamId) {
                    const teamDetail = teamListForFilter.find(t => t.id === filterTeamId);
                    currentTeamNameForDisplay = teamDetail?.name || (filterTeamId ? `Tim (${filterTeamId.substring(0, 6)})` : "Semua Tim");
                } else {
                    currentTeamNameForDisplay = "Semua Tim di PKS ini";
                }
            } else {
                isPksFiltered = true; isTeamFiltered = false;
                currentPksNameForDisplay = "PKS Tidak Valid";
                pksDocsToQueryReportsFrom = [];
                teamListForFilter = [];
            }
        } else {
            pksDocsToQueryReportsFrom = pksFilterSnapshots.docs as admin.firestore.QueryDocumentSnapshot[];
        }

        if (pksListForFilter.length === 0 && !filterPksId) {
             return {
                reportList: [], totalBeratKeseluruhan: 0, message: 'Tidak ada PKS yang terdaftar untuk perusahaan Anda.',
                pksListForFilter, teamListForFilter, startDate: startDateStr, endDate: endDateStr,
                selectedPksId: filterPksId, selectedTeamId: filterTeamId,
                isCurrentlyFiltered: finalIsCurrentlyFiltered, currentPksNameForDisplay: "Tidak Ada PKS", currentTeamNameForDisplay,
                companyName: userSession.email
            };
        }
        if (filterPksId && pksDocsToQueryReportsFrom.length === 0) {
             return {
                reportList: [], totalBeratKeseluruhan: 0, message: `PKS dengan ID "${filterPksId}" tidak ditemukan atau bukan milik Anda.`,
                pksListForFilter, teamListForFilter: [], startDate: startDateStr, endDate: endDateStr,
                selectedPksId: filterPksId, selectedTeamId: filterTeamId,
                isCurrentlyFiltered: finalIsCurrentlyFiltered, currentPksNameForDisplay: "PKS Tidak Valid", currentTeamNameForDisplay: "N/A",
                companyName: userSession.email
            };
        }

        const allReportProcessingPromises: Promise<PKSReport[]>[] = [];
        const usersCache = new Map<string, string>();
        const teamsCacheOnServer = new Map<string, string>();

        for (const pksDoc of pksDocsToQueryReportsFrom) {
            const currentPksId = pksDoc.id;
            const currentPksNameLoop = (pksDoc.data() as PKS).pksName || `PKS (${currentPksId.substring(0, 6)})`;
            const reportsColRef = db.collection(`pks/${currentPksId}/reports`); // Menggunakan 'db'
            let currentReportsQuery: admin.firestore.Query = reportsColRef;

            if (filterPksId && filterTeamId && filterPksId === currentPksId) {
                currentReportsQuery = currentReportsQuery.where('teamId', '==', filterTeamId);
            }
            if (filterStartDateForQuery) {
                currentReportsQuery = currentReportsQuery.where('date', '>=', admin.firestore.Timestamp.fromDate(filterStartDateForQuery));
            }
            if (filterEndDateForQuery) {
                currentReportsQuery = currentReportsQuery.where('date', '<=', admin.firestore.Timestamp.fromDate(filterEndDateForQuery));
            }
            currentReportsQuery = currentReportsQuery.orderBy('date', 'desc');

            const pksReportsPromise = currentReportsQuery.get().then(async (reportSnapshot) => {
                const reportsFromThisPksPromises: Promise<PKSReport>[] = reportSnapshot.docs.map(async (reportDoc) => {
                    const data = reportDoc.data();
                    const berat = Number(data.jumlahBerat) || 0;
                    const reportDateFirestore = data.date as admin.firestore.Timestamp | undefined;
                    const originalDateSerializable = serializeAdminTimestamp(reportDateFirestore);
                    const formattedDate = formatDisplayDate(originalDateSerializable);

                    let userName = data.userId || 'Tidak Diketahui';
                    if (data.userId) {
                        if (usersCache.has(data.userId)) { userName = usersCache.get(data.userId)!; }
                        else {
                            try {
                                const userDocRef = db.collection('pksUsers').doc(data.userId); // Menggunakan 'db'
                                const userDocSnap = await userDocRef.get();
                                if (userDocSnap.exists) {
                                    userName = (userDocSnap.data() as PKSUser).name || data.userId;
                                    usersCache.set(data.userId, userName);
                                } else { usersCache.set(data.userId, data.userId); }
                            } catch (e) { console.error("Error fetching user for report:", data.userId, e); usersCache.set(data.userId, data.userId); }
                        }
                    }

                    let teamNameResolved = data.teamId ? `Tim (${data.teamId.substring(0, 6)})` : (currentPksId && !data.teamId ? 'Laporan Langsung PKS' : 'N/A');
                    if (data.teamId) {
                        const teamCacheKey = `${currentPksId}_${data.teamId}`;
                        if (teamsCacheOnServer.has(teamCacheKey)) { teamNameResolved = teamsCacheOnServer.get(teamCacheKey)!; }
                        else {
                            try {
                                // INI BARIS YANG ERROR (LINE 175 di kode asli Anda, sekarang mungkin berbeda)
                                const teamDocRef = db.collection(`pks/${currentPksId}/teams`).doc(data.teamId); // Menggunakan 'db'
                                const teamDocSnap = await teamDocRef.get();
                                if (teamDocSnap.exists) {
                                    teamNameResolved = (teamDocSnap.data() as PKSTeam).teamName || teamNameResolved;
                                    teamsCacheOnServer.set(teamCacheKey, teamNameResolved);
                                } else { teamsCacheOnServer.set(teamCacheKey, teamNameResolved); }
                            } catch (e) { console.error("Error fetching team for report:", data.teamId, e); teamsCacheOnServer.set(teamCacheKey, teamNameResolved); }
                        }
                    }

                    return {
                        id: reportDoc.id, pksId: currentPksId, pksName: currentPksNameLoop,
                        teamId: data.teamId, teamName: teamNameResolved, date: formattedDate,
                        originalDate: originalDateSerializable, img: data.imgUrl || data.img || null,
                        jumlahBerat: berat, userId: data.userId, userName: userName,
                    } as PKSReport;
                });
                return Promise.all(reportsFromThisPksPromises);
            });
            allReportProcessingPromises.push(pksReportsPromise);
        }

        const resultsPerPKS = await Promise.all(allReportProcessingPromises);
        let combinedReportList = resultsPerPKS.flat();

        combinedReportList.sort((a, b) => {
            const dateA = a.originalDate ? new Date(a.originalDate).getTime() : 0;
            const dateB = b.originalDate ? new Date(b.originalDate).getTime() : 0;
            return dateB - dateA;
        });

        const totalBeratKeseluruhan = combinedReportList.reduce((acc, report) => acc + (report.jumlahBerat || 0), 0);
        let message: string | null = null;
        if (combinedReportList.length === 0) {
            message = finalIsCurrentlyFiltered ? 'Tidak ada laporan untuk filter yang dipilih.' : 'Belum ada laporan yang ditemukan untuk perusahaan Anda.';
        }

        return {
            reportList: combinedReportList, totalBeratKeseluruhan, message, pksListForFilter, teamListForFilter,
            startDate: startDateStr || undefined, endDate: endDateStr || undefined,
            selectedPksId: filterPksId || undefined,
            selectedTeamId: filterTeamId || undefined,
            isCurrentlyFiltered: finalIsCurrentlyFiltered,
            currentPksNameForDisplay, currentTeamNameForDisplay,
            companyName: userSession.email
        };

    } catch (error: any) {
        console.error(`[ReportsPalmol Server Load] Gagal memuat laporan:`, error);
        throw svelteKitError(500, `Gagal memuat laporan Palmol: ${error.message || 'Kesalahan tidak diketahui'}`);
    }
};