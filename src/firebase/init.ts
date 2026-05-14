'use client';

import { initializeApp, getApp, getApps, type FirebaseOptions, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * 🛡️ محرك التهيئة السيادي الموحد (V47.0)
 * المشروع المعتمد: nov-erp-1-25549967-c24e5 (مشروع النجمة)
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyCOreHYZzC4Egia3d7uWUOWKdzPxQ9MrS4",
  authDomain: "nov-erp-1-25549967-c24e5.firebaseapp.com",
  projectId: "nov-erp-1-25549967-c24e5",
  storageBucket: "nov-erp-1-25549967-c24e5.firebasestorage.app",
  messagingSenderId: "71297676078",
  appId: "1:71297676078:web:b956ab00372e6ba237c0bf"
};

function initializeFirebase(): { app: FirebaseApp; auth: Auth; firestore: Firestore; storage: FirebaseStorage; } | null {
  try {
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
