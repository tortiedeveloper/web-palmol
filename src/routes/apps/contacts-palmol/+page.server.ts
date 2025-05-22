// src/routes/apps/contacts-palmol/+page.server.ts
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { User as PKSUser, UserSessionData, PKS } from '$lib/types';
import { ripenessDbAdmin } from '$lib/server/adminRipeness'; // Menggunakan Admin SDK Ripeness
import admin from 'firebase-admin'; // Untuk tipe Timestamp Admin SDK

// Helper untuk serialisasi Firebase Admin Timestamp
function serializeAdminTimestamp(timestamp: admin.firestore.Timestamp | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

interface PKSFilterChoice {
    id: string;
    name: string;
}

export const load: PageServerLoad = async ({ locals, url }) => {
    const userSession = locals.user as UserSessionData | undefined;

    if (!userSession?.hasRipenessAccess || !userSession.ripenessCompanyId) {
        console.warn("[ContactsPalmol Server Load] Sesi Ripeness tidak valid atau ripenessCompanyId tidak ada, redirecting.");
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;
    const filterPksIdFromUrl = url.searchParams.get('filterPksId');

    if (!ripenessDbAdmin) {
        console.error("[ContactsPalmol Server Load] Ripeness Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data Palmol tidak tersedia saat ini.");
    }

    console.log(`[ContactsPalmol Server Load] Memuat data PKS dan pengguna untuk Ripeness company: ${companyIdToLoad}, filter PKS: ${filterPksIdFromUrl || 'tidak ada'}`);

    try {
        // 1. Ambil daftar PKS untuk filter dropdown
        const pksCollectionRef = ripenessDbAdmin.collection('pks');
        const pksQuery = pksCollectionRef
            .where('companyId', '==', companyIdToLoad)
            .orderBy('pksName', 'asc');
        const pksSnapshots = await pksQuery.get();
        const pksListForFilter: PKSFilterChoice[] = pksSnapshots.docs.map(doc => ({
            id: doc.id,
            name: (doc.data() as PKS).pksName || `PKS Tanpa Nama (${doc.id.substring(0, 6)})`
        }));

        // 2. Tentukan PKS mana yang akan di-query penggunanya
        let pksIdsToQueryUsersFrom: string[] = [];
        let currentPksNameForDisplay: string | undefined;

        if (filterPksIdFromUrl) {
            const isValidPksFilter = pksListForFilter.find(pks => pks.id === filterPksIdFromUrl);
            if (isValidPksFilter) {
                pksIdsToQueryUsersFrom.push(filterPksIdFromUrl);
                currentPksNameForDisplay = isValidPksFilter.name;
            } else {
                console.warn(`[ContactsPalmol Server Load] filterPksId '${filterPksIdFromUrl}' tidak valid untuk company '${companyIdToLoad}'.`);
                return {
                    users: [],
                    pksListForFilter,
                    selectedPksId: filterPksIdFromUrl,
                    message: "PKS yang dipilih tidak valid untuk perusahaan Anda.",
                    companyId: companyIdToLoad,
                    currentPksName: "PKS Tidak Valid"
                };
            }
        } else {
            pksIdsToQueryUsersFrom = pksSnapshots.docs.map(doc => doc.id); // Ambil semua PKS ID jika tidak ada filter
            currentPksNameForDisplay = "Semua PKS";
        }

        // 3. Jika tidak ada PKS sama sekali untuk perusahaan ini
        if (pksListForFilter.length === 0) {
            return {
                users: [],
                pksListForFilter,
                selectedPksId: filterPksIdFromUrl || undefined,
                message: 'Tidak ada PKS yang terdaftar untuk perusahaan Anda.',
                companyId: companyIdToLoad,
                currentPksName: "Tidak Ada PKS"
            };
        }

        // 4. Ambil pengguna (pksUsers) berdasarkan pksIdsToQueryUsersFrom
        const allPksUsers: PKSUser[] = [];
        const usersCollectionRef = ripenessDbAdmin.collection('pksUsers'); // Asumsi koleksi 'pksUsers' di root Ripeness DB

        // Jika tidak ada filter PKS ID, dan ada banyak PKS, query bisa menjadi banyak.
        // Pertimbangkan batasan Firestore jika jumlah PKS sangat besar.
        // Untuk kasus umum, iterasi ini masih oke.
        for (const pksId of pksIdsToQueryUsersFrom) {
            const userQuery = usersCollectionRef
                .where('pksId', '==', pksId) // Pengguna difilter berdasarkan pksId mereka
                .orderBy('name', 'asc');
            const usersQuerySnapshot = await userQuery.get();

            usersQuerySnapshot.forEach((userDoc) => {
                const data = userDoc.data();
                const pksDetail = pksListForFilter.find(p => p.id === pksId); // Untuk mendapatkan nama PKS

                const serializableUser: PKSUser = {
                    id: userDoc.id,
                    userId: data.userId || userDoc.id,
                    name: data.name || '',
                    email: data.email || '',
                    companyId: companyIdToLoad, // Ini adalah ripenessCompanyId dari userSession
                    pksId: pksId,
                    pksName: pksDetail?.name, // Nama PKS dari PKS yang terkait
                    avatar: data.avatar,
                    phoneNumber: data.phoneNumber,
                    address: data.address,
                    androidId: data.androidId,
                    birthDate: data.birthDate,
                    date: {
                        createdDate: serializeAdminTimestamp(data.date?.createdDate as admin.firestore.Timestamp | undefined),
                        updatedDate: serializeAdminTimestamp(data.date?.updatedDate as admin.firestore.Timestamp | undefined),
                        validDate: serializeAdminTimestamp(data.date?.validDate as admin.firestore.Timestamp | undefined)
                    },
                    fcmToken: data.fcmToken,
                    gender: data.gender,
                    idToken: data.idToken,
                    lastUpdated: serializeAdminTimestamp(data.lastUpdated as admin.firestore.Timestamp | undefined),
                    location: data.location,
                    membership: data.membership,
                    type: data.type,
                    role: data.role,
                };
                allPksUsers.push(serializableUser);
            });
        }

        allPksUsers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        return {
            users: allPksUsers,
            pksListForFilter,
            selectedPksId: filterPksIdFromUrl || undefined,
            currentPksName: currentPksNameForDisplay,
            message: allPksUsers.length === 0 ? (filterPksIdFromUrl ? `Tidak ada pengguna untuk PKS "${currentPksNameForDisplay}".` : `Tidak ada pengguna Palmol yang ditemukan.`) : null,
            companyId: companyIdToLoad // Ini adalah ripenessCompanyId
        };

    } catch (error: any) {
        console.error(`[ContactsPalmol Server Load] Gagal memuat data:`, error);
        throw svelteKitError(500, `Gagal memuat data pengguna Palmol: ${error.message}`);
    }
};