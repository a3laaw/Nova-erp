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
    // Check if emulators are already running to avoid re-connecting on hot-reloads
    if (!(auth as any).emulatorConfig) {
      connectAuthEmulator(auth, `http://${process.env.NEXT_PUBLIC_EMULATOR_HOST || '127.0.0.1'}:9099`, { disableWarnings: true });
    }
    // Firestore doesn't have a built-in way to check, so we connect every time in dev.
    // connectFirestoreEmulator handles this gracefully if already connected.
    connectFirestoreEmulator(firestore, process.env.NEXT_PUBLIC_EMULATOR_HOST || '127.0.0.1', 8080);
  }

  return { app, auth, firestore };
}

export { initializeFirebase };
export * from './provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export { useAuth } from './auth/use-user';
