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

// تهيئة المكونات بشكل آمن لمنع أخطاء الـ Chunks في Cloud Workstations
const ArchitecturalAppointmentsView = dynamic(
    () => import('@/components/appointments/architectural-appointments-view').then(mod => {
        if (!mod.ArchitecturalAppointmentsView) throw new Error("Component export mismatch");
        return mod.ArchitecturalAppointmentsView;
    }),
    { 
        loading: () => <Skeleton className="h-[500px] w-full rounded-2xl animate-pulse" />,
        ssr: false 
    }
);

const RoomBookingCalendar = dynamic(
    () => import('@/components/appointments/room-booking-calendar').then(mod => {
        if (!mod.RoomBookingCalendar) throw new Error("Component export mismatch");
        return mod.RoomBookingCalendar;
    }),
    { 
        loading: () => <Skeleton className="h-[500px] w-full rounded-2xl animate-pulse" />,
        ssr: false 
    }
);


export default function AppointmentsPage() {
    return (
        <Card dir="rtl" className="border-none shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/10 pb-6 border-b">
                <CardTitle className="text-2xl font-black">إدارة المواعيد والتقويم</CardTitle>
                <CardDescription className="text-base">
                جدولة وتنظيم المواعيد للقسم المعماري وحجز قاعات الاجتماعات للأقسام الهندسية الأخرى بنظام ذكي لمنع التعارض.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <Tabs defaultValue="architectural" dir="rtl">
                    <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-muted rounded-2xl mb-6">
                        <TabsTrigger value="architectural" className="py-3 rounded-xl font-bold data-[state=active]:shadow-lg">مواعيد القسم المعماري</TabsTrigger>
                        <TabsTrigger value="rooms" className="py-3 rounded-xl font-bold data-[state=active]:shadow-lg">حجوزات قاعات الاجتماعات</TabsTrigger>
                    </TabsList>
                    <TabsContent value="architectural" className="mt-0 animate-in fade-in duration-500">
                        <ArchitecturalAppointmentsView />
                    </TabsContent>
                    <TabsContent value="rooms" className="mt-0 animate-in fade-in duration-500">
                        <RoomBookingCalendar />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}
