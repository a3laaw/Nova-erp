'use client';

import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/auth-context';
import { LanguageProvider } from '@/context/language-context';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
        <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
            <LanguageProvider>
                <FirebaseClientProvider>
                  <AuthProvider>
                    {children}
                    <Toaster />
                  </AuthProvider>
                </FirebaseClientProvider>
            </LanguageProvider>
        </body>
    </html>
  );
}
