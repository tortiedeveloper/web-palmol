// src/routes/apps/chat/+page.server.ts
// PERBAIKAN 1: Impor nama variabel yang benar ('sawitPintarDbAdmin')
import { sawitPintarDbAdmin as db } from '$lib/server/adminSawitPintar';
import { error as svelteKitError, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { UserSessionData } from '$lib/types';
import admin from 'firebase-admin';

function serializeAdminTimestamp(
	timestamp: admin.firestore.Timestamp | undefined | null
): string | null {
	if (timestamp && typeof timestamp.toDate === 'function') {
		return timestamp.toDate().toISOString();
	}
	return null;
}

interface AdminUser {
	id: string;
	name: string;
	img: string;
	email: string;
	validDate?: string | null;
}

export const load: PageServerLoad = async ({ locals }) => {
	const userSession = locals.user as UserSessionData | undefined;

	if (!userSession) {
		throw redirect(303, '/auth/sign-in');
	}

	if (!db) {
		console.error('[Chat Page] Koneksi database SawitPintar tidak tersedia.');
		throw svelteKitError(
			503,
			'Layanan chat tidak tersedia saat ini karena masalah koneksi database.'
		);
	}

	const clientCompanyId = userSession.ganoAICompanyId || userSession.ripenessCompanyId;
	const clientUserId = userSession.ganoAIUserId || userSession.ripenessUserId;

	if (!clientCompanyId || !clientUserId) {
		throw svelteKitError(403, 'Informasi pengguna atau perusahaan tidak lengkap.');
	}

	try {
		const adminsSnap = await db.collection('master').get();

		// PERBAIKAN 2: Berikan tipe data eksplisit untuk 'doc'
		const adminList: AdminUser[] = adminsSnap.docs.map(
			(doc: admin.firestore.QueryDocumentSnapshot) => {
				const data = doc.data();
				return {
					id: doc.id,
					name: data.name,
					img: data.img,
					email: data.email,
					validDate: serializeAdminTimestamp(data.validDate as admin.firestore.Timestamp | undefined)
				};
			}
		);

		const adminIds = adminList.map((admin) => admin.id);

		const conversationsRef = db.collection('conversations');
		const existingConvoQuery = conversationsRef
			.where('clientCompanyId', '==', clientCompanyId)
			.limit(1);

		const existingConvoSnap = await existingConvoQuery.get();
		let conversationId: string;

		if (existingConvoSnap.empty) {
			console.log(`Membuat conversation baru untuk company ${clientCompanyId}`);
			const newConvoRef = await conversationsRef.add({
				clientCompanyId: clientCompanyId,
				participantIds: [clientUserId, ...adminIds],
				createdAt: admin.firestore.FieldValue.serverTimestamp()
			});
			conversationId = newConvoRef.id;
		} else {
			conversationId = existingConvoSnap.docs[0].id;
		}

		return {
			conversationId,
			adminList,
			currentUser: {
				uid: clientUserId,
				email: userSession.email
			}
		};
	} catch (error: any) {
		console.error('Gagal memuat data chat:', error);
		throw svelteKitError(500, 'Gagal memuat data chat.');
	}
};