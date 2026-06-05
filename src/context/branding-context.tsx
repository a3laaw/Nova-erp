'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useFirebase } from '@/firebase/index.tsx';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './auth-context';

export interface BrandingSettings {
  id: string;
  company_name: string;
  activity_type?: 'general' | 'food_delivery' | 'construction' | 'consulting';
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_number?: string | null;
  header_image_url?: string | null;
  letterhead_image_url?: string | null;
  footer_image_url?: string | null;
  watermark_image_url?: string | null;
  header_color?: string;
  use_custom_image?: boolean;
  financial_statement_notes?: string;
  work_hours?: any;
  payment_methods?: any[];
  nameEn?: string;
}

interface BrandingContextType {
  branding: BrandingSettings | null;
  loading: boolean;
}

const defaultBranding: BrandingSettings = {
    id: 'default',
    company_name: 'Nova ERP',
    activity_type: 'general',
    header_color: '#FF7A00'
};

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  loading: true,
});

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const { firestore } = useFirebase();
  const { user, loading: authLoading } = useAuth();
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    const tenantId = user?.currentCompanyId;
    
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
            setBranding({
                ...defaultBranding,
                company_name: user?.companyName || defaultBranding.company_name
            }); 
        }
        setLoading(false);
    }, (error) => {
        setBranding(defaultBranding);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user?.currentCompanyId, user?.companyName, authLoading]);
  

  const value = useMemo(() => ({ branding, loading }), [branding, loading]);

  return (
    <CardStylesInjector branding={branding}>
        <BrandingContext.Provider value={value}>
            {children}
        </BrandingContext.Provider>
    </CardStylesInjector>
  );
};

function CardStylesInjector({ children, branding }: { children: React.ReactNode, branding: BrandingSettings | null }) {
    useEffect(() => {
        if (branding?.header_color) {
            document.documentElement.style.setProperty('--primary', hexToHsl(branding.header_color));
        }
    }, [branding?.header_color]);

    return <>{children}</>;
}

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
