'use client';

import { AuthProvider } from '@/context/auth-context';
import { LanguageProvider, useLanguage } from '@/context/language-context';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useEffect } from 'react';

// This component consumes the language context and updates the DOM.
function LanguageManager({ children }: { children: React.ReactNode }) {
    const { language, direction } = useLanguage();

    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = direction;
    }, [language, direction]);

    return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <FirebaseClientProvider>
            <LanguageProvider>
                <AuthProvider>
                    <LanguageManager>
                        {children}
                    </LanguageManager>
                </AuthProvider>
            </LanguageProvider>
        </FirebaseClientProvider>
    );
}
