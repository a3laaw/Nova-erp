'use client';

import { ReactNode, useState, useEffect } from 'react';
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

// This module-level variable will hold the initialized services.
// This is key to preventing re-initialization on re-renders.
let firebaseServices: FirebaseServices | null = null;

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<FirebaseServices | null>(firebaseServices);

  useEffect(() => {
    // We only initialize Firebase if it hasn't been already.
    // This effect runs only once on the client after mount.
    if (!firebaseServices) {
      firebaseServices = initializeFirebase();
      setServices(firebaseServices);
    }
  }, []); // The empty dependency array ensures this runs only once.

  if (!services) {
    // You can render a loading spinner here while Firebase initializes.
    // Returning null is also fine for a brief moment.
    return null;
  }
  
  // Once initialized, we provide the services to the rest of the app.
  return (
    <FirebaseProvider value={services}>
      {children}
    </FirebaseProvider>
  );
}
