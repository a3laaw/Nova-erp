'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { 
    signInWithCustomToken, 
    signOut, 
    onAuthStateChanged, 
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
import type { UserProfile, UserRole } from '@/lib/types';


// This would be your actual custom token generation endpoint
// For this example, we'll mock it.
async function getCustomToken(username: string): Promise<string> {
    // In a real app, this would be an HTTPS call to a Firebase Function
    // e.g., const response = await fetch('https://your-cloud-function-url/generateCustomToken', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ username }),
    // });
    // const { token } = await response.json();
    // return token;
    
    // ---- MOCK IMPLEMENTATION ----
    // This is a placeholder to simulate fetching a custom token.
    // In a real scenario, never generate tokens on the client.
    console.warn("Mock token generation is for development only.");
    
    // We'll use a simple, insecure "token" format: username:role for the mock.
    // In a real app, this would be a signed JWT from your server.
    const MOCK_USERS: Record<string, { role: UserRole }> = {
        'ali.ahmed': { role: 'Admin' },
        'fatima.almansoori': { role: 'Engineer' },
        'yusuf.khan': { role: 'Accountant' },
        'hassan.ibrahim': { role: 'Engineer' },
        'salama.almazrouei': { role: 'Secretary' },
        'badria.saleh': { role: 'HR'},
    };

    const userInfo = MOCK_USERS[username];
    if (!userInfo) {
        throw new Error("Invalid mock user for token generation.");
    }
    
    return `${username}:${userInfo.role}`;
}


// This function will be mocked on the client side for demonstration.
// In a real app, password verification must happen on the server.
async function verifyPassword(password: string, hash: string): Promise<boolean> {
    // ---- MOCK IMPLEMENTATION ----
    // In a real app, you would NEVER have this logic on the client.
    // This is just to complete the login flow for the example.
    // A real implementation would use bcrypt.compare on the server.
    return password === '123456'; // Using a simple mock password for all users
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
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser && firestore) {
            // User is signed in with Firebase. Fetch their profile from Firestore.
            const userDocRef = doc(firestore, 'users', firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userProfile = userDocSnap.data() as UserProfile;
                 setUser({
                    uid: firebaseUser.uid,
                    ...userProfile
                });
            } else {
                // Profile doesn't exist, something is wrong.
                await logout();
            }
        } else {
            setUser(null);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  const login = async (username: string, password: string) => {
    if (!firestore || !auth) {
        throw new Error("Firebase is not initialized.");
    }
    
    // 1. Find user by username in Firestore
    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as UserProfile;

    // 2. Check if user is active
    if (!userData.isActive) {
        throw new Error("هذا الحساب غير نشط. يرجى مراجعة المسؤول.");
    }

    // 3. Verify password (mocked)
    const isPasswordValid = await verifyPassword(password, userData.passwordHash || '');
    if (!isPasswordValid) {
        throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
    }

    // 4. Get custom token (mocked)
    const customToken = await getCustomToken(username);
    
    // 5. Sign in with custom token
    // For the mock token, we extract the role. A real token would be used directly.
    const [tokenUsername, tokenRole] = customToken.split(':');

    // Create a mock Firebase user object for the client-side state
    const mockFirebaseUser: Partial<FirebaseUser> = {
        uid: userDoc.id,
    };
    
    const authenticatedUser: AuthenticatedUser = {
        ...userData,
        id: userDoc.id,
        uid: userDoc.id,
        role: tokenRole as UserRole,
    };
    
    setUser(authenticatedUser);

    // Note: The actual `signInWithCustomToken` would be used with a real token.
    // For this mock, we are manually setting the user state.
    // await signInWithCustomToken(auth, customToken);

    setLoading(false);
  };

  const logout = async () => {
    if (auth) {
      await signOut(auth);
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
