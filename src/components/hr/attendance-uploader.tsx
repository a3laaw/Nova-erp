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
import { parse, format, isValid, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, getDay } from 'date-fns';
import { cleanFirestoreData } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '@/components/ui/separator';

const dayNameToIndex: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

// دالة ذكية لاستخراج التاريخ والوقت من أي صيغة في إكسل
const parseEntryData = (val: any, targetMonth: number, targetYear: number): { date: Date, timeStr: string } | null => {
    if (val === undefined || val === null || val === '') return null;
    
    let parsedDate: Date | null = null;
    let timeStr = "00:00";

    if (typeof val === 'number') {
        try {
            const excelDate = XLSX.SSF.parse_date_code(val);
            parsedDate = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
            timeStr = `${String(excelDate.h).padStart(2, '0')}:${String(excelDate.m).padStart(2, '0')}`;
        } catch { return null; }
    } 
    else if (typeof val === 'string') {
        const cleaned = val.trim();
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
        const excelPunches = new Map<string, Set<string>>(); 

        json.forEach(row => {
            const keys = Object.keys(row);
            let empNo = '';
            for(let k=0; k<Math.min(keys.length, 10); k++) {
                const val = String(row[keys[k]] || '').trim();
                if (employeeMap.has(val)) { empNo = val; break; }
            }
            
            const emp = employeeMap.get(empNo);
            if (!emp?.id) return;

            for (const key in row) {
                const parsed = parseEntryData(row[key], selectedMonthNum, selectedYearNum);
                if (parsed) {
                    const dateKey = `${emp.id}_${parsed.date.getTime()}`;
                    if (!excelPunches.has(dateKey)) excelPunches.set(dateKey, new Set());
                    if (parsed.timeStr && parsed.timeStr !== "00:00") {
                        excelPunches.get(dateKey)!.add(parsed.timeStr);
                    }
                }
            }
        });

        // --- محرك توليد أيام العمل الرسمية وإثبات الغياب ---
        const monthStart = startOfMonth(new Date(selectedYearNum, selectedMonthNum - 1));
        const monthEnd = endOfMonth(monthStart);
        const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        
        const holidayIndexes = new Set((branding?.work_hours?.holidays || []).map(h => dayNameToIndex[h]));
        const workingDaysInMonth = allDaysInMonth.filter(day => !holidayIndexes.has(getDay(day)));

        const batch = writeBatch(firestore);

        if (clearPrevious) {
            const existingQuery = query(
                collection(firestore, 'attendance'),
                where('year', '==', selectedYearNum),
                where('month', '==', selectedMonthNum)
            );
            const existingSnap = await getDocs(existingQuery);
            existingSnap.forEach(d => batch.delete(d.ref));
        }

        const workHours = branding?.work_hours?.general;
        const mEnd = workHours?.morning_end_time || '13:00';
        const eStart = workHours?.evening_start_time || '16:00';

        // لكل موظف نشط، نمر على كل أيام العمل الرسمية
        for (const emp of employees) {
            const employeeRecords: AttendanceRecord[] = [];
            
            for (const day of workingDaysInMonth) {
                const dateKey = `${emp.id}_${day.getTime()}`;
                const punches = excelPunches.get(dateKey);

                if (punches && punches.size > 0) {
                    const sortedTimes = Array.from(punches).sort();
                    let status: AttendanceRecord['status'] = 'present';
                    let anomaly = '';
                    let manualDeduction = 0;

                    // تحقق من التأخير بناءً على ساعات عمل الموظف المخصصة أو العامة
                    const startTimeLimit = emp.workStartTime || workHours?.morning_start_time || '08:00';
                    if (sortedTimes[0] > startTimeLimit) {
                        status = 'late';
                        anomaly = `تأخير عن الموعد المحدد (${startTimeLimit})`;
                    } else {
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

                    employeeRecords.push({
                        date: Timestamp.fromDate(day),
                        employeeId: emp.id!,
                        checkIn1: sortedTimes[0],
                        checkOut1: sortedTimes[sortedTimes.length - 1],
                        checkIn2: null, checkOut2: null,
                        allPunches: sortedTimes,
                        status,
                        anomalyDescription: anomaly,
                        manualDeductionDays: manualDeduction,
                        auditStatus: status === 'present' ? 'verified' : 'pending'
                    });
                } else {
                    // 🛡️ الموظف لم يبصم في يوم عمل رسمي -> إثبات غياب آلي
                    employeeRecords.push({
                        date: Timestamp.fromDate(day),
                        employeeId: emp.id!,
                        checkIn1: null, checkOut1: null, checkIn2: null, checkOut2: null,
                        allPunches: [],
                        status: 'absent',
                        anomalyDescription: 'غياب كامل عن يوم عمل رسمي',
                        manualDeductionDays: 1,
                        auditStatus: 'pending'
                    });
                }
            }

            if (employeeRecords.length > 0) {
                const docId = `${selectedYearNum}-${selectedMonthNum}-${emp.id}`;
                batch.set(doc(firestore, 'attendance', docId), {
                    employeeId: emp.id,
                    year: selectedYearNum,
                    month: selectedMonthNum,
                    records: employeeRecords,
                    updatedAt: serverTimestamp()
                });
            }
        }

        await batch.commit();
        toast({ 
            title: 'اكتملت المعالجة الرقابية', 
            description: `تم تحليل الشهر بالكامل ومطابقته مع أيام العمل الرسمية. تم إثبات غياب الموظفين آلياً للأيام المفقودة.` 
        });
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
                <CardDescription>ارفع ملف الإكسل المستخرج من جهاز البصمة ليقوم النظام بتحليله ومطابقته مع أيام العمل الرسمية.</CardDescription>
            </CardHeader>
            <CardContent>
                <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-[2.5rem] p-12 text-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/30 group">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".xlsx, .xls, .csv" />
                    <FileSpreadsheet className="h-16 w-16 mx-auto opacity-20 mb-4 group-hover:scale-110 transition-transform" />
                    <p className="font-black text-lg">{file ? file.name : "اضغط هنا لاختيار الملف"}</p>
                    <p className="text-xs text-muted-foreground mt-2 font-bold">سيقوم النظام آلياً بتسجيل "غياب" لأي موظف لم تظهر بصمته في يوم عمل رسمي.</p>
                </div>
            </CardContent>
            <CardFooter className="justify-end border-t p-6">
                <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 gap-2">
                    {isProcessing ? <Loader2 className="animate-spin ml-2 h-5 w-5"/> : <RotateCcw className="h-5 w-5"/>} 
                    بدء المعالجة الرقابية
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}