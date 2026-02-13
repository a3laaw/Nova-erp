'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UsersTable } from '@/components/settings/users-table';

export default function UsersSettingsPage() {
  return (
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
  );
}
