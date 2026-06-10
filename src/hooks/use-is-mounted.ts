'use client';

import { useRef, useEffect, useCallback } from 'react';

/**
 * A custom React hook that returns a function to check if the component is still mounted.
 * This is useful for preventing state updates on unmounted components, which can cause memory leaks.
 * @returns {() => boolean} A function that returns true if the component is mounted, false otherwise.
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Set to false when the component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Return a function that returns the current value of the ref
  return useCallback(() => isMountedRef.current, []);
}
