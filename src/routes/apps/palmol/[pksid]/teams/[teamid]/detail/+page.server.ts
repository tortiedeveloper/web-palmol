// src/routes/apps/palmol/[pksid]/teams/[teamid]/detail/+page.server.ts
import type { PageServerLoad } from './$types';
import { ripenessDbAdmin } from '$lib/server/adminRipeness'; // Menggunakan Admin SDK
import admin from 'firebase-admin'; // Untuk tipe Timestamp Admin SDK
import { error as svelteKitError, redirect } from '@sveltejs/kit';
import type { PKSTeam, UserSessionData, PKSUser, PopulatedMemberInfo, PKS } from '$lib/types'; // Impor PopulatedMemberInfo dan PKS
import dayjs from 'dayjs'; // Untuk format tanggal
import 'dayjs/locale/id';
dayjs.locale('id');

// Fungsi helper untuk format tanggal dari Admin Timestamp atau ISO String
function formatAdminTimestampToDisplay(timestamp: admin.firestore.Timestamp | string | undefined | null): string {
    if (!timestamp) return 'Belum ada laporan';
    try {
        const dateObj = (typeof timestamp === 'string') ? new Date(timestamp) : timestamp.toDate();
        if (isNaN(dateObj.getTime())) return 'Invalid Date';
        return dayjs(dateObj).format('DD MMM YYYY, HH:mm');
    } catch (e) {
        console.error("Error formatting admin timestamp for team detail:", e);
        return 'Format Error';
    }
}

export const load: PageServerLoad = async ({ params, locals }) => {
    const userSession = locals.user as UserSessionData | undefined;
    const pksid_from_params = params.pksid;
    const teamid_from_params = params.teamid;

    if (!userSession?.hasRipenessAccess || !userSession.ripenessCompanyId) {
        console.warn("[TeamDetail Server Load] Sesi Ripeness tidak valid, redirecting.");
        throw redirect(303, '/auth/sign-in');
    }

    if (!pksid_from_params || !teamid_from_params) {
        throw svelteKitError(400, 'ID PKS dan ID Tim diperlukan.');
    }

    if (!ripenessDbAdmin) {
        console.error("[TeamDetail Server Load] Ripeness Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data detail tim tidak tersedia saat ini.");
    }
    const db = ripenessDbAdmin;

    console.log(`[TeamDetail Server Load] Memuat detail tim: ${teamid_from_params} untuk PKS: ${pksid_from_params}`);

    try {
        // 1. Verifikasi PKS
        const pksDocRef = db.collection('pks').doc(pksid_from_params);
        const pksDocSnap = await pksDocRef.get();
        let namaPKS = `PKS (${pksid_from_params.substring(0,6)})`; // Default name

        if (pksDocSnap.exists) {
            const pksData = pksDocSnap.data() as PKS;
            if (pksData.companyId !== userSession.ripenessCompanyId) {
                throw svelteKitError(403, 'Akses ditolak ke PKS ini.');
            }
            namaPKS = pksData.pksName || namaPKS;
        } else {
            throw svelteKitError(404, `PKS dengan ID ${pksid_from_params} tidak ditemukan.`);
        }

        // 2. Ambil data tim
        const teamDocRef = db.collection(`pks/${pksid_from_params}/teams`).doc(teamid_from_params);
        const teamDocSnap = await teamDocRef.get();

        if (!teamDocSnap.exists) {
            throw svelteKitError(404, `Tim dengan ID ${teamid_from_params} tidak ditemukan di PKS ${namaPKS}.`);
        }

        const teamData = teamDocSnap.data();
        if (!teamData) { // Seharusnya tidak terjadi jika exists() true
            throw svelteKitError(500, 'Data tim tidak valid atau korup.');
        }

        // 3. Ambil dan populate data anggota tim
        let membersCount = 0;
        // Gunakan field yang benar untuk daftar ID anggota, misal 'membersIdList' atau 'members'
        const memberIdArray = (teamData.membersIdList || teamData.members || []) as string[];
        const membersIdList: string[] = [...new Set(memberIdArray.filter(id => typeof id === 'string'))]; // Pastikan unik dan string
        membersCount = membersIdList.length;

        const populatedMembersList: PopulatedMemberInfo[] = [];

        if (membersIdList.length > 0) {
            const memberPromises = membersIdList.map(memberId =>
                db.collection('pksUsers').doc(memberId).get() // Koleksi pengguna PKS
            );
            const memberDocSnaps = await Promise.all(memberPromises);

            memberDocSnaps.forEach(docSnap => {
                if (docSnap.exists) {
                    const userData = docSnap.data() as PKSUser; // Tipe PKSUser
                    populatedMembersList.push({
                        id: docSnap.id,
                        name: userData?.name || `Pengguna (${docSnap.id.substring(0, 6)})`,
                        avatar: userData?.avatar || null,
                        email: userData?.email || null,
                        phoneNumber: userData?.phoneNumber || null,
                        address: userData?.address || null,
                        // Tambahkan field lain dari PKSUser jika perlu di PopulatedMemberInfo
                    });
                } else {
                    // Handle jika dokumen anggota tidak ditemukan (opsional, tergantung kebutuhan)
                    console.warn(`[TeamDetail Server Load] Dokumen anggota PKSUser dengan ID ${docSnap.id} tidak ditemukan.`);
                    populatedMembersList.push({
                        id: docSnap.id, name: `Pengguna ID ${docSnap.id} (Tidak Ditemukan)`, avatar: null,
                        email: null, phoneNumber: null, address: null
                    });
                }
            });
        }

        const lastReportTimestamp = teamData.lastReport as admin.firestore.Timestamp | undefined;

        const teamDetailData: PKSTeam = {
            id: teamDocSnap.id,
            teamName: teamData.teamName || `Tim (${teamDocSnap.id.substring(0,6)})`,
            membersCount: membersCount,
            membersIdList: membersIdList,
            populatedMembersList: populatedMembersList,
            lastReport: formatAdminTimestampToDisplay(lastReportTimestamp),
            // Baris ini sekarang seharusnya valid setelah tipe PKSTeam.originalLastReport diubah
            originalLastReport: lastReportTimestamp ? lastReportTimestamp.toDate().toISOString() : undefined,
        };

        return {
            pksId: pksid_from_params,
            teamId: teamid_from_params,
            namaPKS: namaPKS,
            teamDetail: teamDetailData,
            message: null // atau hapus jika tidak ada pesan sukses spesifik
        };

    } catch (error: any) {
        console.error(`[TeamDetail Server Load] Error PKS: ${pksid_from_params}, Tim: ${teamid_from_params}):`, error);
        if (error.status) throw error; // Jika sudah SvelteKitError
        throw svelteKitError(500, `Gagal memuat detail tim: ${error.message}`);
    }
};