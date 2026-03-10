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
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Loader2, FileSpreadsheet, Save, DownloadCloud, AlertCircle } from 'lucide-react';
import type { Employee, MonthlyAttendance, AttendanceRecord } from '@/lib/types';
import { parse, format, isValid, startOfDay } from 'date-fns';
import { cn, cleanFirestoreData } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';

/**
 * دالة تحليل التاريخ والوقت المطور:
 * ترفض القيم التي تنتج سنوات غير منطقية (قبل 2000) لمنع الخلط مع أرقام المسلسل.
 */
const parseSmartDateTime = (val: any): { date: Date, timeStr: string } | null => {
    if (val === undefined || val === null || val === '') return null;
    let dateObj: Date | null = null;
    let timeStr: string = "";

    // 1. إذا كان كائن تاريخ جاهز
    if (val instanceof Date && isValid(val)) {
        if (val.getFullYear() < 2000) return null;
        dateObj = startOfDay(val);
        timeStr = format(val, 'HH:mm');
        return { date: dateObj, timeStr };
    }

    // 2. إذا كان رقماً (نظام تاريخ إكسيل)
    if (typeof val === 'number') {
        // تواريخ إكسيل بعد سنة 2000 تكون قيمتها أكبر من 36526
        if (val < 30000 || val > 60000) return null; 
        
        try {
            const date = XLSX.SSF.parse_date_code(val);
            if (date.y < 2000 || date.y > 2100) return null;
            
            dateObj = startOfDay(new Date(date.y, date.m - 1, date.d));
            timeStr = `${String(date.h).padStart(2, '0')}:${String(date.m).padStart(2, '0')}`;
            return { date: dateObj, timeStr };
        } catch { return null; }
    }

    // 3. إذا كان نصاً
    if (typeof val === 'string') {
        const cleaned = val.trim();
        if (!cleaned || cleaned.length < 5) return null;

        const parts = cleaned.split(/\s+/);
        const datePart = parts[0];
        const timePart = parts[1] || "";
        
        const dateFormats = [
            'd-M-yyyy', 'dd-MM-yyyy', 'd-MM-yyyy', 'dd-M-yyyy',
            'd/M/yyyy', 'dd/MM/yyyy', 'd/MM/yyyy', 'dd/M/yyyy',
            'yyyy-MM-dd', 'dd-MM-yy', 'd-M-yy', 'M/d/yy', 'MM/dd/yy'
        ];

        for (const fmt of dateFormats) {
            try {
                const parsedDate = parse(datePart, fmt, new Date());
                if (isValid(parsedDate) && parsedDate.getFullYear() >= 2000) {
                    dateObj = startOfDay(parsedDate);
                    break;
                }
            } catch { continue; }
        }

        if (dateObj) {
            if (timePart) {
                timeStr = timePart.substring(0, 5).replace(/[^0-9:]/g, '');
            } else {
                const dateTimeMatch = cleaned.match(/(\d{1,2}:\d{2})/);
                if (dateTimeMatch) timeStr = dateTimeMatch[1];
            }
            return { date: dateObj, timeStr };
        }
        
        const native = new Date(cleaned);
        if (isValid(native) && native.getFullYear() >= 2000) {
            return { date: startOfDay(native), timeStr: format(native, 'HH:mm') };
        }
    }
    return null;
};

export function AttendanceUploader() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { branding } = useBranding();

  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { data: employees = [] } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
        
        if (json.length === 0) {
            throw new Error("الملف فارغ أو لا يحتوي على بيانات صالحة.");
        }

        const employeeMap = new Map(employees.map(emp => [String(emp.employeeNumber), emp]));
        const punchesMap = new Map<string, { date: Date, employeeId: string, times: string[] }>();

        let recordsFromOtherPeriods = 0;
        const foundYears = new Set<number>();

        json.forEach(row => {
            const empNo = String(row['الرقم الوظيفي'] || row['ID'] || row['رقم الموظف'] || row[Object.keys(row)[0]] || '');
            const emp = employeeMap.get(empNo);
            if (!emp?.id) return;

            // استخراج كافة التواريخ الممكنة في السطر
            const possibleDates: any[] = [];
            for (const key in row) {
                const parsed = parseSmartDateTime(row[key]);
                if (parsed) possibleDates.push(parsed);
            }

            // البحث عن التاريخ الذي يطابق الفترة المختارة في الواجهة
            const matchingPeriodDate = possibleDates.find(p => 
                p.date.getFullYear() === selectedYearNum && (p.date.getMonth() + 1) === selectedMonthNum
            );

            if (!matchingPeriodDate) {
                if (possibleDates.length > 0) {
                    recordsFromOtherPeriods++;
                    foundYears.add(possibleDates[0].date.getFullYear());
                }
                return;
            }

            const dateKey = `${emp.id}_${matchingPeriodDate.date.getTime()}`;
            const existing = punchesMap.get(dateKey) || { date: matchingPeriodDate.date, employeeId: emp.id, times: [] };
            if (matchingPeriodDate.timeStr && !existing.times.includes(matchingPeriodDate.timeStr)) {
                existing.times.push(matchingPeriodDate.timeStr);
            }
            punchesMap.set(dateKey, existing);
        });

        if (punchesMap.size === 0) {
            const yearInfo = foundYears.size > 0 ? ` (تم العثور على سنوات: ${Array.from(foundYears).join(', ')})` : '';
            toast({ 
                variant: 'destructive', 
                title: 'خطأ في مطابقة الفترة', 
                description: `الملف يحتوي على ${recordsFromOtherPeriods} سجلات، ولكن لا يوجد أي منها يطابق شهر ${selectedMonthNum} وسنة ${selectedYearNum}${yearInfo}.` 
            });
            setIsProcessing(false);
            return;
        }

        const batch = writeBatch(firestore);
        const groupedUpdates = new Map<string, AttendanceRecord[]>();
        
        const workHours = branding?.work_hours?.general;
        const mEnd = workHours?.morning_end_time || '13:00';
        const eStart = workHours?.evening_start_time || '16:00';

        punchesMap.forEach((entry) => {
            const emp = employees.find(e => e.id === entry.employeeId);
            const sorted = entry.times.sort();
            
            const morningPunches = sorted.filter(t => t <= mEnd);
            const eveningPunches = sorted.filter(t => t >= eStart);

            let status: AttendanceRecord['status'] = 'present';
            let anomaly = '';
            let manualDeduction = 0;

            if (emp?.workStartTime) {
                if (sorted[0] > emp.workStartTime) {
                    status = 'late';
                    anomaly = `تأخير عن الدوام المخصص (${emp.workStartTime})`;
                }
            } else {
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
                } else if (!hasMorning && !hasEvening) {
                    status = 'absent';
                    anomaly = 'غياب كامل عن اليوم';
                    manualDeduction = 1;
                }
            }

            const record: AttendanceRecord = {
                date: entry.date,
                employeeId: entry.employeeId,
                checkIn1: sorted[0] || null,
                checkOut1: sorted.length > 1 ? sorted[sorted.length-1] : null,
                checkIn2: null, checkOut2: null,
                allPunches: sorted,
                status,
                anomalyDescription: anomaly,
                manualDeductionDays: manualDeduction,
                auditStatus: status === 'present' ? 'verified' : 'pending'
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
        toast({ title: 'نجاح الاستيراد', description: `تم تحليل بيانات ${punchesMap.size} بصمة موظف بنجاح.` });
        setFile(null);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ في المعالجة', description: error.message });
      } finally { setIsProcessing(false); }
    };
    reader.readAsBinaryString(file!);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8" dir="rtl">
        <Card className="lg:col-span-1 rounded-[2rem] border-none shadow-sm">
            <CardHeader><CardTitle className="text-lg font-black">إعدادات الشهر</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2">
                    <Label className="font-bold">السنة</Label>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>{[2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">الشهر المطلوب</Label>
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({length:12}, (_,i)=>i+1).map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
        <Card className="lg:col-span-2 rounded-[2rem] border-none shadow-xl">
            <CardHeader>
                <CardTitle className="font-black">رفع ملف البصمة (Excel)</CardTitle>
                <CardDescription>ارفع ملف الحضور والغياب بصيغة Excel. سيقوم النظام بمطابقة تواريخ الملف مع الشهر المختار أعلاه.</CardDescription>
            </CardHeader>
            <CardContent>
                <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-[2.5rem] p-12 text-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/30 group">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".xlsx, .xls" />
                    <FileSpreadsheet className="h-16 w-16 mx-auto opacity-20 mb-4 group-hover:scale-110 transition-transform" />
                    <p className="font-black text-lg">{file ? file.name : "اضغط هنا لاختيار الملف"}</p>
                    <p className="text-xs text-muted-foreground mt-2 font-bold">تنبيه: يجب أن يحتوي الملف على عمود "الرقم الوظيفي" و "التاريخ والوقت"</p>
                </div>
            </CardContent>
            <CardFooter className="justify-end border-t p-6">
                <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20">
                    {isProcessing ? <Loader2 className="animate-spin ml-2"/> : <Save className="ml-2"/>} 
                    بدء المعالجة والتدقيق
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}
