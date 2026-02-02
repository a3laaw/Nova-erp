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
import { RegisteredClientsList } from '@/components/clients/registered-clients-list';
import { ProspectiveClientsList } from '@/components/clients/prospective-clients-list';


export default function ClientsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة العملاء</CardTitle>
                <CardDescription>عرض وتحديث ملفات العملاء المسجلين وتتبع العملاء المحتملين.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="registered" dir="rtl">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="registered">العملاء المسجلون</TabsTrigger>
                        <TabsTrigger value="prospective">العملاء المحتملون</TabsTrigger>
                    </TabsList>
                    <TabsContent value="registered" className="mt-4">
                        <RegisteredClientsList />
                    </TabsContent>
                    <TabsContent value="prospective" className="mt-4">
                        <ProspectiveClientsList />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
