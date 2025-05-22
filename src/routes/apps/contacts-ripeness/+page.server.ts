// src/routes/apps/contacts-ripeness/+page.server.ts
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { User, UserSessionData } from '$lib/types';
import { ripenessDbAdmin } from '$lib/server/adminRipeness'; // Menggunakan Admin SDK Ripeness
import admin from 'firebase-admin'; // Untuk tipe Timestamp Admin SDK

// Helper untuk serialisasi Firebase Admin Timestamp
function serializeAdminTimestamp(timestamp: admin.firestore.Timestamp | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

export const load: PageServerLoad = async ({ locals }) => {
    const userSession = locals.user as UserSessionData | undefined;

    if (!userSession?.hasRipenessAccess || !userSession.ripenessCompanyId) {
        console.warn("[ContactsRipeness Server Load] Sesi Ripeness tidak valid atau ripenessCompanyId tidak ada, redirecting.");
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;

    if (!ripenessDbAdmin) {
        console.error("[ContactsRipeness Server Load] Ripeness Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data pengguna Ripeness tidak tersedia saat ini.");
    }

    console.log(`[ContactsRipeness Server Load] Memuat data pengguna untuk perusahaan Ripeness ID: ${companyIdToLoad}`);

    try {
        // Asumsi koleksi 'users' ada di root Ripeness DB dan memiliki field 'companyId'
        const usersColRef = ripenessDbAdmin.collection('users');
        const q = usersColRef
            .where('companyId', '==', companyIdToLoad)
            .orderBy('name', 'asc');

        const querySnapshot = await q.get();
        const usersList: User[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const serializableUser: User = {
                id: doc.id,
                userId: data.userId || doc.id,
                name: data.name || '',
                email: data.email || '',
                companyId: data.companyId || '', // Ini adalah companyId di Ripeness
                avatar: data.avatar,
                phoneNumber: data.phoneNumber,
                address: data.address,
                androidId: data.androidId,
                birthDate: data.birthDate,
                date: {
                    validDate: serializeAdminTimestamp(data.date?.validDate as admin.firestore.Timestamp | undefined),
                    createdDate: serializeAdminTimestamp(data.date?.createdDate as admin.firestore.Timestamp | undefined),
                    updatedDate: serializeAdminTimestamp(data.date?.updatedDate as admin.firestore.Timestamp | undefined),
                },
                fcmToken: data.fcmToken,
                gender: data.gender,
                idToken: data.idToken,
                lastUpdated: serializeAdminTimestamp(data.lastUpdated as admin.firestore.Timestamp | undefined),
                location: data.location,
                membership: data.membership,
                type: data.type,
                // Tambahkan field role jika ada di data pengguna Ripeness
                // role: data.role,
            };
            usersList.push(serializableUser);
        });

        return {
            users: usersList,
            // Mengirimkan ripenessCompanyId sebagai 'companyId' untuk konsistensi dengan halaman lain
            // atau bisa diganti namanya menjadi 'ripenessCompanyId' jika lebih disukai
            companyId: companyIdToLoad,
            message: usersList.length === 0 ? 'Tidak ada pengguna yang terdaftar untuk perusahaan Ripeness ini.' : null
        };

    } catch (error: any) {
        console.error(`[ContactsRipeness Server Load] Gagal memuat pengguna untuk Ripeness company ${companyIdToLoad}:`, error);
        throw svelteKitError(500, `Gagal memuat data pengguna Ripeness: ${error.message}`);
    }
};