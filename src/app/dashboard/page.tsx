
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
    Briefcase,
    Users,
    CircleDollarSign,
} from 'lucide-react';
import { projects, clients } from '@/lib/data';
import { formatCurrency } from '@/lib/utils';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { UpcomingAppointments } from '@/components/dashboard/upcoming-appointments';
import { UpcomingAppointmentsCard } from '@/components/dashboard/upcoming-appointments-card';
import { PendingVisits } from '@/components/dashboard/pending-visits';
import { DataAnomalyAlert } from '@/components/dashboard/data-anomaly-alert';


export default function DashboardPage() {

  const totalRevenue = 1250000; // Mock data
  const activeProjects = projects.filter(p => p.status === 'In Progress').length;
  const totalClients = clients.length;

  return (
    <div className="space-y-6">
        {/* نظام تنبيهات الخلل وسلامة البيانات */}
        <DataAnomalyAlert />

        <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
            <div className="grid gap-4 md:grid-cols-2 xl:col-span-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                        إجمالي الإيرادات
                    </CardTitle>
                    <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                    <p className="text-xs text-muted-foreground">
                        +20.1% من الشهر الماضي
                    </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                        المشاريع النشطة
                    </CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">{activeProjects}</div>
                    <p className="text-xs text-muted-foreground">
                        +2 منذ الشهر الماضي
                    </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">إجمالي العملاء</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">+{totalClients}</div>
                    <p className="text-xs text-muted-foreground">
                        +1 منذ الربع الأخير
                    </p>
                    </CardContent>
                </Card>
                <UpcomingAppointmentsCard />
            </div>
            
            <div className="grid gap-4">
                <PendingVisits />
            </div>

            <div className="grid gap-4 xl:col-span-2">
                <RecentActivity />
            </div>
            
            <div className="grid gap-4 xl:col-span-3">
                <UpcomingAppointments />
            </div>
        </div>
    </div>
  );
}
