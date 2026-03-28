'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './auth-context';

export interface BrandingSettings {
  id: string;
  companyName: string;
  activityType?: 'general' | 'food_delivery' | 'construction' | 'consulting';
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxNumber?: string | null;
  headerImageUrl?: string | null;
  footerImageUrl?: string | null;
  watermarkImageUrl?: string | null;
  headerColor?: string;
  useCustomImage?: boolean;
  footerData?: {
      address?: string;
      phones?: string[];
      email?: string;
      crNumber?: string;
      taxNumber?: string;
      extraText?: string;
  };
  work_hours?: any;
  financial_statement_notes?: string;
}

interface BrandingContextType {
  branding: BrandingSettings | null;
  loading: boolean;
}

const defaultBranding: BrandingSettings = {
    id: 'default',
    companyName: 'Nova ERP',
    activityType: 'general',
    headerColor: '#7209B7'
};

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  loading: true,
});

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const [branding, setBranding] = useState<BrandingSettings | null>(defaultBranding);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🛡️ التزامن السيادي: التحقق من وجود جلسة تقمص أو دخول منشأة
    const tenantId = user?.currentCompanyId || null;
    
    if (!firestore || !tenantId) {
      setBranding(defaultBranding);
      setLoading(false);
      return;
    }

    setLoading(true);
    const brandingRef = doc(firestore, `companies/${tenantId}/settings/branding`);
    
    const unsubscribe = onSnapshot(brandingRef, (snapshot) => {
        if (snapshot.exists()) {
            setBranding({ id: snapshot.id, ...snapshot.data() } as BrandingSettings);
        } else {
            // If no custom branding, ensure we at least have the company name from the user claim if available
            setBranding({
                ...defaultBranding,
                companyName: user?.companyName || defaultBranding.companyName
            }); 
        }
        setLoading(false);
    }, (error) => {
        console.error("Critical: Branding sync failed:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user?.currentCompanyId, user?.companyName]);
  

  const value = useMemo(() => ({ branding, loading }), [branding, loading]);

  return (
    <CardStylesInjector branding={branding}>
        <BrandingContext.Provider value={value}>
            {children}
        </BrandingContext.Provider>
    </CardStylesInjector>
  );
};

/**
 * حاقن التنسيقات السيادي: 
 * يقوم بتحديث المتغيرات اللونية في CSS بناءً على إعدادات المنشأة الحالية.
 */
function CardStylesInjector({ children, branding }: { children: React.ReactNode, branding: BrandingSettings | null }) {
    useEffect(() => {
        if (branding?.headerColor) {
            document.documentElement.style.setProperty('--primary', hexToHsl(branding.headerColor));
        }
    }, [branding?.headerColor]);

    return <>{children}</>;
}

/**
 * مساعد تحويل الألوان: من HEX إلى HSL المتوافق مع Tailwind.
 */
function hexToHsl(hex: string): string {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};
