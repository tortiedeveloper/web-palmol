// src/routes/apps/palmol/[pksid]/teams/[teamid]/reports/+page.server.ts
import type { PageServerLoad } from './$types';
import { ripenessDbAdmin } from '$lib/server/adminRipeness';
import admin from 'firebase-admin';
import { error as svelteKitError, redirect } from '@sveltejs/kit';
import type { PKSReport, UserSessionData, PKSUser, PKSTeam, PKS } from '$lib/types'; // Pastikan PKS juga diimpor
import dayjs from 'dayjs';
import 'dayjs/locale/id';
dayjs.locale('id');

// Definisikan tipe data yang akan dikembalikan oleh load function ini
// Ini akan membantu PageData di +page.svelte
export interface TeamReportsPageData {
    pksId: string;
    teamId: string;
    namaPKS: string;
    teamName: string;
    reportList: PKSReport[];
    totalBeratTim: number;
    message: string | null;
    startDate?: string; // Opsional dan bisa undefined
    endDate?: string;   // Opsional dan bisa undefined
    isCurrentlyFiltered: boolean;
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

export const load: PageServerLoad = async ({ params, url, locals }): Promise<TeamReportsPageData> => {
    const userSession = locals.user as UserSessionData | undefined;
    const pksid_from_params = params.pksid;
    const teamid_from_params = params.teamid;

    if (!userSession || !userSession.hasRipenessAccess || !userSession.ripenessCompanyId) {
        throw redirect(303, '/auth/sign-in');
    }

    if (!pksid_from_params || !teamid_from_params) {
        throw svelteKitError(400, 'ID PKS dan ID Tim diperlukan.');
    }

    if (!ripenessDbAdmin) {
        console.error("[TeamReports Server Load] Ripeness Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data laporan tim tidak tersedia saat ini.");
    }
    const db = ripenessDbAdmin;

    // Validasi PKS
    const pksCheckRef = db.collection('pks').doc(pksid_from_params);
    const pksCheckSnap = await pksCheckRef.get();
    if (!pksCheckSnap.exists || (pksCheckSnap.data() as PKS)?.companyId !== userSession.ripenessCompanyId) {
        throw svelteKitError(403, 'Akses ditolak ke PKS ini atau PKS tidak ditemukan.');
    }

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
        const pksDocRef = db.collection('pks').doc(pksid_from_params); // Sudah divalidasi di atas
        const pksDocSnap = await pksDocRef.get(); // Ambil lagi untuk nama (atau simpan dari check)
        let namaPKS = `PKS (${pksid_from_params.substring(0,6)})`;
        if (pksDocSnap.exists) { // Seharusnya exists
            namaPKS = (pksDocSnap.data() as PKS)?.pksName || namaPKS;
        }

        const teamDocRef = db.collection(`pks/${pksid_from_params}/teams`).doc(teamid_from_params);
        const teamDocSnap = await teamDocRef.get();
        let teamName = `Tim (${teamid_from_params.substring(0,6)})`;
        if (teamDocSnap.exists) {
            teamName = (teamDocSnap.data() as PKSTeam)?.teamName || teamName;
        } else {
            throw svelteKitError(404, `Tim dengan ID ${teamid_from_params} tidak ditemukan di PKS ${namaPKS}.`);
        }

        const usersMap = new Map<string, string>();
        // Anda mungkin ingin membatasi query user hanya untuk user yang relevan jika memungkinkan
        const usersColRef = db.collection('pksUsers');
        const usersSnapshot = await usersColRef.where('pksId', '==', pksid_from_params).get(); // Ambil pengguna dari PKS ini
        usersSnapshot.forEach(userDoc => {
            usersMap.set(userDoc.id, userDoc.data().name || 'Tanpa Nama');
        });


        const reportsColRef = db.collection(`pks/${pksid_from_params}/reports`);
        let q: admin.firestore.Query = reportsColRef.where('teamId', '==', teamid_from_params);

        if (isDateEffectivelyFiltered && filterStartDateForQuery && filterEndDateForQuery) {
            const startTimestamp = admin.firestore.Timestamp.fromDate(filterStartDateForQuery);
            const endTimestamp = admin.firestore.Timestamp.fromDate(filterEndDateForQuery);
            q = q.where('date', '>=', startTimestamp).where('date', '<=', endTimestamp);
        }
        q = q.orderBy('date', 'desc');

        const reportsSnapshot = await q.get();
        const reportListPromises = reportsSnapshot.docs.map(async (reportDoc) => {
            const data = reportDoc.data();
            const berat = Number(data.jumlahBerat) || 0;
            const reportDateFirestore = data.date as admin.firestore.Timestamp | undefined;
            const originalDateSerializable = serializeAdminTimestamp(reportDateFirestore);
            const formattedDate = formatDisplayDateFromISO(originalDateSerializable);

            let userName = data.userId || 'Tidak diketahui';
            if (data.userId) {
                if (usersMap.has(data.userId)) {
                    userName = usersMap.get(data.userId)!;
                } else { // Fallback jika user tidak ada di map awal (mis. user ditambahkan setelah PKS user diambil)
                    try {
                        const userDocRef = db.collection('pksUsers').doc(data.userId);
                        const userDocSnap = await userDocRef.get();
                        if (userDocSnap.exists) {
                            const nameFromDb = (userDocSnap.data() as PKSUser).name || data.userId;
                            usersMap.set(data.userId, nameFromDb); // Cache untuk penggunaan berikutnya
                            userName = nameFromDb;
                        } else { usersMap.set(data.userId, data.userId); } // Cache kegagalan
                    } catch (userError) {
                        console.warn(`Gagal mengambil data pengguna ID ${data.userId} untuk laporan:`, userError);
                        usersMap.set(data.userId, data.userId); // Cache kegagalan
                    }
                }
            }

            return {
                id: reportDoc.id,
                date: formattedDate,
                originalDate: originalDateSerializable,
                img: data.imgUrl || data.img || null,
                jumlahBerat: berat,
                userId: data.userId,
                userName: userName,
                teamId: data.teamId,
                pksId: pksid_from_params, // Tambahkan PKS ID ke laporan jika perlu
                pksName: namaPKS,         // Tambahkan Nama PKS ke laporan jika perlu
                teamName: teamName        // Tambahkan Nama Tim ke laporan jika perlu
            } as PKSReport;
        });

        const reportList = await Promise.all(reportListPromises);
        const totalBeratGlobalTim = reportList.reduce((acc, report) => acc + report.jumlahBerat, 0);

        let message: string | null = null;
        if (reportList.length === 0) {
            message = isDateEffectivelyFiltered ? 'Tidak ada laporan untuk rentang tanggal yang dipilih.' : 'Belum ada laporan untuk tim ini.';
        }

        return {
            pksId: pksid_from_params,
            teamId: teamid_from_params,
            namaPKS,
            teamName,
            reportList,
            totalBeratTim: totalBeratGlobalTim,
            message,
            startDate: startDateStr || undefined, // Selalu string | undefined
            endDate: endDateStr || undefined,     // Selalu string | undefined
            isCurrentlyFiltered: isDateEffectivelyFiltered
        };

    } catch (error: any) {
        console.error(`[TeamReports Server Load] Error PKS: ${pksid_from_params}, Tim: ${teamid_from_params}):`, error.stack || error);
        if (error.status && typeof error.message === 'string') { // Jika ini SvelteKitError
             throw error;
        }
        throw svelteKitError(500, `Gagal memuat laporan tim: ${error.message}`);
    }
};