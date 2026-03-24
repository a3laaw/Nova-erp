'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export interface CompanyFirebaseInstances {
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
}

/**
 * دالة جلب تهيئة Firebase الخاصة بشركة محددة (Tenant).
 * تمنع إعادة التهيئة إذا كان التطبيق موجوداً مسبقاً في الذاكرة.
 */
export function getCompanyFirebase(firebaseConfig: any, companyId: string): CompanyFirebaseInstances {
  const appName = `tenant-${companyId}`;
  const existing = getApps().find(app => app.name === appName);

  if (existing) {
    return {
      app: existing,
      firestore: getFirestore(existing),
      auth: getAuth(existing),
      storage: getStorage(existing),
    };
  }

  const app = initializeApp(firebaseConfig, appName);
  return {
    app,
    firestore: getFirestore(app),
    auth: getAuth(app),
    storage: getStorage(app),
  };
}
