'use client';

import * as React from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { query, orderBy } from 'firebase/firestore';
import type { FieldVisit } from '@/lib/types';
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
import { Eye, MapPin, HardHat, CalendarCheck, Coins, Users } from 'lucide-react';
import Link from 'next/link';
import { cn, formatCurrency } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

/**
 * مكون العرض الأفقي للزيارات (Spreadsheet Mode):
 * عرض عريض جداً يجمع كافة البيانات اللوجستية والميدانية والمالية في سطر واحد.
 */
export function FieldVisitsGrid() {
  const { firestore } = useFirebase();

  const visitsQuery = React.useMemo(() => [orderBy('scheduledDate', 'desc')], []);
  const { data: visits, loading } = useSubscription<FieldVisit>(firestore, 'field_visits', visitsQuery);

  if (loading) return <Skeleton className="h-[400px] w-full rounded-[2rem]" />;

  if (visits.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-[3rem] bg-muted/10">
        <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
        <p className="text-xl font-bold text-muted-foreground">لا توجد زيارات ميدانية مسجلة حالياً.</p>
      </div>
    );
  }

  return (
    <Card className="rounded-3xl border-none shadow-xl overflow-hidden bg-card">
      <ScrollArea className="w-full">
        <div className="min-w-[2200px]">
          <Table className="border-collapse table-fixed w-full">
            <TableHeader className="bg-muted/80 sticky top-0 z-20">
              <TableRow className="h-16 border-b-2">
                <TableHead className="w-12 text-center font-black">#</TableHead>
                <TableHead className="w-64 font-black text-right border-l">المشروع / العميل</TableHead>
                <TableHead className="w-80 font-black text-right border-l">عنوان الموقع</TableHead>
                <TableHead className="w-32 font-black text-center border-l">رقم العقد</TableHead>
                <TableHead className="w-24 font-black text-center border-l">المرحلة</TableHead>
                <TableHead className="w-48 font-black text-right border-l">المرحلة الرئيسية</TableHead>
                <TableHead className="w-48 font-black text-right border-l">المرحلة الفرعية</TableHead>
                <TableHead className="w-56 font-black text-right border-l bg-orange-50/20 text-orange-900">مرحلة التنفيذ الحالية</TableHead>
                <TableHead className="w-64 font-black text-right border-l">تفاصيل العمل المطلوب</TableHead>
                <TableHead className="w-32 font-black text-center border-l text-blue-700">الدفعة المطلوبة</TableHead>
                <TableHead className="w-32 font-black text-center border-l">آخر دفعة</TableHead>
                <TableHead className="w-32 font-black text-center border-l">الفريق 1</TableHead>
                <TableHead className="w-32 font-black text-center border-l">الفريق 2</TableHead>
                <TableHead className="w-32 font-black text-center border-l">الفريق 3</TableHead>
                <TableHead className="w-48 font-black text-right border-l"><HardHat className="h-4 w-4 inline ml-1"/> المقاول</TableHead>
                <TableHead className="w-32 font-black text-center border-l">الحالة</TableHead>
                <TableHead className="w-24 font-black text-center">الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.map((visit, index) => (
                <TableRow key={visit.id} className={cn(
                    "h-20 hover:bg-primary/5 transition-colors border-b last:border-0 group",
                    visit.status === 'confirmed' ? "bg-green-50/10" : ""
                )}>
                  <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground border-l bg-muted/5">{index + 1}</TableCell>
                  
                  <TableCell className="border-l px-4">
                    <p className="font-black text-primary leading-tight">{visit.clientName}</p>
                    <p className="text-[10px] text-muted-foreground font-bold mt-1">{visit.transactionType}</p>
                  </TableCell>

                  <TableCell className="text-xs font-bold text-muted-foreground border-l px-4 leading-relaxed line-clamp-2">
                    {visit.clientAddress || 'غير محدد'}
                  </TableCell>

                  <TableCell className="text-center font-mono font-bold border-l">{visit.contractNumber || '---'}</TableCell>
                  
                  <TableCell className="text-center font-mono font-black text-lg border-l text-muted-foreground/60">
                    {visit.phaseNumber || '01'}
                  </TableCell>

                  <TableCell className="text-right text-sm font-medium border-l">{visit.mainStageName || '-'}</TableCell>
                  <TableCell className="text-right text-sm font-medium border-l">{visit.subStageName || '-'}</TableCell>
                  
                  <TableCell className="text-right border-l bg-orange-50/10">
                    <div className="flex items-center gap-2 justify-end">
                        <span className="font-black text-orange-800">{visit.plannedStageName}</span>
                        <CalendarCheck className="h-3 w-3 text-orange-400" />
                    </div>
                  </TableCell>

                  <TableCell className="text-right text-xs border-l max-w-xs truncate italic px-4">
                    {visit.details || 'لا توجد تفاصيل إضافية'}
                  </TableCell>

                  <TableCell className="text-center border-l">
                    <div className="flex flex-col items-center">
                        <span className="text-sm font-black text-blue-700">{visit.requiredPayment || '-'}</span>
                        <Coins className="h-3 w-3 text-blue-300" />
                    </div>
                  </TableCell>

                  <TableCell className="text-center font-bold text-muted-foreground border-l">{visit.lastPayment || '-'}</TableCell>
                  
                  <TableCell className="text-center border-l text-xs font-bold">{visit.team1 || '-'}</TableCell>
                  <TableCell className="text-center border-l text-xs font-bold">{visit.team2 || '-'}</TableCell>
                  <TableCell className="text-center border-l text-xs font-bold">{visit.team3 || '-'}</TableCell>

                  <TableCell className="text-right border-l font-black text-sm text-foreground/80">
                    {visit.subcontractorName || '-'}
                  </TableCell>

                  <TableCell className="text-center border-l">
                    <Badge variant={visit.status === 'confirmed' ? 'default' : 'outline'} className={cn(
                        "font-black text-[9px] px-3",
                        visit.status === 'confirmed' ? "bg-green-600" : "text-blue-600 border-blue-200"
                    )}>
                        {visit.status === 'confirmed' ? 'تم الإنجاز' : 'مخطط'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary hover:text-white transition-all shadow-sm" asChild>
                        <Link href={`/dashboard/construction/field-visits/${visit.id}`}>
                            <Eye className="h-4 w-4" />
                        </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Card>
  );
}
