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

function AppBody({ children }: { children: React.ReactNode }) {
  const { language, direction } = useLanguage();

  // Set metadata dynamically
  if (typeof document !== 'undefined') {
    document.title = 'EmaratiScope';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Engineering Consultancy Management');
    }
  }


  return (
    <html lang={language} dir={direction}>
      <head>
        {/* We can place static head elements here, or dynamic ones inside a useEffect */}
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LanguageProvider>
      <FirebaseClientProvider>
        <AuthProvider>
          <AppBody>{children}</AppBody>
        </AuthProvider>
      </FirebaseClientProvider>
    </LanguageProvider>
  );
}
