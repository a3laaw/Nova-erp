
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
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

/**
 * مزود سياق الشركة (Sovereign Company Provider):
 * تم تحصينه بـ Refs لضمان استقرار دالة الـ Setter ومنع حلقات التكرار اللانهائية.
 */
export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const [currentCompany, setCompany] = useState<Company | null>(null);
  const [instances, setInstances] = useState<CompanyFirebaseInstances | null>(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  
  // 🛡️ استخدام Ref لتعقب المعرف الحالي دون التسبب في إعادة إنشاء الدالة
  const currentIdRef = useRef<string | null>(null);

  const setCurrentCompany = useCallback((company: Company | null) => {
    if (!company) {
      setCompany(null);
      setInstances(null);
      currentIdRef.current = null;
      try {
        if (typeof window !== 'undefined') localStorage.removeItem('nova_current_company');
      } catch (e) {}
      return;
    }

    // 🛡️ منع إعادة التأسيس إذا كانت نفس الشركة لضمان استقرار التحميل
    if (currentIdRef.current === company.id) return;

    setIsLoadingCompany(true);
    try {
      const firebaseInstances = getCompanyFirebase(company.firebaseConfig, company.id!);
      setCompany(company);
      currentIdRef.current = company.id!;
      setInstances(firebaseInstances);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('nova_current_company', JSON.stringify(company));
      }
    } catch (error) {
      console.error("Failed to initialize tenant Firebase:", error);
    } finally {
      setIsLoadingCompany(false);
    }
  }, []); // ⚡ دالة مستقرة تماماً لا تعتمد على الحالة

  useEffect(() => {
    try {
        const saved = localStorage.getItem('nova_current_company');
        if (saved) {
            const company = JSON.parse(saved);
            setCurrentCompany(company);
        }
    } catch (e) {
        if (typeof window !== 'undefined') localStorage.removeItem('nova_current_company');
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
  if (context === undefined) throw new Error('useCompany must be used within a CompanyProvider');
  return context;
};
