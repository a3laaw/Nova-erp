import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { onSnapshot, query, collection, orderBy as fbOrderBy, where, QueryConstraint } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseApp: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const firestore: Firestore = getFirestore(firebaseApp);
const auth: Auth = getAuth(firebaseApp);

interface FirebaseContextType {
    firebaseApp: FirebaseApp | null;
    firestore: Firestore | null;
    auth: Auth | null;
}

const FirebaseContext = createContext<FirebaseContextType>({
    firebaseApp: null,
    firestore: null,
    auth: null,
});

export const FirebaseProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <FirebaseContext.Provider value={{ firebaseApp, firestore, auth }}>
            {children}
        </FirebaseContext.Provider>
    );
};

export const useFirebase = () => {
    return useContext(FirebaseContext);
};

// The stable, original version of useSubscription
export function useSubscription<T>(
    firestore: Firestore | null,
    path: string | null,
    orderBy: string = 'order'
): { data: T[]; loading: boolean; error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const memoizedPath = useMemo(() => path, [path]);

    useEffect(() => {
        if (!firestore || !memoizedPath) {
            setData([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const q = query(collection(firestore, memoizedPath), fbOrderBy(orderBy));
            
            const unsubscribe = onSnapshot(
                q,
                (querySnapshot) => {
                    const fetchedData: T[] = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                    } as T));
                    setData(fetchedData);
                    setLoading(false);
                },
                (err) => {
                    console.error(`Error fetching from ${memoizedPath}:`, err);
                    setError(err);
                    setLoading(false);
                }
            );

            return () => unsubscribe();
        } catch (err: any) {
            console.error(`Error setting up subscription for ${memoizedPath}:`, err);
            setError(err);
            setData([]);
            setLoading(false);
            return;
        }

    }, [firestore, memoizedPath, orderBy]);

    return { data, loading, error };
}
