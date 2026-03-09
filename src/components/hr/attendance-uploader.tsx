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
import { Loader2, AlertTriangle, FileSpreadsheet, DownloadCloud, Save } from 'lucide-react';
import type { Employee, MonthlyAttendance, WorkShift } from '@/lib/types';
import { parse, format, isSameDay, isValid, compareAsc, startOfDay } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { cn, cleanFirestoreData } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';

/**
 * دالة ذكية لتحليل التاريخ والوقت المدمج في خانة واحدة (مثل العينة المرسلة)
 * التنسيق المتوقع: DD-MM-YY HH:mm
 */
const parseSmartDateTime = (val: any): { date: Date, timeStr: string } | null => {
    if (val === undefined || val === null || val === '') return null;

    let dateObj: Date | null = null;
    let timeStr: string = "";

    // إذا كانت القيمة كائن تاريخ أصلي
    if (val instanceof Date && isValid(val)) {
        dateObj = startOfDay(val);
        timeStr = format(val, 'HH:mm');
        return { date: dateObj, timeStr };
    }

    // إذا كانت القيمة رقمية (تنسيق إكسل للتاريخ)
    if (typeof val === 'number') {
        const date = XLSX.SSF.parse_date_code(val);
        dateObj = new Date(date.y, date.m - 1, date.d);
        timeStr = `${String(date.h).padStart(2, '0')}:${String(date.m).padStart(2, '0')}`;
        return { date: dateObj, timeStr };
    }

    // إذا كانت القيمة نصية (01-02-26 10:06)
    if (typeof val === 'string') {
        const cleaned = val.trim();
        // تقسيم النص لمعالجة التاريخ والوقت
        const parts = cleaned.split(/\s+/);
        const datePart = parts[0];
        const timePart = parts[1] || "";

        // محاولة تحليل الجزء الخاص بالتاريخ
        const dateFormats = ['dd-MM-yy', 'dd-MM-yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'M/d/yy', 'MM/dd/yyyy'];
        for (const fmt of dateFormats) {
            const parsedDate = parse(datePart, fmt, new Date());
            if (isValid(parsedDate)) {
                dateObj = startOfDay(parsedDate);
                break;
            }
        }

        // إذا نجحنا في الحصول على التاريخ، نستخرج الوقت
        if (dateObj) {
            if (timePart) {
                // استخراج HH:mm
                timeStr = timePart.substring(0, 5);
            }
            return { date: dateObj, timeStr };
        }
        
        // محاولة أخيرة باستخدام المحلل الافتراضي
        const native = new Date(cleaned);
        if (isValid(native)) {
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
  const [isMounted, setIsMounted] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<{ success: boolean, message: string, skippedCount?: number, validCount?: number } | null>(null);
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    setYear(now.getFullYear().toString());
    setMonth((now.getMonth() + 1).toString());
  }, []);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
      setProcessingResult(null);
    }
  };

  const handleDownloadTemplate = () => {
    const data = [
      { 'الرقم الوظيفي': '101', 'التاريخ والوقت': '01-02-26 10:06' },
      { 'الرقم الوظيفي': '101', 'التاريخ والوقت': '01-02-26 18:52' },
      { 'الرقم الوظيفي': '102', 'التاريخ والوقت': '01-02-26 08:15' },
    ];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Sample");
    XLSX.writeFile(workbook, "Nova_ERP_Attendance_Sample.xlsx");
  };

  const handleUpload = async () => {
    if (!file || !firestore || !year || !month) {
        toast({ variant: 'destructive', title: 'تنبيه', description: 'يرجى تحديد الشهر والسنة قبل الرفع.' });
        return;
    }

    setIsProcessing(true);
    setProcessingResult(null);

    const selectedYearNum = parseInt(year);
    const selectedMonthNum = parseInt(month);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) throw new Error("الملف فارغ.");

        const employeeMap = new Map(employees.map(emp => [String(emp.employeeNumber), emp]));
        // خريطة لتجميع كل البصمات اليومية لكل موظف
        const punchesMap = new Map<string, { date: Date, employeeId: string, times: string[] }>();
        let skippedCount = 0;
        let validCount = 0;

        json.forEach(row => {
            // البحث عن الرقم الوظيفي في أي عمود محتمل
            const empNo = String(row.employeeNumber || row['الرقم الوظيفي'] || row['ID'] || row['رقم الموظف'] || row[Object.keys(row)[0]] || '');
            const emp = employeeMap.get(empNo);
            if (!emp?.id) return;

            // البحث عن خانة التاريخ والوقت
            let parsed = null;
            const possibleDateKeys = ['Time', 'date', 'التاريخ', 'التاريخ والوقت', 'وقت البصمة'];
            for (const key of possibleDateKeys) {
                if (row[key]) {
                    parsed = parseSmartDateTime(row[key]);
                    if (parsed) break;
                }
            }
            
            // إذا لم نجد خانة محددة، نبحث في كل الأعمدة عن قيمة تاريخ صالحة
            if (!parsed) {
                for (const key in row) {
                    parsed = parseSmartDateTime(row[key]);
                    if (parsed) break;
                }
            }

            if (!parsed) return;

            // الرقابة الصارمة على الشهر والسنة
            if (parsed.date.getFullYear() !== selectedYearNum || (parsed.date.getMonth() + 1) !== selectedMonthNum) {
                skippedCount++;
                return;
            }

            validCount++;
            const dateKey = `${emp.id}_${parsed.date.getTime()}`;
            const existing = punchesMap.get(dateKey) || { date: parsed.date, employeeId: emp.id, times: [] };

            if (parsed.timeStr && !existing.times.includes(parsed.timeStr)) {
                existing.times.push(parsed.timeStr);
            }
            punchesMap.set(dateKey, existing);
        });

        if (punchesMap.size === 0) {
            throw new Error(`لم يتم العثور على أي حركات صالحة تخص شهر ${selectedMonthNum}/${selectedYearNum} في هذا الملف.`);
        }

        const batch = writeBatch(firestore);
        const groupedUpdates = new Map<string, any[]>();
        
        punchesMap.forEach((entry) => {
            const emp = employees.find(e => e.id === entry.employeeId);
            const sortedPunches = entry.times.sort();
            
            // منطق الدوام الذكي
            const ramadan = branding?.work_hours?.ramadan;
            const ramStart = toFirestoreDate(ramadan?.start_date);
            const ramEnd = toFirestoreDate(ramadan?.end_date);
            const isRamadanDay = ramadan?.is_enabled && ramStart && ramEnd && 
                                 entry.date >= startOfDay(ramStart) && 
                                 entry.date <= startOfDay(ramEnd);
            
            // تحديد وقت البداية بناءً على (موظف مخصص -> إعدادات عامة)
            let effectiveWorkStart = '08:00';
            if (isRamadanDay) {
                effectiveWorkStart = ramadan.start_time || '09:30';
            } else if (emp?.workStartTime) {
                effectiveWorkStart = emp.workStartTime;
            } else {
                effectiveWorkStart = branding?.work_hours?.general?.morning_start_time || '08:00';
            }
            
            const checkIn = sortedPunches[0];
            const checkOut = sortedPunches[sortedPunches.length - 1];
            const isLate = checkIn && checkIn > effectiveWorkStart;

            const mergedRecord = {
                date: entry.date,
                employeeId: entry.employeeId,
                checkIn1: checkIn || null,
                checkOut1: checkIn === checkOut ? null : checkOut, 
                status: isLate ? 'late' : 'present',
                isRamadan: isRamadanDay,
                allPunches: sortedPunches 
            };

            const docKey = `${selectedYearNum}-${selectedMonthNum}-${entry.employeeId}`;
            if (!groupedUpdates.has(docKey)) groupedUpdates.set(docKey, []);
            groupedUpdates.get(docKey)!.push(mergedRecord);
        });

        for (const [docId, newRecords] of groupedUpdates.entries()) {
            const docRef = doc(firestore, 'attendance', docId);
            const existingDoc = await getDoc(docRef);
            let finalRecords = existingDoc.exists() ? (existingDoc.data().records || []) : [];

            finalRecords = finalRecords.map((r: any) => ({ ...r, date: toFirestoreDate(r.date) }));

            newRecords.forEach(newItem => {
                const existingIdx = finalRecords.findIndex((r: any) => r.date && isSameDay(r.date, newItem.date));
                if (existingIdx > -1) {
                    finalRecords[existingIdx] = { ...finalRecords[existingIdx], ...newItem };
                } else {
                    finalRecords.push(newItem);
                }
            });

            finalRecords.sort((a: any, b: any) => compareAsc(a.date, b.date));

            batch.set(docRef, cleanFirestoreData({
                employeeId: docId.split('-')[2],
                year: selectedYearNum,
                month: selectedMonthNum,
                records: finalRecords,
                summary: {
                    presentDays: finalRecords.filter((r: any) => r.checkIn1).length,
                    lateDays: finalRecords.filter((r: any) => r.status === 'late').length,
                    absentDays: 0,
                    totalDays: finalRecords.length
                },
                updatedAt: serverTimestamp()
            }), { merge: true });
        }

        await batch.commit();
        setProcessingResult({ 
            success: true, 
            message: `تم تحليل ${validCount} بصمة. تم دمج الحركات اليومية لـ ${punchesMap.size} أيام عمل.`,
            skippedCount,
            validCount
        });
        toast({ title: 'نجاح الاستيراد', description: `تمت معالجة بيانات شهر ${selectedMonthNum} بنجاح.` });
        setFile(null);
      } catch (error: any) {
        setProcessingResult({ success: false, message: error.message });
        toast({ variant: 'destructive', title: 'فشل الرفع', description: error.message });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file!);
  };

  if (!isMounted) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start" dir="rtl">
        <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5">
                    <CardTitle className="text-lg flex items-center gap-2 text-primary">
                        <DownloadCloud className="h-5 w-5 text-primary" />
                        إعدادات الاستيراد الذكي
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div className="grid gap-2">
                        <Label className="font-bold">السنة</Label>
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent dir="rtl">
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label className="font-bold">الشهر المطلوب</Label>
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent dir="rtl">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Separator className="my-2"/>
                    <Button onClick={handleDownloadTemplate} variant="outline" className="w-full h-11 rounded-xl border-dashed border-primary/30 text-primary font-bold">تنزيل نموذج متوافق</Button>
                </CardContent>
            </Card>

            <Alert className="rounded-2xl border-orange-200 bg-orange-50/50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="font-black">تنبيه الرقابة الزمنية</AlertTitle>
                <AlertDescription className="text-xs font-bold leading-relaxed">
                    النظام سيقوم بدمج البصمات المتعددة لليوم الواحد آلياً.
                    <br/>
                    تم استبعاد {processingResult?.skippedCount || 0} بصمة لا تخص شهر {month}.
                </AlertDescription>
            </Alert>
        </div>

        <div className="lg:col-span-2">
            <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-muted/30 border-b pb-8 px-8">
                    <CardTitle className="text-xl font-black">رفع وتحليل ملف البصمة</CardTitle>
                    <CardDescription>يدعم التنسيقات المدمجة (تاريخ ووقت في خانة واحدة) والبصمات المتكررة.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <div 
                        onClick={() => !isProcessing && fileInputRef.current?.click()} 
                        className={cn(
                            "border-4 border-dashed rounded-[2rem] p-12 text-center cursor-pointer transition-all", 
                            isProcessing ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50 hover:bg-primary/[0.02]"
                        )}
                    >
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls" />
                        <div className="p-4 bg-muted rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                            {isProcessing ? <Loader2 className="h-10 w-10 text-primary animate-spin" /> : <FileSpreadsheet className="h-10 w-10 text-muted-foreground opacity-40" />}
                        </div>
                        <div className="mt-6">
                            {file ? (
                                <div className="space-y-2">
                                    <p className="text-lg font-black text-primary">{file.name}</p>
                                    <p className="text-sm font-bold text-green-600">الملف جاهز للتحليل</p>
                                </div>
                            ) : (
                                <p className="text-lg font-black text-muted-foreground">اضغط هنا لاختيار ملف البصمة</p>
                            )}
                        </div>
                    </div>
                    {processingResult && (
                        <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                            <Alert className={cn("rounded-2xl border-2", processingResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50")}>
                                <AlertTitle className="font-black">{processingResult.success ? "تم تحليل البيانات بنجاح" : "فشل التحليل"}</AlertTitle>
                                <AlertDescription className="font-bold text-sm">
                                    {processingResult.message}
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="p-8 bg-muted/10 border-t flex justify-end">
                    <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-14 px-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 min-w-[280px] gap-3">
                        {isProcessing ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                        تأكيد وحفظ حركات شهر {month}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    </div>
  );
}
