// src/routes/apps/tree-ripeness/+page.server.ts
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Tree, User, UserSessionData } from '$lib/types';
import { ripenessDbAdmin } from '$lib/server/adminRipeness'; // Menggunakan Admin SDK Ripeness
import admin from 'firebase-admin'; // Untuk tipe Timestamp Admin SDK

// Helper untuk serialisasi Firebase Admin Timestamp
function serializeAdminTimestamp(timestamp: admin.firestore.Timestamp | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

// Helper untuk format tanggal tampilan
function formatDisplayDate(isoDateString: string | null | undefined): string {
    if (!isoDateString) return 'N/A';
    try {
        return new Date(isoDateString).toLocaleDateString('id-ID', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    } catch (e) {
        return 'Invalid Date';
    }
}

export const load: PageServerLoad = async ({ locals }) => {
    const userSession = locals.user as UserSessionData | undefined;

    if (!userSession?.hasRipenessAccess || !userSession.ripenessCompanyId) {
        console.warn("[TreeRipeness Server Load] Sesi Ripeness tidak valid atau ripenessCompanyId tidak ada, redirecting.");
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;

    if (!ripenessDbAdmin) {
        console.error("[TreeRipeness Server Load] Ripeness Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data pohon Ripeness tidak tersedia saat ini.");
    }

    console.log(`[TreeRipeness Server Load] Memuat data pohon untuk perusahaan Ripeness ID: ${companyIdToLoad}`);

    try {
        // 1. Ambil data pengguna untuk mapping userName
        const usersMap = new Map<string, string>();
        const usersColRef = ripenessDbAdmin.collection('users'); // Asumsi koleksi 'users' di Ripeness DB
        const companyUsersQuery = usersColRef.where('companyId', '==', companyIdToLoad);
        const usersSnapshot = await companyUsersQuery.get();
        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            usersMap.set(userDoc.id, userData.name || 'Tanpa Nama');
        });

        // 2. Ambil data pohon
        const treesColRef = ripenessDbAdmin.collection(`company/${companyIdToLoad}/tree`);
        const q = treesColRef.orderBy('name', 'asc');
        const querySnapshot = await q.get();
        const treesList: Tree[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const createdDate = data.date?.createdDate as admin.firestore.Timestamp | undefined;
            const updatedDate = data.date?.updatedDate as admin.firestore.Timestamp | undefined;

            const createdDateISO = serializeAdminTimestamp(createdDate);
            const updatedDateISO = serializeAdminTimestamp(updatedDate);

            const serializableTree: Tree = {
                id: doc.id,
                companyId: data.companyId,
                name: data.name,
                description: data.description,
                img: data.img,
                last_status: data.last_status, // Ini mungkin tidak terlalu relevan untuk Ripeness, tapi kita sertakan jika ada
                location: data.location,
                userId: data.userId,
                userName: data.userId ? (usersMap.get(data.userId) || data.userId) : 'Tidak Diketahui',
                fruitCounts: data.fruitCounts || { belumMatang: 0, matang: 0, terlaluMatang: 0 }, // Penting untuk Ripeness
                date: {
                    createdDate: createdDateISO,
                    updatedDate: updatedDateISO,
                },
                createdDateFormatted: formatDisplayDate(createdDateISO),
                updatedDateFormatted: formatDisplayDate(updatedDateISO),
            };
            treesList.push(serializableTree);
        });

        return {
            trees: treesList,
            companyId: companyIdToLoad, // ripenessCompanyId
            message: treesList.length === 0 ? 'Tidak ada data pohon untuk perusahaan Ripeness ini.' : null
        };

    } catch (error: any) {
        console.error(`[TreeRipeness Server Load] Gagal memuat pohon untuk Ripeness company ${companyIdToLoad}:`, error);
        throw svelteKitError(500, `Gagal memuat data pohon Ripeness: ${error.message}`);
    }
};