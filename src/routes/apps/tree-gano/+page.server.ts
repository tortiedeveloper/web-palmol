// src/routes/apps/tree-gano/+page.server.ts
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Tree, UserSessionData, TreeGeoJSONProperties, GeoLocation } from '$lib/types';
import { ganoAIDbAdmin } from '$lib/server/adminGanoAI';
import admin from 'firebase-admin';
import type { FeatureCollection, Point } from 'geojson';
import dayjs from 'dayjs';

function serializeAdminTimestamp(timestamp: admin.firestore.Timestamp | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

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

export const load: PageServerLoad = async ({ locals, url }) => {
    const userSession = locals.user as UserSessionData | undefined;
    if (!userSession?.hasGanoAIAccess || !userSession.ganoAICompanyId) {
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ganoAICompanyId;
    if (!ganoAIDbAdmin) {
        throw svelteKitError(503, "Layanan data pohon GanoAI tidak tersedia saat ini.");
    }

    const filterStatus = url.searchParams.get('status');
    const startDateStr = url.searchParams.get('startDate');
    const endDateStr = url.searchParams.get('endDate');

    try {
        const usersMap = new Map<string, string>();
        const usersColRef = ganoAIDbAdmin.collection('users');
        const companyUsersQuery = usersColRef.where('companyId', '==', companyIdToLoad);
        const usersSnapshot = await companyUsersQuery.get();
        usersSnapshot.forEach(userDoc => {
            usersMap.set(userDoc.id, userDoc.data().name || 'Tanpa Nama');
        });

        const treesColRef = ganoAIDbAdmin.collection(`company/${companyIdToLoad}/tree`);
        let q: admin.firestore.Query = treesColRef;

        if (filterStatus && ['sick', 'recovered', 'maintenance'].includes(filterStatus)) {
            q = q.where('last_status', '==', filterStatus);
        }
        if (startDateStr) {
            q = q.where('date.updatedDate', '>=', dayjs(startDateStr).startOf('day').toDate());
        }
        if (endDateStr) {
            q = q.where('date.updatedDate', '<=', dayjs(endDateStr).endOf('day').toDate());
        }

        q = q.orderBy('date.updatedDate', 'desc');

        const querySnapshot = await q.get();
        const treesList: Tree[] = [];
        const treeFeaturesForMap: any[] = [];
        const locations: GeoLocation[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const createdDateISO = serializeAdminTimestamp(data.date?.createdDate as admin.firestore.Timestamp | undefined);
            const updatedDateISO = serializeAdminTimestamp(data.date?.updatedDate as admin.firestore.Timestamp | undefined);

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
                date: { createdDate: createdDateISO, updatedDate: updatedDateISO },
                createdDateFormatted: formatDisplayDate(createdDateISO),
                updatedDateFormatted: formatDisplayDate(updatedDateISO),
            };
            treesList.push(serializableTree);
            
            if (data.location?.latitude != null && data.location?.longitude != null) {
                locations.push(data.location); // Kumpulkan lokasi untuk menghitung pusat
                treeFeaturesForMap.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [data.location.longitude, data.location.latitude] },
                    properties: {
                        id: doc.id,
                        name: data.name || `Pohon ID ${doc.id.substring(0,6)}`,
                        last_status: data.last_status || 'unknown',
                        img: data.img,
                        description: data.description
                    }
                });
            }
        });
        
        const treeDataGeoJSON: FeatureCollection<Point, TreeGeoJSONProperties> | null = treeFeaturesForMap.length > 0
            ? { type: 'FeatureCollection', features: treeFeaturesForMap }
            : null;

        // --- HITUNG TITIK TENGAH PETA ---
        let mapCenter: GeoLocation = { latitude: -2.5489, longitude: 118.0149 }; // Default Indonesia
        if (locations.length > 0) {
            const sumLat = locations.reduce((acc, loc) => acc + loc.latitude, 0);
            const sumLng = locations.reduce((acc, loc) => acc + loc.longitude, 0);
            mapCenter = { latitude: sumLat / locations.length, longitude: sumLng / locations.length };
        }
        // ---------------------------------

        return {
            trees: treesList,
            treeDataGeoJSON,
            mapCenter, // Kirim titik tengah ke UI
            companyId: companyIdToLoad,
            mapboxAccessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
            filters: { status: filterStatus, startDate: startDateStr, endDate: endDateStr },
            message: treesList.length === 0 ? 'Tidak ada data pohon yang cocok dengan filter Anda.' : null
        };

    } catch (error: any) {
        console.error(`[TreeGano Server Load] Gagal memuat pohon:`, error);
        throw svelteKitError(500, `Gagal memuat data pohon GanoAI: ${error.message}`);
    }
};