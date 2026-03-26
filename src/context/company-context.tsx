'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { Company } from '@/lib/types';
import { getCompanyFirebase, type CompanyFirebaseInstances } from '@/firebase/multi-tenant';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';

interface CompanyContextType {
  currentCompany: Company | null;
  companyFirestore: Firestore | null;
  companyAuth: Auth | null;
  isLoadingCompany: boolean;
  setCurrentCompany: (company: Company | null) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const [currentCompany, setCompany] = useState<Company | null>(null);
  const [instances, setInstances] = useState<CompanyFirebaseInstances | null>(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);

  /**
   * ✨ حفظ دالة التبديل برمجياً (Memoization) ✨
   * ضروري جداً لكسر حلقة التكرار اللانهائي مع AuthContext.
   */
  const setCurrentCompany = useCallback((company: Company | null) => {
    if (!company) {
      setCompany(null);
      setInstances(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nova_current_company');
      }
      return;
    }

    setIsLoadingCompany(true);
    try {
      const firebaseInstances = getCompanyFirebase(company.firebaseConfig, company.id!);
      setCompany(company);
      setInstances(firebaseInstances);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nova_current_company', JSON.stringify(company));
      }
    } catch (error) {
      console.error("Failed to initialize tenant Firebase:", error);
    } finally {
      setIsLoadingCompany(false);
    }
  }, []);

  // محاولة استعادة الشركة من التخزين المحلي عند إعادة التحميل (مرة واحدة فقط)
  useEffect(() => {
    const saved = localStorage.getItem('nova_current_company');
    if (saved) {
      try {
        const company = JSON.parse(saved);
        setCurrentCompany(company);
      } catch (e) {
        localStorage.removeItem('nova_current_company');
      }
    }
  }, [setCurrentCompany]);

  return (
    <CompanyContext.Provider value={{ 
      currentCompany, 
      companyFirestore: instances?.firestore || null, 
      companyAuth: instances?.auth || null,
      isLoadingCompany,
      setCurrentCompany 
    }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
