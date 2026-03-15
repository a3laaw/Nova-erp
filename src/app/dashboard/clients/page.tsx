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
import { useAppTheme } from '@/context/theme-context';

export default function ClientsPage() {
    const searchParams = useSearchParams();
    const [view, setView] = useState<'registered' | 'prospective'>('registered');
    const { theme } = useAppTheme();
    const isGlass = theme === 'glass';

    useEffect(() => {
        const viewParam = searchParams.get('view');
        if (viewParam === 'prospective') setView('prospective');
        else if (viewParam === 'registered') setView('registered');
    }, [searchParams]);

    return (
        <div className="space-y-6" dir="rtl">
            <Card className={cn(
                "border-none rounded-[2.5rem] overflow-hidden",
                isGlass ? "glass-effect" : "bg-gradient-to-l from-white to-sky-50 shadow-sm"
            )}>
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
                            <CardDescription className={cn("text-base font-medium", isGlass && "text-slate-800")}>
                                {view === 'registered' 
                                    ? 'مركز التحكم في بيانات العملاء المتعاقدين وملفاتهم الفنية.' 
                                    : 'تتبع زوار المكتب والزيارات الأولية لتحويلهم إلى تعاقدات رسمية.'}
                            </CardDescription>
                        </div>
                        
                        <div className={cn(
                            "flex p-1.5 rounded-[1.5rem] border shadow-inner",
                            isGlass ? "bg-white/20 border-white/20" : "bg-muted"
                        )}>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setView('registered')}
                                className={cn(
                                    "rounded-xl px-8 h-10 font-bold transition-all gap-2", 
                                    view === 'registered' 
                                        ? (isGlass ? "bg-white/60 text-primary shadow-lg" : "bg-white shadow-md text-primary dark:bg-primary dark:text-white")
                                        : (isGlass ? "text-slate-900" : "")
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
                                    view === 'prospective' 
                                        ? (isGlass ? "bg-white/60 text-orange-600 shadow-lg" : "bg-white shadow-md text-orange-600 dark:bg-orange-600 dark:text-white")
                                        : (isGlass ? "text-slate-900" : "")
                                )}
                            >
                                <UserSearch className="h-4 w-4" />
                                العملاء المحتملون
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className={cn(
                "border-none rounded-3xl overflow-hidden",
                isGlass ? "glass-effect" : "bg-white shadow-sm"
            )}>
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