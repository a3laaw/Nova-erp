'use client';

import { ReactNode, useState, useEffect, useMemo } from 'react';
import { FirebaseProvider } from './provider';
import { initializeFirebase } from './index';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

let firebaseServices: FirebaseServices | null = null;

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<FirebaseServices | null>(firebaseServices);

  useEffect(() => {
    if (!firebaseServices) {
      firebaseServices = initializeFirebase();
      setServices(firebaseServices);
    }
  }, []);

  if (!services) {
    // You can render a loading spinner here if needed
    return null;
  }
  
  return (
    <FirebaseProvider value={services}>
      {children}
    </FirebaseProvider>
  );
}
