'use client';

import React from 'react';
import { Mail, MapPin, Phone, Hash } from 'lucide-react';

interface PrintFooterProps {
  branding: any;
}

/**
 * مكون تذييل الصفحة (Footer):
 * يعرض بيانات التواصل والروابط القانونية في أسفل ورقة الـ A4.
 */
export function PrintFooter({ branding }: PrintFooterProps) {
  if (!branding) return null;

  // الحالة 1: استخدام صورة فوتر جاهزة
  if (branding.useCustomImage && branding.footerImageUrl) {
    return (
      <div className="w-full mt-auto pt-6 border-t border-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={branding.footerImageUrl} 
          alt="Footer" 
          className="w-full h-auto max-h-[120px] object-contain block mx-auto"
        />
      </div>
    );
  }

  const footer = branding.footerData || {};

  // الحالة 2: التصميم اليدوي المخصص
  return (
    <div className="w-full mt-auto pt-8 border-t border-slate-200" dir="rtl">
      <div className="grid grid-cols-3 gap-6 text-[10px] font-black text-slate-600">
        <div className="space-y-2">
          {footer.address && (
            <p className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-primary shrink-0" />
              <span>{footer.address}</span>
            </p>
          )}
          {footer.email && (
            <p className="flex items-center gap-2">
              <Mail className="h-3 w-3 text-primary shrink-0" />
              <span className="font-mono">{footer.email}</span>
            </p>
          )}
        </div>

        <div className="space-y-2 text-center">
          {footer.phones && footer.phones.length > 0 && (
            <p className="flex items-center justify-center gap-2">
              <Phone className="h-3 w-3 text-primary shrink-0" />
              <span className="font-mono" dir="ltr">
                {footer.phones.filter(Boolean).join(' / ')}
              </span>
            </p>
          )}
          {footer.crNumber && (
            <p className="flex items-center justify-center gap-2">
              <Hash className="h-3 w-3 text-primary shrink-0" />
              <span>س.ت: {footer.crNumber}</span>
            </p>
          )}
        </div>

        <div className="text-left flex flex-col justify-end space-y-1">
          <p className="font-black text-slate-900">{branding.companyName}</p>
          <p className="text-[9px] opacity-60 leading-tight">
            {footer.extraText || 'هذا المستند معتمد وصادر آلياً عبر نظام Nova ERP.'}
          </p>
        </div>
      </div>
      
      {/* ترقيم الصفحات (المتصفح يضيفه تلقائياً عند الطباعة، لكن هنا نضع علامة سيادية) */}
      <div className="text-center mt-4 text-[8px] font-bold text-slate-300 tracking-[0.5em] uppercase">
        Nova ERP Sovereign Document System v2.5
      </div>
    </div>
  );
}
