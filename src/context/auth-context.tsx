'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { 
    onAuthStateChanged, 
    signOut,
    signInAnonymously,
    type User as FirebaseUser 
} from 'firebase/auth';
import type { UserProfile } from '@/lib/types';
import { users as mockUsers } from '@/lib/data'; // Import mock data

// This function will be mocked on the client side for demonstration.
async function verifyPassword(password: string, hash: string): Promise<boolean> {
    // For this mock, we'll do a simple string comparison.
    return password === hash;
}


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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { auth, firestore } = useFirebase();
  const router = useRouter();

  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('authUser');
    if (storedUser) {
        try {
            setUser(JSON.parse(storedUser));
        } catch(e) {
            sessionStorage.removeItem('authUser');
        }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    
    // --- LOCAL AUTHENTICATION (Workaround) ---
    const userFromMock = mockUsers.find(u => u.username === username);

    if (!userFromMock) {
        setLoading(false);
        throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
    }
    
    if (!userFromMock.isActive) {
        setLoading(false);
        throw new Error("هذا الحساب غير نشط. يرجى مراجعة المسؤول.");
    }

    const isPasswordValid = await verifyPassword(password, userFromMock.passwordHash || '');
    
    if (!isPasswordValid) {
        setLoading(false);
        throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
    }
    
    // In a real app, we'd get a UID from Firebase. Here, we'll use the mock ID.
    const authenticatedUser: AuthenticatedUser = {
        ...userFromMock,
        id: userFromMock.id || `mock-${username}`,
        uid: userFromMock.id || `mock-uid-${username}`,
    };

    sessionStorage.setItem('authUser', JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
    setLoading(false);
  };

  const logout = async () => {
    sessionStorage.removeItem('authUser');
    setUser(null);
    if(auth) {
        await signOut(auth);
    }
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
