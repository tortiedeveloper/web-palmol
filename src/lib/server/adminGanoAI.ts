// src/lib/server/adminGanoAI.ts
import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { env } from '$env/dynamic/private';

const GANOAI_ADMIN_APP_NAME = 'ganoAIAdmin';

let ganoAIAdminAppInternalInstance: admin.app.App | undefined = undefined;
let ganoAIDbAdminInternalInstance: Firestore | null = null;

try {
    const saGanoAIString = env.GANOAI_ADMIN_SDK_JSON;
    if (!saGanoAIString) {
        console.warn(`[AdminGanoAI] Peringatan: Environment variable GANOAI_ADMIN_SDK_JSON tidak di-set via $env/dynamic/private. Layanan GanoAI Admin tidak akan berfungsi.`);
    } else {
        const serviceAccountGanoAI = JSON.parse(saGanoAIString);

        // SOLUSI: Ganti literal \\n menjadi \n dalam private_key
        if (serviceAccountGanoAI.private_key) {
            serviceAccountGanoAI.private_key = serviceAccountGanoAI.private_key.replace(/\\n/g, '\n');
        } else {
            throw new Error("Private key is missing in GANOAI_ADMIN_SDK_JSON.");
        }

        const existingApp = admin.apps.find(app => app?.name === GANOAI_ADMIN_APP_NAME);

        if (existingApp) {
            ganoAIAdminAppInternalInstance = existingApp;
            console.log(`[AdminGanoAI] Menggunakan instance Firebase Admin SDK '${GANOAI_ADMIN_APP_NAME}' yang sudah ada.`);
        } else {
            ganoAIAdminAppInternalInstance = admin.initializeApp({
                credential: admin.credential.cert(serviceAccountGanoAI)
            }, GANOAI_ADMIN_APP_NAME);
            console.log(`[AdminGanoAI] Firebase Admin SDK '${GANOAI_ADMIN_APP_NAME}' berhasil diinisialisasi.`);
        }

        if (ganoAIAdminAppInternalInstance) {
            ganoAIDbAdminInternalInstance = ganoAIAdminAppInternalInstance.firestore();
            console.log(`[AdminGanoAI] Instance Firestore untuk ${GANOAI_ADMIN_APP_NAME} berhasil didapatkan.`);
        }
    }
} catch (e: any) {
    console.error(`[AdminGanoAI] KRITIKAL: Gagal menginisialisasi ${GANOAI_ADMIN_APP_NAME} Admin SDK atau Firestore:`, e.message, e.stack ? `\nStack: ${e.stack}` : '');
}

export const ganoAIDbAdmin: Firestore | null = ganoAIDbAdminInternalInstance;
export const ganoAIAdminApp: admin.app.App | undefined = ganoAIAdminAppInternalInstance;