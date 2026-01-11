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

// Create a module-level promise to ensure initialization only runs once.
let firebaseInitializationPromise: Promise<FirebaseServices> | null = null;

const initialize = () => {
    if (!firebaseInitializationPromise) {
        firebaseInitializationPromise = new Promise((resolve) => {
            const services = initializeFirebase();
            resolve(services);
        });
    }
    return firebaseInitializationPromise;
};

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<FirebaseServices | null>(null);

  useEffect(() => {
    // This effect runs once on the client after mount.
    initialize().then(setServices);
  }, []); // The empty dependency array ensures this runs only once.

  if (!services) {
    // You can render a global loading spinner here.
    // Returning null is fine for the very brief initialization moment.
    return null; 
  }
  
  // Once initialized, we provide the stable services to the rest of the app.
  return (
    <FirebaseProvider value={services}>
      {children}
    </FirebaseProvider>
  );
}
