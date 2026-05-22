// src/routes/apps/kawasan-ripeness/+page.server.ts
import { ripenessDbAdmin } from '$lib/server/adminRipeness';
import { error as svelteKitError, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { UserSessionData } from '$lib/types';
import admin from 'firebase-admin';

export const load: PageServerLoad = async ({ locals }) => {
	const userSession = locals.user as UserSessionData | undefined;

	if (!userSession) {
		throw redirect(303, '/auth/sign-in');
	}

	if (!userSession.hasRipenessAccess || !userSession.ripenessCompanyId) {
		throw svelteKitError(403, 'Akun Anda tidak terhubung dengan perusahaan SawitHarvest.');
	}

	try {
		if (!ripenessDbAdmin) {
			throw svelteKitError(503, 'Layanan data SawitHarvest tidak tersedia saat ini.');
		}
		const companyDoc = await ripenessDbAdmin.collection('company').doc(userSession.ripenessCompanyId).get();
		const daftarKawasan: string[] = companyDoc.exists ? (companyDoc.data()?.daftarKawasan || []) : [];
		daftarKawasan.sort();

		return {
			daftarKawasan,
			companyId: userSession.ripenessCompanyId
		};
	} catch (error: any) {
		console.error('Gagal memuat data kawasan ripeness:', error);
		throw svelteKitError(500, 'Gagal memuat data kawasan dari server.');
	}
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const userSession = locals.user as UserSessionData | undefined;
		if (!userSession) return fail(401, { message: 'Tidak terautentikasi' });
		if (!userSession.ripenessCompanyId) return fail(403, { message: 'Akun tidak terhubung dengan perusahaan SawitHarvest.' });

		const formData = await request.formData();
		const kawasanInputs = formData.getAll('kawasan') as string[];

		if (!kawasanInputs || kawasanInputs.length === 0) {
			return fail(400, { message: 'Input kawasan tidak boleh kosong.' });
		}

		const newKawasan = kawasanInputs.map(k => k.trim()).filter(Boolean);

		if (newKawasan.length === 0) {
			return fail(400, { message: 'Input tidak valid.' });
		}

		try {
			if (!ripenessDbAdmin) {
				return fail(503, { message: 'Layanan data SawitHarvest tidak tersedia saat ini.' });
			}
			const ref = ripenessDbAdmin.collection('company').doc(userSession.ripenessCompanyId);
			await ref.update({
				daftarKawasan: admin.firestore.FieldValue.arrayUnion(...newKawasan)
			});
			return { success: true, message: `${newKawasan.length} kawasan berhasil ditambahkan.` };
		} catch (error) {
			console.error("Error adding kawasan ripeness:", error);
			return fail(500, { message: "Gagal menyimpan data ke server." });
		}
	},

	delete: async ({ request, locals }) => {
		const userSession = locals.user as UserSessionData | undefined;
		if (!userSession) return fail(401, { message: 'Tidak terautentikasi' });
		if (!userSession.ripenessCompanyId) return fail(403, { message: 'Akun tidak terhubung dengan perusahaan SawitHarvest.' });

		const formData = await request.formData();
		const kawasanToDelete = formData.get('kawasan') as string;

		if (!kawasanToDelete) {
			return fail(400, { message: 'Nama kawasan yang akan dihapus tidak valid.' });
		}

		try {
			if (!ripenessDbAdmin) {
				return fail(503, { message: 'Layanan data SawitHarvest tidak tersedia saat ini.' });
			}
			const ref = ripenessDbAdmin.collection('company').doc(userSession.ripenessCompanyId);
			await ref.update({
				daftarKawasan: admin.firestore.FieldValue.arrayRemove(kawasanToDelete)
			});
			return { success: true, message: `Kawasan "${kawasanToDelete}" berhasil dihapus.` };
		} catch (error) {
			console.error("Error deleting kawasan ripeness:", error);
			return fail(500, { message: "Gagal menghapus data dari server." });
		}
	}
};