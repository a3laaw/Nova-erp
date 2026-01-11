'use client';

import { createContext, useContext, ReactNode } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

// This defines the shape of the context data.
interface FirebaseContextType {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
}

// Create the context with an undefined initial value.
const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

/**
 * The provider component that makes Firebase services available to the component tree.
 * It takes the initialized services as a value prop.
 */
export function FirebaseProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: FirebaseContextType;
}) {
  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
}

/**
 * A custom hook to access the full Firebase context (app, auth, firestore).
 * Throws an error if used outside of a FirebaseProvider.
 */
export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

/**
 * A custom hook to specifically access the Firebase App instance.
 */
export function useFirebaseApp() {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useFirebaseApp must be used within a FirebaseProvider');
    }
    return context.app;
}

/**
 * A custom hook to specifically access the Firebase Auth instance.
 */
export function useAuth() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a FirebaseProvider');
  }
  return context.auth;
}

/**
 * A custom hook to specifically access the Firestore instance.
 */
export function useFirestore() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirestore must be used within a FirebaseProvider');
  }
    return context.firestore;
}
