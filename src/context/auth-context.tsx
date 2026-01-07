'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import type { Employee, UserProfile } from '@/lib/types';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';


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
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!auth || !firestore) {
      // Firebase services might not be available yet.
      // The effect will re-run when they are.
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, get their profile from Firestore.
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userProfile = userDoc.data() as UserProfile;
          
          if (!userProfile.isActive) {
            // If user is not active, sign them out and prevent login.
            await signOut(auth);
            setUser(null);
            setLoading(false);
            return;
          }

          // Get linked employee data
          const employeeDocRef = doc(firestore, 'employees', userProfile.employeeId);
          const employeeDoc = await getDoc(employeeDocRef);
          
          setUser({
            ...userProfile,
            id: userDoc.id,
            uid: firebaseUser.uid,
            fullName: employeeDoc.exists() ? employeeDoc.data().fullName : userProfile.username,
            avatarUrl: employeeDoc.exists() ? employeeDoc.data().profilePicture : undefined,
          });
        } else {
          // User exists in Auth, but not in Firestore. This is an invalid state.
          await signOut(auth);
          setUser(null);
        }
      } else {
        // User is signed out
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  const login = async (username: string, password: string) => {
    if (!firestore || !auth) {
        throw new Error("Authentication service is not ready.");
    }

    // 1. Find user in Firestore by username
    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where('username', '==', username), where('isActive', '==', true));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("User not found or account is not active.");
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as UserProfile;

    // 2. Use the email from Firestore to sign in with Firebase Auth
    await signInWithEmailAndPassword(auth, userData.email, password);

    // The onAuthStateChanged listener will handle setting the user state.
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
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
