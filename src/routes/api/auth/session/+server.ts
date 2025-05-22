// src/routes/api/auth/session/+server.ts
import { json, error as SvelteKitError, type RequestHandler } from '@sveltejs/kit'; // <--- PERBAIKAN DI SINI
import admin from 'firebase-admin';
import { env } from '$env/dynamic/private';
import type { UserSessionData } from '$lib/types';

// Inisialisasi Firebase Admin SDK utama (sawitPintarAdmin)
let mainAdminApp: admin.app.App;
try {
    const serviceAccountString = env.SAWITPINTAR_ADMIN_SDK_JSON;
    if (!serviceAccountString) {
        throw new Error("SAWITPINTAR_ADMIN_SDK_JSON environment variable is not set.");
    }
    const serviceAccount = JSON.parse(serviceAccountString);
    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    } else {
        throw new Error("Private key is missing in SAWITPINTAR_ADMIN_SDK_JSON.");
    }

    const appName = 'sawitPintarAdmin';
    const existingApp = admin.apps.find(app => app?.name === appName);
    if (existingApp) {
        mainAdminApp = existingApp;
    } else {
        mainAdminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        }, appName);
    }
    console.log("[API Session] Firebase Admin SDK 'sawitPintarAdmin' ready for session endpoint.");
} catch (e: any) {
    console.error("[API Session] CRITICAL: Failed to initialize Firebase Admin SDK for session endpoint:", e.message);
}

export const POST: RequestHandler = async ({ request, cookies }) => { // Tipe untuk 'request' dan 'cookies' akan diinferensikan dari RequestHandler @sveltejs/kit
    if (!mainAdminApp) {
        console.error("[API Session] Firebase Admin SDK 'sawitPintarAdmin' not initialized. Cannot create session.");
        throw SvelteKitError(503, "Layanan autentikasi tidak tersedia saat ini.");
    }

    try {
        const body = await request.json();
        const idToken = body.token;

        if (!idToken || typeof idToken !== 'string') {
            throw SvelteKitError(400, "ID Token tidak disediakan atau format salah.");
        }

        console.log("[API Session] Menerima token, mencoba verifikasi...");
        const decodedToken = await mainAdminApp.auth().verifyIdToken(idToken);
        console.log("[API Session] Token berhasil diverifikasi untuk UID:", decodedToken.uid);

        const userSession: UserSessionData = {
            email: decodedToken.email || '',
            hasGanoAIAccess: decodedToken.hasGanoAIAccess === true,
            ganoAIUserId: decodedToken.uid,
            ganoAICompanyId: decodedToken.ganoAICompanyId || undefined,
            hasRipenessAccess: decodedToken.hasRipenessAccess === true,
            ripenessUserId: decodedToken.uid,
            ripenessCompanyId: decodedToken.ripenessCompanyId || undefined,
            accountActive: decodedToken.accountActive === true,
            // isGanoAIPremium: decodedToken.isGanoAIPremium === true,
        };

        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 hari
        cookies.set('app_session', JSON.stringify(userSession), {
            path: '/',
            httpOnly: true,
            secure: env.NODE_ENV === 'production', // Menggunakan env dari $env/dynamic/private jika NODE_ENV tidak terset global
            maxAge: expiresIn / 1000, 
            sameSite: 'lax',
        });

        console.log("[API Session] Cookie sesi berhasil di-set untuk:", userSession.email);
        // Mengembalikan claims dalam respons agar klien bisa langsung menggunakannya jika perlu,
        // selain mengandalkan invalidateAll() untuk memuat ulang data dari server.
        return json({ status: 'success', message: 'Sesi berhasil dibuat.', claims: userSession });

    } catch (error: any) {
        console.error('[API Session] Gagal memverifikasi token atau mengatur cookie:', error.message, error.code);
        // Memberikan respons error yang lebih spesifik berdasarkan kode error Firebase Auth
        if (error.code && typeof error.code === 'string' && error.code.startsWith('auth/')) {
             throw SvelteKitError(401, `Token tidak valid: ${error.message}`);
        }
        // Jika error bukan SvelteKitError, bungkus dengan SvelteKitError
        if (error.status && error.body) { // Cek jika ini sudah SvelteKitError
            throw error;
        }
        throw SvelteKitError(500, error.message || 'Gagal memproses permintaan sesi.');
    }
};