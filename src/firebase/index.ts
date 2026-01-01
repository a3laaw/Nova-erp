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

// Centralized Firebase services instances
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

function initializeFirebase() {
  if (!firebaseConfig.apiKey) {
    console.error("Firebase API key is missing. Please check your environment variables.");
    return { app: null, auth: null, firestore: null };
  }

  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  firestore = getFirestore(app);

  if (process.env.NODE_ENV === 'development') {
    if (process.env.NEXT_PUBLIC_EMULATOR_HOST) {
        try {
            connectAuthEmulator(auth, `http://${process.env.NEXT_PUBLIC_EMULATOR_HOST}:9099`, { disableWarnings: true });
            connectFirestoreEmulator(firestore, process.env.NEXT_PUBLIC_EMULATOR_HOST, 8080);
        } catch (e) {
            console.error('Error connecting to Firebase emulators:', e);
        }
    }
  }

  return { app, auth, firestore };
}

// Initialize Firebase on module load
const initializedInstances = initializeFirebase();
app = initializedInstances.app;
auth = initializedInstances.auth;
firestore = initializedInstances.firestore;

export { app, auth, firestore };
export * from './provider';
export { useCollection } from 'react-firebase-hooks/firestore';
