'use client';

import { useEffect, useState, Suspense } from 'react';
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
import { CalendarDays, Home, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const ArchitecturalAppointmentsView = dynamic(
    () => import('@/components/appointments/architectural-appointments-view').then(mod => mod.ArchitecturalAppointmentsView),
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

function AppointmentsContent() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState('architectural');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'rooms') setActiveTab('rooms');
        else if (tab === 'architectural') setActiveTab('architectural');
    }, [searchParams]);

    return (
        <div className="space-y-10" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">إدارة المواعيد والتقويم</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">تنظيم زيارات القسم المعماري وحجز القاعات بنظام ذكي لمنع التعارض.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <CalendarDays className="h-10 w-10 text-white" />
                            </div>
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
    );
}

export default function AppointmentsPage() {
    return (
        <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-[2.5rem]" />}>
            <AppointmentsContent />
        </Suspense>
    );
}