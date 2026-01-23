
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
        <TabsTrigger value="contracts">العقود</TabsTrigger>
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
      <TabsContent value="contracts">
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                <div>
                    <CardTitle>{t.title}</CardTitle>
                    <CardDescription>{t.description}</CardDescription>
                </div>
                <Button asChild>
                    <Link href="/dashboard/contracts/new">
                    <PlusCircle className="ml-2 h-4 w-4" />
                    {t.newContract}
                    </Link>
                </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="p-8 text-center border-2 border-dashed rounded-lg">
                    <h3 className="mt-4 text-lg font-medium">{t.noContracts}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        ستظهر قائمة العقود المحفوظة هنا.
                    </p>
                </div>
            </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
