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
    return password === hash;
}


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { auth, firestore } = useFirebase();
  const router = useRouter();

  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  // This effect handles session persistence
  useEffect(() => {
    if (!auth) {
        setLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            // If there's a Firebase user, try to load the full profile from session storage
             const storedUser = sessionStorage.getItem('authUser');
             if (storedUser) {
                 const fullUser: AuthenticatedUser = JSON.parse(storedUser);
                 // Simple check to see if the stored user matches the Firebase user
                 if (fullUser.uid === firebaseUser.uid) {
                    setUser(fullUser);
                 } else {
                     // Mismatch, clear session and log out
                     await logout();
                 }
             } else {
                // This case might happen if the page is refreshed and session is lost
                // For this app, we'll log out to force a clean login
                await logout();
             }
        } else {
            setUser(null);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const login = async (username: string, password: string) => {
    if (!auth || !firestore) {
      throw new Error('Firebase not initialized.');
    }
    setLoading(true);

    try {
        // 1. Find user in the mock data array
        const userFromMock = mockUsers.find(u => u.username === username);

        if (!userFromMock) {
            throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
        }

        // 2. Check if user is active
        if (!userFromMock.isActive) {
            throw new Error("هذا الحساب غير نشط. يرجى مراجعة المسؤول.");
        }

        // 3. "Verify" password (insecure, for demo only)
        const isPasswordValid = await verifyPassword(password, userFromMock.passwordHash || '');
        if (!isPasswordValid) {
            throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
        }

        // 4. Sign in anonymously to get a UID
        const userCredential = await signInAnonymously(auth);
        const firebaseUser = userCredential.user;


        // 5. Prepare the full user object
        const authenticatedUser: AuthenticatedUser = {
            ...userFromMock,
            uid: firebaseUser.uid, // Use the real UID from anonymous sign-in
        };
        
        // 6. Store user in session storage and set state
        sessionStorage.setItem('authUser', JSON.stringify(authenticatedUser));
        setUser(authenticatedUser);

    } catch (error) {
        console.error("Login failed:", error);
        // Ensure we log out from any partial anonymous session if something went wrong
        await signOut(auth);
        sessionStorage.removeItem('authUser');
        setUser(null);
        if (error instanceof Error) {
            throw error; // Re-throw the original error to be displayed on the UI
        }
        throw new Error('An unexpected error occurred during login.');
    } finally {
        setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    sessionStorage.removeItem('authUser');
    if (auth) {
      await signOut(auth);
    }
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
