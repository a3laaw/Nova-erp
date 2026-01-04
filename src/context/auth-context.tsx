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
async function getCustomToken(uid: string, role: UserRole): Promise<string> {
    // In a real app, this would be an HTTPS call to a Firebase Function
    // that mints a token for the given UID with the specified role claim.
    // e.g., const response = await fetch('https://your-cloud-function-url/generateToken', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ uid, role }),
    // });
    // const { token } = await response.json();
    // return token;
    
    // ---- MOCK IMPLEMENTATION ----
    // This is a placeholder to simulate fetching a custom token.
    // In a real scenario, never generate tokens on the client.
    console.warn("Mock token generation is for development only.");
    
    // We'll use a simple, insecure "token" format for the mock.
    // A real token is a long, signed JWT.
    // This is NOT a real token, but it allows signInWithCustomToken to work with the emulator.
    const mockPayload = JSON.stringify({ uid, claims: { role } });
    
    // In a real scenario, you'd return a real JWT from your server.
    // For the emulator, even a non-JWT string works if it's not empty.
    // We return the payload to have some identifiable data, but it's not used by the client.
    // The IMPORTANT part is that the server would create this with the Admin SDK.
    return `mock-token-for-${uid}`;
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
    if (!auth) {
      setLoading(false);
      return;
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firestore) {
        // User is signed in with Firebase Auth. Now fetch their profile from Firestore.
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userProfile = userDocSnap.data() as UserProfile;
          setUser({
            ...userProfile,
            uid: firebaseUser.uid,
            id: firebaseUser.uid,
          });
        } else {
          // User exists in Auth but not in Firestore. This is an inconsistent state.
          setUser(null);
          await signOut(auth);
        }
      } else {
        // No user signed in with Firebase Auth.
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

    // 3. Verify password (using our mocked verification)
    const isPasswordValid = await verifyPassword(password, userData.passwordHash || '');
    if (!isPasswordValid) {
        throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
    }
    
    // 4. If password is valid, get a custom token (mocked)
    const customToken = await getCustomToken(userDoc.id, userData.role);

    // 5. Sign in with the custom token
    // This is the crucial step that creates a real Firebase Auth session.
    await signInWithCustomToken(auth, customToken);

    // The onAuthStateChanged listener will now handle setting the user state.
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
