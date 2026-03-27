'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PrintHeaderProps {
  branding: any;
}

/**
 * مكون ترويسة الصفحة (Header):
 * يدعم وضع الصورة الكاملة (Letterhead) أو التصميم المخصص (اللوجو + الاسم).
 */
export function PrintHeader({ branding }: PrintHeaderProps) {
  if (!branding) return null;

  // الحالة 1: استخدام صورة هيدر جاهزة
  if (branding.useCustomImage && branding.headerImageUrl) {
    return (
      <div className="w-full mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={branding.headerImageUrl} 
          alt="Header" 
          className="w-full h-auto max-h-[180px] object-contain block mx-auto"
        />
      </div>
    );
  }

  // الحالة 2: التصميم اليدوي المخصص
  return (
    <div className="w-full mb-8" dir="rtl">
      <div 
        className="flex justify-between items-center pb-4" 
        style={{ borderBottom: `4px solid ${branding.headerColor || '#1e40af'}` }}
      >
        <div className="flex items-center gap-4">
          {branding.logoUrl && (
            <div className="relative w-24 h-24 bg-white p-1 border rounded-xl overflow-hidden shadow-sm flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={branding.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
            </div>
          )}
          <div className="text-right">
            <h1 className="text-2xl font-black text-slate-900 leading-tight">
              {branding.companyName || 'Nova ERP'}
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mt-1">
              Engineering & Contracting Solutions
            </p>
          </div>
        </div>
        
        <div className="text-left space-y-1">
          <div className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-black tracking-tighter">
            مستند رسمي / Official Document
          </div>
          <p className="text-[10px] font-mono font-bold text-muted-foreground pt-1">
            ISSUED: {new Date().toLocaleDateString('en-GB')}
          </p>
        </div>
      </div>
    </div>
  );
}
