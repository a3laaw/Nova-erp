'use client';

import { ReactNode, useMemo } from 'react';
import { FirebaseProvider } from './provider';
import { initializeFirebase } from './index';

// This function ensures Firebase is initialized only once.
const getFirebaseServices = (() => {
  let firebase: ReturnType<typeof initializeFirebase> | null = null;
  return () => {
    if (!firebase) {
      firebase = initializeFirebase();
    }
    return firebase;
  };
})();

export function FirebaseClientProvider({ children }: { children: React.Node }) {
  // getFirebaseServices() always returns the same instance.
  const services = useMemo(() => getFirebaseServices(), []);

  return (
    <FirebaseProvider value={services}>
      {children}
    </FirebaseProvider>
  );
}
