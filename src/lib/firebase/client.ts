// src/lib/firebase/client.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore'; // Opsional, jika Anda perlu akses Firestore 'sawit-pintar' dari klien

const firebaseConfigSawitPintar = {
    apiKey: import.meta.env.VITE_SAWITPINTAR_API_KEY,
    authDomain: import.meta.env.VITE_SAWITPINTAR_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_SAWITPINTAR_PROJECT_ID,
    storageBucket: import.meta.env.VITE_SAWITPINTAR_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_SAWITPINTAR_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_SAWITPINTAR_APP_ID,
    measurementId: import.meta.env.VITE_SAWITPINTAR_MEASUREMENT_ID
};

let app: FirebaseApp;

if (!getApps().length) {
    app = initializeApp(firebaseConfigSawitPintar);
} else {
    app = getApp(); // Mengambil instance default jika sudah diinisialisasi
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app); // Hanya jika Anda perlu akses ke Firestore 'sawit-pintar' dari klien
export { app };