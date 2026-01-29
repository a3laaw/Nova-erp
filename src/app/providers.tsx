'use client';

import { AuthProvider } from '@/context/auth-context';
import { LanguageProvider, useLanguage } from '@/context/language-context';
import { BrandingProvider } from '@/context/branding-context';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Loader } from 'lucide-react';

const DynamicFirebaseProvider = dynamic(
  () => import('@/firebase/provider').then(mod => mod.FirebaseProvider),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <Loader className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">جاري تهيئة الاتصال...</p>
      </div>
    ),
  }
);


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
        <DynamicFirebaseProvider>
            <BrandingProvider>
                <LanguageProvider>
                    <AuthProvider>
                        <LanguageManager>
                            {children}
                        </LanguageManager>
                    </AuthProvider>
                </LanguageProvider>
            </BrandingProvider>
        </DynamicFirebaseProvider>
    );
}
