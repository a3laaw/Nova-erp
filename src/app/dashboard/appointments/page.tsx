'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const ArchitecturalAppointmentsView = dynamic(
    () => import('@/components/appointments/architectural-appointments-view'),
    { 
        loading: () => <Skeleton className="h-[500px] w-full rounded-[2.5rem] animate-pulse" />,
        ssr: false 
    }
);

const RoomBookingCalendar = dynamic(
    () => import('@/components/appointments/room-booking-calendar'),
    { 
        loading: () => <Skeleton className="h-[500px] w-full rounded-[2.5rem] animate-pulse" />,
        ssr: false 
    }
);

export default function AppointmentsPage() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState('architectural');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'rooms') setActiveTab('rooms');
        else if (tab === 'architectural') setActiveTab('architectural');
    }, [searchParams]);

    return (
        <div className="space-y-10" dir="rtl">
            {/* 🛡️ الهيدر الرئيسي السيادي للمواعيد */}
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="space-y-2 text-center lg:text-right">
                            <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-4">
                                إدارة المواعيد والتقويم
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                                    <CalendarDays className="h-8 w-8" />
                                </div>
                            </CardTitle>
                            <CardDescription className="text-base font-bold text-slate-500 mt-1 pr-0 lg:pr-12">
                                تنظيم زيارات القسم المعماري وحجز القاعات بنظام ذكي لمنع التعارض.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full">
                <div className="flex justify-center mb-10">
                    <TabsList className="w-full max-w-2xl h-16 shadow-xl border-white/60">
                        <TabsTrigger value="architectural" className="gap-2 h-full text-base font-black">
                            <CalendarDays className="h-4 w-4" />
                            مواعيد القسم المعماري
                        </TabsTrigger>
                        <TabsTrigger value="rooms" className="gap-2 h-full text-base font-black">
                            <Home className="h-4 w-4" />
                            حجوزات القاعات
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <TabsContent value="architectural" className="mt-0">
                        <ArchitecturalAppointmentsView />
                    </TabsContent>
                    <TabsContent value="rooms" className="mt-0">
                        <RoomBookingCalendar />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
