import type { Metadata } from "next";
import { Tajawal } from 'next/font/google';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const tajawal = Tajawal({ 
    subsets: ['arabic', 'latin'],
    weight: ['400', '500', '700', '800'],
    variable: '--font-body',
});

export const metadata: Metadata = {
  title: "Nova ERP",
  description: "نظام إدارة الأعمال المتكامل",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${tajawal.variable} font-body antialiased`}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
