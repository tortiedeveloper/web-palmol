// src/lib/firebase/ganoAIClient.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'; // Menambahkan FirebaseApp untuk konsistensi tipe
import { getAuth, type Auth } from 'firebase/auth'; // Menambahkan Auth untuk konsistensi tipe
import { getFirestore, type Firestore } from 'firebase/firestore'; // Menambahkan Firestore untuk konsistensi tipe
import { getStorage, type FirebaseStorage } from 'firebase/storage'; // Menambahkan FirebaseStorage untuk konsistensi tipe

const firebaseConfigGanoAI = {
    apiKey: import.meta.env.VITE_GANOAI_API_KEY,
    authDomain: import.meta.env.VITE_GANOAI_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_GANOAI_PROJECT_ID,
    storageBucket: import.meta.env.VITE_GANOAI_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_GANOAI_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_GANOAI_APP_ID,
    measurementId: import.meta.env.VITE_GANOAI_MEASUREMENT_ID
};

let ganoAIApp: FirebaseApp; // Menggunakan tipe FirebaseApp

if (!getApps().find(app => app.name === 'ganoAI')) {
    ganoAIApp = initializeApp(firebaseConfigGanoAI, 'ganoAI');
} else {
    ganoAIApp = getApp('ganoAI');
}

// Ekspor dengan nama yang diharapkan oleh kode Anda (berdasarkan asumsi pola konsisten)
export const authGanoAI: Auth = getAuth(ganoAIApp);
export const ganoAIDb: Firestore = getFirestore(ganoAIApp); // Mengikuti pola ripenessDb -> ganoAIDb
export const storageGanoAI: FirebaseStorage = getStorage(ganoAIApp);

export { ganoAIApp };