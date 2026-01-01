'use client';

import { ReactNode } from 'react';
import { FirebaseProvider } from './provider';
import { app, auth, firestore } from './index';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider value={{ app, auth, firestore }}>
      {children}
    </FirebaseProvider>
  );
}
