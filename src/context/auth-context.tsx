'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { 
    // We are not using Firebase Auth directly for login anymore, but keeping for session state
    onAuthStateChanged, 
    signOut,
    signInAnonymously, // We will sign in users anonymously to get a UID for rules
    type User as FirebaseUser 
} from 'firebase/auth';
import { 
    collection, 
    query, 
    where, 
    getDocs,
    doc,
    getDoc,
    type DocumentData
} from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';


// This function will be mocked on the client side for demonstration.
// In a real app, password verification must happen on the server.
async function verifyPassword(password: string, hash: string): Promise<boolean> {
    // In a real-world scenario, this would be a call to a server
    // which would use something like bcrypt.compare(password, hash)
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

  // This effect now only manages session persistence.
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    };
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        // Since we aren't using real Firebase Auth users, this listener
        // is mostly for session management. We'll handle user state manually.
        const storedUser = sessionStorage.getItem('authUser');
        if (firebaseUser && storedUser) {
            try {
                const manualUser = JSON.parse(storedUser) as AuthenticatedUser;
                setUser(manualUser);
            } catch (e) {
                 setUser(null);
                 sessionStorage.removeItem('authUser');
            }
        } else {
            setUser(null);
            sessionStorage.removeItem('authUser');
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const login = async (username: string, password: string) => {
    if (!firestore || !auth) {
        throw new Error("Firebase is not initialized.");
    }
    setLoading(true);
    
    // 1. Find user by username in Firestore
    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        setLoading(false);
        throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as UserProfile;
    const userId = userDoc.id;

    // 2. Check if user is active
    if (!userData.isActive) {
        setLoading(false);
        throw new Error("هذا الحساب غير نشط. يرجى مراجعة المسؤول.");
    }

    // 3. Verify password (using our mocked verification)
    const isPasswordValid = await verifyPassword(password, userData.passwordHash || '');
    if (!isPasswordValid) {
        setLoading(false);
        throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
    }
    
    // 4. If password is valid, create the user object.
    // To satisfy security rules that check auth.uid, we will sign in anonymously.
    // In a real app, this is where you'd use the custom token flow.
    const credential = await signInAnonymously(auth);

    const authenticatedUser: AuthenticatedUser = {
        ...userData,
        id: userId,
        uid: credential.user.uid, // Use the anonymous UID
    };

    // 5. Set user state manually and persist to session storage
    sessionStorage.setItem('authUser', JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
    setLoading(false);
  };

  const logout = async () => {
    if (auth) {
      await signOut(auth);
    }
    sessionStorage.removeItem('authUser');
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
