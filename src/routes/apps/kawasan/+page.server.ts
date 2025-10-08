// src/routes/apps/kawasan/+page.server.ts
import { ganoAIDbAdmin } from '$lib/server/adminGanoAI';
import { ripenessDbAdmin } from '$lib/server/adminRipeness';
import { error as svelteKitError, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { UserSessionData } from '$lib/types';
import admin from 'firebase-admin';

export const load: PageServerLoad = async ({ locals }) => {
	const userSession = locals.user as UserSessionData | undefined;

	// --- PERUBAHAN DI SINI ---
	// Cek userSession terlebih dahulu sebelum mengakses propertinya.
	if (!userSession) {
		throw redirect(303, '/auth/sign-in');
	}
	// Pastikan user memiliki setidaknya satu companyId.
	if (!userSession.ganoAICompanyId && !userSession.ripenessCompanyId) {
		// Anda bisa arahkan ke halaman lain atau tampilkan pesan error
		throw svelteKitError(403, 'Akun Anda tidak terhubung dengan perusahaan manapun.');
	}
	// --- AKHIR PERUBAHAN ---


	let ganoKawasan: string[] = [];
	let ripenessKawasan: string[] = [];

	try {
        // Kode selanjutnya tidak perlu diubah, karena TypeScript sekarang tahu userSession tidak undefined.
		if (userSession.ganoAICompanyId && ganoAIDbAdmin) {
			const doc = await ganoAIDbAdmin.collection('company').doc(userSession.ganoAICompanyId).get();
			if (doc.exists) {
				ganoKawasan = doc.data()?.daftarKawasan || [];
			}
		}

		if (userSession.ripenessCompanyId && ripenessDbAdmin) {
			const doc = await ripenessDbAdmin.collection('company').doc(userSession.ripenessCompanyId).get();
			if (doc.exists) {
				ripenessKawasan = doc.data()?.daftarKawasan || [];
			}
		}

		// Gabungkan dan hilangkan duplikat
		const combinedKawasan = [...new Set([...ganoKawasan, ...ripenessKawasan])];
		combinedKawasan.sort(); // Urutkan berdasarkan abjad

		return {
			daftarKawasan: combinedKawasan
		};
	} catch (error: any) {
		console.error('Gagal memuat data kawasan:', error);
		throw svelteKitError(500, 'Gagal memuat data kawasan dari server.');
	}
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const userSession = locals.user as UserSessionData | undefined;
		if (!userSession) return fail(401, { message: 'Tidak terautentikasi' });

		const formData = await request.formData();
        
        // --- PERUBAHAN DI SINI ---
		// Ambil semua input yang memiliki name="kawasan" sebagai array
		const kawasanInputs = formData.getAll('kawasan') as string[];

		if (!kawasanInputs || kawasanInputs.length === 0) {
			return fail(400, { message: 'Input kawasan tidak boleh kosong.' });
		}
        
		// Filter input yang kosong dan hapus spasi berlebih
		const newKawasan = kawasanInputs.map(k => k.trim()).filter(Boolean);
        // --- AKHIR PERUBAHAN ---

		if (newKawasan.length === 0) {
			return fail(400, { message: 'Input tidak valid.' });
		}

		try {
			const updatePromises = [];

			if (userSession.ganoAICompanyId && ganoAIDbAdmin) {
				const ref = ganoAIDbAdmin.collection('company').doc(userSession.ganoAICompanyId);
				updatePromises.push(ref.update({
					daftarKawasan: admin.firestore.FieldValue.arrayUnion(...newKawasan)
				}));
			}

			if (userSession.ripenessCompanyId && ripenessDbAdmin) {
				const ref = ripenessDbAdmin.collection('company').doc(userSession.ripenessCompanyId);
				updatePromises.push(ref.update({
					daftarKawasan: admin.firestore.FieldValue.arrayUnion(...newKawasan)
				}));
			}

			await Promise.all(updatePromises);
			return { success: true, message: `${newKawasan.length} kawasan berhasil ditambahkan.` };
		} catch (error) {
			console.error("Error adding kawasan:", error);
			return fail(500, { message: "Gagal menyimpan data ke server." });
		}
	},

	delete: async ({ request, locals }) => {
		const userSession = locals.user as UserSessionData | undefined;
		if (!userSession) return fail(401, { message: 'Tidak terautentikasi' });

		const formData = await request.formData();
		const kawasanToDelete = formData.get('kawasan') as string;

		if (!kawasanToDelete) {
			return fail(400, { message: 'Nama kawasan yang akan dihapus tidak valid.' });
		}

		try {
			const deletePromises = [];

			if (userSession.ganoAICompanyId && ganoAIDbAdmin) {
				const ref = ganoAIDbAdmin.collection('company').doc(userSession.ganoAICompanyId);
				deletePromises.push(ref.update({
					daftarKawasan: admin.firestore.FieldValue.arrayRemove(kawasanToDelete)
				}));
			}

			if (userSession.ripenessCompanyId && ripenessDbAdmin) {
				const ref = ripenessDbAdmin.collection('company').doc(userSession.ripenessCompanyId);
				deletePromises.push(ref.update({
					daftarKawasan: admin.firestore.FieldValue.arrayRemove(kawasanToDelete)
				}));
			}
			await Promise.all(deletePromises);
			return { success: true, message: `Kawasan "${kawasanToDelete}" berhasil dihapus.` };
		} catch (error) {
			console.error("Error deleting kawasan:", error);
			return fail(500, { message: "Gagal menghapus data dari server." });
		}
	}
};