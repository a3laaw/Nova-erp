
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, limit, onSnapshot, type DocumentData } from 'firebase/firestore';

export interface BrandingSettings {
  id: string;
  company_name: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_number?: string;
  letterhead_text?: string;
  letterhead_image_url?: string;
  footer_image_url?: string;
  watermark_image_url?: string;
  system_background_url?: string;
  work_hours?: {
    morning_start_time: string;
    morning_end_time: string;
    evening_start_time: string;
    evening_end_time: string;
    appointment_slot_duration: number;
    appointment_buffer_time?: number;
  }
}

interface BrandingContextType {
  branding: BrandingSettings | null;
  loading: boolean;
}

const defaultBranding: BrandingSettings = {
    id: 'default',
    company_name: 'Nova ERP',
};

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  loading: true,
});

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const { firestore } = useFirebase();
  const [branding, setBranding] = useState<BrandingSettings | null>(defaultBranding);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore) {
      setLoading(false);
      return;
    }

    const brandingQuery = query(collection(firestore, 'company_settings'), limit(1));
    const unsubscribe = onSnapshot(brandingQuery, (snapshot) => {
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            setBranding({ id: doc.id, ...doc.data() } as BrandingSettings);
        } else {
            setBranding(defaultBranding); // Fallback to default if no settings exist
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching branding settings:", error);
        setBranding(defaultBranding); // Fallback on error
        setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore]);
  

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

    