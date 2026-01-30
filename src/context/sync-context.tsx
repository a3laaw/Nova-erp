'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { WifiOff } from 'lucide-react';

interface SyncContextType {
  isOnline: boolean;
  justUpdated: boolean;
  signalUpdate: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [justUpdated, setJustUpdated] = useState(false);
  
  useEffect(() => {
    // Check initial status on the client
    if (typeof window !== 'undefined' && typeof navigator.onLine === 'boolean') {
        setIsOnline(navigator.onLine);
    }
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const signalUpdate = useCallback(() => {
    setJustUpdated(true);
    const timer = setTimeout(() => {
      setJustUpdated(false);
    }, 3000); // Hide after 3 seconds
    return () => clearTimeout(timer);
  }, []);

  return (
    <SyncContext.Provider value={{ isOnline, justUpdated, signalUpdate }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncStatus() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSyncStatus must be used within a SyncStatusProvider');
  }
  return context;
}

// A component to display the offline indicator
export function OfflineIndicator() {
    const { isOnline } = useSyncStatus();

    if (isOnline) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 flex animate-pulse items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-white shadow-lg no-print dark:bg-slate-800">
            <WifiOff className="h-5 w-5" />
            <span className="text-sm font-medium">أنت غير متصل بالإنترنت</span>
        </div>
    );
}

// A component to display the update indicator
export function UpdateIndicator() {
    const { justUpdated } = useSyncStatus();

    return (
        <div className={cn(
            "flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 transition-all duration-300 dark:bg-blue-900/50 dark:text-blue-300",
            justUpdated ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'
        )}>
            <div className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500"></span>
            </div>
            <span>تم تحديث البيانات</span>
        </div>
    );
}
