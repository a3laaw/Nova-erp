import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, PlusCircle } from 'lucide-react';
import { UpcomingAppointments } from '@/components/dashboard/upcoming-appointments';

export default function AppointmentsPage() {
    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Appointments</CardTitle>
                            <CardDescription>
                                Schedule and manage all client meetings and site visits.
                            </CardDescription>
                        </div>
                        <Button asChild size="sm" className="gap-1">
                            
                                <><PlusCircle className="h-4 w-4" />
                                New Appointment</>
                            
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="p-8 text-center border-2 border-dashed rounded-lg">
                        <CalendarIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-medium">Calendar View Coming Soon</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            A full calendar view for scheduling will be implemented here.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <UpcomingAppointments />
        </div>
    )
}
