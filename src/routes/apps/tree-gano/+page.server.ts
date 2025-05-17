// src/routes/apps/tree-gano/+page.server.ts
import { ganoAIDb } from '$lib/firebase/ganoAIClient';
import { collection, query, where, getDocs, orderBy, type Timestamp as FirebaseTimestampType } from 'firebase/firestore';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoadEvent, PageServerLoad } from './$types';
import type { Tree, User, FirebaseTimestamp, TreeDate, UserSessionData } from '$lib/types';


function serializeTimestamp(timestamp: FirebaseTimestampType | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

function formatDisplayDate(timestamp: FirebaseTimestampType | undefined | null): string {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return timestamp.toDate().toLocaleDateString('id-ID', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

export const load: PageServerLoad = async (event: PageServerLoadEvent) => {
    const userSession = event.locals.user as UserSessionData | undefined;

    if (!userSession || !userSession.hasGanoAIAccess || !userSession.ganoAICompanyId) {
        console.warn("[TreeGano Load] Sesi GanoAI tidak valid atau companyId tidak ada, redirecting ke login.");
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ganoAICompanyId;

    console.log(`[TreeGano Load] Memuat data pohon untuk perusahaan ID GanoAI: ${companyIdToLoad}`);

    try {
        const usersMap = new Map<string, string>();
        const usersColRef = collection(ganoAIDb, 'users');
        const companyUsersQuery = query(usersColRef, where('companyId', '==', companyIdToLoad));
        const usersSnapshot = await getDocs(companyUsersQuery);
        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data() as User;
            usersMap.set(userDoc.id, userData.name || 'Tanpa Nama');
        });

        const treesColRef = collection(ganoAIDb, `company/${companyIdToLoad}/tree`);
        const q = query(treesColRef, orderBy('name', 'asc'));
        
        const querySnapshot = await getDocs(q);
        const treesList: Tree[] = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const serializableTree: Tree = {
                id: doc.id,
                companyId: data.companyId,
                name: data.name,
                description: data.description,
                img: data.img,
                last_status: data.last_status,
                location: data.location,
                userId: data.userId,
                userName: data.userId ? usersMap.get(data.userId) || data.userId : 'Tidak Diketahui',
                date: {
                    createdDate: serializeTimestamp(data.date?.createdDate as FirebaseTimestampType | undefined),
                    updatedDate: serializeTimestamp(data.date?.updatedDate as FirebaseTimestampType | undefined),
                },
                createdDateFormatted: formatDisplayDate(data.date?.createdDate as FirebaseTimestampType | undefined),
                updatedDateFormatted: formatDisplayDate(data.date?.updatedDate as FirebaseTimestampType | undefined),
            };
            treesList.push(serializableTree);
        });

        return {
            trees: treesList,
            companyId: companyIdToLoad
        };

    } catch (error: any) {
        console.error(`Error loading trees for company ${companyIdToLoad} di tree-gano:`, error);
        return {
            trees: [],
            companyId: companyIdToLoad,
            error: `Gagal memuat data pohon: ${error.message}`
        };
    }
};