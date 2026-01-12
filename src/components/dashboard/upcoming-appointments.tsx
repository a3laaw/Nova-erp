
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { appointments, clients, projects, users } from '@/lib/data';
import { format } from 'date-fns';
import { useLanguage } from '@/context/language-context';

export function UpcomingAppointments() {
  const { language } = useLanguage();
  const upcoming = appointments
    .filter((a) => new Date(a.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);
    
  const t = (language === 'ar') ? 
    { title: 'المواعيد القادمة', description: 'زياراتك الميدانية واجتماعاتك المجدولة التالية.', viewAll: 'عرض الكل', clientProject: 'العميل والمشروع', engineer: 'المهندس', dateTime: 'التاريخ والوقت', purpose: 'الغرض' } : 
    { title: 'Upcoming Appointments', description: 'Your next scheduled site visits and meetings.', viewAll: 'View All', clientProject: 'Client & Project', engineer: 'Engineer', dateTime: 'Date & Time', purpose: 'Purpose' };


  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader className="flex flex-row items-center">
        <div className="grid gap-2">
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>
            {t.description}
          </CardDescription>
        </div>
        <Button asChild size="sm" className="ml-auto gap-1">
          <Link href="/dashboard/appointments">
            {t.viewAll}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.clientProject}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.engineer}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.dateTime}</TableHead>
              <TableHead className="text-right">{t.purpose}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {upcoming.map((appt) => {
              const client = clients.find((c) => c.id === appt.clientId);
              const project = projects.find((p) => p.id === appt.projectId);
              const engineer = users.find((u) => u.id === appt.engineerId);
              return (
                <TableRow key={appt.id}>
                  <TableCell>
                    <div className="font-medium">{client?.name[language]}</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                      {project?.name[language]}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {engineer?.fullName}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                     {format(new Date(appt.date), "EEE, dd MMM yyyy 'at' h:mm a")}
                  </TableCell>
                  <TableCell className="text-right">{appt.title[language]}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
