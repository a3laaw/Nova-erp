
'use client';

import { useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { query, orderBy, where } from 'firebase/firestore';
import type { FieldVisit } from '@/lib/types';
import { format, isToday, isFuture, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Calendar, User, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
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

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>;

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
        const isUpcoming = date && isFuture(date);
        const isVisitToday = date && isToday(date);

        return (
          <Card key={visit.id} className={cn(
            "overflow-hidden border-2 transition-all hover:shadow-lg rounded-3xl",
            visit.status === 'confirmed' ? "border-green-100 bg-green-50/10" : 
            isVisitToday ? "border-primary/20 bg-primary/5 shadow-md" : "border-muted"
          )}>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-background rounded-xl border shadow-sm">
                  <MapPin className={cn("h-5 w-5", visit.status === 'confirmed' ? "text-green-600" : "text-primary")} />
                </div>
                <Badge variant={visit.status === 'confirmed' ? 'default' : 'outline'} className={cn(
                    "rounded-full font-black text-[10px] uppercase px-3",
                    visit.status === 'confirmed' && "bg-green-600",
                    isVisitToday && visit.status === 'planned' && "bg-primary text-white"
                )}>
                  {visit.status === 'confirmed' ? 'تمت الزيارة' : isVisitToday ? 'اليوم' : 'مخطط لها'}
                </Badge>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black leading-tight">{visit.clientName}</h3>
                <p className="text-xs text-muted-foreground font-bold">{visit.transactionType}</p>
              </div>

              <div className="pt-2 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatDate(visit.scheduledDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">المهندس: {visit.engineerName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded-lg border border-dashed">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-primary">المهمة: {visit.plannedStageName}</span>
                </div>
              </div>

              <Button asChild className="w-full h-11 rounded-xl font-bold mt-2" variant={visit.status === 'confirmed' ? 'secondary' : 'default'}>
                <Link href={`/dashboard/construction/field-visits/${visit.id}`}>
                  {visit.status === 'confirmed' ? 'عرض تفاصيل الإنجاز' : 'فتح وتأكيد الزيارة'}
                  <ArrowRight className="mr-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
