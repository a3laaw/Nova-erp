'use client';

import { initializeApp, getApp, getApps, type FirebaseOptions, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * محرك التهيئة اللحظي: 
 * يعتمد على متغيرات البيئة لضمان التوافق التام مع المشروع الحالي.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCX4Zms4_pkTGy0chAJPyF6P6g9XCRAXk8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-8039389980-3d2d0.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-8039389980-3d2d0",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-8039389980-3d2d0.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "828494117254",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:828494117254:web:d0c31facd0d0bb2f341407",
};

function initializeFirebase(): { app: FirebaseApp; auth: Auth; firestore: Firestore; storage: FirebaseStorage; } | null {
  if (!firebaseConfig.projectId) {
    console.warn("Firebase config is missing. System in restricted mode.");
    return null;
  }
  
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const storage = getStorage(app);

  return { app, auth, firestore, storage };
}

const getFirebaseServicesSingleton = (() => {
  let firebase: ReturnType<typeof initializeFirebase> | null = null;
  let initialized = false;
  return () => {
    if (!initialized) {
      firebase = initializeFirebase();
      initialized = true;
    }
    return firebase;
  };
})();

export const getFirebaseServices = getFirebaseServicesSingleton;
