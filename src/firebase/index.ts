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
            // Check if emulators are already connected
            if (!(auth as any).emulatorConfig) {
                connectAuthEmulator(auth, `http://${process.env.NEXT_PUBLIC_EMULATOR_HOST}:9099`, { disableWarnings: true });
            }
            if (!(firestore as any)._settings.host) {
                 connectFirestoreEmulator(firestore, process.env.NEXT_PUBLIC_EMULATOR_HOST, 8080);
            }
        } catch (e) {
            // console.error('Error connecting to Firebase emulators:', e);
        }
    }
  }

  return { app, auth, firestore };
}

// We export the function to be called on demand, not the instances themselves.
export { initializeFirebase };
export * from './provider';
export { useCollection } from 'react-firebase-hooks/firestore';
