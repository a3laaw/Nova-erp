
'use client';
// This hook is deprecated. Please use `useDocument` from `@/firebase` instead.
export function useDoc() {
    console.error('useDoc is deprecated. Please use `useDocument` for real-time document data.');
    return [null, true, new Error('useDoc is deprecated. Use useDocument.')] as const;
}
