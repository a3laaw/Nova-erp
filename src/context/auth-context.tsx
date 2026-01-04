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
    if (!firestore) {
        throw new Error("Firestore is not initialized.");
    }
    try {
        // 1. Find user in the Firestore 'users' collection
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('username', '==', username));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
        }

        const userDoc = querySnapshot.docs[0];
        const userProfile = { id: userDoc.id, ...userDoc.data() } as UserProfile;

        // 2. Check if user is active
        if (!userProfile.isActive) {
            throw new Error("هذا الحساب غير نشط. يرجى مراجعة المسؤول.");
        }
        
        // 3. "Verify" password 
        const isPasswordValid = await verifyPassword(password, userProfile.passwordHash || '');
        if (!isPasswordValid) {
            throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
        }

        // 4. Fetch linked employee data to get avatar and full name
        let employeeData: Partial<Employee> = {};
        if (userProfile.employeeId) {
            const employeeRef = doc(firestore, "employees", userProfile.employeeId);
            const employeeSnap = await getDoc(employeeRef);
            if (employeeSnap.exists()) {
                const emp = employeeSnap.data();
                employeeData.fullName = emp.fullName;
                employeeData.profilePicture = emp.profilePicture; 
            }
        }
        
        // 5. Prepare the full user object with a mock UID and employee details.
        const authenticatedUser: AuthenticatedUser = {
            ...userProfile,
            uid: userProfile.id || `mock-uid-${userProfile.username}`,
            fullName: employeeData.fullName || userProfile.username,
            avatarUrl: employeeData.profilePicture
        };
        
        // 6. Store user in session storage and set state
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
