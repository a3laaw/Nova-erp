
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
    Activity,
    ArrowUpRight,
    Briefcase,
    Users,
    CircleDollarSign,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic'; // Import dynamic
import { Button } from '@/components/ui/button';
import { projects, clients } from '@/lib/data';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { UpcomingAppointments } from '@/components/dashboard/upcoming-appointments';
import { UpcomingAppointmentsCard } from '@/components/dashboard/upcoming-appointments-card';
import { PendingVisits } from '@/components/dashboard/pending-visits';


// Dynamically import the TaskPrioritization component
const TaskPrioritization = dynamic(
  () => import('@/components/dashboard/task-prioritization').then(mod => mod.TaskPrioritization),
  { 
    ssr: false,
    loading: () => (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-3/4 mt-2" />
            </CardHeader>
            <CardContent className="flex-grow">
                <Skeleton className="h-24 w-full" />
            </CardContent>
            <CardFooter>
                <Skeleton className="h-10 w-full" />
            </CardFooter>
        </Card>
    ),
  }
);


export default function DashboardPage() {

  const totalRevenue = 1250000; // Mock data
  const activeProjects = projects.filter(p => p.status === 'In Progress').length;
  const totalClients = clients.length;

  return (
    <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <div className="grid gap-4 md:grid-cols-2 xl:col-span-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                    Total Revenue
                </CardTitle>
                <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                    +20.1% from last month
                </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                    Active Projects
                </CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{activeProjects}</div>
                <p className="text-xs text-muted-foreground">
                    +2 since last month
                </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">+{totalClients}</div>
                <p className="text-xs text-muted-foreground">
                    +1 since last quarter
                </p>
                </CardContent>
            </Card>
             <UpcomingAppointmentsCard />
        </div>
        
        <div className="grid gap-4">
            <PendingVisits />
        </div>

        <div className="grid gap-4 xl:col-span-2">
           <TaskPrioritization />
        </div>
        
        <div className="grid gap-4">
            <RecentActivity />
        </div>

        <div className="grid gap-4 xl:col-span-3">
            <UpcomingAppointments />
        </div>

    </div>
  );
}
