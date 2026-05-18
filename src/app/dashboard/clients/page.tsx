'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RegisteredClientsList } from '@/components/clients/registered-clients-list';
import { ProspectiveClientsList } from '@/components/clients/prospective-clients-list';
import { Button } from '@/components/ui/button';
import { Users, UserSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ClientsPage() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState('registered');

    useEffect(() => {
        const viewParam = searchParams.get('view');
        if (viewParam === 'prospective') setActiveTab('prospective');
        else if (viewParam === 'registered') setActiveTab('registered');
    }, [searchParams]);

    return (
        <div className="space-y-10" dir="rtl">
            {/* 🛡️ الهيدر الرئيسي السيادي لإدارة العملاء */}
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-blue-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="space-y-2 text-center lg:text-right">
                            <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-4">
                                إدارة ملفات العملاء (CRM)
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                                    <Users className="h-8 w-8" />
                                </div>
                            </CardTitle>
                            <CardDescription className="text-base font-bold text-slate-500 mt-1 pr-0 lg:pr-12">
                                مركز التحكم في بيانات العملاء المتعاقدين وتتبع زوار المكتب الجدد.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full">
                <div className="flex justify-center mb-10">
                    <TabsList className="w-full max-w-2xl h-16 shadow-xl border-white/60">
                        <TabsTrigger value="registered" className="gap-2 h-full text-base font-black">
                            <Users className="h-4 w-4" />
                            الملفات المسجلة
                        </TabsTrigger>
                        <TabsTrigger value="prospective" className="gap-2 h-full text-base font-black">
                            <UserSearch className="h-4 w-4" />
                            المحتملون
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95">
                        <CardContent className="pt-8">
                            <TabsContent value="registered" className="mt-0">
                                <RegisteredClientsList />
                            </TabsContent>
                            <TabsContent value="prospective" className="mt-0">
                                <ProspectiveClientsList />
                            </TabsContent>
                        </CardContent>
                    </Card>
                </div>
            </Tabs>
        </div>
    );
}
