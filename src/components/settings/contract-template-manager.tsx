'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export function ContractTemplateManager() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>نماذج العقود</CardTitle>
                <CardDescription>
                إدارة نماذج العقود المستخدمة في النظام كنقاط انطلاق لإنشاء عقود العملاء.
                </CardDescription>
            </div>
            <Button size="sm" className="gap-1">
                <PlusCircle className="ml-2 h-4 w-4" />
                إضافة نموذج جديد
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-semibold">لا توجد نماذج عقود بعد</h3>
            <p className="text-muted-foreground mt-2">
                انقر على "إضافة نموذج جديد" للبدء في إنشاء أول نموذج عقد لك.
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
