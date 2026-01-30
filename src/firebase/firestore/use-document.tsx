'use client';
// This hook is deprecated. Please use `useDocument` from `@/hooks/use-document` instead.
export function useDocument() {
    console.error('useDocument is deprecated. Please use the hook from `@/hooks/use-document`.');
    return { data: null, loading: true, error: new Error('useDocument is deprecated.') };
}
