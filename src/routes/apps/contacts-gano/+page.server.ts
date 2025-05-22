// src/routes/apps/contacts-gano/+page.server.ts
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { User, UserSessionData } from '$lib/types'; // UserDateInfo dan FirebaseTimestamp tidak diperlukan di sini
import { ganoAIDbAdmin } from '$lib/server/adminGanoAI';
import admin from 'firebase-admin'; // Untuk tipe admin.firestore.Timestamp

// Helper untuk serialisasi Firebase Admin Timestamp ke string ISO atau null
function serializeAdminTimestamp(timestamp: admin.firestore.Timestamp | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

// Definisikan tipe data yang akan dikembalikan oleh load function ini
// Ini akan membantu PageData di +page.svelte
export interface ContactsGanoPageData {
    users: User[];
    companyId: string;
    message: string | null; // 'message' ADA DI SINI
}

export const load: PageServerLoad = async ({ locals }): Promise<ContactsGanoPageData> => {
    const userSession = locals.user as UserSessionData | undefined;

    if (!userSession?.hasGanoAIAccess || !userSession.ganoAICompanyId) {
        console.warn("[ContactsGano Server Load] Sesi GanoAI tidak valid atau ganoAICompanyId tidak ada, redirecting ke login.");
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ganoAICompanyId;

    if (!ganoAIDbAdmin) {
        console.error("[ContactsGano Server Load] GanoAI Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data pengguna GanoAI tidak tersedia saat ini. Silakan coba lagi nanti.");
    }
    const db = ganoAIDbAdmin;

    console.log(`[ContactsGano Server Load] Memuat data pengguna untuk perusahaan GanoAI ID: ${companyIdToLoad}`);

    try {
        const usersColRef = db.collection('users'); // Koleksi 'users' di GanoAI
        const q = usersColRef
            .where('companyId', '==', companyIdToLoad)
            .orderBy('name', 'asc');

        const querySnapshot = await q.get();
        const usersList: User[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Asumsi tipe User di $lib/types sudah mengharapkan string untuk tanggal setelah serialisasi
            const serializableUser: User = {
                id: doc.id,
                userId: data.userId || doc.id,
                name: data.name || '',
                email: data.email || '',
                companyId: data.companyId || '',
                avatar: data.avatar,
                phoneNumber: data.phoneNumber,
                address: data.address,
                androidId: data.androidId,
                birthDate: data.birthDate, // Asumsikan string atau null
                date: { // UserDateInfo di types/index.ts harus mengharapkan string | null
                    validDate: serializeAdminTimestamp(data.date?.validDate as admin.firestore.Timestamp | undefined),
                    createdDate: serializeAdminTimestamp(data.date?.createdDate as admin.firestore.Timestamp | undefined),
                    updatedDate: serializeAdminTimestamp(data.date?.updatedDate as admin.firestore.Timestamp | undefined),
                },
                fcmToken: data.fcmToken,
                gender: data.gender,
                idToken: data.idToken,
                lastUpdated: serializeAdminTimestamp(data.lastUpdated as admin.firestore.Timestamp | undefined), // Sudah string | null
                location: data.location,
                membership: data.membership,
                type: data.type,
                // createdDateFormatted & updatedDateFormatted akan diisi oleh PKS type jika extends FormattedDates
                // Jika User type tidak extends FormattedDates, Anda bisa mengisinya di sini jika perlu
            };
            usersList.push(serializableUser);
        });

        return {
            users: usersList,
            companyId: companyIdToLoad,
            message: usersList.length === 0 ? "Tidak ada pengguna yang terdaftar untuk perusahaan ini." : null
        };

    } catch (error: any) {
        console.error(`[ContactsGano Server Load] Gagal memuat pengguna untuk GanoAI company ${companyIdToLoad}:`, error.stack || error);
        throw svelteKitError(500, `Gagal memuat data pengguna GanoAI: ${error.message}`);
    }
};