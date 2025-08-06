// src/lib/server/adminSawitPintar.ts
import admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { env } from '$env/dynamic/private';

const SAWITPINTAR_ADMIN_APP_NAME = 'sawitPintarAdminMain';

let sawitPintarAdminAppInternal: admin.app.App | undefined = undefined;
let sawitPintarDbAdminInternal: Firestore | null = null;

try {
	const saString = env.SAWITPINTAR_ADMIN_SDK_JSON;
	if (!saString) {
		console.warn(
			`[AdminSawitPintar] Peringatan: Environment variable SAWITPINTAR_ADMIN_SDK_JSON tidak di-set. Layanan Admin SawitPintar tidak akan berfungsi.`
		);
	} else {
		const serviceAccount = JSON.parse(saString);
		if (serviceAccount.private_key) {
			serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
		} else {
			throw new Error('Private key is missing in SAWITPINTAR_ADMIN_SDK_JSON.');
		}

		const existingApp = admin.apps.find((app) => app?.name === SAWITPINTAR_ADMIN_APP_NAME);

		if (existingApp) {
			sawitPintarAdminAppInternal = existingApp;
		} else {
			sawitPintarAdminAppInternal = admin.initializeApp(
				{
					credential: admin.credential.cert(serviceAccount)
				},
				SAWITPINTAR_ADMIN_APP_NAME
			);
		}
		console.log(`[AdminSawitPintar] Firebase Admin SDK '${SAWITPINTAR_ADMIN_APP_NAME}' siap.`);

		if (sawitPintarAdminAppInternal) {
			sawitPintarDbAdminInternal = sawitPintarAdminAppInternal.firestore();
		}
	}
} catch (e: any) {
	console.error(`[AdminSawitPintar] KRITIKAL: Gagal menginisialisasi Admin SDK:`, e.message);
}

export const sawitPintarDbAdmin: Firestore | null = sawitPintarDbAdminInternal;
export const sawitPintarAdminApp: admin.app.App | undefined = sawitPintarAdminAppInternal;