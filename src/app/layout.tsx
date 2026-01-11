'use client';

import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/auth-context';
import { LanguageProvider, useLanguage } from '@/context/language-context';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

function AppBody({ children }: { children: React.ReactNode }) {
  const { language, direction } = useLanguage();

  return (
    <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
      {children}
      <Toaster />
    </body>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <LanguageProvider>
        <FirebaseClientProvider>
          <AuthProvider>
            <AppBody>{children}</AppBody>
          </AuthProvider>
        </FirebaseClientProvider>
      </LanguageProvider>
    </html>
  );
}
