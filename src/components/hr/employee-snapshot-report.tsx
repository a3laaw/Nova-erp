'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import type { Employee, LeaveRequest, Holiday, AuditLog } from '@/lib/types';
import { collection, doc, getDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { format, differenceInYears, eachDayOfInterval, isFriday, intervalToDuration } from 'date-fns';
import { Logo } from '../layout/logo';
import { formatCurrency } from '@/lib/utils';
import { AlertCircle, Banknote, Briefcase, Calendar, Contact, FileText, Gift, Home, User, Wallet } from 'lucide-react';
import { Button } from '../ui/button';
import { generateReport } from '@/services/report-generator'; // Import the new generator

interface ReportProps {
  employeeId: string;
  reportDate: Date;
}

const formatDate = (date: Date | string | null, fallback = '-') => {
  if (!date) return fallback;
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('ar-KW', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      numberingSystem: 'latn',
    }).format(d);
  } catch (e) {
    return String(date);
  }
};


export function EmployeeSnapshotReport({ employeeId, reportDate }: ReportProps) {
  const firestore = useFirestore();
  const [reportData, setReportData] = useState<any>(null); // Use a generic 'any' for the generated report data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
      // Set date on client-side to avoid hydration mismatch
      setCurrentDate(new Date());
  }, []);

  useEffect(() => {
    if (!firestore || !employeeId) {
      setError('معلومات غير كافية لتوليد التقرير.');
      setLoading(false);
      return;
    }

    const generate = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await generateReport(firestore, 'EmployeeDossier', { 
            asOfDate: reportDate.toISOString().split('T')[0], 
            employeeId 
        });

        if (data.type === 'EmployeeDossier') {
          setReportData(data.employee);
        } else {
          throw new Error("نوع التقرير المستلم غير متوقع.");
        }
      } catch (e: any) {
        setError(e.message || 'حدث خطأ غير متوقع أثناء توليد التقرير.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    generate();
  }, [employeeId, reportDate, firestore]);

  if (loading || !reportData) {
    return (
      <div className="p-8 space-y-6" dir="rtl">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive" dir="rtl">
        <h2 className="text-xl font-bold">فشل إنشاء التقرير</h2>
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">إعادة المحاولة</Button>
      </div>
    );
  }
  
  // Now we use the sanitized reportData
  const employee = reportData;

  return (
    <div className="p-4 md:p-8 bg-background font-body print:p-0" dir="rtl">
        <div className="max-w-4xl mx-auto space-y-6 bg-card p-6 rounded-lg shadow-lg print:shadow-none print:rounded-none print:border-none print:p-0">
            <header className="flex justify-between items-start pb-4 border-b">
                <div className='flex items-center gap-4'>
                    <Logo className="h-16 w-16 !p-3" />
                    <div>
                        <h1 className="text-2xl font-bold font-headline">بطاقة الموظف</h1>
                        <p className="text-muted-foreground">EmaratiScope Engineering</p>
                    </div>
                </div>
                <div className="text-left text-xs text-muted-foreground">
                    <p>تاريخ التقرير: {formatDate(reportDate)}</p>
                    {currentDate && <p>تاريخ الطباعة: {formatDate(currentDate)}</p>}
                </div>
            </header>

            <main className="space-y-6">
                 {/* This component is now replaced by EmployeeDossier */}
            </main>
        </div>
    </div>
  );
}