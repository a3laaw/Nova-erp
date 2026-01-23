
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
import { UsersTable } from '@/components/settings/users-table';
import { ReferenceDataManager } from '@/components/settings/reference-data-manager';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { ContractTemplateManager } from '@/components/settings/contract-template-manager';

export default function SettingsPage() {
    const { language } = useLanguage();
    const t = language === 'ar' ? {
        title: 'إدارة العقود',
        description: 'عرض وإنشاء وتعديل العقود الإلكترونية.',
        newContract: 'إنشاء عقد جديد',
        noContracts: 'لا توجد عقود محفوظة بعد.',
    } : {
        title: 'Contract Management',
        description: 'View, create, and edit electronic contracts.',
        newContract: 'New Contract',
        noContracts: 'No saved contracts yet.',
    };

  return (
    <Tabs defaultValue="users" dir="rtl">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="users">إدارة المستخدمين</TabsTrigger>
        <TabsTrigger value="reference-data">البيانات المرجعية</TabsTrigger>
        <TabsTrigger value="contract-templates">نماذج العقود</TabsTrigger>
      </TabsList>
      <TabsContent value="users">
        <Card>
          <CardHeader>
            <CardTitle>إدارة المستخدمين</CardTitle>
            <CardDescription>
              إدارة حسابات دخول الموظفين وصلاحياتهم في النظام.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsersTable />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="reference-data">
        <ReferenceDataManager />
      </TabsContent>
      <TabsContent value="contract-templates">
        <ContractTemplateManager />
      </TabsContent>
    </Tabs>
  );
}
