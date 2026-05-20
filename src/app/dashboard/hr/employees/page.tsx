'use client';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Search, FileBarChart, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { EmployeesTable } from '@/components/hr/employees-table';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

export default function EmployeesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    // 🛡️ درع الحماية: منع المستخدم العادي من رؤية سجل الموظفين
    useEffect(() => {
        if (!authLoading && user && !['Admin', 'HR', 'Developer'].includes(user.role)) {
            router.replace('/dashboard');
        }
    }, [user, authLoading, router]);

    if (authLoading || (user && !['Admin', 'HR', 'Developer'].includes(user.role))) {
        return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-10" dir="rtl">
            {/* 🛡️ الهيدر الرئيسي المحدث بالهوية البرتقالية 🛡️ */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">شؤون الموظفين والموارد</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">إدارة ملفات الموظفين، الرواتب، وسجلات التدقيق الوظيفي للمنشأة.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <Users className="h-10 w-10 text-white" />
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 no-print">
                            <Button asChild variant="outline" className="h-12 px-6 rounded-2xl font-black gap-2 bg-white/20 text-white border-white/40 hover:bg-white/30 backdrop-blur-md">
                                <Link href="/dashboard/hr/reports">
                                    <FileBarChart className="h-5 w-5" />
                                    تقارير الموارد
                                </Link>
                            </Button>
                            <Button asChild className="h-12 px-8 rounded-2xl font-black gap-2 bg-white text-[#FF7A00] shadow-xl hover:bg-slate-50 border-none">
                                <Link href="/dashboard/hr/employees/new">
                                    <PlusCircle className="h-5 w-5" />
                                    إضافة
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none rounded-[3rem] overflow-hidden bg-white/95 shadow-2xl">
                <CardContent className="pt-8">
                    <EmployeesTable searchQuery={searchQuery} />
                </CardContent>
            </Card>
        </div>
    );
}
