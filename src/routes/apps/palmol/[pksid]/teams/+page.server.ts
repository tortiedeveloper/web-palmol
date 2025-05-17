// src/routes/apps/palmol/[pksid]/teams/+page.server.ts
import type { PageServerLoad } from './$types';
import { ripenessDb } from '$lib/firebase/ripenessClient';
// PERBAIKAN: Impor collection, doc, getDoc, getDocs, orderBy, query, where, QueryDocumentSnapshot, Timestamp
import { 
    collection, 
    doc, 
    getDoc,        // Untuk mengambil satu dokumen
    getDocs,       // Untuk mengambil hasil query (banyak dokumen)
    orderBy, 
    query, 
    where, 
    type Timestamp as FirebaseTimestampType,
    type QueryDocumentSnapshot // Tipe untuk dokumen dalam hasil query
} from 'firebase/firestore';
import { error as svelteKitError, redirect } from '@sveltejs/kit';
import type { PKSTeam, UserSessionData } from '$lib/types';

export const load: PageServerLoad = async ({ params, locals }) => {
    const userSession = locals.user as UserSessionData | undefined;
    const pksId = params.pksid; 

    if (!userSession || !userSession.hasRipenessAccess || !userSession.ripenessCompanyId) {
        throw redirect(303, '/auth/sign-in');
    }
    // Tidak perlu: const companyIdToLoad = userSession.ripenessCompanyId; karena PKS ID sudah unik

    if (!pksId) {
        throw svelteKitError(400, 'ID PKS diperlukan.');
    }

    try {
        const pksDocRef = doc(ripenessDb, 'pks', pksId);
        // PERBAIKAN: Gunakan getDoc(pksDocRef)
        const pksDocSnap = await getDoc(pksDocRef); 

        if (!pksDocSnap.exists()) { // Gunakan pksDocSnap
            throw svelteKitError(404, `PKS dengan ID ${pksId} tidak ditemukan.`);
        }
        const pksData = pksDocSnap.data(); // Gunakan pksDocSnap
        // Validasi apakah PKS ini milik company user yang login
        if (pksData?.companyId !== userSession.ripenessCompanyId) {
             throw svelteKitError(403, `Anda tidak memiliki akses ke PKS ini.`);
        }
        const namaPKS = pksData?.pksName || `PKS (${pksId})`;

        const teamsColRef = collection(pksDocRef, 'teams'); // Subkoleksi dari pksDocRef
        const teamsQuery = query(teamsColRef, orderBy('teamName', 'asc'));
        const teamsSnapshot = await getDocs(teamsQuery);

        if (teamsSnapshot.empty) {
            return {
                pksId: pksId,
                namaPKS: namaPKS,
                teamList: [],
                message: 'Tidak ada tim yang terdaftar di PKS ini.'
            };
        }

        const teamList = teamsSnapshot.docs.map((teamDoc: QueryDocumentSnapshot) => { // PERBAIKAN: Gunakan QueryDocumentSnapshot
            const data = teamDoc.data();
            let membersCount = 0;
            if (Array.isArray(data.members)) {
                membersCount = data.members.length;
            }
            let formattedLastReport = 'Belum ada laporan';
            if (data.lastReport && typeof (data.lastReport as FirebaseTimestampType).toDate === 'function') {
                const date = (data.lastReport as FirebaseTimestampType).toDate();
                formattedLastReport = date.toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }
            return {
                id: teamDoc.id,
                teamName: data.teamName || `Tim (${teamDoc.id})`,
                membersCount: membersCount,
                lastReport: formattedLastReport,
            } as PKSTeam;
        });

        return {
            pksId: pksId,
            namaPKS: namaPKS,
            teamList: teamList
        };

    } catch (errorObj: any) {
        console.error(`Error mengambil daftar tim untuk PKS ${pksId}:`, errorObj);
        if (errorObj.status) throw errorObj;
        throw svelteKitError(500, `Gagal memuat daftar tim: ${errorObj.message}`);
    }
};