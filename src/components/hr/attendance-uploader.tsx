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
 * محرك تحليل التاريخ والوقت العالمي (Global DateTime Parser):
 * يدعم كافة التنسيقات العربية والغربية، السنين المختصرة، ونظام AM/PM.
 */
const parseSmartDateTime = (val: any): { date: Date, timeStr: string } | null => {
    if (val === undefined || val === null || val === '') return null;
    
    // 1. إذا كان كائن تاريخ جاهز (من مكتبة XLSX)
    if (val instanceof Date && isValid(val)) {
        if (val.getFullYear() < 2000) return null;
        return { date: startOfDay(val), timeStr: format(val, 'HH:mm') };
    }

    // 2. إذا كان رقماً (نظام تاريخ إكسيل المتسلسل)
    if (typeof val === 'number') {
        if (val < 30000 || val > 60000) return null; // نطاق منطقي للسنين 2000-2100
        try {
            const date = XLSX.SSF.parse_date_code(val);
            if (date.y < 2000 || date.y > 2100) return null;
            return { 
                date: startOfDay(new Date(date.y, date.m - 1, date.d)), 
                timeStr: `${String(date.h).padStart(2, '0')}:${String(date.m).padStart(2, '0')}` 
            };
        } catch { return null; }
    }

    // 3. تحليل النصوص (Strings) بكافة الاحتمالات
    if (typeof val === 'string') {
        const cleaned = val.trim();
        if (cleaned.length < 5) return null;

        // محاولة التحويل المباشر أولاً (ISO and Local Standard)
        const native = new Date(cleaned);
        if (isValid(native) && native.getFullYear() >= 2000) {
            return { date: startOfDay(native), timeStr: format(native, 'HH:mm') };
        }

        // تجربة التنسيقات اليدوية الشائعة
        const parts = cleaned.split(/\s+/);
        const datePart = parts[0];
        const timePart = parts.slice(1).join(' '); // يشمل AM/PM إن وجد
        
        // قائمة شاملة لتنسيقات التاريخ
        const dateFormats = [
            'd-M-yyyy', 'dd-MM-yyyy', 'd-MM-yyyy', 'dd-M-yyyy',
            'd/M/yyyy', 'dd/MM/yyyy', 'd/MM/yyyy', 'dd/M/yyyy',
            'd.M.yyyy', 'dd.MM.yyyy',
            'yyyy-MM-dd', 'yyyy/MM/dd', 'yyyy.MM.dd',
            'dd-MM-yy', 'd-M-yy', 'M/d/yy', 'MM/dd/yy', 'dd/MM/yy',
            'M-d-yyyy', 'MM-dd-yyyy'
        ];

        // قائمة شاملة لتنسيقات الوقت
        const timeFormats = [
            'HH:mm', 'H:mm', 'HH:mm:ss', 'H:mm:ss', 
            'hh:mm a', 'h:mm a', 'hh:mm:ss a', 'h:mm:ss a',
            'hh:mmA', 'h:mma'
        ];

        for (const dFmt of dateFormats) {
            try {
                const parsedDate = parse(datePart, dFmt, new Date());
                if (isValid(parsedDate) && parsedDate.getFullYear() >= 2000) {
                    let timeStr = "00:00";
                    if (timePart) {
                        for (const tFmt of timeFormats) {
                            const parsedTime = parse(timePart, tFmt, new Date());
                            if (isValid(parsedTime)) {
                                timeStr = format(parsedTime, 'HH:mm'); // تحويل دائماً لـ 24 ساعة للمعالجة
                                break;
                            }
                        }
                    } else {
                        // محاولة استخراج الوقت من النص الكامل إذا لم ينقسم بمسافة
                        const timeMatch = cleaned.match(/(\d{1,2}:\d{2}(:\d{2})?(\s?[AaPp][Mm])?)/);
                        if (timeMatch) {
                            for (const tFmt of timeFormats) {
                                const pt = parse(timeMatch[0], tFmt, new Date());
                                if (isValid(pt)) { timeStr = format(pt, 'HH:mm'); break; }
                            }
                        }
                    }
                    return { date: startOfDay(parsedDate), timeStr };
                }
            } catch { continue; }
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
        
        if (json.length === 0) throw new Error("الملف فارغ.");

        const employeeMap = new Map(employees.map(emp => [String(emp.employeeNumber), emp]));
        const punchesMap = new Map<string, { date: Date, employeeId: string, times: string[] }>();

        let totalInvalidPeriod = 0;
        const foundPeriods = new Set<string>();

        json.forEach(row => {
            // محاولة العثور على رقم الموظف في أول 3 أعمدة
            const keys = Object.keys(row);
            let empNo = '';
            for(let k=0; k<Math.min(keys.length, 3); k++) {
                const val = String(row[keys[k]] || '');
                if (employeeMap.has(val)) { empNo = val; break; }
            }
            
            const emp = employeeMap.get(empNo);
            if (!emp?.id) return;

            // فحص كافة أعمدة السطر للعثور على التاريخ الذي يطابق الفترة المختارة
            let matchedDate: { date: Date, timeStr: string } | null = null;
            for (const key in row) {
                const parsed = parseSmartDateTime(row[key]);
                if (parsed) {
                    foundPeriods.add(`${parsed.date.getMonth()+1}/${parsed.date.getFullYear()}`);
                    if (parsed.date.getFullYear() === selectedYearNum && (parsed.date.getMonth() + 1) === selectedMonthNum) {
                        matchedDate = parsed;
                        break; 
                    }
                }
            }

            if (!matchedDate) {
                totalInvalidPeriod++;
                return;
            }

            const dateKey = `${emp.id}_${matchedDate.date.getTime()}`;
            const existing = punchesMap.get(dateKey) || { date: matchedDate.date, employeeId: emp.id, times: [] };
            if (matchedDate.timeStr && !existing.times.includes(matchedDate.timeStr)) {
                existing.times.push(matchedDate.timeStr);
            }
            punchesMap.set(dateKey, existing);
        });

        if (punchesMap.size === 0) {
            const periods = Array.from(foundPeriods).join(', ');
            toast({ 
                variant: 'destructive', 
                title: 'خطأ في مطابقة الفترة', 
                description: `لم يتم العثور على بيانات لشهر ${selectedMonthNum}/${selectedYearNum} في الملف. الفترات المتاحة بالملف هي: [${periods}]` 
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

            // نظام الرقابة الثنائي (صباحي/مسائي)
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
                    anomaly = 'بصمة صباحية فقط (خصم نص يوم)';
                    manualDeduction = 0.5;
                } else if (!hasMorning && hasEvening) {
                    status = 'half_day';
                    anomaly = 'بصمة مسائية فقط (خصم نص يوم)';
                    manualDeduction = 0.5;
                } else if (hasMorning && hasEvening && sorted.length < 4) {
                    status = 'missing_punch';
                    anomaly = 'نسيان بصمة البريك (يوم كامل)';
                } else if (!hasMorning && !hasEvening) {
                    status = 'absent';
                    anomaly = 'غياب كامل';
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
        toast({ title: 'نجاح الاستيراد', description: `تم تحليل ${punchesMap.size} سجل يومي بنجاح وتصنيف المخالفات.` });
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
            <CardHeader><CardTitle className="text-lg font-black">إعدادات الفترة</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2">
                    <Label className="font-bold">السنة</Label>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">الشهر</Label>
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({length:12}, (_,i)=>i+1).map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
        <Card className="lg:col-span-2 rounded-[2rem] border-none shadow-xl">
            <CardHeader>
                <CardTitle className="font-black">رفع ملف البصمة</CardTitle>
                <CardDescription>يدعم النظام كافة تنسيقات التاريخ والوقت (AM/PM). سيتم مطابقة البيانات مع الفترة المختارة.</CardDescription>
            </CardHeader>
            <CardContent>
                <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-[2.5rem] p-12 text-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/30 group">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".xlsx, .xls, .csv" />
                    <FileSpreadsheet className="h-16 w-16 mx-auto opacity-20 mb-4 group-hover:scale-110 transition-transform" />
                    <p className="font-black text-lg">{file ? file.name : "اضغط هنا لاختيار الملف"}</p>
                    <p className="text-xs text-muted-foreground mt-2 font-bold">يمكنك سحب وإفلات الملف هنا مباشرة</p>
                </div>
            </CardContent>
            <CardFooter className="justify-end border-t p-6">
                <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20">
                    {isProcessing ? <Loader2 className="animate-spin ml-2"/> : <Save className="ml-2"/>} 
                    تحليل وتدقيق البيانات
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}
