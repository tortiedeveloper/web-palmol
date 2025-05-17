// src/routes/+page.server.ts (PERBAIKAN)
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { UserSessionData } from '$lib/types'; // Impor tipe session Anda

export const load: PageServerLoad = ({ locals }) => {
    const userSession = locals.user as UserSessionData | undefined; // Ambil dari event.locals

    if (userSession) {
        // Pengguna sudah login, arahkan ke dashboard yang sesuai
        if (userSession.hasGanoAIAccess) {
            // Prioritaskan GanoAI jika punya akses kedua-duanya atau hanya GanoAI
            throw redirect(303, '/dashboards/analytics-gano');
        } else if (userSession.hasRipenessAccess) {
            // Jika hanya punya akses Ripeness
            throw redirect(303, '/dashboards/analytics-ripeness');
        } else {
            // Kasus aneh: punya sesi tapi tidak punya akses ke mana pun? Arahkan ke login.
            // Ini juga bisa terjadi jika cookie ada tapi isinya tidak valid dan hooks menghapusnya,
            // tapi jika hooks menghapus, locals.user akan undefined.
            // Untuk keamanan, jika tidak ada akses teridentifikasi, arahkan ke login.
            console.warn("User session ada tapi tidak ada akses teridentifikasi, redirecting ke login.");
            throw redirect(303, '/auth/sign-in');
        }
    }

    // Jika tidak ada userSession (pengguna belum login), arahkan ke halaman sign-in
    throw redirect(303, '/auth/sign-in');
};