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
import { BrandingManager } from '@/components/settings/branding-manager';
import { DataIntegrityManager } from '@/components/settings/data-integrity-manager';

export default function SettingsPage() {
  return (
    <Tabs defaultValue="users" dir="rtl">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="users">إدارة المستخدمين</TabsTrigger>
        <TabsTrigger value="branding">العلامة التجارية</TabsTrigger>
        <TabsTrigger value="reference-data">البيانات المرجعية</TabsTrigger>
        <TabsTrigger value="data-integrity">سلامة البيانات</TabsTrigger>
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
      <TabsContent value="branding">
        <BrandingManager />
      </TabsContent>
      <TabsContent value="reference-data">
        <ReferenceDataManager />
      </TabsContent>
      <TabsContent value="data-integrity">
        <DataIntegrityManager />
      </TabsContent>
    </Tabs>
  );
}
