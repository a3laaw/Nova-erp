
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UsersTable } from '@/components/settings/users-table';
import { useAuth } from '@/context/auth-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lock } from 'lucide-react';


export default function SettingsPage() {
  const { user } = useAuth();
  const currentUserRole = user?.role;

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>إدارة المستخدمين</CardTitle>
        <CardDescription>
          إدارة حسابات دخول الموظفين وصلاحياتهم في النظام.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currentUserRole === 'Admin' ? (
            <UsersTable />
        ) : (
            <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertTitle>الوصول مرفوض</AlertTitle>
                <AlertDescription>
                    هذه الصفحة متاحة للمدراء (Admin) فقط. لا تملك الصلاحية اللازمة لعرض أو إدارة المستخدمين.
                </AlertDescription>
            </Alert>
        )}
      </CardContent>
    </Card>
  );
}

