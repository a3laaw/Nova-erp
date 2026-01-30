
'use client';
// This hook is deprecated. Please use `useSubscription` from `@/firebase` instead.
export function useCollection() {
    console.error('useCollection is deprecated. Please use `useSubscription` for real-time collection data.');
    return [null, true, new Error('useCollection is deprecated. Use useSubscription.')] as const;
}
