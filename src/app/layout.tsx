import type { Metadata } from "next";
import { Tajawal } from 'next/font/google';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

/**
 * @fileOverview Root layout for Nova ERP.
 * تم التأكد من مسارات الاستيراد لضمان استقرار التحميل.
 */

const tajawal = Tajawal({ 
    subsets: ['arabic', 'latin'],
    weight: ['400', '500', '700', '800'],
    variable: '--font-body',
});

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
      <body className={`${tajawal.variable} font-body antialiased`}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
