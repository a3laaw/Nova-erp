'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useUser } from '@/firebase';
import type { Employee, UserProfile } from '@/lib/types';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';


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

// Define mock user outside the component to ensure it's a stable reference
// and to avoid creating a new object on every render.
const mockAdminUser: AuthenticatedUser = {
    uid: 'mock-admin-uid',
    id: 'mock-admin-id',
    username: 'admin.user',
    email: 'admin@scoop.local',
    role: 'Admin',
    isActive: true,
    employeeId: 'emp-admin',
    fullName: 'المدير العام',
    jobTitle: 'Admin',
    avatarUrl: 'https://images.unsplash.com/photo-1557862921-37829c790f19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw1fHxtYW4lMjBnbGFzc2VzfGVufDB8fHx8MTc2NzIwMzM1MHww&ixlib=rb-4.1.0&q=80&w=1080',
    passwordHash: '',
    createdAt: new Timestamp(1672531200, 0), // Jan 1, 2023 - static date
    activatedAt: new Timestamp(1672531200, 0), // Jan 1, 2023 - static date
    createdBy: 'system-fallback'
};


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

    if (!firestore) {
      console.warn("Firestore is not initialized. Firebase config might be missing. Falling back to mock admin user for development.");
      setUser(mockAdminUser);
      setLoading(false);
      return;
    }

    if (!firebaseUser) {
      console.warn("No authenticated Firebase user found. Falling back to mock admin user for development.");
      setUser(mockAdminUser);
      setLoading(false);
      return;
    }


    const userProfileQuery = query(collection(firestore, 'users'), where('uid', '==', firebaseUser.uid));
    
    const unsubscribe = onSnapshot(userProfileQuery, async (snapshot) => {
      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const userProfileData = userDoc.data() as UserProfile;

        // Selectively fetch and attach only necessary employee data
        let fullName, avatarUrl, jobTitle;
        if (userProfileData.employeeId) {
          const employeeDocRef = doc(firestore, 'employees', userProfileData.employeeId);
          const employeeSnap = await getDoc(employeeDocRef);
          if (employeeSnap.exists()) {
            const employeeData = employeeSnap.data() as Employee;
            fullName = employeeData.fullName;
            avatarUrl = employeeData.profilePicture;
            jobTitle = employeeData.jobTitle;
          }
        }
        
        setUser({
          ...userProfileData,
          id: userDoc.id,
          uid: firebaseUser.uid,
          // Augment with employee data, providing fallbacks
          fullName: fullName || userProfileData.username,
          avatarUrl: avatarUrl || '',
          jobTitle: jobTitle || '',
        });

      } else {
         // This case can happen if the user exists in Auth but not in Firestore 'users' collection
         console.warn(`User profile not found in Firestore for UID: ${firebaseUser.uid}. Falling back to mock admin user for development.`);
         setUser(mockAdminUser);
      }
      setLoading(false);
    }, (error) => {
        console.error("Error fetching user profile:", error);
        setUser(null);
        setLoading(false);
    });

    return () => unsubscribe();
    
  }, [firebaseUser, authLoading, firestore]);


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
