'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'ar' | 'en';
type Direction = 'rtl' | 'ltr';

interface LanguageContextType {
  language: Language;
  direction: Direction;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('ar');
  const [direction, setDirection] = useState<Direction>('rtl');

  const toggleLanguage = () => {
    setLanguage((prev) => {
      const newLang = prev === 'ar' ? 'en' : 'ar';
      setDirection(newLang === 'ar' ? 'rtl' : 'ltr');
      return newLang;
    });
  };

  return (
    <LanguageContext.Provider value={{ language, direction, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
