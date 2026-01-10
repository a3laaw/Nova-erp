
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UsersTable } from '@/components/settings/users-table';

export default function SettingsPage() {
  // Since authentication is removed, we assume an Admin is viewing this page.
  // The UsersTable component can be displayed directly.
  return (
    <Card dir="rtl">
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
  );
}
