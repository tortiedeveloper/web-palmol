import type { PageServerLoad } from './$types';
import { ripenessDb } from '$lib/firebase/ripenessClient';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    type Timestamp as FirebaseTimestampType,
    type QueryDocumentSnapshot,
    type DocumentData
} from 'firebase/firestore';
import { error as svelteKitError, redirect } from '@sveltejs/kit';
import type { PKSReport, UserSessionData, User, PKSUser, PKS, PKSTeam, AppError } from '$lib/types';

interface FilterChoice {
    id: string;
    name: string;
}

export const load: PageServerLoad = async ({ url, locals }) => {
    const userSession = locals.user as UserSessionData | undefined;

    if (!userSession || !userSession.hasRipenessAccess || !userSession.ripenessCompanyId) {
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;

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
        const parsedStart = new Date(startDateStr + "T00:00:00Z");
        if (!isNaN(parsedStart.getTime())) {
            filterStartDateForQuery = parsedStart;
            isDateEffectivelyFiltered = true;
        }
    }

    if (endDateStr) {
        const parsedEnd = new Date(endDateStr + "T23:59:59.999Z");
        if (!isNaN(parsedEnd.getTime())) {
            filterEndDateForQuery = parsedEnd;
            isDateEffectivelyFiltered = true;
        }
    }

    if (filterStartDateForQuery && !filterEndDateForQuery && startDateStr) {
        filterEndDateForQuery = new Date();
        filterEndDateForQuery.setUTCHours(23, 59, 59, 999);
    }

    if (filterStartDateForQuery && filterEndDateForQuery && filterStartDateForQuery > filterEndDateForQuery) {
        filterStartDateForQuery = undefined;
        filterEndDateForQuery = undefined;
        isDateEffectivelyFiltered = false;
    }
    
    const finalIsCurrentlyFiltered = isDateEffectivelyFiltered || isPksFiltered || isTeamFiltered;

    try {
        const pksQueryForFilterList = query(collection(ripenessDb, 'pks'), where('companyId', '==', companyIdToLoad), orderBy('pksName', 'asc'));
        const pksFilterSnapshots = await getDocs(pksQueryForFilterList);
        const pksListForFilter: FilterChoice[] = pksFilterSnapshots.docs.map(d => ({
            id: d.id,
            name: (d.data() as PKS).pksName || `PKS (${d.id.substring(0,6)})`
        }));

        let teamListForFilter: FilterChoice[] = [];
        let currentPksNameForDisplay: string | undefined = "Semua PKS";
        let currentTeamNameForDisplay: string | undefined = "Semua Tim";
        let pksDocsToQueryFrom: QueryDocumentSnapshot<DocumentData>[] = [];

        if (filterPksId) {
            const pksDocRef = doc(ripenessDb, 'pks', filterPksId);
            const pksDocSnap = await getDoc(pksDocRef);
            if (pksDocSnap.exists() && pksDocSnap.data()?.companyId === companyIdToLoad) {
                pksDocsToQueryFrom.push(pksDocSnap);
                currentPksNameForDisplay = (pksDocSnap.data() as PKS).pksName || `PKS (${filterPksId.substring(0,6)})`;
                const teamsQuery = query(collection(ripenessDb, `pks/${filterPksId}/teams`), orderBy('teamName', 'asc'));
                const teamsSnapshot = await getDocs(teamsQuery);
                teamListForFilter = teamsSnapshot.docs.map(d => ({
                    id: d.id,
                    name: (d.data() as PKSTeam).teamName || `Tim (${d.id.substring(0,6)})`
                }));

                if (filterTeamId) {
                    const teamDetail = teamListForFilter.find(t => t.id === filterTeamId);
                    currentTeamNameForDisplay = teamDetail?.name || (filterTeamId ? `Tim (${filterTeamId.substring(0,6)})` : "Semua Tim");
                } else {
                    currentTeamNameForDisplay = "Semua Tim di PKS ini";
                }
            } else {
                isPksFiltered = true; 
                isTeamFiltered = false; 
                currentPksNameForDisplay = "PKS Tidak Valid";
                pksDocsToQueryFrom = [];
                teamListForFilter = [];
            }
        } else {
            pksDocsToQueryFrom = pksFilterSnapshots.docs; 
        }
        
        if (pksDocsToQueryFrom.length === 0 && isPksFiltered && filterPksId) {
             return {
                reportList: [], totalBeratKeseluruhan: 0, message: 'PKS yang dipilih tidak valid atau tidak memiliki laporan.',
                pksListForFilter, teamListForFilter, startDate: startDateStr || undefined, endDate: endDateStr || undefined, 
                selectedPksId: filterPksId || undefined, selectedTeamId: filterTeamId || undefined,
                isCurrentlyFiltered: finalIsCurrentlyFiltered, currentPksNameForDisplay, currentTeamNameForDisplay,
                companyName: userSession.email 
            };
        }
        if (pksDocsToQueryFrom.length === 0 && !isPksFiltered && pksFilterSnapshots.empty) {
             return {
                reportList: [], totalBeratKeseluruhan: 0, message: 'Tidak ada PKS yang terdaftar untuk perusahaan Anda.',
                pksListForFilter, teamListForFilter, startDate: startDateStr || undefined, endDate: endDateStr || undefined, 
                selectedPksId: filterPksId || undefined, selectedTeamId: filterTeamId || undefined,
                isCurrentlyFiltered: finalIsCurrentlyFiltered, currentPksNameForDisplay, currentTeamNameForDisplay,
                companyName: userSession.email
            };
        }

        const allReportProcessingPromises: Promise<PKSReport[]>[] = [];
        const usersCache = new Map<string, string>();
        const teamsCacheInternal = new Map<string, string>();

        for (const pksDoc of pksDocsToQueryFrom) {
            const currentPksId = pksDoc.id;
            const currentPksNameLoop = (pksDoc.data() as PKS).pksName || `PKS (${currentPksId.substring(0,6)})`;
            const reportsColRef = collection(ripenessDb, `pks/${currentPksId}/reports`);
            let currentReportsQuery = query(reportsColRef);

            if (filterPksId && filterTeamId && filterPksId === currentPksId) {
                currentReportsQuery = query(currentReportsQuery, where('teamId', '==', filterTeamId));
            }

            if (filterStartDateForQuery) {
                currentReportsQuery = query(currentReportsQuery, where('date', '>=', Timestamp.fromDate(filterStartDateForQuery)));
            }
            if (filterEndDateForQuery) {
                currentReportsQuery = query(currentReportsQuery, where('date', '<=', Timestamp.fromDate(filterEndDateForQuery)));
            }
            
            const pksReportsPromise = getDocs(currentReportsQuery).then(async (reportSnapshot) => {
                const reportsFromThisPks: Promise<PKSReport>[] = reportSnapshot.docs.map(async (reportDoc) => {
                    const data = reportDoc.data();
                    const berat = Number(data.jumlahBerat) || 0;
                    let formattedDate = 'N/A', originalDateSerializable: string | null = null;
                    const reportDateFirestore = data.date as FirebaseTimestampType | undefined;

                    if (reportDateFirestore?.toDate) {
                        const jsDate = reportDateFirestore.toDate();
                        formattedDate = jsDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                        originalDateSerializable = jsDate.toISOString();
                    }

                    let userName = data.userId || 'Tidak Diketahui';
                    if (data.userId) {
                        if (usersCache.has(data.userId)) { userName = usersCache.get(data.userId)!; }
                        else { try {
                                const userDocRef = doc(ripenessDb, 'pksUsers', data.userId);
                                const userDocSnap = await getDoc(userDocRef);
                                if (userDocSnap.exists()) {
                                    userName = (userDocSnap.data() as PKSUser).name || data.userId;
                                    usersCache.set(data.userId, userName);
                                } else { usersCache.set(data.userId, data.userId); }
                            } catch (e) { console.error("Error fetching user:", data.userId, e); usersCache.set(data.userId, data.userId); }
                        }
                    }

                    let teamNameResolved = data.teamId ? `Tim (${data.teamId.substring(0,6)})` : 'Laporan Level PKS';
                    if (data.teamId) {
                        const teamCacheKey = `${currentPksId}_${data.teamId}`;
                        if (teamsCacheInternal.has(teamCacheKey)) { teamNameResolved = teamsCacheInternal.get(teamCacheKey)!; }
                        else { try {
                                const teamDocRef = doc(ripenessDb, `pks/${currentPksId}/teams`, data.teamId);
                                const teamDocSnap = await getDoc(teamDocRef);
                                if (teamDocSnap.exists()) {
                                    teamNameResolved = (teamDocSnap.data() as PKSTeam).teamName || teamNameResolved;
                                    teamsCacheInternal.set(teamCacheKey, teamNameResolved);
                                } else { teamsCacheInternal.set(teamCacheKey, teamNameResolved); }
                            } catch (e) { console.error("Error fetching team:", data.teamId, e); teamsCacheInternal.set(teamCacheKey, teamNameResolved); }
                        }
                    }
                    
                    return {
                        id: reportDoc.id, pksId: currentPksId, pksName: currentPksNameLoop,
                        teamId: data.teamId, teamName: teamNameResolved, date: formattedDate,
                        originalDate: originalDateSerializable, img: data.imgUrl || data.img || null,
                        jumlahBerat: berat, userId: data.userId, userName: userName,
                    } as PKSReport;
                });
                return Promise.all(reportsFromThisPks);
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
            message = finalIsCurrentlyFiltered ? 'Tidak ada laporan untuk filter yang dipilih.' : 'Belum ada laporan yang ditemukan.';
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

    } catch (errorObj: any) {
        console.error(`[AllPalmolReports Load] Gagal memuat laporan:`, errorObj);
        if (errorObj.status && typeof errorObj.message === 'string') {
             throw errorObj;
        }
        throw svelteKitError(500, `Gagal memuat semua laporan Palmol: ${errorObj.message || 'Kesalahan tidak diketahui'}`);
    }
};