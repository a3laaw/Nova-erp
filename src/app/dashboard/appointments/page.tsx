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
import { useAppTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';

const ArchitecturalAppointmentsView = dynamic(
    () => import('@/components/appointments/architectural-appointments-view'),
    { 
        loading: () => <Skeleton className="h-[500px] w-full rounded-3xl animate-pulse" />,
        ssr: false 
    }
);

const RoomBookingCalendar = dynamic(
    () => import('@/components/appointments/room-booking-calendar'),
    { 
        loading: () => <Skeleton className="h-[500px] w-full rounded-3xl animate-pulse" />,
        ssr: false 
    }
);

export default function AppointmentsPage() {
    const { theme } = useAppTheme();
    const isGlass = theme === 'glass';

    return (
        <div className="space-y-6" dir="rtl">
            <Card className={cn(
                "border-none shadow-sm rounded-[2.5rem] overflow-hidden",
                isGlass ? "glass-effect" : "bg-gradient-to-l from-white to-sky-50 shadow-sm"
            )}>
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

            <Tabs defaultValue="architectural" dir="rtl">
                <div className={cn(isGlass ? "tabs-frame-secondary" : "mb-8 bg-white rounded-3xl shadow-sm p-4")}>
                    <TabsList className={cn(
                        "grid w-full grid-cols-2 h-auto p-0 gap-4 bg-transparent",
                        isGlass ? "" : ""
                    )}>
                        <TabsTrigger value="architectural" className={cn("py-3.5 rounded-xl font-black gap-2 h-14", isGlass && "tabs-trigger-card justify-center items-center")}>
                            <CalendarDays className="h-4 w-4" />
                            مواعيد القسم المعماري
                        </TabsTrigger>
                        <TabsTrigger value="rooms" className={cn("py-3.5 rounded-xl font-black gap-2 h-14", isGlass && "tabs-trigger-card justify-center items-center")}>
                            <Home className="h-4 w-4" />
                            حجوزات قاعات الاجتماعات
                        </TabsTrigger>
                    </TabsList>
                </div>

                <Card className={cn(
                    "border-none shadow-sm rounded-3xl overflow-hidden",
                    isGlass ? "glass-effect" : "bg-white shadow-sm"
                )}>
                    <CardContent className="pt-8">
                        <TabsContent value="architectural" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
                            <ArchitecturalAppointmentsView />
                        </TabsContent>
                        <TabsContent value="rooms" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
                            <RoomBookingCalendar />
                        </TabsContent>
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    )
}