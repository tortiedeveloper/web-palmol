// src/routes/apps/palmol/[pksid]/teams/[teamid]/detail/+page.server.ts
import type { PageServerLoad } from './$types';
import { ripenessDb } from '$lib/firebase/ripenessClient';
import { 
    collection, 
    doc, 
    getDoc, 
    type Timestamp as FirebaseTimestampType, 
    type DocumentSnapshot, // Impor DocumentSnapshot
    type DocumentData 
} from 'firebase/firestore';
import { error as svelteKitError, redirect } from '@sveltejs/kit';
import type { PKSTeam, UserSessionData, PKSUser } from '$lib/types';

export const load: PageServerLoad = async ({ params, locals }) => {
    const userSession = locals.user as UserSessionData | undefined;
    const pksid_from_params = params.pksid; 
    const teamid_from_params = params.teamid; 

    if (!userSession || !userSession.hasRipenessAccess || !userSession.ripenessCompanyId) {
        throw redirect(303, '/auth/sign-in');
    }

    if (!pksid_from_params || !teamid_from_params) {
        throw svelteKitError(400, 'ID PKS dan ID Tim diperlukan.');
    }

    try {
        const pksDocRef = doc(ripenessDb, 'pks', pksid_from_params);
        const pksDocSnap = await getDoc(pksDocRef);
        let namaPKS = `PKS (${pksid_from_params})`;
        if (pksDocSnap.exists()) {
            const pksData = pksDocSnap.data();
            if (pksData?.companyId !== userSession.ripenessCompanyId) {
                throw svelteKitError(403, 'Akses ditolak ke PKS ini.');
            }
            namaPKS = pksData?.pksName || namaPKS;
        } else {
            throw svelteKitError(404, `PKS dengan ID ${pksid_from_params} tidak ditemukan.`);
        }

        const teamDocRef = doc(ripenessDb, `pks/${pksid_from_params}/teams`, teamid_from_params);
        const teamDocSnap = await getDoc(teamDocRef);

        if (!teamDocSnap.exists()) {
            throw svelteKitError(404, `Tim dengan ID ${teamid_from_params} tidak ditemukan di PKS ${pksid_from_params}.`);
        }

        const teamData = teamDocSnap.data();
        if (!teamData) {
            throw svelteKitError(500, 'Data tim tidak valid atau korup.');
        }

        let membersCount = 0;
        let membersIdList: string[] = [];
        if (Array.isArray(teamData.members)) {
            membersIdList = [...new Set(teamData.members as string[])];
            membersCount = membersIdList.length;
        }

        let populatedMembersList: Array<{
            id: string;
            name: string;
            avatar?: string | null;
            email?: string | null;       // TAMBAHKAN
            phoneNumber?: string | null; // TAMBAHKAN
            address?: string | null;     // TAMBAHKAN
        }> = [];

        if (membersIdList.length > 0) {
            const memberPromises = membersIdList.map(memberId => {
                return getDoc(doc(ripenessDb, 'pksUsers', memberId)); // Asumsi koleksi Anda bernama 'pksUsers'
            });
            const memberDocSnaps = await Promise.all(memberPromises);
            
            populatedMembersList = memberDocSnaps.map((docSnap: DocumentSnapshot<DocumentData>) => { 
                if (docSnap.exists()) {
                    const userData = docSnap.data() as PKSUser; // PKSUser harus memiliki field yang relevan
                    return {
                        id: docSnap.id,
                        name: userData?.name || `Pengguna (${docSnap.id.substring(0,6)})`,
                        avatar: userData?.avatar || null,
                        email: userData?.email || null,             // AMBIL DARI userData
                        phoneNumber: userData?.phoneNumber || null, // AMBIL DARI userData
                        address: userData?.address || null          // AMBIL DARI userData
                    };
                }
                return { 
                    id: docSnap.id, 
                    name: `Pengguna ID ${docSnap.id} Tdk Ditemukan`, 
                    avatar: null,
                    email: null,        // Default null
                    phoneNumber: null,  // Default null
                    address: null       // Default null
                };
            });
        }

        let formattedLastReport = 'Belum ada laporan';
        if (teamData.lastReport && typeof (teamData.lastReport as FirebaseTimestampType).toDate === 'function') {
            const date = (teamData.lastReport as FirebaseTimestampType).toDate();
            formattedLastReport = date.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
        }

        const teamDetailData: PKSTeam = {
            id: teamDocSnap.id, 
            teamName: teamData.teamName || `Tim (${teamDocSnap.id})`, 
            membersCount: membersCount,
            populatedMembersList: populatedMembersList, // Ini sekarang berisi data lengkap
            lastReport: formattedLastReport,
        };
        
        return {
            pksId: pksid_from_params,
            teamId: teamid_from_params, // Mengirim teamId dari parameter
            namaPKS: namaPKS,
            teamDetail: teamDetailData
        };

    } catch (errorObj: any) {
        console.error(`[DetailTim Load] Error PKS: ${pksid_from_params}, Tim: ${teamid_from_params}):`, errorObj);
        if (errorObj.status) throw errorObj;
        throw svelteKitError(500, `Gagal memuat detail tim: ${errorObj.message}`);
    }
};