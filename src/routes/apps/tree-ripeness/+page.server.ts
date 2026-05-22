// src/routes/apps/tree-ripeness/+page.server.ts
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Tree, UserSessionData, TreeGeoJSONProperties, GeoLocation, FruitCounts } from '$lib/types';
import { ripenessDbAdmin } from '$lib/server/adminRipeness';
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
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	} catch (e) {
		return 'Invalid Date';
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const userSession = locals.user as UserSessionData | undefined;

	if (!userSession?.hasRipenessAccess || !userSession.ripenessCompanyId) {
		throw redirect(303, '/auth/sign-in');
	}
	const companyIdToLoad = userSession.ripenessCompanyId;

	if (!ripenessDbAdmin) {
		throw svelteKitError(503, 'Layanan data pohon Ripeness tidak tersedia saat ini.');
	}

	// Ambil parameter filter dari URL
	const filterKawasan = url.searchParams.get('kawasan');
	const filterRipeness = url.searchParams.get('ripenessStatus');

	try {
		// 1. Ambil daftar kawasan yang tersedia untuk dropdown filter
		let daftarKawasan: string[] = [];
		const companyDoc = await ripenessDbAdmin.collection('company').doc(companyIdToLoad).get();
		if (companyDoc.exists) {
			daftarKawasan = companyDoc.data()?.daftarKawasan || [];
			daftarKawasan.sort();
		}

		// 2. Ambil data pengguna untuk mapping userName
		const usersMap = new Map<string, string>();
		const usersColRef = ripenessDbAdmin.collection('users');
		const companyUsersQuery = usersColRef.where('companyId', '==', companyIdToLoad);
		const usersSnapshot = await companyUsersQuery.get();
		usersSnapshot.forEach((userDoc) => {
			usersMap.set(userDoc.id, userDoc.data().name || 'Tanpa Nama');
		});

		// 3. Bangun query pohon dengan filter
		const treesColRef = ripenessDbAdmin.collection(`company/${companyIdToLoad}/tree`);
		let q: admin.firestore.Query = treesColRef;

		if (filterKawasan) {
			q = q.where('kawasan', '==', filterKawasan);
		}
		if (filterRipeness) {
			if (filterRipeness === 'matang') q = q.where('fruitCounts.matang', '>', 0);
			if (filterRipeness === 'belumMatang') q = q.where('fruitCounts.belumMatang', '>', 0);
			if (filterRipeness === 'terlaluMatang') q = q.where('fruitCounts.terlaluMatang', '>', 0);
		}

		// Urutkan berdasarkan update terbaru jika tidak ada filter kematangan, jika ada, urutkan berdasarkan nama
		if (!filterRipeness) {
			q = q.orderBy('date.updatedDate', 'desc');
		} else {
			q = q.orderBy('name', 'asc');
		}

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
				userName: data.userId ? usersMap.get(data.userId) || data.userId : 'Tidak Diketahui',
				fruitCounts: data.fruitCounts || { belumMatang: 0, matang: 0, terlaluMatang: 0 },
				kawasan: data.kawasan,
				date: { createdDate: createdDateISO, updatedDate: updatedDateISO },
				createdDateFormatted: formatDisplayDate(createdDateISO),
				updatedDateFormatted: formatDisplayDate(updatedDateISO)
			};
			treesList.push(serializableTree);

			if (data.location?.latitude != null && data.location?.longitude != null) {
				locations.push(data.location);
				treeFeaturesForMap.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [data.location.longitude, data.location.latitude] },
					properties: {
						id: doc.id,
						name: data.name || `Pohon ID ${doc.id.substring(0, 6)}`,
						img: data.img,
						description: data.description,
						fruitCounts: data.fruitCounts,
						kawasan: data.kawasan || 'N/A'
					}
				});
			}
		});

		const treeDataGeoJSON: FeatureCollection<Point, TreeGeoJSONProperties> | null =
			treeFeaturesForMap.length > 0 ? { type: 'FeatureCollection', features: treeFeaturesForMap } : null;

		let mapCenter: GeoLocation = { latitude: -2.5489, longitude: 118.0149 };
		if (locations.length > 0) {
			const sumLat = locations.reduce((acc, loc) => acc + loc.latitude, 0);
			const sumLng = locations.reduce((acc, loc) => acc + loc.longitude, 0);
			mapCenter = { latitude: sumLat / locations.length, longitude: sumLng / locations.length };
		}

		return {
			trees: treesList,
			treeDataGeoJSON,
			mapCenter,
			companyId: companyIdToLoad,
			mapboxAccessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
			daftarKawasan,
			filters: {
				kawasan: filterKawasan,
				ripenessStatus: filterRipeness
			},
			message: treesList.length === 0 ? 'Tidak ada data pohon yang cocok dengan filter Anda.' : null
		};
	} catch (error: any) {
		console.error(`[TreeRipeness Server Load] Gagal memuat pohon:`, error);
		throw svelteKitError(500, `Gagal memuat data pohon Ripeness: ${error?.message || 'Kesalahan tidak diketahui'}`);
	}
};