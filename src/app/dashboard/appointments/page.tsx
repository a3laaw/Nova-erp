'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, PlusCircle } from 'lucide-react';
import { UpcomingAppointments } from '@/components/dashboard/upcoming-appointments';
import { useLanguage } from '@/context/language-context';
import Link from 'next/link';

export default function AppointmentsPage() {
    const { language } = useLanguage();
    const t = (language === 'ar') ? 
        { title: 'المواعيد', description: 'جدولة وإدارة جميع اجتماعات العملاء والزيارات الميدانية.', new: 'موعد جديد', calendar: 'عرض التقويم قريباً', calendarDesc: 'سيتم تنفيذ عرض تقويم كامل للجدولة هنا.' } : 
        { title: 'Appointments', description: 'Schedule and manage all client meetings and site visits.', new: 'New Appointment', calendar: 'Calendar View Coming Soon', calendarDesc: 'A full calendar view for scheduling will be implemented here.' };
        
    return (
        <div className="space-y-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>{t.title}</CardTitle>
                            <CardDescription>{t.description}</CardDescription>
                        </div>
                        <Button asChild size="sm" className="gap-1">
                            <Link href="#">
                                <PlusCircle className="h-4 w-4" />
                                {t.new}
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="p-8 text-center border-2 border-dashed rounded-lg">
                        <CalendarIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-medium">{t.calendar}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {t.calendarDesc}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <UpcomingAppointments />
        </div>
    )
}
