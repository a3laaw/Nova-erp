'use client';

import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { LanguageProvider, useLanguage } from '@/context/language-context';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

// Since we are using 'use client', we can't export metadata directly.
// We can handle this in a child component if needed or set it dynamically.
// export const metadata: Metadata = {
//   title: 'EmaratiScope',
//   description: 'Engineering Consultancy Management',
// };

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
      <AppBody>{children}</AppBody>
    </LanguageProvider>
  );
}
