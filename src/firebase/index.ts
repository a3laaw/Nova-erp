'use client';

// This file is now a pure barrel file, re-exporting Firebase utilities.
// The circular dependency has been resolved by moving `initializeFirebase`
// into `provider.tsx`.

export * from './provider';
export { useUser } from './auth/use-user';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
