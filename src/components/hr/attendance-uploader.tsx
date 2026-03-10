'use client';

import { useState, useMemo, useRef } from 'react';
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
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Loader2, FileSpreadsheet, RotateCcw } from 'lucide-react';
import type { Employee, MonthlyAttendance, AttendanceRecord } from '@/lib/types';
import { parse, format, isValid, startOfDay } from 'date-fns';
import { cleanFirestoreData } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '@/components/ui/separator';

/**
 * محرك تحليل التاريخ والوقت المتطور:
 * يقوم بفصل التاريخ عن الوقت بدقة لضمان عدم خلط الشهور.
 */
const parseEntryData = (val: any, targetMonth: number, targetYear: number): { date: Date, timeStr: string } | null => {
    if (val === undefined || val === null || val === '') return null;
    
    let parsedDate: Date | null = null;
    let timeStr = "00:00";

    // إذا كان التاريخ كود إكسل (رقم)
    if (typeof val === 'number') {
        try {
            const excelDate = XLSX.SSF.parse_date_code(val);
            parsedDate = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
            timeStr = `${String(excelDate.h).padStart(2, '0')}:${String(excelDate.m).padStart(2, '0')}`;
        } catch { return null; }
    } 
    // إذا كان نصاً
    else if (typeof val === 'string') {
        const cleaned = val.trim();
        // محاولة تنظيف النص من أي رموز غريبة
        const datePart = cleaned.split(/\s+/)[0].replace(/[^\d\/\.\-]/g, '');
        
        const dateFormats = [
            'd-M-yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 'd/M/yyyy', 'dd.MM.yyyy', 'd.M.yyyy',
            'dd-MM-yy', 'd-M-yy', 'M/d/yy', 'MM/dd/yy', 'yyyy/MM/dd'
        ];

        for (const fmt of dateFormats) {
            try {
                const p = parse(datePart, fmt, new Date());
                if (isValid(p) && p.getFullYear() >= 2000) {
                    parsedDate = startOfDay(p);
                    // محاولة استخراج الوقت إذا وجد في نفس الخانة
                    const timeMatch = cleaned.match(/(\d{1,2}:\d{2}(:\d{2})?(\s?[AaPp][Mm])?)/);
                    if (timeMatch) {
                        const tp = parse(timeMatch[0].toUpperCase(), timeMatch[0].includes('M') ? 'hh:mm a' : 'HH:mm', new Date());
                        if (isValid(tp)) timeStr = format(tp, 'HH:mm');
                    }
                    break;
                }
            } catch { continue; }
        }
    }

    if (parsedDate && isValid(parsedDate)) {
        // التحقق الصارم من مطابقة الشهر والسنة لضمان عدم تداخل البيانات
        if (parsedDate.getFullYear() === targetYear && (parsedDate.getMonth() + 1) === targetMonth) {
            return { date: parsedDate, timeStr };
        }
    }
    
    return null;
};

export function AttendanceUploader() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { branding } = useBranding();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [clearPrevious, setClearPrevious] = useState(true);
  
  const { data: employees = [] } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        
        if (json.length === 0) throw new Error("الملف المرفوع فارغ.");

        const employeeMap = new Map(employees.map(emp => [String(emp.employeeNumber), emp]));
        // خريطة لتجميع البصمات: الموظف -> اليوم -> قائمة الساعات
        const dailyPunches = new Map<string, Set<string>>(); 

        json.forEach(row => {
            const keys = Object.keys(row);
            let empNo = '';
            // البحث عن رقم الموظف في أول 5 أعمدة (لزيادة الدقة)
            for(let k=0; k<Math.min(keys.length, 5); k++) {
                const val = String(row[keys[k]] || '').trim();
                if (employeeMap.has(val)) { empNo = val; break; }
            }
            
            const emp = employeeMap.get(empNo);
            if (!emp?.id) return;

            // استخراج كافة البصمات الممكنة من السطر الحالي والتي تخص الشهر المختار
            for (const key in row) {
                const parsed = parseEntryData(row[key], selectedMonthNum, selectedYearNum);
                if (parsed) {
                    const dateKey = `${emp.id}_${parsed.date.getTime()}`;
                    if (!dailyPunches.has(dateKey)) dailyPunches.set(dateKey, new Set());
                    if (parsed.timeStr && parsed.timeStr !== "00:00") {
                        dailyPunches.get(dateKey)!.add(parsed.timeStr);
                    }
                }
            }
        });

        if (dailyPunches.size === 0) {
            throw new Error(`لم يتم العثور على أي بصمات تخص شهر ${selectedMonthNum}/${selectedYearNum} في هذا الملف. يرجى التأكد من محتوى الملف أو الفترة المختارة.`);
        }

        const batch = writeBatch(firestore);

        // تطهير البيانات القديمة لمنع ظهور March في February
        if (clearPrevious) {
            const existingQuery = query(
                collection(firestore, 'attendance'),
                where('year', '==', selectedYearNum),
                where('month', '==', selectedMonthNum)
            );
            const existingSnap = await getDocs(existingQuery);
            existingSnap.forEach(d => batch.delete(d.ref));
        }

        const groupedByEmployee = new Map<string, AttendanceRecord[]>();
        const workHours = branding?.work_hours?.general;
        const mEnd = workHours?.morning_end_time || '13:00';
        const eStart = workHours?.evening_start_time || '16:00';

        dailyPunches.forEach((timesSet, compositeKey) => {
            const [empId, timestamp] = compositeKey.split('_');
            const date = new Date(parseInt(timestamp));
            const sortedTimes = Array.from(timesSet).sort();
            const emp = employees.find(e => e.id === empId);

            let status: AttendanceRecord['status'] = 'present';
            let anomaly = '';
            let manualDeduction = 0;

            if (emp?.workStartTime && sortedTimes[0] > emp.workStartTime) {
                status = 'late';
                anomaly = `تأخير عن موعده المخصص (${emp.workStartTime})`;
            } else if (!emp?.workStartTime) {
                const hasMorning = sortedTimes.some(t => t <= mEnd);
                const hasEvening = sortedTimes.some(t => t >= eStart);

                if (hasMorning && !hasEvening) {
                    status = 'half_day';
                    anomaly = 'بصمة صباحية فقط (خصم نص يوم)';
                    manualDeduction = 0.5;
                } else if (!hasMorning && hasEvening) {
                    status = 'half_day';
                    anomaly = 'بصمة مسائية فقط (خصم نص يوم)';
                    manualDeduction = 0.5;
                } else if (hasMorning && hasEvening && sortedTimes.length < 4) {
                    status = 'missing_punch';
                    anomaly = 'بصمة ناقصة (نسيان بصمة البريك)';
                }
            }

            const record: AttendanceRecord = {
                date: Timestamp.fromDate(date),
                employeeId: empId,
                checkIn1: sortedTimes[0] || null,
                checkOut1: sortedTimes.length > 1 ? sortedTimes[sortedTimes.length-1] : null,
                checkIn2: null, checkOut2: null,
                allPunches: sortedTimes,
                status,
                anomalyDescription: anomaly,
                manualDeductionDays: manualDeduction,
                auditStatus: status === 'present' ? 'verified' : 'pending'
            };

            const docId = `${selectedYearNum}-${selectedMonthNum}-${empId}`;
            if (!groupedByEmployee.has(docId)) groupedByEmployee.set(docId, []);
            groupedByEmployee.get(docId)!.push(record);
        });

        for (const [docId, records] of groupedByEmployee.entries()) {
            batch.set(doc(firestore, 'attendance', docId), {
                employeeId: docId.split('-')[2],
                year: selectedYearNum,
                month: selectedMonthNum,
                records,
                updatedAt: serverTimestamp()
            });
        }

        await batch.commit();
        toast({ title: 'نجاح المعالجة', description: `تم استيراد ${dailyPunches.size} يومية بنجاح لشهر ${selectedMonthNum}. تم تنظيف السجلات القديمة تلقائياً.` });
        setFile(null);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ في الاستيراد', description: error.message });
      } finally { setIsProcessing(false); }
    };
    reader.readAsBinaryString(file!);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8" dir="rtl">
        <Card className="lg:col-span-1 rounded-[2rem] border-none shadow-sm">
            <CardHeader><CardTitle className="text-lg font-black">فترة التقرير</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-2">
                    <Label className="font-bold">السنة المستهدفة</Label>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">الشهر المستهدف</Label>
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({length:12}, (_,i)=>i+1).map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <Separator />
                <div className="flex items-center gap-3 p-4 bg-red-50/50 rounded-2xl border border-red-100">
                    <Checkbox id="purge" checked={clearPrevious} onCheckedChange={(c) => setClearPrevious(!!c)} />
                    <div className="space-y-0.5">
                        <Label htmlFor="purge" className="font-black text-xs text-red-800 cursor-pointer">تطهير البيانات السابقة</Label>
                        <p className="text-[9px] text-red-600 font-bold leading-tight">سيتم مسح أي بصمات قديمة لهذا الشهر قبل الرفع الجديد لضمان الدقة.</p>
                    </div>
                </div>
            </CardContent>
        </Card>
        <Card className="lg:col-span-2 rounded-[2rem] border-none shadow-xl">
            <CardHeader>
                <CardTitle className="font-black">ملف البصمة الجديد</CardTitle>
                <CardDescription>ارفع ملف الإكسل المستخرج من جهاز البصمة ليقوم النظام بتحليله آلياً.</CardDescription>
            </CardHeader>
            <CardContent>
                <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-[2.5rem] p-12 text-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/30 group">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".xlsx, .xls, .csv" />
                    <FileSpreadsheet className="h-16 w-16 mx-auto opacity-20 mb-4 group-hover:scale-110 transition-transform" />
                    <p className="font-black text-lg">{file ? file.name : "اضغط هنا لاختيار الملف"}</p>
                    <p className="text-xs text-muted-foreground mt-2 font-bold">يقوم النظام بفلترة البيانات حسب الشهر والسنة المختارين.</p>
                </div>
            </CardContent>
            <CardFooter className="justify-end border-t p-6">
                <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 gap-2">
                    {isProcessing ? <Loader2 className="animate-spin ml-2 h-5 w-5"/> : <RotateCcw className="h-5 w-5"/>} 
                    بدء المعالجة الذكية
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}
