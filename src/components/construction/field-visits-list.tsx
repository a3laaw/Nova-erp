'use client';

import { useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { query, orderBy } from 'firebase/firestore';
import type { FieldVisit } from '@/lib/types';
import { format, isToday } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Calendar, User, ArrowRight, HardHat, Users, Clock } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function FieldVisitsList() {
  const { firestore } = useFirebase();

  const visitsQuery = useMemo(() => [orderBy('scheduledDate', 'desc')], []);
  const { data: visits, loading } = useSubscription<FieldVisit>(firestore, 'field_visits', visitsQuery);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'eeee, dd MMMM', { locale: ar }) : '-';
  };

  if (loading) return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
    </div>
  );

  if (visits.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-[3rem] bg-muted/10">
        <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
        <p className="text-xl font-bold text-muted-foreground">لا توجد زيارات ميدانية مجدولة.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {visits.map((visit) => {
        const date = toFirestoreDate(visit.scheduledDate);
        const isVisitToday = date && isToday(date);

        return (
          <Card key={visit.id} className={cn(
            "overflow-hidden border-2 transition-all hover:shadow-xl rounded-[2rem] group",
            visit.status === 'confirmed' ? "border-green-100 bg-green-50/10" : 
            isVisitToday ? "border-primary/20 bg-primary/5 shadow-md" : "border-muted"
          )}>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <Badge variant={visit.status === 'confirmed' ? 'default' : 'outline'} className={cn(
                        "rounded-full font-black text-[9px] uppercase px-3 w-fit mb-2",
                        visit.status === 'confirmed' && "bg-green-600",
                        isVisitToday && visit.status === 'planned' && "bg-primary text-white"
                    )}>
                    {visit.status === 'confirmed' ? 'تمت الزيارة' : isVisitToday ? 'زيارة اليوم' : 'مخطط لها'}
                    </Badge>
                    <h3 className="text-xl font-black leading-tight text-foreground group-hover:text-primary transition-colors">{visit.clientName}</h3>
                    <p className="text-xs text-muted-foreground font-bold mt-1">{visit.projectName}</p>
                </div>
                <div className="p-3 bg-background rounded-2xl border shadow-sm shrink-0">
                  <MapPin className={cn("h-6 w-6", visit.status === 'confirmed' ? "text-green-600" : "text-primary")} />
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-bold">{formatDate(visit.scheduledDate)}</span>
                </div>
                
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-xs">المسؤول: {visit.engineerName}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2 bg-muted/50 rounded-xl border flex items-center gap-2">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold truncate">الفرق: {visit.teamNames?.length || 0}</span>
                    </div>
                    <div className="p-2 bg-muted/50 rounded-xl border flex items-center gap-2">
                        <HardHat className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold truncate">{visit.subcontractorName || 'فريق داخلي'}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-background rounded-xl border-2 border-dashed border-primary/10">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-xs font-black text-primary truncate max-w-[180px]">{visit.plannedStageName}</span>
                  </div>
                </div>
              </div>

              <Button asChild className="w-full h-12 rounded-2xl font-black text-base mt-2 shadow-lg group-hover:shadow-primary/20 transition-all" variant={visit.status === 'confirmed' ? 'secondary' : 'default'}>
                <Link href={`/dashboard/construction/field-visits/${visit.id}`}>
                  {visit.status === 'confirmed' ? 'عرض تفاصيل الإنجاز' : 'تأكيد إنجاز الموقع'}
                  <ArrowRight className="mr-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
