
'use client';

import { useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { query, orderBy } from 'firebase/firestore';
import type { DailySiteReport } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Calendar, Cloud, AlertTriangle, ImageIcon } from 'lucide-react';
import Image from 'next/image';

export function DailyReportsList({ projectId }: { projectId: string }) {
  const { firestore } = useFirebase();

  const reportQuery = useMemo(() => [orderBy('date', 'desc')], []);
  const { data: reports, loading } = useSubscription<DailySiteReport>(
    firestore, 
    `projects/${projectId}/daily_reports`, 
    reportQuery
  );

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>;

  if (reports.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-[3rem] bg-muted/10">
        <p className="text-muted-foreground font-medium italic">لا توجد تقارير ميدانية لهذا المشروع بعد.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reports.map((report) => {
        const reportDate = toFirestoreDate(report.date);
        return (
          <Card key={report.id} className="overflow-hidden border-none shadow-md rounded-3xl">
            <div className="flex flex-col md:flex-row">
              {/* Left Side: Images */}
              {report.photoUrls && report.photoUrls.length > 0 ? (
                <div className="md:w-64 h-48 md:h-auto relative bg-muted flex-shrink-0">
                  <Image src={report.photoUrls[0]} alt="Site" fill className="object-cover" />
                  {report.photoUrls.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      +{report.photoUrls.length - 1} صور إضافية
                    </div>
                  )}
                </div>
              ) : (
                <div className="md:w-64 h-48 md:h-auto bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                  <ImageIcon className="h-10 w-10 opacity-20" />
                </div>
              )}

              {/* Right Side: Content */}
              <div className="flex-1 p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      تقرير يوم {reportDate ? format(reportDate, 'eeee, dd MMMM yyyy', { locale: ar }) : '-'}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1">
                      <Users className="h-3 w-3" /> بواسطة: {report.engineerName}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="secondary" className="font-bold flex items-center gap-1 bg-sky-50 text-sky-700">
                      <Cloud className="h-3 w-3" /> {report.weatherStatus}
                    </Badge>
                    <Badge variant="outline" className="font-black text-xs border-primary/20">
                      العمالة: {report.workersCount}
                    </Badge>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-2xl text-sm leading-relaxed border border-muted-foreground/5">
                  <p className="font-bold text-primary mb-1">العمل المنجز:</p>
                  <p>{report.workCompleted}</p>
                </div>

                {report.encounteredIssues && (
                  <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex gap-3 text-xs">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <div>
                      <p className="font-black text-red-800">مشاكل وعقبات:</p>
                      <p className="text-red-700 mt-0.5">{report.encounteredIssues}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
