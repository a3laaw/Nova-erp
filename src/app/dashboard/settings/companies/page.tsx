'use client';
import { CompanyManager } from '@/components/settings/company-manager';
import { useRouter } from 'next/navigation';

export default function CompaniesPage() {
    const router = useRouter();
    return <CompanyManager onBack={() => router.push('/dashboard/settings')} />;
}
