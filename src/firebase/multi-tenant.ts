'use client';

import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
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
 * 🛡️ محرك الربط السيادي (Sovereign Connection Factory):
 * يقوم بتأسيس جسر اتصال مع قاعدة بيانات المنشأة سواء كانت مشتركة أو مستقلة.
 * يمنع إعادة التهيئة إذا كان التطبيق موجوداً مسبقاً لضمان سرعة الاستجابة.
 */
export function getCompanyFirebase(config: FirebaseOptions, companyId: string): CompanyFirebaseInstances {
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

  // تأسيس اتصال سحابي جديد ومعزول للمنشأة
  const app = initializeApp(config, appName);
  return {
    app,
    firestore: getFirestore(app),
    auth: getAuth(app),
    storage: getStorage(app),
  };
}
