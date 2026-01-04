
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
import { useAuth } from '@/context/auth-context';


export default function SettingsPage() {
  const { user } = useAuth();
  const currentUserRole = user?.role;

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>الإعدادات</CardTitle>
        <CardDescription>
          إدارة حسابك، الفريق، وإعدادات التطبيق.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="users" dir='rtl'>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">الملف الشخصي</TabsTrigger>
            <TabsTrigger value="users">المستخدمين</TabsTrigger>
            <TabsTrigger value="billing">الفواتير</TabsTrigger>
            <TabsTrigger value="notifications">الإشعارات</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-4">
            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <h3 className="mt-4 text-lg font-medium">إعدادات الملف الشخصي</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    سيتم عرض نموذج إدارة الملف الشخصي للمستخدم هنا.
                </p>
            </div>
          </TabsContent>
          <TabsContent value="users" className="mt-4">
            {currentUserRole === 'Admin' ? (
                <UsersTable />
            ) : (
                <div className="p-8 text-center border-2 border-dashed rounded-lg">
                    <h3 className="mt-4 text-lg font-medium">الوصول مرفوض</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        فقط المدير (Admin) يمكنه عرض وإدارة المستخدمين.
                    </p>
                </div>
            )}
          </TabsContent>
           <TabsContent value="billing" className="mt-4">
            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <h3 className="mt-4 text-lg font-medium">معلومات الفواتير</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    إدارة اشتراكك وطرق الدفع.
                </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

    