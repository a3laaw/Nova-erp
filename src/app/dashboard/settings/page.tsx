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
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Manage your account, team, and application settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="profile" dir='rtl'>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            {currentUserRole === 'Admin' && <TabsTrigger value="users">المستخدمين</TabsTrigger>}
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-4">
            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <h3 className="mt-4 text-lg font-medium">Profile Settings</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    User profile management form will be here.
                </p>
            </div>
          </TabsContent>
           {currentUserRole === 'Admin' && <TabsContent value="users" className="mt-4">
            <UsersTable />
          </TabsContent>}
           <TabsContent value="billing" className="mt-4">
            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <h3 className="mt-4 text-lg font-medium">Billing Information</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    Manage your subscription and payment methods.
                </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
