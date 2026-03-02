'use client';

import * as React from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { query, orderBy } from 'firebase/firestore';
import type { FieldVisit } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, MapPin, Users, History, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export function FieldVisitsGrid() {
  const { firestore } = useFirebase();

  const visitsQuery = React.useMemo(() => [orderBy('scheduledDate', 'desc')], []);
  const { data: visits, loading } = useSubscription<FieldVisit>(firestore, 'field_visits', visitsQuery);

  if (loading) return <Skeleton className="h-[400px] w-full rounded-2xl" />;

  if (visits.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-[3rem] bg-muted/10">
        <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
        <p className="text-xl font-bold text-muted-foreground">لا توجد زيارات ميدانية مسجلة حالياً.</p>
      </div>
    );
  }

  return (
    <Card className="rounded-2xl border-none shadow-xl overflow-hidden bg-card">
      <ScrollArea className="w-full">
        <div className="min-w-[1800px]">
          <Table className="border-collapse">
            <TableHeader className="bg-muted/80 sticky top-0 z-20">
              <TableRow className="h-14 border-b-2">
                <TableHead className="w-12 text-center font-black">#</TableHead>
                <TableHead className="w-64 font-black text-right border-l">اسم المشروع</TableHead>
                <TableHead className="w-80 font-black text-right border-l">العنوان</TableHead>
                <TableHead className="w-32 font-black text-center border-l">رقم العقد</TableHead>
                <TableHead className="w-24 font-black text-center border-l">رقم المرحلة</TableHead>
                <TableHead className="w-48 font-black text-right border-l">مرحلة العمل الرئيسية</TableHead>
                <TableHead className="w-48 font-black text-right border-l">مرحلة العمل الفرعية</TableHead>
                <TableHead className="w-48 font-black text-right border-l">مرحلة العمل (التفصيلية)</TableHead>
                <TableHead className="w-64 font-black text-right border-l">تفاصيل العمل</TableHead>
                <TableHead className="w-32 font-black text-center border-l">الدفعة المطلوبة</TableHead>
                <TableHead className="w-32 font-black text-center border-l">آخر دفعة</TableHead>
                <TableHead className="w-24 font-black text-center border-l">مطلوب</TableHead>
                <TableHead className="w-32 font-black text-center border-l">فريق العمل 1</TableHead>
                <TableHead className="w-32 font-black text-center border-l">فريق العمل 2</TableHead>
                <TableHead className="w-32 font-black text-center border-l">فريق العمل 3</TableHead>
                <TableHead className="w-40 font-black text-right border-l">مقاول</TableHead>
                <TableHead className="w-24 font-black text-center">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.map((visit, index) => {
                const scheduledDate = toFirestoreDate(visit.scheduledDate);
                return (
                  <TableRow key={visit.id} className="h-16 hover:bg-primary/5 transition-colors border-b last:border-0 group">
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-black text-primary border-l">{visit.clientName}</TableCell>
                    <TableCell className="text-xs font-bold text-muted-foreground border-l leading-relaxed">
                        {visit.clientAddress || '-'}
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold border-l">{visit.contractNumber || '111'}</TableCell>
                    <TableCell className="text-center font-mono font-bold border-l">{visit.phaseNumber || '11'}</TableCell>
                    <TableCell className="text-right font-medium border-l">{visit.mainStageName || visit.plannedStageName}</TableCell>
                    <TableCell className="text-right font-medium border-l">{visit.subStageName || visit.plannedStageName}</TableCell>
                    <TableCell className="text-right font-black text-orange-700 border-l bg-orange-50/10">{visit.plannedStageName}</TableCell>
                    <TableCell className="text-right text-xs border-l max-w-xs truncate italic">{visit.details || '-'}</TableCell>
                    <TableCell className="text-center font-bold text-blue-700 border-l">{visit.requiredPayment || 'الخامسة'}</TableCell>
                    <TableCell className="text-center font-bold text-muted-foreground border-l">{visit.lastPayment || 'الرابعة'}</TableCell>
                    <TableCell className="text-center border-l">
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-black">مطلوب</Badge>
                    </TableCell>
                    <TableCell className="text-center border-l text-xs">{visit.team1 || '-'}</TableCell>
                    <TableCell className="text-center border-l text-xs">{visit.team2 || '-'}</TableCell>
                    <TableCell className="text-center border-l text-xs">{visit.team3 || '-'}</TableCell>
                    <TableCell className="text-right border-l font-bold text-sm">{visit.subcontractorName || '-'}</TableCell>
                    <TableCell className="text-center">
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary hover:text-white transition-all shadow-sm" asChild>
                            <Link href={`/dashboard/construction/field-visits/${visit.id}`}>
                                <Eye className="h-4 w-4" />
                            </Link>
                        </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Card>
  );
}
