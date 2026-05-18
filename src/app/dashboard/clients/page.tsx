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
import { Users, UserSearch, Sparkles } from 'lucide-react';
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
            {/* 🛡️ الهيدر الرئيسي السيادي المحدث بالهوية البرتقالية 🛡️ */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">إدارة ملفات العملاء (CRM)</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">مركز التحكم في بيانات العملاء المتعاقدين وتتبع زوار المكتب الجدد.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <Users className="h-10 w-10 text-white" />
                            </div>
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
