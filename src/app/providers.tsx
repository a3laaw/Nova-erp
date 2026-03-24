'use client';

import { LanguageProvider, useLanguage } from '@/context/language-context';
import { BrandingProvider } from '@/context/branding-context';
import { SyncStatusProvider } from '@/context/sync-context';
import { useEffect } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { AuthProvider } from '@/context/auth-context';
import { ThemeProvider } from '@/context/theme-context';
import { CompanyProvider } from '@/context/company-context';

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
        <FirebaseProvider>
            <BrandingProvider>
                <CompanyProvider>
                    <ThemeProvider>
                        <LanguageProvider>
                            <SyncStatusProvider>
                                <AuthProvider>
                                    <LanguageManager>
                                        {children}
                                    </LanguageManager>
                                </AuthProvider>
                            </SyncStatusProvider>
                        </LanguageProvider>
                    </ThemeProvider>
                </CompanyProvider>
            </BrandingProvider>
        </FirebaseProvider>
    );
}
