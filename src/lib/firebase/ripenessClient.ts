// src/lib/firebase/ripenessClient.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfigRipeness = {
    apiKey: import.meta.env.VITE_RIPENESS_API_KEY,
    authDomain: import.meta.env.VITE_RIPENESS_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_RIPENESS_PROJECT_ID,
    storageBucket: import.meta.env.VITE_RIPENESS_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_RIPENESS_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_RIPENESS_APP_ID,
    measurementId: import.meta.env.VITE_RIPENESS_MEASUREMENT_ID
};

let ripenessApp: FirebaseApp;

if (!getApps().find(app => app.name === 'ripeness')) {
    ripenessApp = initializeApp(firebaseConfigRipeness, 'ripeness');
} else {
    ripenessApp = getApp('ripeness');
}

// Ekspor dengan nama yang diharapkan oleh kode Anda
export const authRipeness: Auth = getAuth(ripenessApp);
export const ripenessDb: Firestore = getFirestore(ripenessApp); // Sesuai dengan penggunaan Anda
export const storageRipeness: FirebaseStorage = getStorage(ripenessApp);

export { ripenessApp };