// src/hooks.server.ts
import { redirect, type Handle, error as SvelteKitError } from '@sveltejs/kit';
import type { UserSessionData } from '$lib/types';
import admin from 'firebase-admin';
import { env } from '$env/dynamic/private';

let adminApp: admin.app.App; // Ini adalah 'sawitPintarAdmin'

try {
    const serviceAccountString = env.SAWITPINTAR_ADMIN_SDK_JSON;
    if (!serviceAccountString) {
        throw new Error("SAWITPINTAR_ADMIN_SDK_JSON environment variable is not set via $env/dynamic/private.");
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
        adminApp = existingApp;
    } else {
        adminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        }, appName);
    }
    console.log("[HOOKS] Firebase Admin SDK 'sawitPintarAdmin' initialized for hooks.");
} catch (e: any) {
    console.error("[HOOKS] CRITICAL: Failed to initialize Firebase Admin SDK 'sawitPintarAdmin' for hooks:", e.message);
}

const PROTECTED_ROUTES_PREFIX = ['/dashboards', '/apps'];
const AUTH_ROUTES_PREFIX = ['/auth/sign-in', '/auth/register'];

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.user = undefined; // Reset di awal

    // 1. Coba dapatkan sesi dari cookie terlebih dahulu
    const sessionCookie = event.cookies.get('app_session');
    if (sessionCookie) {
        try {
            const userSessionFromCookie = JSON.parse(sessionCookie) as UserSessionData;
            // Anda bisa menambahkan validasi tambahan di sini jika perlu (mis. cek timestamp cookie)
            // Untuk sekarang, kita asumsikan cookie yang ada dan bisa di-parse adalah valid.
            // Terutama karena custom claims sudah diverifikasi saat cookie dibuat.
            if (userSessionFromCookie && userSessionFromCookie.email) {
                 event.locals.user = userSessionFromCookie;
                 console.log("[HOOKS] Sesi pengguna ditemukan dari cookie untuk:", userSessionFromCookie.email);
            }
        } catch (e) {
            console.warn("[HOOKS] Gagal mem-parse session cookie:", e);
            event.cookies.delete('app_session', { path: '/' }); // Hapus cookie jika korup
        }
    }

    // 2. Jika tidak ada sesi dari cookie, coba dari Bearer token (untuk API calls atau skenario lain)
    // Ini bersifat opsional jika Anda hanya ingin mengandalkan cookie untuk navigasi browser.
    if (!event.locals.user) {
        const authHeader = event.request.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            const idToken = authHeader.substring(7);
            try {
                if (!adminApp) {
                    console.error("[HOOKS] Firebase Admin SDK 'sawitPintarAdmin' is not available for Bearer token verification.");
                    throw new Error("Admin SDK 'sawitPintarAdmin' not initialized.");
                }
                const decodedToken = await adminApp.auth().verifyIdToken(idToken);
                console.log("[HOOKS] Bearer token berhasil diverifikasi untuk UID:", decodedToken.uid);

                const userSessionFromToken: UserSessionData = {
                    email: decodedToken.email || '',
                    hasGanoAIAccess: decodedToken.hasGanoAIAccess === true,
                    ganoAIUserId: decodedToken.uid,
                    ganoAICompanyId: decodedToken.ganoAICompanyId || undefined,
                    hasRipenessAccess: decodedToken.hasRipenessAccess === true,
                    ripenessUserId: decodedToken.uid,
                    ripenessCompanyId: decodedToken.ripenessCompanyId || undefined,
                    accountActive: decodedToken.accountActive === true,
                };
                event.locals.user = userSessionFromToken;
                console.log("[HOOKS] Sesi pengguna diisi dari Bearer token untuk:", userSessionFromToken.email);
                // Pertimbangkan apakah Anda juga ingin set cookie di sini jika Bearer token valid
                // agar navigasi berikutnya bisa menggunakan cookie.
            } catch (err: any) {
                console.warn(`[HOOKS] Invalid Bearer token presented: ${err.code} - ${err.message}.`);
            }
        }
    }

    const currentPath = event.url.pathname;

    if (PROTECTED_ROUTES_PREFIX.some(prefix => currentPath.startsWith(prefix))) {
        if (!event.locals.user) {
            console.log(`[HOOKS] Protected route ${currentPath} access denied (no session), redirecting to sign-in.`);
            throw redirect(303, `/auth/sign-in?redirectTo=${encodeURIComponent(currentPath)}`);
        } else if (event.locals.user && event.locals.user.accountActive === false) {
            // Tambahan: Jika akun tidak aktif, redirect ke halaman tertentu atau tampilkan error
            console.log(`[HOOKS] Protected route ${currentPath} access denied (account inactive) for ${event.locals.user.email}.`);
            // Anda bisa redirect ke halaman info atau logout dan tampilkan pesan
            // Untuk sekarang, kita redirect ke sign-in dengan pesan error (bisa dihandle di sign-in page)
            event.cookies.delete('app_session', { path: '/' }); // Hapus cookie sesi
            throw redirect(303, `/auth/sign-in?error=account_inactive`);
        }
    }

    if (AUTH_ROUTES_PREFIX.some(prefix => currentPath.startsWith(prefix)) && event.locals.user && event.locals.user.accountActive) {
        let redirectTo = '/';
        if (event.locals.user.hasGanoAIAccess) redirectTo = '/dashboards/analytics-gano';
        else if (event.locals.user.hasRipenessAccess) redirectTo = '/dashboards/analytics-ripeness';
        
        console.log(`[HOOKS] User logged in, redirecting from auth page ${currentPath} to ${redirectTo}`);
        throw redirect(303, redirectTo);
    }

    return resolve(event);
};