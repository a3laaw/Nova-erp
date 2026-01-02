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

export default function SettingsPage() {
  // In a real app, you'd get the current user's role from your auth context
  const currentUserRole = 'admin'; // Mocking for now

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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            {currentUserRole === 'admin' && <TabsTrigger value="team">Team Members</TabsTrigger>}
            {currentUserRole === 'admin' && <TabsTrigger value="users">المستخدمين</TabsTrigger>}
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
          {currentUserRole === 'admin' && <TabsContent value="team" className="mt-4">
            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <h3 className="mt-4 text-lg font-medium">Team Management</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    Invite, edit, and remove team members based on roles.
                </p>
            </div>
          </TabsContent>}
           {currentUserRole === 'admin' && <TabsContent value="users" className="mt-4">
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
