'use client';

import { initializeApp, getApp, getApps, type FirebaseOptions, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function initializeFirebase(): { app: FirebaseApp; auth: Auth; firestore: Firestore } {
  if (!firebaseConfig.projectId) {
    throw new Error("Firebase project ID is missing. Please check your environment variables.");
  }
  
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  if (process.env.NODE_ENV === 'development') {
    if (process.env.NEXT_PUBLIC_EMULATOR_HOST) {
        try {
            const authEmulatorConnected = (auth as any).emulatorConfig;
            if (!authEmulatorConnected) {
                connectAuthEmulator(auth, `http://${process.env.NEXT_PUBLIC_EMULATOR_HOST}:9099`, { disableWarnings: true });
            }
            
            const firestoreSettings = (firestore as any)._settings;
            if (firestoreSettings && typeof firestoreSettings.host !== 'string' || !firestoreSettings.host.includes(process.env.NEXT_PUBLIC_EMULATOR_HOST)) {
                 connectFirestoreEmulator(firestore, process.env.NEXT_PUBLIC_EMULATOR_HOST, 8080);
            }
        } catch (e) {
            // Errors can happen on hot-reloads, we can safely ignore them.
        }
    }
  }

  return { app, auth, firestore };
}

export { initializeFirebase };
export * from './provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
