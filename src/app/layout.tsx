'use client';

import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/auth-context';
import { LanguageProvider, useLanguage } from '@/context/language-context';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // We can't use the useLanguage hook here directly since RootLayout is the one providing the context.
  // We will assume 'ar' and 'rtl' as defaults for the initial server render.
  // The client-side re-render within AppContent will apply the correct language settings.
  return (
    <LanguageProvider>
      <FirebaseClientProvider>
        <AuthProvider>
          <AppContent>{children}</AppContent>
        </AuthProvider>
      </FirebaseClientProvider>
    </LanguageProvider>
  );
}

function AppContent({ children }: { children: React.ReactNode }) {
  const { language, direction } = useLanguage();

  return (
    <html lang={language} dir={direction}>
      <head>
        <title>EmaratiScope</title>
        <meta name="description" content="Engineering Consultancy Management" />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}