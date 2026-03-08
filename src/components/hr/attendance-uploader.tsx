
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
import { Loader2, Upload, FileCheck, AlertTriangle, DownloadCloud, Save, Sparkles, CalendarDays } from 'lucide-react';
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

        const dateFormats = ['yyyy-MM-dd', 'dd-MM-yyyy', 'dd/MM/yyyy', 'yy-MM-dd', 'dd-MM-yy'];
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
  const [processingResult, setProcessingResult] = useState<{ success: boolean, message: string } | null>(null);
  
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
    if (!file || !firestore) return;

    setIsProcessing(true);
    setProcessingResult(null);

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

        json.forEach(row => {
            const emp = employeeMap.get(String(row.employeeNumber));
            if (!emp?.id) return;

            const parsed = parseSmartDateTime(row.date) || parseSmartDateTime(row.time);
            if (!parsed) return;

            const dateKey = `${emp.id}_${parsed.date.getTime()}`;
            const existing = punchesMap.get(dateKey) || { date: parsed.date, employeeId: emp.id, times: [] };

            if (parsed.timeStr && !existing.times.includes(parsed.timeStr)) {
                existing.times.push(parsed.timeStr);
            }
            punchesMap.set(dateKey, existing);
        });

        const batch = writeBatch(firestore);
        const groupedUpdates = new Map<string, any[]>();
        
        punchesMap.forEach((entry) => {
            const emp = employeeMap.get(employees.find(e => e.id === entry.employeeId)?.employeeNumber || '');
            const sortedPunches = entry.times.sort();
            
            // ✨ محرك كشف رمضان الذكي (يوم بيوم)
            const ramadan = branding?.work_hours?.ramadan;
            const ramStart = toFirestoreDate(ramadan?.start_date);
            const ramEnd = toFirestoreDate(ramadan?.end_date);
            
            const isRamadanDay = ramadan?.is_enabled && ramStart && ramEnd && 
                                 entry.date >= startOfDay(ramStart) && 
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

            const docKey = `${entry.date.getFullYear()}-${entry.date.getMonth() + 1}-${entry.employeeId}`;
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
                year: parseInt(docId.split('-')[0]),
                month: parseInt(docId.split('-')[1]),
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
        setProcessingResult({ success: true, message: `تم تحليل البيانات بنجاح. تم رصد الانتقال الزمني لرمضان آلياً.` });
        toast({ title: 'نجاح الحفظ', description: 'تمت معالجة وسم التأخير لكل يوم بدقة.' });
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
                    <CardTitle className="text-lg flex items-center gap-2">
                        <DownloadCloud className="h-5 w-5 text-primary" />
                        تجهيز الملف
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <Button onClick={handleDownloadTemplate} variant="outline" className="w-full h-11 rounded-xl border-dashed border-primary/30 text-primary font-bold">تنزيل نموذج الرفع</Button>
                </CardContent>
            </Card>

            <Alert className="rounded-2xl border-orange-100 bg-orange-50/50">
                <Sparkles className="h-4 w-4 text-orange-600" />
                <AlertTitle className="font-black">ملاحظة الانتقال الزمني</AlertTitle>
                <AlertDescription className="text-[10px] leading-relaxed font-bold">
                    النظام الآن "يتحسس" تاريخ كل بصمة؛ إذا صادف يوم 18/02/2026 (بداية رمضان)، سيقوم تلقائياً بتغيير معيار التأخير لهذا اليوم وما يليه دون تدخل منك.
                </AlertDescription>
            </Alert>
        </div>

        <div className="lg:col-span-2">
            <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-muted/30 border-b pb-8 px-8">
                    <CardTitle className="text-xl font-black">رفع ملف البصمة</CardTitle>
                    <CardDescription>المحرك سيعالج كل يوم بمفرده لضمان دقة احتساب التأخير في أيام الانتقال لرمضان.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <div onClick={() => !isProcessing && fileInputRef.current?.click()} className={cn("border-4 border-dashed rounded-[2rem] p-12 text-center cursor-pointer transition-all", isProcessing ? "opacity-50" : "hover:border-primary/50 hover:bg-primary/[0.02]")}>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls" />
                        <div className="p-4 bg-muted rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                            {isProcessing ? <Loader2 className="h-10 w-10 text-primary animate-spin" /> : <Upload className="h-10 w-10 text-muted-foreground opacity-40" />}
                        </div>
                        <div className="mt-6">
                            <p className="text-lg font-black text-primary">{file ? file.name : "اسحب الملف هنا"}</p>
                            {file && <p className="text-sm font-bold text-green-600 mt-2">الملف جاهز للتحليل</p>}
                        </div>
                    </div>
                    {processingResult && (
                        <Alert className={cn("mt-6 rounded-2xl border-2", processingResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50")}>
                            <AlertTitle className="font-black">{processingResult.success ? "نجاح المعالجة" : "خطأ"}</AlertTitle>
                            <AlertDescription className="font-bold text-sm">{processingResult.message}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter className="p-8 bg-muted/10 border-t flex justify-end">
                    <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-14 px-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 min-w-[280px] gap-3">
                        {isProcessing ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                        تأكيد وحفظ الحركات
                    </Button>
                </CardFooter>
            </Card>
        </div>
    </div>
  );
}
