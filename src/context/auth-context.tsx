'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import {
  onAuthStateChanged,
  signOut,
  signInAnonymously,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { UserProfile } from '@/lib/types';
import { users as mockUsers } from '@/lib/data';
import { collection, query, where, getDocs } from 'firebase/firestore';

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

// This is a temporary, insecure password check for demonstration purposes.
// In a real app, this would be a call to a secure backend function.
async function verifyPassword(password: string, hash: string): Promise<boolean> {
    // In a real app, you would use a library like bcrypt to compare the password with the hash.
    // For this demo, we're doing a simple string comparison.
    return password === hash;
}


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { auth, firestore } = useFirebase();
  const router = useRouter();

  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  // This effect handles session persistence
  useEffect(() => {
    // This part is simplified. In a real app, you'd have a more robust session management.
     const storedUser = sessionStorage.getItem('authUser');
     if (storedUser) {
         setUser(JSON.parse(storedUser));
     }
     setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
        // 1. Find user in the local mock data array
        const userFromMock = mockUsers.find(u => u.username === username);

        if (!userFromMock) {
            throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
        }

        // 2. Check if user is active
        if (!userFromMock.isActive) {
            throw new Error("هذا الحساب غير نشط. يرجى مراجعة المسؤول.");
        }

        // 3. "Verify" password against the mock data
        const isPasswordValid = await verifyPassword(password, userFromMock.passwordHash || '');
        if (!isPasswordValid) {
            throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
        }

        // 4. Prepare the full user object with a mock UID.
        const authenticatedUser: AuthenticatedUser = {
            ...userFromMock,
            uid: userFromMock.id || `mock-uid-${userFromMock.username}`,
        };
        
        // 5. Store user in session storage and set state
        sessionStorage.setItem('authUser', JSON.stringify(authenticatedUser));
        setUser(authenticatedUser);

    } catch (error) {
        console.error("Login failed:", error);
        sessionStorage.removeItem('authUser');
        setUser(null);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('An unexpected error occurred during login.');
    } finally {
        setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    sessionStorage.removeItem('authUser');
    // We don't need to sign out from Firebase if we're not signed in.
    setUser(null);
    router.push('/');
    setLoading(false);
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
