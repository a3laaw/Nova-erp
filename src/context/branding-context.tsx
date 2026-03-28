'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './auth-context';
import type { PaymentMethod } from '@/lib/types';

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
}

interface BrandingContextType {
  branding: BrandingSettings | null;
  loading: boolean;
}

const defaultBranding: BrandingSettings = {
    id: 'default',
    companyName: 'Nova ERP',
    activityType: 'general'
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
    if (!firestore || !user?.currentCompanyId) {
      setLoading(false);
      return;
    }

    const brandingRef = doc(firestore, `companies/${user.currentCompanyId}/settings/branding`);
    
    const unsubscribe = onSnapshot(brandingRef, (snapshot) => {
        if (snapshot.exists()) {
            setBranding({ id: snapshot.id, ...snapshot.data() } as BrandingSettings);
        } else {
            setBranding(defaultBranding); 
        }
        setLoading(false);
    }, (error) => {
        console.error("Error listening to branding:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user?.currentCompanyId]);
  

  const value = useMemo(() => ({ branding, loading }), [branding, loading]);

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};
