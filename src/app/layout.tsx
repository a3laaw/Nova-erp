import type { Metadata } from "next";
import { Inter, Space_Grotesk } from 'next/font/google';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: {
    default: "Nova ERP",
    template: "Nova ERP - %s",
  },
  description: "Nova ERP - نظام إدارة الأعمال المتكامل للشركات الكويتية",
  keywords: ["Nova ERP", "نظام محاسبي", "ERP كويتي", "إدارة عملاء", "عقود", "رواتب"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
