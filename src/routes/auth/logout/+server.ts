// src/routes/auth/logout/+server.ts
import { json } from '@sveltejs/kit'; // Hanya butuh json
import type { RequestHandler } from './$types';

const SESSION_COOKIE_NAME = "app_session";

export const POST: RequestHandler = async ({ cookies }) => {
    console.log("[LOGOUT ENDPOINT] Menghapus cookie session...");
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    console.log("[LOGOUT ENDPOINT] Cookie session dihapus.");
    // Kembalikan respons sukses agar fetch di klien tahu operasinya berhasil
    return json({ success: true, message: "Logout berhasil" }, { status: 200 });
};