// src/routes/apps/palmol/[pksid]/teams/+page.server.ts
import type { PageServerLoad } from './$types';
import { ripenessDbAdmin } from '$lib/server/adminRipeness'; // Menggunakan Admin SDK
import admin from 'firebase-admin'; // Untuk tipe Timestamp Admin SDK
import { error as svelteKitError, redirect } from '@sveltejs/kit';
import type { PKSTeam, UserSessionData, PKS } from '$lib/types'; // Impor PKS
import dayjs from 'dayjs'; // Untuk format tanggal
import 'dayjs/locale/id';
dayjs.locale('id');

// Fungsi helper untuk format tanggal dari Admin Timestamp atau ISO String
function formatAdminTimestampToDisplay(timestamp: admin.firestore.Timestamp | string | undefined | null): string {
    if (!timestamp) return 'Belum ada laporan'; // Atau N/A
    try {
        const dateObj = (typeof timestamp === 'string') ? new Date(timestamp) : timestamp.toDate();
        if (isNaN(dateObj.getTime())) return 'Invalid Date';
        return dayjs(dateObj).format('DD MMM YYYY, HH:mm');
    } catch (e) {
        console.error("Error formatting admin timestamp for team list:", e);
        return 'Format Error';
    }
}

export const load: PageServerLoad = async ({ params, locals }) => {
    const userSession = locals.user as UserSessionData | undefined;
    const pksId = params.pksid;

    if (!userSession?.hasRipenessAccess || !userSession.ripenessCompanyId) {
        console.warn("[TeamsList Server Load] Sesi Ripeness tidak valid, redirecting.");
        throw redirect(303, '/auth/sign-in');
    }

    if (!pksId) {
        throw svelteKitError(400, 'ID PKS diperlukan.');
    }

    if (!ripenessDbAdmin) {
        console.error("[TeamsList Server Load] Ripeness Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data tim tidak tersedia saat ini.");
    }
    const db = ripenessDbAdmin;

    console.log(`[TeamsList Server Load] Memuat tim untuk PKS ID: ${pksId} di company: ${userSession.ripenessCompanyId}`);

    try {
        // 1. Verifikasi PKS dan dapatkan namanya
        const pksDocRef = db.collection('pks').doc(pksId);
        const pksDocSnap = await pksDocRef.get();

        if (!pksDocSnap.exists) {
            throw svelteKitError(404, `PKS dengan ID ${pksId} tidak ditemukan.`);
        }
        const pksData = pksDocSnap.data() as PKS; // Cast ke tipe PKS
        if (pksData?.companyId !== userSession.ripenessCompanyId) {
            throw svelteKitError(403, `Anda tidak memiliki akses ke PKS ini.`);
        }
        const namaPKS = pksData?.pksName || `PKS (${pksId.substring(0,6)})`;

        // 2. Ambil daftar tim dari subkoleksi PKS
        const teamsColRef = db.collection(`pks/${pksId}/teams`);
        const teamsQuery = teamsColRef.orderBy('teamName', 'asc');
        const teamsSnapshot = await teamsQuery.get();

        if (teamsSnapshot.empty) {
            return {
                pksId: pksId,
                namaPKS: namaPKS,
                teamList: [],
                message: 'Tidak ada tim yang terdaftar di PKS ini.'
            };
        }

        const teamList = teamsSnapshot.docs.map((teamDoc) => {
            const data = teamDoc.data();
            let membersCount = 0;
            if (Array.isArray(data.membersIdList)) { // Pastikan field members adalah membersIdList sesuai tipe
                membersCount = data.membersIdList.length;
            } else if (Array.isArray(data.members)) { // Fallback jika fieldnya 'members'
                 membersCount = data.members.length;
            }

            const lastReportTimestamp = data.lastReport as admin.firestore.Timestamp | undefined;

            return {
                id: teamDoc.id,
                teamName: data.teamName || `Tim Tanpa Nama (${teamDoc.id.substring(0,6)})`,
                membersCount: membersCount,
                lastReport: formatAdminTimestampToDisplay(lastReportTimestamp),
                // Anda bisa menambahkan originalLastReport (ISO string) jika perlu pengurutan lebih lanjut di klien
                // originalLastReport: lastReportTimestamp ? lastReportTimestamp.toDate().toISOString() : null,
            } as PKSTeam; // Pastikan tipe PKSTeam sesuai
        });

        return {
            pksId: pksId,
            namaPKS: namaPKS,
            teamList: teamList,
            message: null
        };

    } catch (error: any) {
        console.error(`[TeamsList Server Load] Error mengambil daftar tim untuk PKS ${pksId}:`, error);
        if (error.status) throw error; // Jika sudah SvelteKitError, lempar lagi
        throw svelteKitError(500, `Gagal memuat daftar tim: ${error.message}`);
    }
};