'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useUser } from '@/firebase';
import type { Employee, UserProfile } from '@/lib/types';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';


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
  const router = useRouter();
  const { auth, firestore } = useFirebase();
  const { user: firebaseUser, loading: authLoading } = useUser();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!firebaseUser) {
      setUser(null);
      setLoading(false);
      // Optional: redirect to login page if not on it
      // if (router.pathname !== '/') router.push('/');
      return;
    }

    if (!firestore) return;

    const userProfileQuery = query(collection(firestore, 'users'), where('uid', '==', firebaseUser.uid));
    
    const unsubscribe = onSnapshot(userProfileQuery, async (snapshot) => {
      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const userProfileData = userDoc.data() as UserProfile;

        // Fetch employee data
        const employeeDocRef = doc(firestore, 'employees', userProfileData.employeeId);
        const employeeSnap = await getDoc(employeeDocRef);
        const employeeData = employeeSnap.exists() ? (employeeSnap.data() as Employee) : {};
        
        setUser({
          ...userProfileData,
          ...employeeData,
          id: userDoc.id,
          uid: firebaseUser.uid
        });

      } else {
         // This case can happen if the user exists in Auth but not in Firestore 'users' collection
         console.warn(`User profile not found in Firestore for UID: ${firebaseUser.uid}`);
         setUser(null);
      }
      setLoading(false);
    }, (error) => {
        console.error("Error fetching user profile:", error);
        setUser(null);
        setLoading(false);
    });

    return () => unsubscribe();
    
  }, [firebaseUser, authLoading, firestore, router]);


  const login = async (username: string, password: string) => {
    console.log("Login function is disabled.");
    throw new Error("Authentication is currently disabled.");
  };

  const logout = async () => {
    if(auth) {
        await auth.signOut();
    }
    setUser(null);
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
