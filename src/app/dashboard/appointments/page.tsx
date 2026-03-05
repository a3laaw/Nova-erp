'use client';

import {
  Card,
  CardContent,
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

const ArchitecturalAppointmentsView = dynamic(
    () => import('@/components/appointments/architectural-appointments-view').then(mod => mod.ArchitecturalAppointmentsView),
    { 
        loading: () => <Skeleton className="h-[500px] w-full rounded-3xl animate-pulse" />,
        ssr: false 
    }
);

const RoomBookingCalendar = dynamic(
    () => import('@/components/appointments/room-booking-calendar').then(mod => mod.RoomBookingCalendar),
    { 
        loading: () => <Skeleton className="h-[500px] w-full rounded-3xl animate-pulse" />,
        ssr: false 
    }
);

export default function AppointmentsPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                            <CalendarDays className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">إدارة المواعيد والتقويم</CardTitle>
                            <CardDescription className="text-base font-medium">
                                تنظيم زيارات القسم المعماري وحجز القاعات بنظام ذكي لمنع التعارض.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <Tabs defaultValue="architectural" dir="rtl">
                        <TabsList className="grid w-full grid-cols-2 h-auto p-1.5 bg-muted/50 rounded-2xl mb-8">
                            <TabsTrigger value="architectural" className="py-3.5 rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg">
                                <CalendarDays className="h-4 w-4" />
                                مواعيد القسم المعماري
                            </TabsTrigger>
                            <TabsTrigger value="rooms" className="py-3.5 rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg">
                                <Home className="h-4 w-4" />
                                حجوزات قاعات الاجتماعات
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="architectural" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
                            <ArchitecturalAppointmentsView />
                        </TabsContent>
                        <TabsContent value="rooms" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
                            <RoomBookingCalendar />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
