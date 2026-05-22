// src/routes/apps/contacts-gano/+page.server.ts
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { User, UserSessionData } from '$lib/types';
import { ganoAIDbAdmin } from '$lib/server/adminGanoAI';
import admin from 'firebase-admin';

function serializeAdminTimestamp(timestamp: admin.firestore.Timestamp | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

export interface ContactsGanoPageData {
    users: User[];
    companyId: string;
    message: string | null;
}

export const load: PageServerLoad = async ({ locals }): Promise<ContactsGanoPageData> => {
    const userSession = locals.user as UserSessionData | undefined;

    if (!userSession?.hasGanoAIAccess || !(userSession.ganoAIActiveCompanyId || userSession.ganoAICompanyId)) {
        console.warn("[ContactsGano Server Load] Sesi GanoAI tidak valid, redirecting ke login.");
        throw redirect(303, '/auth/sign-in');
    }

    if (!ganoAIDbAdmin) {
        console.error("[ContactsGano Server Load] GanoAI Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data pengguna GanoAI tidak tersedia saat ini.");
    }

    const db = ganoAIDbAdmin;
    const groupId = userSession.groupIdGano;
    const companyIdToLoad = (userSession.ganoAIActiveCompanyId || userSession.ganoAICompanyId) || '';

    console.log(`[ContactsGano Server Load] groupIdGano: ${groupId}, companyId: ${companyIdToLoad}`);

    try {
        let userIds: string[] = [];

        if (groupId) {
            // Cara baru: ambil members dari grup
            const groupDoc = await db.collection('groups').doc(groupId).get();
            if (groupDoc.exists) {
                const groupData = groupDoc.data();
                if (groupData?.members && Array.isArray(groupData.members)) {
                    userIds = groupData.members;
                    console.log(`[ContactsGano] Ditemukan ${userIds.length} members di grup ${groupId}`);
                } else {
                    console.warn(`[ContactsGano] Grup ${groupId} tidak memiliki field members.`);
                }
            } else {
                console.warn(`[ContactsGano] Grup ${groupId} tidak ditemukan.`);
            }
        } else {
            // Fallback: query berdasarkan companyId (cara lama)
            console.warn(`[ContactsGano] groupIdGano tidak tersedia, fallback ke query companyId.`);
            const usersColRef = db.collection('users');
            const q = usersColRef
                .where('companyId', '==', companyIdToLoad)
                .orderBy('name', 'asc');

            const querySnapshot = await q.get();
            const usersList: User[] = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                usersList.push(buildUser(doc.id, data));
            });

            return {
                users: usersList,
                companyId: companyIdToLoad,
                message: usersList.length === 0 ? "Tidak ada pengguna yang terdaftar untuk perusahaan ini." : null
            };
        }

        // Query users berdasarkan userIds dari members array
        const usersList: User[] = [];

        if (userIds.length > 0) {
            // Firestore 'in' query max 30 items per batch
            for (let i = 0; i < userIds.length; i += 30) {
                const batch = userIds.slice(i, i + 30);
                const snapshot = await db.collection('users')
                    .where(admin.firestore.FieldPath.documentId(), 'in', batch)
                    .get();

                snapshot.forEach((doc) => {
                    const data = doc.data();
                    usersList.push(buildUser(doc.id, data));
                });
            }

            // Sort by name
            usersList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }

        return {
            users: usersList,
            companyId: companyIdToLoad,
            message: usersList.length === 0 ? "Tidak ada pengguna yang terdaftar dalam grup ini." : null
        };

    } catch (error: any) {
        console.error(`[ContactsGano Server Load] Gagal memuat pengguna:`, error.stack || error);
        throw svelteKitError(500, `Gagal memuat data pengguna GanoAI: ${error?.message || 'Kesalahan tidak diketahui'}`);
    }
};

function buildUser(docId: string, data: any): User {
    return {
        id: docId,
        userId: data.userId || docId,
        name: data.name || '',
        email: data.email || '',
        companyId: data.companyId || '',
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
    };
}