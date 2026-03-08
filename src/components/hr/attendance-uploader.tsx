'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Loader2, Upload, FileCheck, AlertTriangle, DownloadCloud, Save, Sparkles, CalendarDays, Filter } from 'lucide-react';
import type { Employee, MonthlyAttendance } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { parse, format, isSameDay, isValid, compareAsc, startOfDay } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { cn, cleanFirestoreData } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
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

        const dateFormats = ['yyyy-MM-dd', 'dd-MM-yyyy', 'dd/MM/yyyy', 'yy-MM-dd', 'dd-MM-yy', 'M/d/yyyy', 'MM/dd/yyyy'];
        for (const fmt of dateFormats) {
            const parsed = parse(datePart, fmt, new Date());
            if (isValid(parsed)) {
                dateObj = startOfDay(parsed);
                break;
            }
        }

        if (!dateObj) {
            const native = new Date(cleaned);
            if (isValid(native)) {
                dateObj = startOfDay(native);
                timeStr = format(native, 'HH:mm');
            }
        } else if (timePart) {
            timeStr = timePart.substring(0, 5);
        }

        if (dateObj) return { date: dateObj, timeStr };
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
  const [processingResult, setProcessingResult] = useState<{ success: boolean, message: string, skippedCount?: number } | null>(null);
  
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
    const templateData = employees.map(emp => ({
        employeeNumber: emp.employeeNumber,
        employeeName: emp.fullName, 
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
    }));
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
    XLSX.writeFile(workbook, `Attendance_Template.xlsx`);
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
        const punchesMap = new Map<string, { date: Date, employeeId: string, times: string[] }>();
        let skippedCount = 0;

        json.forEach(row => {
            const emp = employeeMap.get(String(row.employeeNumber));
            if (!emp?.id) return;

            const parsed = parseSmartDateTime(row.date) || parseSmartDateTime(row.time);
            if (!parsed) return;

            // 🛡️ الرقابة: التحقق من مطابقة الشهر والسنة المختارة
            if (parsed.date.getFullYear() !== selectedYearNum || (parsed.date.getMonth() + 1) !== selectedMonthNum) {
                skippedCount++;
                return;
            }

            const dateKey = `${emp.id}_${parsed.date.getTime()}`;
            const existing = punchesMap.get(dateKey) || { date: parsed.date, employeeId: emp.id, times: [] };

            if (parsed.timeStr && !existing.times.includes(parsed.timeStr)) {
                existing.times.push(parsed.timeStr);
            }
            punchesMap.set(dateKey);
            punchesMap.set(dateKey, existing);
        });

        if (punchesMap.size === 0 && skippedCount > 0) {
            throw new Error(`لم يتم استيراد أي بيانات. جميع الأسطر في الملف (${skippedCount}) تخص شهوراً أخرى غير الشهر المختار (${selectedMonthNum}/${selectedYearNum}).`);
        }

        const batch = writeBatch(firestore);
        const groupedUpdates = new Map<string, any[]>();
        
        punchesMap.forEach((entry) => {
            const emp = employeeMap.get(employees.find(e => e.id === entry.employeeId)?.employeeNumber || '');
            const sortedPunches = entry.times.sort();
            
            const ramadan = branding?.work_hours?.ramadan;
            const ramStart = toFirestoreDate(ramadan?.start_date);
            const ramEnd = toFirestoreDate(ramadan?.end_date);
            
            const isRamadanDay = ramadan?.is_enabled && ramStart && ramEnd && 
                                 entry.date >= startOfToday() && 
                                 entry.date <= startOfDay(ramEnd);
            
            const effectiveWorkStart = isRamadanDay 
                ? (ramadan.start_time || '09:30') 
                : (emp?.workStartTime || branding?.work_hours?.general?.morning_start_time || '08:00');
            
            const isLate = sortedPunches[0] && sortedPunches[0] > effectiveWorkStart;

            const mergedRecord = {
                date: entry.date,
                employeeId: entry.employeeId,
                checkIn1: sortedPunches[0] || null,
                checkOut1: sortedPunches[sortedPunches.length - 1] || null,
                status: isLate ? 'late' : 'present',
                isRamadan: isRamadanDay
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
            message: `تم تحليل وحفظ البيانات بنجاح لـ ${punchesMap.size} بصمة صحيحة.`,
            skippedCount
        });
        toast({ title: 'نجاح الحفظ', description: `تمت المعالجة بنجاح. تم تجاهل ${skippedCount} سطر لا يخص شهر ${selectedMonthNum}.` });
        setFile(null);
      } catch (error: any) {
        setProcessingResult({ success: false, message: error.message });
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
                        <Filter className="h-5 w-5" />
                        إعدادات الفلترة
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div className="grid gap-2">
                        <Label className="font-bold">السنة المستهدفة</Label>
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
                        <Label className="font-bold">الشهر المستهدف</Label>
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
                    <Button onClick={handleDownloadTemplate} variant="outline" className="w-full h-11 rounded-xl border-dashed border-primary/30 text-primary font-bold">تنزيل نموذج الرفع</Button>
                </CardContent>
            </Card>

            <Alert className="rounded-2xl border-blue-100 bg-blue-50/50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="font-black">نظام الحماية من الخطأ</AlertTitle>
                <AlertDescription className="text-[10px] leading-relaxed font-bold">
                    إذا قمت برفع ملف يحتوي على تواريخ شهر 2 وأنت اخترت شهر 3، سيقوم النظام **تلقائياً بتجاهل** بصمات شهر 2 ولن يقوم بتخزينها لضمان نظافة البيانات.
                </AlertDescription>
            </Alert>
        </div>

        <div className="lg:col-span-2">
            <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-muted/30 border-b pb-8 px-8">
                    <CardTitle className="text-xl font-black">رفع ملف البصمة لشهر {month}/{year}</CardTitle>
                    <CardDescription>المحرك سيفلتر البيانات آلياً لضمان تخزين ما يخص الفترة المحددة فقط.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={cn("border-4 border-dashed rounded-[2rem] p-12 text-center cursor-pointer transition-all", isProcessing ? "opacity-50" : "hover:border-primary/50 hover:bg-primary/[0.02]")}>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls" />
                        <div className="p-4 bg-muted rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                            {isProcessing ? <Loader2 className="h-10 w-10 text-primary animate-spin" /> : <Upload className="h-10 w-10 text-muted-foreground opacity-40" />}
                        </div>
                        <div className="mt-6">
                            <p className="text-lg font-black text-primary">{file ? file.name : "اسحب الملف هنا"}</p>
                            {file && <p className="text-sm font-bold text-green-600 mt-2">الملف جاهز وبانتظار أمر التحليل</p>}
                        </div>
                    </div>
                    {processingResult && (
                        <div className="mt-6 space-y-3">
                            <Alert className={cn("rounded-2xl border-2", processingResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50")}>
                                <AlertTitle className="font-black">{processingResult.success ? "تمت المعالجة بنجاح" : "حدث خطأ"}</AlertTitle>
                                <AlertDescription className="font-bold text-sm">{processingResult.message}</AlertDescription>
                            </Alert>
                            
                            {processingResult.skippedCount! > 0 && (
                                <Alert className="rounded-2xl border-orange-200 bg-orange-50/50">
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                    <AlertTitle className="text-xs font-black">تنبيه رقابي</AlertTitle>
                                    <AlertDescription className="text-[10px] font-bold">
                                        تم اكتشاف **{processingResult.skippedCount}** سطر في الملف تخص شهوراً أخرى وتم تجاهلها آلياً.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="p-8 bg-muted/10 border-t flex justify-end">
                    <Button onClick={handleUpload} disabled={!file || isProcessing || !year || !month} className="h-14 px-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 min-w-[280px] gap-3">
                        {isProcessing ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                        تأكيد وحفظ حركات شهر {month}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    </div>
  );
}
