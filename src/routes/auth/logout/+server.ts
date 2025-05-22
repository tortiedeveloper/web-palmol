// src/routes/auth/logout/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
    const userEmail = locals.user?.email; // locals.user mungkin sudah diisi oleh hooks dari cookie

    // Hapus cookie sesi
    cookies.delete('app_session', { path: '/' });
    console.log(`[LOGOUT ENDPOINT] Session cookie cleared for user ${userEmail || '(unknown session from cookie)'}. Client should also sign out from Firebase.`);
    
    // locals.user di-clear di awal hook berikutnya, jadi tidak perlu di-clear di sini secara eksplisit.
    // Cukup hapus cookie.

    return json({ success: true, message: "Server session cookie cleared." });
};