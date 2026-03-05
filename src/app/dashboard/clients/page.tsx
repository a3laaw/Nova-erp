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

export default function ClientsPage() {
    const searchParams = useSearchParams();
    const [view, setView] = useState<'registered' | 'prospective'>('registered');

    useEffect(() => {
        const viewParam = searchParams.get('view');
        if (viewParam === 'prospective') setView('prospective');
        else if (viewParam === 'registered') setView('registered');
    }, [searchParams]);

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="space-y-1 text-center lg:text-right">
                            <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-3">
                                {view === 'registered' ? (
                                    <Users className="text-primary h-8 w-8" />
                                ) : (
                                    <UserSearch className="text-orange-600 h-8 w-8" />
                                )}
                                {view === 'registered' ? 'إدارة ملفات العملاء' : 'متابعة العملاء المحتملين'}
                            </CardTitle>
                            <CardDescription className="text-base font-medium">
                                {view === 'registered' 
                                    ? 'مركز التحكم في بيانات العملاء المتعاقدين وملفاتهم الفنية.' 
                                    : 'تتبع زوار المكتب والزيارات الأولية لتحويلهم إلى تعاقدات رسمية.'}
                            </CardDescription>
                        </div>
                        
                        <div className="flex bg-muted p-1.5 rounded-[1.5rem] border shadow-inner">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setView('registered')}
                                className={cn(
                                    "rounded-xl px-8 h-10 font-bold transition-all gap-2", 
                                    view === 'registered' && "shadow-md bg-white hover:bg-white text-primary dark:bg-primary dark:text-white"
                                )}
                            >
                                <Users className="h-4 w-4" />
                                الملفات المسجلة
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setView('prospective')}
                                className={cn(
                                    "rounded-xl px-8 h-10 font-bold transition-all gap-2", 
                                    view === 'prospective' && "shadow-md bg-white hover:bg-white text-orange-600 dark:bg-orange-600 dark:text-white"
                                )}
                            >
                                <UserSearch className="h-4 w-4" />
                                العملاء المحتملون
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <div className="transition-all duration-500 animate-in fade-in zoom-in-95">
                        {view === 'registered' ? (
                            <RegisteredClientsList />
                        ) : (
                            <ProspectiveClientsList />
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
