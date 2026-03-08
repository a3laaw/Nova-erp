'use client';

import { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Loader2, Upload, FileCheck, AlertTriangle, DownloadCloud, ListFilter, Save, Sparkles, Clock } from 'lucide-react';
import type { Employee, MonthlyAttendance } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { parse, format, isSameDay, isValid, compareAsc, startOfDay } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../ui/card';
import { toFirestoreDate } from '@/services/date-converter';
import { cn, cleanFirestoreData } from '@/lib/utils';

/**
 * دالة ذكية لتحليل التاريخ والوقت من الإكسل
 * تدعم التاريخ المنفصل، الوقت المنفصل، أو التاريخ والوقت المدمج في خلية واحدة
 */
const parseSmartDateTime = (val: any): { date: Date, timeStr: string } | null => {
    if (val === undefined || val === null || val === '') return null;

    let dateObj: Date | null = null;
    let timeStr: string = "";

    // إذا كان كائن تاريخ JS أصلاً
    if (val instanceof Date && isValid(val)) {
        dateObj = startOfDay(val);
        timeStr = format(val, 'HH:mm');
        return { date: dateObj, timeStr };
    }

    // إذا كان رقم إكسل تسلسلي (Excel Serial Number)
    if (typeof val === 'number') {
        const date = XLSX.SSF.parse_date_code(val);
        dateObj = new Date(date.y, date.m - 1, date.d);
        timeStr = `${String(date.h).padStart(2, '0')}:${String(date.m).padStart(2, '0')}`;
        return { date: dateObj, timeStr };
    }

    // إذا كان نصاً (String) - مثل الصورة المقدمة "16-02-26 10:05"
    if (typeof val === 'string') {
        const cleaned = val.trim();
        // محاولة فصل التاريخ عن الوقت إذا كانا معاً
        const parts = cleaned.split(/\s+/); // تقسيم بالفراغ
        
        const datePart = parts[0];
        const timePart = parts[1] || "";

        // محاولة تحليل الجزء الخاص بالتاريخ
        const dateFormats = ['yyyy-MM-dd', 'dd-MM-yyyy', 'dd/MM/yyyy', 'yy-MM-dd', 'dd-MM-yy'];
        for (const fmt of dateFormats) {
            const parsed = parse(datePart, fmt, new Date());
            if (isValid(parsed)) {
                dateObj = startOfDay(parsed);
                break;
            }
        }

        // إذا لم نجد تاريخاً صالحاً، قد يكون التاريخ في الخلية والوقت في أخرى
        if (!dateObj) {
            const native = new Date(cleaned);
            if (isValid(native)) {
                dateObj = startOfDay(native);
                timeStr = format(native, 'HH:mm');
            }
        } else if (timePart) {
            // إذا وجدنا الوقت مدمجاً في نفس النص
            timeStr = timePart.substring(0, 5); // نأخذ HH:mm فقط
        }

        if (dateObj) return { date: dateObj, timeStr };
    }

    return null;
};

export function AttendanceUploader() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<{ success: boolean, message: string } | null>(null);
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
      setProcessingResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setProcessingResult(null);
    }
  };

  const handleDownloadTemplate = () => {
    if (employeesLoading) {
      toast({ title: 'الرجاء الانتظار', description: 'جاري تحميل قائمة الموظفين.' });
      return;
    }
    
    const templateData = employees.map(emp => ({
        employeeNumber: emp.employeeNumber,
        employeeName: emp.fullName, 
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        status: 'C/In'
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
        
        // ✨ مرحلة تجميع كافة الحركات (Punches) لكل موظف في كل يوم
        // مفتاح الخريطة: employeeId_dateTimestamp
        const punchesMap = new Map<string, { date: Date, employeeId: string, times: string[] }>();

        json.forEach(row => {
            const emp = employeeMap.get(String(row.employeeNumber));
            if (!emp?.id) return;

            // التحليل الذكي للخلية (قد تحتوي على تاريخ ووقت مدمجين)
            const parsed = parseSmartDateTime(row.date) || parseSmartDateTime(row.time);
            if (!parsed) return;

            const dateKey = `${emp.id}_${parsed.date.getTime()}`;
            const existing = punchesMap.get(dateKey) || {
                date: parsed.date,
                employeeId: emp.id,
                times: [],
            };

            // إضافة الوقت المكتشف في هذا السطر (سواء كان مدمجاً أو في عمود منفصل)
            // إذا كان الملف يحتوي على عمود وقت صريح نأخذ منه أيضاً
            let punchTime = parsed.timeStr;
            const extraTime = parseSmartDateTime(row.time)?.timeStr;
            if (extraTime) punchTime = extraTime;

            if (punchTime && !existing.times.includes(punchTime)) {
                existing.times.push(punchTime);
            }

            punchesMap.set(dateKey, existing);
        });

        // تصنيف السطور المدمجة حسب الشهر والموظف وتوزيعها زمنياً
        const groupedUpdates = new Map<string, any[]>();
        
        punchesMap.forEach((entry) => {
            // ترتيب البصمات زمنياً لليوم الواحد
            const sortedPunches = entry.times.sort();
            
            const mergedRecord = {
                date: entry.date,
                employeeId: entry.employeeId,
                checkIn1: sortedPunches[0] || null,
                checkOut1: sortedPunches[1] || null,
                checkIn2: sortedPunches[2] || null,
                checkOut2: sortedPunches[sortedPunches.length - 1] === sortedPunches[2] ? null : sortedPunches[sortedPunches.length - 1],
            };

            const docKey = `${entry.date.getFullYear()}-${entry.date.getMonth() + 1}-${entry.employeeId}`;
            if (!groupedUpdates.has(docKey)) groupedUpdates.set(docKey, []);
            groupedUpdates.get(docKey)!.push(mergedRecord);
        });

        const batch = writeBatch(firestore);
        
        for (const [docId, newRecords] of groupedUpdates.entries()) {
            const docRef = doc(firestore, 'attendance', docId);
            const existingDoc = await getDoc(docRef);
            let finalRecords = existingDoc.exists() ? (existingDoc.data().records || []) : [];

            // تحويل التواريخ المخزنة إلى كائنات JS للمقارنة
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
                    absentDays: finalRecords.filter((r: any) => !r.checkIn1).length,
                    totalDays: finalRecords.length
                },
                updatedAt: serverTimestamp()
            }), { merge: true });
        }

        await batch.commit();
        setProcessingResult({ success: true, message: `نجح التحليل الذكي وتم دمج الحركات زمنياً لعدد ${groupedUpdates.size} سجلات.` });
        toast({ title: 'نجاح المزامنة', description: 'تم التعرف على التوقيت المدمج وترتيب البصمات آلياً.' });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

      } catch (error: any) {
        setProcessingResult({ success: false, message: error.message });
        toast({ variant: 'destructive', title: 'خطأ', description: error.message });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file!);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start" dir="rtl">
        <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <DownloadCloud className="h-5 w-5 text-primary" />
                        نموذج الإدخال
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <p className="text-[10px] text-muted-foreground font-bold leading-relaxed">
                        استخدم هذا الزر لتوليد نموذج يحتوي على بيانات الموظفين فقط إذا كنت ستقوم بالإدخال اليدوي. أما إذا كان لديك ملف من جهاز البصمة، فيمكنك رفعه مباشرة.
                    </p>
                    <Button onClick={handleDownloadTemplate} variant="outline" className="w-full h-11 rounded-xl border-dashed border-primary/30 text-primary font-bold gap-2">
                        تنزيل نموذج فارغ
                    </Button>
                </CardContent>
            </Card>

            <Alert className="rounded-2xl border-blue-100 bg-blue-50/50">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800 font-black">المحرك الذكي نشط</AlertTitle>
                <AlertDescription className="text-blue-700 text-[10px] leading-relaxed font-bold">
                    النظام يتعرف تلقائياً على (التاريخ + الوقت) حتى لو كانا في خانة واحدة. كما يقوم بترتيب البصمات زمنياً لليوم الواحد.
                </AlertDescription>
            </Alert>
        </div>

        <div className="lg:col-span-2">
            <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-muted/30 border-b pb-8 px-8">
                    <CardTitle className="text-xl font-black">مركز الرفع والتحليل اللحظي</CardTitle>
                    <CardDescription className="text-base">اسحب ملف البصمة الخام هنا وسيتولى النظام فرزه وتوزيعه.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className="group border-4 border-dashed rounded-[2rem] p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/[0.02] transition-all duration-300"
                    >
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls" />
                        <div className="p-4 bg-muted rounded-full w-20 h-20 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="h-10 w-10 text-muted-foreground opacity-40 group-hover:text-primary group-hover:opacity-100" />
                        </div>
                        {file ? (
                            <div className="mt-6">
                                <p className="text-lg font-black text-primary">{file.name}</p>
                                <p className="text-xs text-muted-foreground font-bold italic">جاري فحص الحركات زمنياً...</p>
                            </div>
                        ) : (
                            <div className="mt-6">
                                <p className="text-base font-bold text-muted-foreground">اسحب ملف الإكسل هنا</p>
                                <p className="text-xs text-muted-foreground/60">أو اضغط لاختيار ملف</p>
                            </div>
                        )}
                    </div>

                    {processingResult && (
                        <Alert variant={processingResult.success ? 'default' : 'destructive'} className={cn("rounded-2xl border-2", processingResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200")}>
                            {processingResult.success ? <FileCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                            <AlertTitle className="font-black">{processingResult.success ? 'نجاح المعالجة' : 'خطأ'}</AlertTitle>
                            <AlertDescription className="font-bold text-sm">{processingResult.message}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter className="p-8 bg-muted/10 border-t flex justify-end">
                    <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-14 px-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 min-w-[280px] gap-3">
                        {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                        {isProcessing ? 'جاري الدمج والحساب...' : 'تأكيد وحفظ السجلات'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    </div>
  );
}
