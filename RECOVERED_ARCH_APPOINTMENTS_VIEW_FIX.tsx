'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, Phone, MapPin, ShieldAlert } from 'lucide-react';

interface RecoveredAppointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  date: Date;
  status: 'confirmed' | 'pending' | 'cancelled';
  assignedEngineer: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  location: string;
  type: 'architectural' | 'room_booking' | string;
}

const recoveredStatusStyles: Record<RecoveredAppointment['status'], string> = {
  confirmed: 'bg-green-100 text-green-800 border-green-300',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

export function checkBookingConflict(
  newAppointment: Omit<RecoveredAppointment, 'id'>, 
  existingAppointments: RecoveredAppointment[],
  clientStatus: 'Lead' | 'Current',
  assignedEngineerIdForClient?: string
) {
  if (clientStatus !== 'Lead' && assignedEngineerIdForClient) {
    if (newAppointment.assignedEngineer.id !== assignedEngineerIdForClient) {
      return { isAllowed: false, reason: "خطأ في الاختصاص: هذا العميل حالي ويجب حجز الموعد مع المهندس المختص به فقط." };
    }
  }

  const newApptTime = new Date(newAppointment.date).getTime();

  for (const appt of existingAppointments) {
    const existingApptTime = new Date(appt.date).getTime();
    if (existingApptTime === newApptTime && appt.status !== 'cancelled') {
      if (appt.type !== newAppointment.type) {
        return { isAllowed: false, reason: `تضارب أقسام: العميل لديه حجز آخر في نفس الوقت في قسم مختلف (${appt.type === 'architectural' ? 'المعماري' : 'جدول القاعات'}).` };
      }
      return { isAllowed: false, reason: "حجز مزدوج: العميل لديه موعد محجوز بالفعل في هذا الوقت تماماً." };
    }
  }
  return { isAllowed: true };
}

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
        <Card key={appt.id} className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-2xl border border-slate-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-slate-50 p-4 border-b">
            <CardTitle className="text-sm font-medium text-slate-800">{appt.clientName}</CardTitle>
            <Badge className={recoveredStatusStyles[appt.status]}>{appt.status}</Badge>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4 space-x-reverse text-sm text-muted-foreground mb-4">
                <Clock className="h-4 w-4 text-[#FF8A65]" />
                <span>{new Date(appt.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' })}</span>
            </div>
            <div className="flex items-center space-x-4 space-x-reverse text-sm text-muted-foreground mb-4">
                <Phone className="h-4 w-4 text-[#FFC107]" />
                <span>{appt.clientPhone}</span>
            </div>
             <div className="flex items-center space-x-4 space-x-reverse text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>{appt.location}</span>
            </div>
            <div className="border-t my-4"></div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 space-x-reverse">
                  <Avatar className="h-9 w-9 border border-slate-200">
                      <AvatarImage src={appt.assignedEngineer.avatarUrl} alt={appt.assignedEngineer.name} />
                      <AvatarFallback className="bg-slate-200">{appt.assignedEngineer.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                      <p className="text-xs font-semibold text-slate-500 leading-none">المهندس المسؤول</p>
                      <p className="text-sm font-medium text-slate-700 mt-1">{appt.assignedEngineer.name}</p>
                  </div>
              </div>
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-slate-100 border-slate-200 text-slate-600">
                {appt.type === 'architectural' ? 'معماري' : 'قاعة'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
