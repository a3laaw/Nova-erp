'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Search, FileBarChart } from 'lucide-react';
import Link from 'next/link';
import { EmployeesTable } from '@/components/hr/employees-table';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function EmployeesPage() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="space-y-10" dir="rtl">
            {/* 🛡️ الهيدر الرئيسي السيادي لشؤون الموظفين */}
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-pink-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="space-y-2 text-center lg:text-right">
                            <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-4">
                                شؤون الموظفين والموارد
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                                    <Users className="h-8 w-8" />
                                </div>
                            </CardTitle>
                            <CardDescription className="text-base font-bold text-slate-500 mt-1 pr-0 lg:pr-12">
                                إدارة ملفات الموظفين، الرواتب، وسجلات التدقيق الوظيفي للمنشأة.
                            </CardDescription>
                        </div>
                        
                        <div className="flex items-center gap-3 no-print">
                            <Button asChild variant="outline" className="h-11 px-6 rounded-xl font-bold gap-2 bg-white/60 border-primary/20 text-primary">
                                <Link href="/dashboard/hr/reports">
                                    <FileBarChart className="h-5 w-5" />
                                    تقارير الموارد
                                </Link>
                            </Button>
                            <Button asChild className="h-11 px-10 rounded-xl font-black gap-2 shadow-xl shadow-primary/20">
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
