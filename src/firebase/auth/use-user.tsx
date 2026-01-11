'use client';

import { useAuthState } from 'react-firebase-hooks/auth';
import { useAuth as useFirebaseAuth } from '../provider';

/**
 * A custom hook to get the current authenticated user.
 * It uses react-firebase-hooks to listen to auth state changes in real-time.
 */
export function useAuth() {
  const auth = useFirebaseAuth();
  if (!auth) {
    // This can happen on the initial server render before the provider is ready.
    // The component using this hook should handle the null auth case.
    return [null, true, undefined];
  }
  return useAuthState(auth);
}
