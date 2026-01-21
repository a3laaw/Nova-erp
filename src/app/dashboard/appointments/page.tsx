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

const ArchitecturalAppointmentsView = dynamic(
    () => import('@/components/appointments/architectural-appointments-view').then(mod => mod.ArchitecturalAppointmentsView),
    { 
        loading: () => <Skeleton className="h-[400px] w-full" />,
        ssr: false 
    }
);

const RoomBookingCalendar = dynamic(
    () => import('@/components/appointments/room-booking-calendar').then(mod => mod.RoomBookingCalendar),
    { 
        loading: () => <Skeleton className="h-[400px] w-full" />,
        ssr: false 
    }
);


export default function AppointmentsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة المواعيد</CardTitle>
                <CardDescription>
                جدولة وتنظيم المواعيد للقسم المعماري وحجز قاعات الاجتماعات للأقسام الهندسية الأخرى.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="architectural" dir="rtl">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="architectural">مواعيد القسم المعماري</TabsTrigger>
                        <TabsTrigger value="rooms">حجوزات قاعات الاجتماعات</TabsTrigger>
                    </TabsList>
                    <TabsContent value="architectural" className="mt-4">
                        <ArchitecturalAppointmentsView />
                    </TabsContent>
                    <TabsContent value="rooms" className="mt-4">
                        <RoomBookingCalendar />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}
