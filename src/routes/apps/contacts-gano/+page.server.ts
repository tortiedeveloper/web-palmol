// src/routes/apps/contacts-gano/+page.server.ts
import { ganoAIDb } from '$lib/firebase/ganoAIClient';
import { collection, query, where, getDocs, orderBy, type Timestamp as FirebaseTimestampType } from 'firebase/firestore';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoadEvent, PageServerLoad } from './$types';
import type { User, FirebaseTimestamp, UserDateInfo, UserSessionData } from '$lib/types';

function serializeTimestamp(timestamp: FirebaseTimestampType | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

export const load: PageServerLoad = async (event: PageServerLoadEvent) => {
    const userSession = event.locals.user as UserSessionData | undefined;

    if (!userSession || !userSession.hasGanoAIAccess || !userSession.ganoAICompanyId) {
        console.warn("[ContactsGano Load] Sesi GanoAI tidak valid atau companyId tidak ada, redirecting ke login.");
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ganoAICompanyId;

    console.log(`[ContactsGano Load] Memuat data pengguna untuk perusahaan ID GanoAI: ${companyIdToLoad}`);

    try {
        const usersColRef = collection(ganoAIDb, 'users');
        const q = query(
            usersColRef, 
            where('companyId', '==', companyIdToLoad),
            orderBy('name', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        const usersList: User[] = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
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
                membership: data.membership,
                type: data.type,
            };
            usersList.push(serializableUser);
        });

        return {
            users: usersList,
            companyId: companyIdToLoad 
        };

    } catch (error: any) {
        console.error(`Error loading users for company ${companyIdToLoad} di contacts-gano:`, error);
        return {
            users: [],
            companyId: companyIdToLoad,
            error: `Gagal memuat data pengguna: ${error.message}`
        };
    }
};