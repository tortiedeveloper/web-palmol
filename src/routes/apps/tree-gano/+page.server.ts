// src/routes/apps/tree-gano/+page.server.ts
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Tree, User, UserSessionData } from '$lib/types';
import { ganoAIDbAdmin } from '$lib/server/adminGanoAI'; // Menggunakan Admin SDK
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

    if (!userSession?.hasGanoAIAccess || !userSession.ganoAICompanyId) {
        console.warn("[TreeGano Server Load] Sesi GanoAI tidak valid atau ganoAICompanyId tidak ada, redirecting.");
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ganoAICompanyId;

    if (!ganoAIDbAdmin) {
        console.error("[TreeGano Server Load] GanoAI Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data pohon GanoAI tidak tersedia saat ini.");
    }

    console.log(`[TreeGano Server Load] Memuat data pohon untuk perusahaan GanoAI ID: ${companyIdToLoad}`);

    try {
        // 1. Ambil data pengguna untuk mapping userName
        const usersMap = new Map<string, string>();
        const usersColRef = ganoAIDbAdmin.collection('users'); // Asumsi koleksi 'users' di GanoAI
        const companyUsersQuery = usersColRef.where('companyId', '==', companyIdToLoad);
        const usersSnapshot = await companyUsersQuery.get();
        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            usersMap.set(userDoc.id, userData.name || 'Tanpa Nama');
        });

        // 2. Ambil data pohon
        const treesColRef = ganoAIDbAdmin.collection(`company/${companyIdToLoad}/tree`);
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
                last_status: data.last_status,
                location: data.location,
                userId: data.userId,
                userName: data.userId ? (usersMap.get(data.userId) || data.userId) : 'Tidak Diketahui',
                date: { // Simpan sebagai ISO string atau null
                    createdDate: createdDateISO,
                    updatedDate: updatedDateISO,
                },
                // Field *_formatted untuk tampilan langsung jika diperlukan
                createdDateFormatted: formatDisplayDate(createdDateISO),
                updatedDateFormatted: formatDisplayDate(updatedDateISO),
                // fruitCounts tidak relevan untuk GanoAI, jadi bisa diabaikan atau pastikan tipenya opsional
            };
            treesList.push(serializableTree);
        });

        return {
            trees: treesList,
            companyId: companyIdToLoad, // ganoAICompanyId
            message: treesList.length === 0 ? 'Tidak ada data pohon untuk perusahaan ini.' : null
        };

    } catch (error: any) {
        console.error(`[TreeGano Server Load] Gagal memuat pohon untuk GanoAI company ${companyIdToLoad}:`, error);
        throw svelteKitError(500, `Gagal memuat data pohon GanoAI: ${error.message}`);
    }
};