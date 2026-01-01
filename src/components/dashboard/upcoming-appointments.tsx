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

export function UpcomingAppointments() {
  const upcoming = appointments
    .filter((a) => new Date(a.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <div className="grid gap-2">
          <CardTitle>Upcoming Appointments</CardTitle>
          <CardDescription>
            Your next scheduled site visits and meetings.
          </CardDescription>
        </div>
        <Button asChild size="sm" className="ml-auto gap-1">
          <Link href="/dashboard/appointments">
            View All
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client & Project</TableHead>
              <TableHead className="hidden sm:table-cell">Engineer</TableHead>
              <TableHead className="hidden sm:table-cell">Date & Time</TableHead>
              <TableHead className="text-right">Purpose</TableHead>
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
                    <div className="font-medium">{client?.name}</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                      {project?.name}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {engineer?.fullName}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                     {format(new Date(appt.date), "EEE, dd MMM yyyy 'at' h:mm a")}
                  </TableCell>
                  <TableCell className="text-right">{appt.title}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
