// src/routes/apps/kebun-manager/+page.server.ts
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { UserSessionData } from '$lib/types';
import { ganoAIDbAdmin } from '$lib/server/adminGanoAI';

export interface KebunData {
    id: string;
    companyName: string;
    luasKebun: number;
    isActive: boolean;
}

export interface GroupData {
    id: string;
    maxHektar: number;
    totalHektar: number;
    memberCount: number;
}

interface KebunManagerPageData {
    kebunList: KebunData[];
    groupData: GroupData | null;
    activeCompanyId: string;
    mapboxAccessToken: string;
}

export const load: PageServerLoad = async ({ locals }) => {
    const userSession = locals.user as UserSessionData | undefined;
    
    // 1. Verifikasi akses
    if (!userSession?.hasGanoAIAccess || !userSession.groupIdGano) {
        throw redirect(303, '/auth/sign-in');
    }

    if (!ganoAIDbAdmin) {
        throw svelteKitError(503, 'Layanan data GanoAI tidak tersedia saat ini.');
    }

    const groupId = userSession.groupIdGano;
    const activeCompanyId = (userSession.ganoAIActiveCompanyId || userSession.ganoAICompanyId) || '';

    try {
        // 2. Fetch group data
        const groupDoc = await ganoAIDbAdmin.collection('groups').doc(groupId).get();
        let groupData: GroupData | null = null;
        
        if (groupDoc.exists) {
            const gData = groupDoc.data();
            groupData = {
                id: groupDoc.id,
                maxHektar: gData?.maxHektar || 0,
                totalHektar: gData?.totalHektar || 0,
                memberCount: gData?.members?.length || 0,
            };
        }

        // 3. Fetch companies dalam grup
        const kebunList: KebunData[] = [];
        
        if (groupData) {
            // Query companies dengan ownerGroupId == groupId
            const companiesSnapshot = await ganoAIDbAdmin
                .collection('company')
                .where('ownerGroupId', '==', groupId)
                .get();

            companiesSnapshot.forEach((doc) => {
                const data = doc.data();
                kebunList.push({
                    id: doc.id,
                    companyName: data.company_name || 'Kebun Tanpa Nama',
                    luasKebun: data.luasKebun || 0,
                    isActive: doc.id === activeCompanyId,
                });
            });

            // Sort: active first, then by name
            kebunList.sort((a, b) => {
                if (a.isActive && !b.isActive) return -1;
                if (!a.isActive && b.isActive) return 1;
                return a.companyName.localeCompare(b.companyName);
            });
        }

        // 4. Return data
        const mapboxAccessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

        return {
            kebunList,
            groupData,
            activeCompanyId,
            mapboxAccessToken,
        } as KebunManagerPageData;

    } catch (error: any) {
        console.error('[KebunManager] Error fetching data:', error);
        throw svelteKitError(500, 'Gagal memuat data kebun. Silakan coba lagi.');
    }
};
