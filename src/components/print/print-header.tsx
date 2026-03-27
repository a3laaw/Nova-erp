'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface PrintHeaderProps {
  branding: any;
}

/**
 * مكون الترويسة المطبوعة (Print Header):
 * يدعم العرض عبر صورة كاملة جاهزة أو عبر التصميم المخصص (اللوجو + الاسم).
 */
export function PrintHeader({ branding }: PrintHeaderProps) {
  if (!branding) return null;

  // الحالة 1: استخدام صورة هيدر جاهزة
  if (branding.useCustomImage && branding.headerImageUrl) {
    return (
      <div className="w-full mb-6">
        <img 
          src={branding.headerImageUrl} 
          alt="Header" 
          className="w-full h-auto max-h-[180px] object-contain"
        />
      </div>
    );
  }

  // الحالة 2: التصميم اليدوي المخصص
  return (
    <div className="w-full mb-8" dir="rtl">
      <div className="flex justify-between items-center pb-4" style={{ borderBottom: `4px solid ${branding.headerColor || '#1e40af'}` }}>
        <div className="flex items-center gap-4">
          {branding.logoUrl && (
            <div className="relative w-24 h-24 bg-white p-1 border rounded-xl overflow-hidden shadow-sm">
              <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          )}
          <div className="text-right">
            <h1 className="text-2xl font-black text-slate-900 leading-tight">
              {branding.companyName || 'Nova ERP'}
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
              Engineering & Contracting
            </p>
          </div>
        </div>
        
        <div className="text-left space-y-1">
          <div className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-black tracking-tighter">
            مستند رسمي / Official Document
          </div>
          <p className="text-[10px] font-mono text-muted-foreground pt-1">
            DATE: {new Date().toLocaleDateString('en-GB')}
          </p>
        </div>
      </div>
    </div>
  );
}
