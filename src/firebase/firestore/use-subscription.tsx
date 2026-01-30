'use client';
// This hook is deprecated. Please use `useSubscription` from `@/hooks/use-subscription` instead.
export function useSubscription() {
    console.error('useSubscription is deprecated. Please use the hook from `@/hooks/use-subscription`.');
    return { data: [], setData: () => {}, loading: true, error: new Error('useSubscription is deprecated.') };
}
