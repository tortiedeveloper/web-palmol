// src/routes/apps/contacts-ripeness/+page.server.ts
import { ripenessDb } from '$lib/firebase/ripenessClient'; // Gunakan DB Ripeness
import { collection, query, where, getDocs, orderBy, type Timestamp as FirebaseTimestampType } from 'firebase/firestore';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoadEvent, PageServerLoad } from './$types';
import type { User, FirebaseTimestamp, UserDateInfo, UserSessionData } from '$lib/types';

// Helper function untuk konversi Firebase Timestamp ke string ISO atau null
function serializeTimestamp(timestamp: FirebaseTimestampType | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

export const load: PageServerLoad = async (event: PageServerLoadEvent) => {
    const userSession = event.locals.user as UserSessionData | undefined;

    // Pastikan pengguna memiliki akses ke Ripeness dan ada ripenessCompanyId
    if (!userSession || !userSession.hasRipenessAccess || !userSession.ripenessCompanyId) {
        console.warn("[ContactsRipeness Load] Sesi Ripeness tidak valid atau companyId tidak ada, redirecting ke login.");
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;

    console.log(`[ContactsRipeness Load] Memuat data pengguna untuk perusahaan ID Ripeness: ${companyIdToLoad}`);

    try {
        const usersColRef = collection(ripenessDb, 'users'); // Gunakan ripenessDb
        const q = query(
            usersColRef, 
            where('companyId', '==', companyIdToLoad),
            orderBy('name', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        const usersList: User[] = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Struktur serialisasi sama dengan contacts-gano
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
                birthDate: data.birthDate,
                date: { 
                    validDate: serializeTimestamp(data.date?.validDate as FirebaseTimestampType | undefined)
                },
                fcmToken: data.fcmToken,
                gender: data.gender,
                idToken: data.idToken,
                lastUpdated: serializeTimestamp(data.lastUpdated as FirebaseTimestampType | undefined),
                location: data.location,
                membership: data.membership, // Field membership juga ada di users Ripeness
                type: data.type,
            };
            usersList.push(serializableUser);
        });

        return {
            users: usersList,
            companyId: companyIdToLoad // Anda mungkin ingin mengganti nama ini menjadi ripenessCompanyId agar lebih jelas di +page.svelte
        };

    } catch (error: any) {
        console.error(`Error loading users for company ${companyIdToLoad} di contacts-ripeness:`, error);
        return {
            users: [],
            companyId: companyIdToLoad,
            error: `Gagal memuat data pengguna (Ripeness): ${error.message}`
        };
    }
};