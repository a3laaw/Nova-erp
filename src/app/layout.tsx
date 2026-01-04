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

// This component now only handles HTML and body tags with language/direction.
function RootHtml({ children }: { children: React.ReactNode }) {
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


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LanguageProvider>
      <FirebaseClientProvider>
        <AuthProvider>
            <RootHtml>{children}</RootHtml>
        </AuthProvider>
      </FirebaseClientProvider>
    </LanguageProvider>
  );
}
