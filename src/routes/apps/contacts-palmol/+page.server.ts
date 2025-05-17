// src/routes/apps/contacts-palmol/+page.server.ts
import { ripenessDb } from '$lib/firebase/ripenessClient';
import { collection, query, where, getDocs, orderBy, doc, getDoc, type Timestamp as FirebaseTimestampType } from 'firebase/firestore';
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoadEvent, PageServerLoad } from './$types';
import type { User as PKSUser, FirebaseTimestamp, UserSessionData, PKS, AppError } from '$lib/types'; // Pastikan tipe User/PKSUser sesuai

function serializeTimestamp(timestamp: FirebaseTimestampType | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

interface PKSFilterChoice {
    id: string;
    name: string;
}

export const load: PageServerLoad = async (event: PageServerLoadEvent) => {
    const userSession = event.locals.user as UserSessionData | undefined;
    const url = event.url;

    if (!userSession || !userSession.hasRipenessAccess || !userSession.ripenessCompanyId) {
        console.warn("[ContactsPalmol Load] Sesi Ripeness tidak valid atau companyId tidak ada, redirecting ke login.");
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;
    const filterPksIdFromUrl = url.searchParams.get('filterPksId');

    try {
        const pksQuery = query(
            collection(ripenessDb, 'pks'),
            where('companyId', '==', companyIdToLoad),
            orderBy('pksName', 'asc')
        );
        const pksSnapshots = await getDocs(pksQuery);
        const pksListForFilter: PKSFilterChoice[] = pksSnapshots.docs.map(d => ({
            id: d.id,
            name: (d.data() as PKS).pksName || `PKS (${d.id.substring(0,6)})`
        }));

        let pksIdsToQuery: string[] = [];
        let currentPksNameForDisplay: string | undefined;

        if (filterPksIdFromUrl) {
            const isValidPksFilter = pksListForFilter.find(pks => pks.id === filterPksIdFromUrl);
            if (isValidPksFilter) {
                pksIdsToQuery.push(filterPksIdFromUrl);
                currentPksNameForDisplay = isValidPksFilter.name;
            } else {
                console.warn(`[ContactsPalmol Load] filterPksId ${filterPksIdFromUrl} tidak valid untuk company ${companyIdToLoad}.`);
                return {
                    users: [], pksListForFilter, selectedPksId: filterPksIdFromUrl,
                    message: "PKS yang dipilih tidak valid.", companyId: companyIdToLoad,
                    currentPksName: "PKS Tidak Valid"
                };
            }
        } else {
            pksIdsToQuery = pksSnapshots.docs.map(doc => doc.id);
            currentPksNameForDisplay = "Semua PKS";
        }

        const allPksUsers: PKSUser[] = [];

        if (pksIdsToQuery.length === 0 && pksSnapshots.empty) {
             return {
                users: [], pksListForFilter, selectedPksId: filterPksIdFromUrl,
                message: 'Tidak ada PKS yang terdaftar untuk perusahaan Anda.',
                companyId: companyIdToLoad, currentPksName: "Tidak Ada PKS"
            };
        }
        
        // Pastikan nama koleksi ini ('pksUsers') sesuai dengan yang ada di Firebase Anda
        const usersColRef = collection(ripenessDb, 'pksUsers'); 

        for (const pksId of pksIdsToQuery) {
            // PERBAIKAN KUNCI: Hapus `where('companyId', '==', companyIdToLoad)` jika field ini tidak ada di pksUsers
            const q = query(
                usersColRef,
                where('pksId', '==', pksId), 
                orderBy('name', 'asc')
            );
            const usersQuerySnapshot = await getDocs(q);
            usersQuerySnapshot.forEach((userDoc) => {
                const data = userDoc.data();
                const pksDetail = pksListForFilter.find(p => p.id === pksId);

                const serializableUser: PKSUser = {
                    id: userDoc.id,
                    userId: data.userId || userDoc.id,
                    name: data.name || '',
                    email: data.email || '',
                    companyId: companyIdToLoad, // Diambil dari sesi, karena PKS sudah divalidasi milik company ini
                    pksId: pksId, 
                    pksName: pksDetail?.name,
                    avatar: data.avatar,
                    phoneNumber: data.phoneNumber,
                    address: data.address,
                    androidId: data.androidId,
                    birthDate: data.birthDate,
                    date: { 
                        createdDate: serializeTimestamp(data.date?.createdDate as FirebaseTimestampType | undefined),
                        updatedDate: serializeTimestamp(data.date?.updatedDate as FirebaseTimestampType | undefined),
                        validDate: serializeTimestamp(data.date?.validDate as FirebaseTimestampType | undefined)
                    },
                    fcmToken: data.fcmToken,
                    gender: data.gender,
                    idToken: data.idToken,
                    lastUpdated: serializeTimestamp(data.lastUpdated as FirebaseTimestampType | undefined),
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
            currentPksName: currentPksNameForDisplay, // Nama PKS yang sedang difilter atau "Semua PKS"
            message: allPksUsers.length === 0 ? (filterPksIdFromUrl ? `Tidak ada pengguna untuk PKS "${currentPksNameForDisplay}".` : `Tidak ada pengguna Palmol yang ditemukan.`) : null,
            companyId: companyIdToLoad
        };

    } catch (error: any) {
        console.error(`[ContactsPalmol Load] Error:`, error);
        if (error.status) throw error;
        throw svelteKitError(500, `Gagal memuat data pengguna Palmol: ${error.message}`);
    }
};