// src/routes/apps/tree-ripeness/+page.server.ts
import { ripenessDb } from '$lib/firebase/ripenessClient'; // Gunakan DB Ripeness
import { collection, query, where, getDocs, orderBy, type Timestamp as FirebaseTimestampType } from 'firebase/firestore';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoadEvent, PageServerLoad } from './$types';
import type { Tree, User, FirebaseTimestamp, UserSessionData } from '$lib/types'; // Tipe Tree sudah termasuk fruitCounts opsional

// Helper function untuk konversi Firebase Timestamp ke string ISO atau null
function serializeTimestamp(timestamp: FirebaseTimestampType | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

// Helper function untuk format tanggal ke dd MMM yyyy (atau format lain yang Anda suka)
function formatDisplayDate(timestamp: FirebaseTimestampType | undefined | null): string {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    return timestamp.toDate().toLocaleDateString('id-ID', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

export const load: PageServerLoad = async (event: PageServerLoadEvent) => {
    const userSession = event.locals.user as UserSessionData | undefined;

    if (!userSession || !userSession.hasRipenessAccess || !userSession.ripenessCompanyId) {
        console.warn("[TreeRipeness Load] Sesi Ripeness tidak valid atau companyId tidak ada, redirecting ke login.");
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;

    console.log(`[TreeRipeness Load] Memuat data pohon untuk perusahaan ID Ripeness: ${companyIdToLoad}`);

    try {
        const usersMap = new Map<string, string>();
        const usersColRef = collection(ripenessDb, 'users'); // Gunakan ripenessDb
        const companyUsersQuery = query(usersColRef, where('companyId', '==', companyIdToLoad));
        const usersSnapshot = await getDocs(companyUsersQuery);
        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data() as User;
            usersMap.set(userDoc.id, userData.name || 'Tanpa Nama');
        });

        const treesColRef = collection(ripenessDb, `company/${companyIdToLoad}/tree`); // Gunakan ripenessDb
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
                last_status: data.last_status, // Mungkin tidak dipakai atau diinterpretasi berbeda untuk Ripeness
                location: data.location,
                userId: data.userId,
                userName: data.userId ? usersMap.get(data.userId) || data.userId : 'Tidak Diketahui',
                fruitCounts: data.fruitCounts || { belumMatang: 0, matang: 0, terlaluMatang: 0 }, // Pastikan ada fallback
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
        console.error(`Error loading trees for company ${companyIdToLoad} di tree-ripeness:`, error);
        return {
            trees: [],
            companyId: companyIdToLoad,
            error: `Gagal memuat data pohon (Ripeness): ${error.message}`
        };
    }
};