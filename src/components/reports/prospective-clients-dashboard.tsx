
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NoShowClientsReport } from './no-show-clients-report';
import { FollowUpClientsReport } from './follow-up-clients-report';
import type { Appointment, Client, Employee, ClientTransaction } from '@/lib/types';

interface Props {
    appointments: Appointment[];
    employees: Employee[];
    clients: Client[];
    transactions: (ClientTransaction & { clientId: string })[];
    loading: boolean;
}

export function ProspectiveClientsDashboard({ appointments, employees, clients, transactions, loading }: Props) {
    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader>
                <CardTitle>متابعة العملاء المحتملين</CardTitle>
                <CardDescription>تحليل العملاء الذين لم يتعاقدوا بعد، سواء لم يحضروا أو توقفوا بعد الاستفسارات.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="follow-up" dir="rtl">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="follow-up">بحاجة لمتابعة</TabsTrigger>
                        <TabsTrigger value="no-shows">لم يحضروا</TabsTrigger>
                    </TabsList>
                    <TabsContent value="follow-up" className="mt-4">
                        <FollowUpClientsReport clients={clients} transactions={transactions} loading={loading} />
                    </TabsContent>
                    <TabsContent value="no-shows" className="mt-4">
                        <NoShowClientsReport appointments={appointments} employees={employees} loading={loading} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

  