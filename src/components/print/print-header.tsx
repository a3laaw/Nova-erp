'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PrintHeaderProps {
  branding: any;
}

/**
 * مكون ترويسة الصفحة (Header):
 * تم تطهيره من اللون الأسود واستبداله بإطار برتقالي سيادي.
 */
export function PrintHeader({ branding }: PrintHeaderProps) {
  if (!branding) return null;

  if (branding.useCustomImage && branding.headerImageUrl) {
    return (
      <div className="w-full mb-6">
        <img 
          src={branding.headerImageUrl} 
          alt="Header" 
          className="w-full h-auto max-h-[180px] object-contain block mx-auto"
        />
      </div>
    );
  }

  return (
    <div className="w-full mb-8" dir="rtl">
      <div 
        className="flex justify-between items-center pb-6" 
        style={{ borderBottom: `4px solid ${branding.headerColor || '#e87c24'}` }}
      >
        <div className="flex items-center gap-5">
          {branding.logoUrl && (
            <div className="relative w-24 h-24 bg-white p-1 border-2 border-primary/10 rounded-2xl overflow-hidden shadow-sm flex items-center justify-center">
              <img src={branding.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
            </div>
          )}
          <div className="text-right">
            <h1 className="text-3xl font-black text-[#1e1b4b] leading-tight tracking-tighter">
              {branding.company_name || 'Nova ERP'}
            </h1>
            <p className="text-[10px] text-primary uppercase tracking-[0.3em] font-black mt-1">
              Engineering & Construction Solutions
            </p>
          </div>
        </div>
        
        <div className="text-left space-y-1.5">
          <div className="border-2 border-primary text-primary px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm bg-primary/5">
            مستند رسمي / Official Document
          </div>
          <p className="text-[10px] font-mono font-bold text-slate-400 pt-1">
            ISSUED: {new Date().toLocaleDateString('en-GB')}
          </p>
        </div>
      </div>
    </div>
  );
}
