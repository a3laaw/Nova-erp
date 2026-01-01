import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { users, projects } from '@/lib/data';

const activities = [
  {
    userName: 'Fatima Al-Mansoori',
    userAvatar: users.find(u => u.id === 'user-2')?.avatarUrl,
    action: 'updated the timeline for',
    projectName: 'Downtown Dubai Villa',
    time: '5m ago',
  },
  {
    userName: 'Ali Ahmed',
    userAvatar: users.find(u => u.id === 'user-1')?.avatarUrl,
    action: 'added a new client',
    projectName: 'Aldar Properties',
    time: '30m ago',
  },
  {
    userName: 'Hassan Ibrahim',
    userAvatar: users.find(u => u.id === 'user-5')?.avatarUrl,
    action: 'submitted a daily report for',
    projectName: 'Yas Island Residential Tower',
    time: '1h ago',
  },
  {
    userName: 'Yusuf Khan',
    userAvatar: users.find(u => u.id === 'user-3')?.avatarUrl,
    action: 'marked an invoice as paid for',
    projectName: 'Downtown Dubai Villa',
    time: '2h ago',
  },
];

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          An overview of the latest actions in your team.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {activities.map((activity, index) => (
          <div className="flex items-center gap-4" key={index}>
            <Avatar className="hidden h-9 w-9 sm:flex">
              <AvatarImage src={activity.userAvatar} alt="Avatar" />
              <AvatarFallback>{activity.userName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="grid gap-1">
              <p className="text-sm font-medium leading-none">
                {activity.userName}{' '}
                <span className="text-muted-foreground">{activity.action}</span>{' '}
                {activity.projectName}
              </p>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {activity.time}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
