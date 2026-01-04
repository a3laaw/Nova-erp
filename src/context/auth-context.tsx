'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import type { Employee, UserProfile } from '@/lib/types';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export interface AuthenticatedUser extends UserProfile {
  uid: string;
}

interface AuthContextType {
  user: AuthenticatedUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// A mock user to bypass login for now
const MOCK_ADMIN_USER: AuthenticatedUser = {
  id: 'admin-user-mock',
  uid: 'admin-user-mock',
  username: 'admin.mock',
  email: 'admin.mock@bmec-kw.local',
  role: 'Admin',
  isActive: true,
  fullName: 'Admin User (Mock)',
  employeeId: 'mock-employee-id',
  passwordHash: 'mock',
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  // This effect now bypasses login and sets a mock admin user.
  useEffect(() => {
    setUser(MOCK_ADMIN_USER);
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    // Login function is disabled for now.
    console.log("Login is temporarily disabled.");
    setUser(MOCK_ADMIN_USER);
    router.push('/dashboard');
  };

  const logout = async () => {
    // Logout function is disabled for now.
    console.log("Logout is temporarily disabled.");
    // To prevent being locked out, we just refresh the page which will log back in.
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
