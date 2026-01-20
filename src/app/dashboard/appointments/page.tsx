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
import { ArchitecturalAppointmentsView } from '@/components/appointments/architectural-appointments-view';
import { RoomBookingCalendar } from '@/components/appointments/room-booking-calendar';

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
