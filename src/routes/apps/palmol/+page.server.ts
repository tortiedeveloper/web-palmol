// src/routes/apps/palmol/+page.server.ts
import type { PageServerLoad } from './$types';
import { ripenessDb } from '$lib/firebase/ripenessClient';
import { collection, query, where, getDocs, orderBy, type Timestamp as FirebaseTimestampType } from 'firebase/firestore'; // Impor Timestamp
import { error as svelteKitError, redirect } from '@sveltejs/kit';
import type { PKS, UserSessionData, FirebaseTimestamp } from '$lib/types'; // Pastikan FirebaseTimestamp diimpor

// Fungsi helper untuk format tanggal (jika belum ada di file ini)
function formatDisplayDate(timestamp: FirebaseTimestampType | undefined | null): string {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return timestamp.toDate().toLocaleDateString('id-ID', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}


export const load: PageServerLoad = async ({ locals }) => {
    const userSession = locals.user as UserSessionData | undefined;

    if (!userSession || !userSession.hasRipenessAccess || !userSession.ripenessCompanyId) {
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;

    try {
        const pksColRef = collection(ripenessDb, 'pks');
        const q = query(pksColRef, where('companyId', '==', companyIdToLoad), orderBy('pksName', 'asc'));
        const pksSnapshot = await getDocs(q);

        if (pksSnapshot.empty) {
            return {
                pksList: [],
                message: 'Tidak ada PKS yang terdaftar untuk perusahaan Anda saat ini.'
            };
        }

        const pksList = pksSnapshot.docs.map(doc => {
            const data = doc.data();
            // Ambil dan format updatedDate dari PKS jika ada
            const pksUpdatedDate = data.date?.updatedDate as FirebaseTimestampType | undefined || data.lastUpdated as FirebaseTimestampType | undefined;

            return {
                id: doc.id,
                pksId: data.pksId || doc.id,
                companyId: data.companyId,
                pksName: data.pksName || `PKS Tanpa Nama (${doc.id.substring(0,6)})`,
                avatar: data.avatar || null,
                address: data.address || 'Alamat tidak tersedia',
                email: data.email || null, // Tambahkan email
                phoneNumber: data.phoneNumber || null, // Tambahkan phoneNumber
                updatedDateFormatted: formatDisplayDate(pksUpdatedDate), // Tambahkan tanggal update PKS
                membership: data.membership || null // Tambahkan membership jika ada
            } as PKS; // Pastikan tipe PKS di $lib/types mencakup field baru ini
        });

        return {
            pksList: pksList
        };

    } catch (errorObj: any) {
        console.error("[Palmol PKS List] Error mengambil daftar PKS:", errorObj);
        throw svelteKitError(500, `Gagal memuat daftar PKS: ${errorObj.message}`);
    }
};