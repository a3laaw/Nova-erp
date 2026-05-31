'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, Phone, MapPin } from 'lucide-react';

// =============================================================================
// 
// هذه هي النسخة المصححة والآمنة من واجهة عرض المواعيد المعمارية.
// المسار الأصلي: src/components/appointments/architectural-appointments-view.tsx
// 
// =============================================================================

interface RecoveredAppointment {
  id: string;
  clientName: string;
  clientPhone: string;
  date: Date;
  status: 'confirmed' | 'pending' | 'cancelled';
  assignedEngineer: {
    name: string;
    avatarUrl?: string;
  };
  location: string;
}

const recoveredStatusStyles: Record<RecoveredAppointment['status'], string> = {
  confirmed: 'bg-green-100 text-green-800 border-green-300',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

// The appointments prop now defaults to an empty array to prevent crashes.
export function ArchitecturalAppointmentsView({ appointments = [] }: { appointments: RecoveredAppointment[] }) {
  if (appointments.length === 0) {
    return (
        <div className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">لا توجد مواعيد لعرضها حالياً.</p>
        </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
      {appointments.map((appt) => (
        <Card key={appt.id} className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-slate-50 p-4 border-b">
            <CardTitle className="text-sm font-medium">{appt.clientName}</CardTitle>
            <Badge className={recoveredStatusStyles[appt.status]}>{appt.status}</Badge>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4 space-x-reverse text-sm text-muted-foreground mb-4">
                <Clock className="h-4 w-4" />
                <span>{new Date(appt.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' })}</span>
            </div>
            <div className="flex items-center space-x-4 space-x-reverse text-sm text-muted-foreground mb-4">
                <Phone className="h-4 w-4" />
                <span>{appt.clientPhone}</span>
            </div>
             <div className="flex items-center space-x-4 space-x-reverse text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{appt.location}</span>
            </div>
            <div className="border-t my-4"></div>
            <div className="flex items-center space-x-3 space-x-reverse">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={appt.assignedEngineer.avatarUrl} alt={appt.assignedEngineer.name} />
                    <AvatarFallback>{appt.assignedEngineer.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-medium leading-none">المهندس المسؤول</p>
                    <p className="text-sm text-muted-foreground">{appt.assignedEngineer.name}</p>
                </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
