'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription, 
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from '@/components/ui/alert';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Loader2, AlertTriangle, FileSpreadsheet, DownloadCloud, Save, SearchCode } from 'lucide-react';
import type { Employee, MonthlyAttendance, AttendanceRecord } from '@/lib/types';
import { parse, format, isSameDay, isValid, compareAsc, startOfDay } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { cn, cleanFirestoreData } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';

const parseSmartDateTime = (val: any): { date: Date, timeStr: string } | null => {
    if (val === undefined || val === null || val === '') return null;
    let dateObj: Date | null = null;
    let timeStr: string = "";

    if (val instanceof Date && isValid(val)) {
        dateObj = startOfDay(val);
        timeStr = format(val, 'HH:mm');
        return { date: dateObj, timeStr };
    }

    if (typeof val === 'number') {
        const date = XLSX.SSF.parse_date_code(val);
        dateObj = new Date(date.y, date.m - 1, date.d);
        timeStr = `${String(date.h).padStart(2, '0')}:${String(date.m).padStart(2, '0')}`;
        return { date: dateObj, timeStr };
    }

    if (typeof val === 'string') {
        const cleaned = val.trim();
        const parts = cleaned.split(/\s+/);
        const datePart = parts[0];
        const timePart = parts[1] || "";
        const dateFormats = ['dd-MM-yy', 'dd-MM-yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'M/d/yy', 'MM/dd/yyyy'];
        for (const fmt of dateFormats) {
            const parsedDate = parse(datePart, fmt, new Date());
            if (isValid(parsedDate)) {
                dateObj = startOfDay(parsedDate);
                break;
            }
        }
        if (dateObj) {
            if (timePart) timeStr = timePart.substring(0, 5);
            return { date: dateObj, timeStr };
        }
        const native = new Date(cleaned);
        if (isValid(native)) return { date: startOfDay(native), timeStr: format(native, 'HH:mm') };
    }
    return null;
};

export function AttendanceUploader() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { branding } = useBranding();

  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<any>(null);
  
  const { data: employees = [] } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    setYear(now.getFullYear().toString());
    setMonth((now.getMonth() + 1).toString());
  }, []);

  const handleUpload = async () => {
    if (!file || !firestore || !year || !month) return;
    setIsProcessing(true);
    const selectedYearNum = parseInt(year);
    const selectedMonthNum = parseInt(month);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const employeeMap = new Map(employees.map(emp => [String(emp.employeeNumber), emp]));
        const punchesMap = new Map<string, { date: Date, employeeId: string, times: string[] }>();

        json.forEach(row => {
            const empNo = String(row['الرقم الوظيفي'] || row['ID'] || row['رقم الموظف'] || row[Object.keys(row)[0]] || '');
            const emp = employeeMap.get(empNo);
            if (!emp?.id) return;

            let parsed = null;
            for (const key in row) {
                parsed = parseSmartDateTime(row[key]);
                if (parsed) break;
            }
            if (!parsed || parsed.date.getFullYear() !== selectedYearNum || (parsed.date.getMonth() + 1) !== selectedMonthNum) return;

            const dateKey = `${emp.id}_${parsed.date.getTime()}`;
            const existing = punchesMap.get(dateKey) || { date: parsed.date, employeeId: emp.id, times: [] };
            if (parsed.timeStr && !existing.times.includes(parsed.timeStr)) existing.times.push(parsed.timeStr);
            punchesMap.set(dateKey, existing);
        });

        const batch = writeBatch(firestore);
        const groupedUpdates = new Map<string, AttendanceRecord[]>();
        
        const workHours = branding?.work_hours?.general;
        const mEnd = workHours?.morning_end_time || '13:00';
        const eStart = workHours?.evening_start_time || '16:00';

        punchesMap.forEach((entry) => {
            const emp = employees.find(e => e.id === entry.employeeId);
            const sorted = entry.times.sort();
            
            // محرك الفحص الذكي للفترات
            const morningPunches = sorted.filter(t => t <= mEnd);
            const eveningPunches = sorted.filter(t => t >= eStart);

            let status: AttendanceRecord['status'] = 'present';
            let anomaly = '';
            let manualDeduction = 0;

            if (emp?.workStartTime) {
                // دوام مخصص (فترة واحدة)
                if (sorted[0] > emp.workStartTime) status = 'late';
            } else {
                // دوام رسمي (فترتين)
                const hasMorning = morningPunches.length > 0;
                const hasEvening = eveningPunches.length > 0;

                if (hasMorning && !hasEvening) {
                    status = 'half_day';
                    anomaly = 'غياب عن الفترة المسائية';
                    manualDeduction = 0.5;
                } else if (!hasMorning && hasEvening) {
                    status = 'half_day';
                    anomaly = 'غياب عن الفترة الصباحية';
                    manualDeduction = 0.5;
                } else if (hasMorning && hasEvening && sorted.length < 4) {
                    status = 'missing_punch';
                    anomaly = 'فقدان بصمة وسيطة (تم احتساب يوم كامل)';
                }
            }

            const record: AttendanceRecord = {
                date: entry.date,
                employeeId: entry.employeeId,
                checkIn1: sorted[0] || null,
                checkOut1: sorted.length > 1 ? sorted[sorted.length-1] : null,
                checkIn2: null, checkOut2: null, // سيتم عرض كل البصمات في التفاصيل
                allPunches: sorted,
                status,
                anomalyDescription: anomaly,
                manualDeductionDays: manualDeduction,
                auditStatus: 'pending'
            };

            const docKey = `${selectedYearNum}-${selectedMonthNum}-${entry.employeeId}`;
            if (!groupedUpdates.has(docKey)) groupedUpdates.set(docKey, []);
            groupedUpdates.get(docKey)!.push(record);
        });

        for (const [docId, newRecords] of groupedUpdates.entries()) {
            batch.set(doc(firestore, 'attendance', docId), cleanFirestoreData({
                employeeId: docId.split('-')[2], year: selectedYearNum, month: selectedMonthNum,
                records: newRecords, updatedAt: serverTimestamp()
            }), { merge: true });
        }

        await batch.commit();
        setProcessingResult({ success: true, message: `تم تحليل بيانات ${punchesMap.size} أيام عمل.` });
        toast({ title: 'نجاح الاستيراد' });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: error.message });
      } finally { setIsProcessing(false); }
    };
    reader.readAsBinaryString(file!);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8" dir="rtl">
        <Card className="lg:col-span-1 rounded-3xl">
            <CardHeader><CardTitle className="text-lg">إعدادات الشهر</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2"><Label>السنة</Label><Select value={year} onValueChange={setYear}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-2"><Label>الشهر</Label><Select value={month} onValueChange={setMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({length:12}, (_,i)=>i+1).map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent></Select></div>
                <Button onClick={handleDownloadTemplate} variant="outline" className="w-full">تنزيل نموذج</Button>
            </CardContent>
        </Card>
        <Card className="lg:col-span-2 rounded-3xl">
            <CardHeader><CardTitle>رفع ملف البصمة</CardTitle><CardDescription>سيقوم النظام بتحليل الفترات ورصد المخالفات آلياً للمراجعة.</CardDescription></CardHeader>
            <CardContent>
                <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-3xl p-12 text-center cursor-pointer hover:bg-primary/5 transition-all">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls" />
                    <FileSpreadsheet className="h-12 w-12 mx-auto opacity-20 mb-4" />
                    <p className="font-bold">{file ? file.name : "اسحب ملف البصمة هنا"}</p>
                </div>
            </CardContent>
            <CardFooter className="justify-end border-t p-6">
                <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-12 px-10 rounded-xl font-black">
                    {isProcessing ? <Loader2 className="animate-spin ml-2"/> : <Save className="ml-2"/>} معالجة وتدقيق البيانات
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}
