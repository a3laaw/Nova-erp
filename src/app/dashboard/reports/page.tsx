// This file is now deprecated and its content has been split into individual report pages.
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportsRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/reports/delayed-stages');
    }, [router]);
    return null;
}

  