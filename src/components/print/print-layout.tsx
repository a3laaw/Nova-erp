'use client';

import React from 'react';
import { PrintHeader } from './print-header';
import { PrintFooter } from './print-footer';
import { useSubscription, useFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '../ui/skeleton';

interface PrintLayoutProps {
  children: React.ReactNode;
  id?: string; // id for html2pdf to capture
}

/**
 * غلاف الطباعة (Print Layout Wrapper):
 * يلف أي محتوى ويحقن الهيدر والفوتر حسب إعدادات البراندنج الخاصة بالشركة.
 */
export function PrintLayout({ children, id = "printable-content" }: PrintLayoutProps) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const [branding, setBranding] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !user?.currentCompanyId) {
        setLoading(false);
        return;
    }

    const fetchBranding = async () => {
        try {
            const brandingRef = doc(firestore, `companies/${user.currentCompanyId}/settings/branding`);
            const snap = await getDoc(brandingRef);
            if (snap.exists()) {
                setBranding(snap.data());
            }
        } catch (e) {
            console.error("PrintLayout: Error fetching branding", e);
        } finally {
            setLoading(false);
        }
    };

    fetchBranding();
  }, [firestore, user?.currentCompanyId]);

  if (loading) return <Skeleton className="w-[210mm] h-[297mm] mx-auto rounded-none" />;

  return (
    <div 
      id={id} 
      className="bg-white mx-auto print:m-0"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '15mm',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
    >
      <PrintHeader branding={branding} />
      
      <div className="flex-grow">
        {children}
      </div>

      <PrintFooter branding={branding} />
    </div>
  );
}
