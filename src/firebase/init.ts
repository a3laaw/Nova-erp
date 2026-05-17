'use client';

import { initializeApp, getApp, getApps, type FirebaseOptions, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * 🛡️ محرك التهيئة السيادي الموحد (V118.0)
 * تم التطهير: المفاتيح الآن تُجلب من متغيرات البيئة المشفرة.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

function initializeFirebase(): { app: FirebaseApp; auth: Auth; firestore: Firestore; storage: FirebaseStorage; } | null {
  try {
    // التحقق من وجود المفاتيح قبل البدء لمنع انهيار النظام
    if (!firebaseConfig.apiKey) {
        console.warn("⚠️ Firebase Config Missing: Environment variables are not set.");
        return null;
    }

    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    const storage = getStorage(app);

    return { app, auth, firestore, storage };
  } catch (e) {
    console.error("Firebase Init Failed:", e);
    return null;
  }
}

export const getFirebaseServices = () => {
  return initializeFirebase();
};
