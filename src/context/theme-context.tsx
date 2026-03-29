'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'default' | 'glass';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // 🛡️ التأسيس السيادي: جعل الوضع الزجاجي هو الافتراضي
  const [theme, setThemeState] = useState<Theme>('glass');

  useEffect(() => {
    const saved = localStorage.getItem('nova_theme') as Theme;
    const initialTheme = saved || 'glass';
    document.documentElement.setAttribute('data-theme', initialTheme);
    setThemeState(initialTheme);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('nova_theme', newTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'default' ? 'glass' : 'default';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
};