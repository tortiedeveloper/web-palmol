// src/lib/server/adminRipeness.ts
import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { env } from '$env/dynamic/private';

const RIPENESS_ADMIN_APP_NAME = 'ripenessAdmin';

let ripenessAdminAppInternalInstance: admin.app.App | undefined = undefined;
let ripenessDbAdminInternalInstance: Firestore | null = null;

try {
    const saRipenessString = env.RIPENESS_ADMIN_SDK_JSON;
    if (!saRipenessString) {
        console.warn(`[AdminRipeness] Peringatan: Environment variable RIPENESS_ADMIN_SDK_JSON tidak di-set via $env/dynamic/private. Layanan Ripeness Admin tidak akan berfungsi.`);
    } else {
        const serviceAccountRipeness = JSON.parse(saRipenessString);

        // SOLUSI: Ganti literal \\n menjadi \n dalam private_key
        if (serviceAccountRipeness.private_key) {
            serviceAccountRipeness.private_key = serviceAccountRipeness.private_key.replace(/\\n/g, '\n');
        } else {
            throw new Error("Private key is missing in RIPENESS_ADMIN_SDK_JSON.");
        }
        
        const existingApp = admin.apps.find(app => app?.name === RIPENESS_ADMIN_APP_NAME);

        if (existingApp) {
            ripenessAdminAppInternalInstance = existingApp;
            console.log(`[AdminRipeness] Menggunakan instance Firebase Admin SDK '${RIPENESS_ADMIN_APP_NAME}' yang sudah ada.`);
        } else {
            ripenessAdminAppInternalInstance = admin.initializeApp({
                credential: admin.credential.cert(serviceAccountRipeness)
            }, RIPENESS_ADMIN_APP_NAME);
            console.log(`[AdminRipeness] Firebase Admin SDK '${RIPENESS_ADMIN_APP_NAME}' berhasil diinisialisasi.`);
        }

        if (ripenessAdminAppInternalInstance) {
            ripenessDbAdminInternalInstance = ripenessAdminAppInternalInstance.firestore();
            console.log(`[AdminRipeness] Instance Firestore untuk ${RIPENESS_ADMIN_APP_NAME} berhasil didapatkan.`);
        }
    }
} catch (e: any) {
    console.error(`[AdminRipeness] KRITIKAL: Gagal menginisialisasi ${RIPENESS_ADMIN_APP_NAME} Admin SDK atau Firestore:`, e.message, e.stack ? `\nStack: ${e.stack}` : '');
}

export const ripenessDbAdmin: Firestore | null = ripenessDbAdminInternalInstance;
export const ripenessAdminApp: admin.app.App | undefined = ripenessAdminAppInternalInstance;