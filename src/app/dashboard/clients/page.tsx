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

    // Handle initial view and changes from URL params (e.g., ?view=prospective)
    useEffect(() => {
        const viewParam = searchParams.get('view');
        if (viewParam === 'prospective') {
            setView('prospective');
        } else if (viewParam === 'registered') {
            setView('registered');
        }
    }, [searchParams]);

    return (
        <Card dir="rtl" className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-col md:flex-row items-center justify-between gap-4 border-b bg-muted/10 pb-6 px-6">
                <div className="space-y-1">
                    <CardTitle className="text-2xl font-black flex items-center gap-2">
                        {view === 'registered' ? (
                            <Users className="text-primary h-6 w-6" />
                        ) : (
                            <UserSearch className="text-orange-600 h-6 w-6" />
                        )}
                        {view === 'registered' ? 'إدارة ملفات العملاء' : 'متابعة العملاء المحتملين'}
                    </CardTitle>
                    <CardDescription className="text-sm font-medium">
                        {view === 'registered' 
                            ? 'عرض وإدارة بيانات العملاء الذين لديهم ملفات رسمية وعقود.' 
                            : 'تتبع الأشخاص المهتمين الذين قاموا بزيارات أولية ولم يفتحوا ملفات بعد.'}
                    </CardDescription>
                </div>
                
                <div className="flex bg-muted p-1 rounded-xl border shadow-inner">
                    <Button 
                        variant={view === 'registered' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setView('registered')}
                        className={cn(
                            "rounded-lg px-6 font-bold transition-all gap-2", 
                            view === 'registered' && "shadow-sm bg-white hover:bg-white text-primary dark:bg-primary dark:text-white"
                        )}
                    >
                        <Users className="h-4 w-4" />
                        الملفات المسجلة
                    </Button>
                    <Button 
                        variant={view === 'prospective' ? 'default' : 'ghost'} 
                        size="sm" 
                        onClick={() => setView('prospective')}
                        className={cn(
                            "rounded-lg px-6 font-bold transition-all gap-2", 
                            view === 'prospective' && "shadow-sm bg-white hover:bg-white text-orange-600 dark:bg-orange-600 dark:text-white"
                        )}
                    >
                        <UserSearch className="h-4 w-4" />
                        العملاء المحتملون
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-6 px-6">
                <div className="transition-all duration-300 animate-in fade-in zoom-in-95">
                    {view === 'registered' ? (
                        <RegisteredClientsList />
                    ) : (
                        <ProspectiveClientsList />
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
