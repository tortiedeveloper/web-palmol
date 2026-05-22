// src/routes/apps/kebun-manager/+page.server.ts
import { redirect, error as svelteKitError, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { UserSessionData } from '$lib/types';
import { ganoAIDbAdmin } from '$lib/server/adminGanoAI';
import admin from 'firebase-admin';

export interface KebunData {
    id: string;
    companyName: string;
    luasKebun: number;
    isActive: boolean;
    daftarKawasan: string[];
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
                    daftarKawasan: data.daftarKawasan || [],
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

export const actions: Actions = {
    addKawasan: async ({ request, locals }) => {
        const userSession = locals.user as UserSessionData | undefined;
        if (!userSession?.hasGanoAIAccess || !userSession.groupIdGano) {
            return fail(401, { message: 'Tidak terautentikasi' });
        }

        const formData = await request.formData();
        const companyId = formData.get('companyId') as string;
        const kawasanInputs = formData.getAll('kawasan') as string[];

        if (!companyId) {
            return fail(400, { message: 'ID kebun tidak valid.' });
        }
        if (!kawasanInputs || kawasanInputs.length === 0) {
            return fail(400, { message: 'Input kawasan tidak boleh kosong.' });
        }

        const newKawasan = kawasanInputs.map(k => k.trim()).filter(Boolean);
        if (newKawasan.length === 0) {
            return fail(400, { message: 'Input tidak valid.' });
        }

        try {
            if (!ganoAIDbAdmin) {
                return fail(503, { message: 'Layanan data GanoAI tidak tersedia saat ini.' });
            }
            const ref = ganoAIDbAdmin.collection('company').doc(companyId);
            await ref.update({
                daftarKawasan: admin.firestore.FieldValue.arrayUnion(...newKawasan)
            });
            return { success: true, message: `${newKawasan.length} kawasan berhasil ditambahkan.` };
        } catch (error) {
            console.error("[KebunManager] Error adding kawasan:", error);
            return fail(500, { message: "Gagal menyimpan data ke server." });
        }
    },

    deleteKawasan: async ({ request, locals }) => {
        const userSession = locals.user as UserSessionData | undefined;
        if (!userSession?.hasGanoAIAccess || !userSession.groupIdGano) {
            return fail(401, { message: 'Tidak terautentikasi' });
        }

        const formData = await request.formData();
        const companyId = formData.get('companyId') as string;
        const kawasanToDelete = formData.get('kawasan') as string;

        if (!companyId) {
            return fail(400, { message: 'ID kebun tidak valid.' });
        }
        if (!kawasanToDelete) {
            return fail(400, { message: 'Nama kawasan yang akan dihapus tidak valid.' });
        }

        try {
            if (!ganoAIDbAdmin) {
                return fail(503, { message: 'Layanan data GanoAI tidak tersedia saat ini.' });
            }
            const ref = ganoAIDbAdmin.collection('company').doc(companyId);
            await ref.update({
                daftarKawasan: admin.firestore.FieldValue.arrayRemove(kawasanToDelete)
            });
            return { success: true, message: `Kawasan "${kawasanToDelete}" berhasil dihapus.` };
        } catch (error) {
            console.error("[KebunManager] Error deleting kawasan:", error);
            return fail(500, { message: "Gagal menghapus data dari server." });
        }
    },

    addKebun: async ({ request, locals }) => {
        const userSession = locals.user as UserSessionData | undefined;
        if (!userSession?.hasGanoAIAccess || !userSession.groupIdGano) {
            return fail(401, { message: 'Tidak terautentikasi' });
        }

        const groupId = userSession.groupIdGano;
        const formData = await request.formData();

        const companyName = (formData.get('company_name') as string)?.trim();
        const luasKebunStr = formData.get('luasKebun') as string;
        const luasKebun = parseFloat(luasKebunStr);
        const polygonJson = formData.get('polygon') as string;
        const kawasanInputs = formData.getAll('kawasan') as string[];

        // Validasi input
        if (!companyName) {
            return fail(400, { message: 'Nama kebun wajib diisi.' });
        }
        if (isNaN(luasKebun) || luasKebun <= 0) {
            return fail(400, { message: 'Luas kebun tidak valid.' });
        }

        const newKawasan = kawasanInputs.map(k => k.trim()).filter(Boolean);
        if (newKawasan.length === 0) {
            return fail(400, { message: 'Minimal harus ada 1 kawasan.' });
        }

        let polygon: admin.firestore.GeoPoint[] = [];
        try {
            const parsedPolygon = JSON.parse(polygonJson);
            if (!Array.isArray(parsedPolygon) || parsedPolygon.length < 3) {
                return fail(400, { message: 'Polygon minimal harus memiliki 3 titik.' });
            }
            polygon = parsedPolygon.map((p: [number, number]) => {
                if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number') {
                    throw new Error('Invalid polygon coordinate');
                }
                return new admin.firestore.GeoPoint(p[0], p[1]);
            });
        } catch (e) {
            return fail(400, { message: 'Data polygon tidak valid.' });
        }

        try {
            if (!ganoAIDbAdmin) {
                return fail(503, { message: 'Layanan data GanoAI tidak tersedia saat ini.' });
            }

            const db = ganoAIDbAdmin;

            // 1. Fetch group data untuk cek kuota
            const groupDoc = await db.collection('groups').doc(groupId).get();
            if (!groupDoc.exists) {
                return fail(404, { message: 'Data grup tidak ditemukan.' });
            }

            const groupData = groupDoc.data()!;
            const currentTotalHektar = groupData.totalHektar || 0;
            const maxHektar = groupData.maxHektar || 0;

            if (currentTotalHektar + luasKebun > maxHektar) {
                return fail(400, { 
                    message: `Luas kebun melebihi sisa kuota. Sisa kuota: ${(maxHektar - currentTotalHektar).toFixed(1)} Ha.` 
                });
            }

            // 2. Buat dokumen company baru
            const companyRef = db.collection('company').doc();
            const newCompanyId = companyRef.id;

            await companyRef.set({
                company_name: companyName,
                consultationId: '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                daftarKawasan: newKawasan,
                isCompany: true,
                luasKebun: luasKebun,
                onRequest: false,
                ownerGroupId: groupId,
                polygon: polygon,
            });

            // 3. Update group doc
            const groupRef = db.collection('groups').doc(groupId);
            await groupRef.update({
                companies: admin.firestore.FieldValue.arrayUnion(newCompanyId),
                totalHektar: currentTotalHektar + luasKebun,
            });

            console.log(`[KebunManager] Kebun baru dibuat: ${newCompanyId} (${companyName}), luas: ${luasKebun} Ha`);

            return { 
                success: true, 
                message: `Kebun "${companyName}" berhasil ditambahkan.` 
            };

        } catch (error: any) {
            console.error("[KebunManager] Error adding kebun:", error);
            return fail(500, { message: error.message || "Gagal menyimpan data ke server." });
        }
    }
};
