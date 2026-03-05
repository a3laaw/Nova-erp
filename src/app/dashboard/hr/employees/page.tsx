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

export default function EmployeesPage() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="space-y-1 text-center lg:text-right">
                            <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-3">
                                <Users className="text-primary h-8 w-8" />
                                إدارة شؤون الموظفين
                            </CardTitle>
                            <CardDescription className="text-base font-medium">إدارة ملفات الموظفين، الرواتب، وسجلات التدقيق الوظيفي.</CardDescription>
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="ابحث بالاسم أو الرقم الوظيفي..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-11 rounded-xl shadow-inner bg-background border-2"
                                />
                            </div>
                            <Button asChild variant="outline" className="h-11 px-6 rounded-xl font-bold gap-2">
                                <Link href="/dashboard/hr/reports">
                                    <FileBarChart className="h-5 w-5" />
                                    تقارير الموارد
                                </Link>
                            </Button>
                            <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                                <Link href="/dashboard/hr/employees/new">
                                    <PlusCircle className="h-5 w-5" />
                                    إضافة موظف
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <EmployeesTable searchQuery={searchQuery} />
                </CardContent>
            </Card>
        </div>
    );
}
