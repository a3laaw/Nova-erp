// This file is deprecated. Please use useSubscription instead.
export function useRealtime() {
    console.error('useRealtime is deprecated. Please use `useSubscription` for real-time collection data.');
    return { data: [], loading: true, error: new Error('useRealtime is deprecated.') };
}
