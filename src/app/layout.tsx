'use client';

import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/auth-context';
import { LanguageProvider, useLanguage } from '@/context/language-context';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { language, direction } = useLanguage();

  return (
     <html lang={language} dir={direction}>
        <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
            {children}
            <Toaster />
        </body>
    </html>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <FirebaseClientProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
        </AuthProvider>
      </LanguageProvider>
    </FirebaseClientProvider>
  );
}
