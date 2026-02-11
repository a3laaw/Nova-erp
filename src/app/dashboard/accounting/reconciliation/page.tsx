'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StandardReconciliationView } from '@/components/accounting/reconciliation/standard-reconciliation';
import { IntermediaryReconciliationView } from '@/components/accounting/reconciliation/intermediary-reconciliation';

export default function ReconciliationPage() {
    return (
        <Tabs defaultValue="standard" dir="rtl">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="standard">التسوية البنكية القياسية</TabsTrigger>
                <TabsTrigger value="intermediary">تسوية شركات الوساطة</TabsTrigger>
            </TabsList>
            <TabsContent value="standard" className="mt-4">
                <StandardReconciliationView />
            </TabsContent>
            <TabsContent value="intermediary" className="mt-4">
                <IntermediaryReconciliationView />
            </TabsContent>
        </Tabs>
    );
}
