'use client';

import { createContext, useContext, useMemo, ReactNode, useState, useEffect } from 'react';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { 
    Firestore,
    getFirestore,
    collection,
    doc,
    onSnapshot,
    Query,
    onSnapshot as onDocSnapshot
} from 'firebase/firestore';
import { Auth, getAuth } from 'firebase/auth';
import { useIsMounted } from '@/hooks/use-is-mounted';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- Firebase Context Definition ---
interface FirebaseContextValue {
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

// --- Firebase Provider Component ---
export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  const value = useMemo(() => {
    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    const auth = getAuth(app);
    return { app, firestore, auth };
  }, []);

  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
};

// --- Custom Hook to use Firebase Context ---
export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};


// --- STABLE, INDEPENDENT FIRESTORE HOOKS ---


/**
 * Subscribes to a Firestore collection by its path.
 * This is the original, stable version of the hook.
 * @param path The full path to the collection. The hook is dormant if the path is null.
 * @returns An object with the array of data and loading state.
 */
export function useSubscription<T>(path: string | null, disabled: boolean = false): { data: T[]; loading: boolean } {
    const { firestore } = useFirebase();

    const collectionRef = useMemo(() => {
        // حماية دفاعية: نتأكد أن المسار موجود وأنه "نص" فعلاً وليس كائن
        if (!path || typeof path !== 'string') {
            if (path) {
                console.error("[Firestore Error] useSubscription received an invalid path type! It should be a string, but received:", path);
            }
            return null;
        }
        return collection(firestore, path);
    }, [path, firestore]);

    const { data, loading } = useCollection<T>(collectionRef, disabled);
    return { data, loading };
}

/**
 * Subscribes to a single Firestore document by its path.
 * This is the original, stable version of the hook.
 * @param path The full path to the document. The hook is dormant if the path is null.
 * @returns An object with the document data and loading state.
 */
export function useDocument<T>(path: string | null, disabled: boolean = false): { data: T | null; loading: boolean } {
  const { firestore } = useFirebase();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useIsMounted();

  useEffect(() => {
    if (!path || disabled) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
        const docRef = doc(firestore, path);
        const unsubscribe = onDocSnapshot(docRef, (docSnap) => {
        if (isMounted()) {
            setData(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as T : null);
            setLoading(false);
        }
        }, (error) => {
        console.error(`[Firestore] Error in useDocument (${path}):`, error);
        if (isMounted()) {
            setData(null);
            setLoading(false);
        }
        });

        return () => unsubscribe();
    } catch(error) {
        console.error(`[Firestore] Failed to create document reference in useDocument (${path}):`, error);
        if (isMounted()) {
            setData(null);
            setLoading(false);
        }
    }
  }, [path, disabled, firestore, isMounted]);

  return { data, loading };
}

/**
 * Subscribes to a Firestore query.
 * This is the new hook that was originally requested, now implemented safely.
 * @param q The Firestore Query object. The hook is dormant if the query is null.
 * @returns An object with the array of data and loading state.
 */
export function useCollection<T>(q: Query | null, disabled: boolean = false): { data: T[]; loading: boolean } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const isMounted = useIsMounted();

    useEffect(() => {
        if (!q || disabled) {
            setData([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            if (isMounted()) {
                const items = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
                setData(items);
                setLoading(false);
            }
        }, (error) => {
            console.error("[Firestore] Error in useCollection:", error);
            if (isMounted()) {
                setData([]);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [q, disabled, isMounted]);

    return { data, loading };
}
