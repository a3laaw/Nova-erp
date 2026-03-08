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
import { Loader2, Upload, FileCheck, AlertTriangle, DownloadCloud, ListFilter, Save, Sparkles } from 'lucide-react';
import type { Employee, MonthlyAttendance } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { parse, format, isSameDay, isValid } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../ui/card';
import { toFirestoreDate } from '@/services/date-converter';
import { cn } from '@/lib/utils';

/**
 * دالة مساعدة لتحويل تاريخ الإكسل (رقم أو نص) إلى تاريخ JS صحيح
 */
const parseExcelDate = (dateVal: any): Date | null => {
    if (!dateVal) return null;
    
    // إذا كان التاريخ بصيغة رقم (Excel Serial Number)
    if (typeof dateVal === 'number') {
        return new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    }
    
    // إذا كان نصاً، نحاول تحليله بعدة صيغ
    if (typeof dateVal === 'string') {
        const formats = ['yyyy-MM-dd', 'dd/MM/yyyy', 'dd-MM-yyyy'];
        for (const fmt of formats) {
            const parsed = parse(dateVal, fmt, new Date());
            if (isValid(parsed)) return parsed;
        }
        const native = new Date(dateVal);
        if (isValid(native)) return native;
    }
    
    return null;
};

const parseExcelTime = (excelTime: any): { hours: number, minutes: number } | null => {
    if (excelTime === undefined || excelTime === null || excelTime === '') return null;
    
    if (typeof excelTime === 'number' && excelTime >= 0 && excelTime < 1) {
        const date = XLSX.SSF.parse_date_code(excelTime);
        return { hours: date.h, minutes: date.m };
    }
    
    if (typeof excelTime === 'string' && excelTime.includes(':')) {
        const [h, m] = excelTime.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
            return { hours: h, minutes: m };
        }
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
    
    // توليد نموذج يحتوي على أيام الشهر المختار لتسهيل العمل على المستخدم
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const templateData: any[] = [];

    employees.forEach(emp => {
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = format(new Date(parseInt(year), parseInt(month) - 1, d), 'yyyy-MM-dd');
            templateData.push({
                employeeNumber: emp.employeeNumber,
                employeeName: emp.fullName, 
                date: dateStr,
                checkIn1: '',
                checkOut1: '',
                checkIn2: '',
                checkOut2: '',
            });
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
    
    XLSX.writeFile(workbook, `Attendance_Template_${year}-${month}.xlsx`);
  };

  const handleUpload = async () => {
    if (!file || !firestore) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار ملف لرفعه.' });
      return;
    }

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
        
        // هيكل البيانات المجمعة: [الشهر-السنة-الموظف] -> [سجلات]
        const groupedUpdates = new Map<string, any[]>();
        
        json.forEach(row => {
            const emp = employeeMap.get(String(row.employeeNumber));
            if (!emp?.id) return;

            const rowDate = parseExcelDate(row.date);
            if (!rowDate || !isValid(rowDate)) return;

            const t1 = parseExcelTime(row.checkIn1);
            const t2 = parseExcelTime(row.checkOut1);
            const t3 = parseExcelTime(row.checkIn2);
            const t4 = parseExcelTime(row.checkOut2);

            let status: 'present' | 'absent' | 'late' = t1 ? 'present' : 'absent';
            if (t1 && emp.workStartTime) {
                const workStart = parse(emp.workStartTime, 'HH:mm', new Date());
                const checkIn = new Date(0, 0, 0, t1.hours, t1.minutes);
                if (checkIn > workStart) status = 'late';
            }

            const record = {
                date: rowDate,
                checkIn1: t1 ? `${String(t1.hours).padStart(2, '0')}:${String(t1.minutes).padStart(2, '0')}` : null,
                checkOut1: t2 ? `${String(t2.hours).padStart(2, '0')}:${String(t2.minutes).padStart(2, '0')}` : null,
                checkIn2: t3 ? `${String(t3.hours).padStart(2, '0')}:${String(t3.minutes).padStart(2, '0')}` : null,
                checkOut2: t4 ? `${String(t4.hours).padStart(2, '0')}:${String(t4.minutes).padStart(2, '0')}` : null,
                status
            };

            const docKey = `${rowDate.getFullYear()}-${rowDate.getMonth() + 1}-${emp.id}`;
            if (!groupedUpdates.has(docKey)) groupedUpdates.set(docKey, []);
            groupedUpdates.get(docKey)!.push(record);
        });

        const batch = writeBatch(firestore);
        
        for (const [docId, newRecords] of groupedUpdates.entries()) {
            const [yearStr, monthStr, employeeId] = docId.split('-');
            const docRef = doc(firestore, 'attendance', docId);
            
            const existingDoc = await getDoc(docRef);
            let mergedRecords = existingDoc.exists() ? (existingDoc.data().records || []) : [];

            // تحويل التواريخ القادمة من Firestore إلى كائنات Date للمقارنة
            mergedRecords = mergedRecords.map((r: any) => ({ ...r, date: toFirestoreDate(r.date) }));

            newRecords.forEach(newItem => {
                const existingIdx = mergedRecords.findIndex((r: any) => r.date && isSameDay(r.date, newItem.date));
                if (existingIdx > -1) mergedRecords[existingIdx] = newItem;
                else mergedRecords.push(newItem);
            });

            // إعادة حساب الملخص بناءً على السجلات المدمجة
            const summary = {
                presentDays: mergedRecords.filter((r: any) => r.status === 'present' || r.status === 'late').length,
                absentDays: mergedRecords.filter((r: any) => r.status === 'absent').length,
                lateDays: mergedRecords.filter((r: any) => r.status === 'late').length,
                totalDays: mergedRecords.length
            };

            batch.set(docRef, {
                employeeId,
                year: parseInt(yearStr),
                month: parseInt(monthStr),
                records: mergedRecords,
                summary,
                updatedAt: serverTimestamp()
            }, { merge: true });
        }

        await batch.commit();
        setProcessingResult({ success: true, message: `تم تحليل الملف بنجاح وتحديث ${groupedUpdates.size} سجلات شهرية للموظفين.` });
        toast({ title: 'نجاح التحليل الذكي', description: 'تم توزيع البيانات على الأشهر والموظفين حسب التواريخ المكتوبة في الملف.' });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

      } catch (error: any) {
        setProcessingResult({ success: false, message: error.message });
        toast({ variant: 'destructive', title: 'خطأ في التحليل', description: error.message });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file!);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start" dir="rtl">
        <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ListFilter className="h-5 w-5 text-primary" />
                        تجهيز نموذج الإدخال
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <p className="text-xs text-muted-foreground font-bold leading-relaxed">
                        اختر الشهر المُراد تعبئة بياناته لتوليد ملف إكسل جاهز بأسماء الموظفين وتواريخ الشهر بالكامل.
                    </p>
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold text-muted-foreground">السنة</Label>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold text-muted-foreground">الشهر</Label>
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Button onClick={handleDownloadTemplate} variant="outline" className="w-full h-12 rounded-xl border-dashed border-primary/30 text-primary font-bold gap-2 hover:bg-primary/5">
                        <DownloadCloud className="h-5 w-5" />
                        تنزيل نموذج الشهر المختار
                    </Button>
                </CardContent>
            </Card>

            <Alert className="rounded-2xl border-indigo-100 bg-indigo-50/50">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <AlertTitle className="text-indigo-800 font-black">التحليل الذكي (Smart Sync)</AlertTitle>
                <AlertDescription className="text-indigo-700 text-[10px] leading-relaxed font-bold">
                    ارفع أي ملف يحتوي على أي تواريخ؛ سيقوم النظام بفرز السطور وتوجيهها للموظف والشهر المناسب في قاعدة البيانات تلقائياً.
                </AlertDescription>
            </Alert>
        </div>

        <div className="lg:col-span-2">
            <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-muted/30 border-b pb-8 px-8">
                    <CardTitle className="text-xl font-black">مركز الرفع والتحليل التلقائي</CardTitle>
                    <CardDescription className="text-base">اسحب الملف هنا ليقوم "محرك الذكاء" بتصنيف البيانات وتوزيعها زمنياً.</CardDescription>
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
                            <div className="mt-6 space-y-1">
                                <p className="text-lg font-black text-primary">{file.name}</p>
                                <p className="text-xs text-muted-foreground font-bold italic">الملف بانتظار التحليل الزمني وتوزيع السجلات...</p>
                            </div>
                        ) : (
                            <div className="mt-6 space-y-1">
                                <p className="text-base font-bold text-muted-foreground">اسحب وأفلت ملف البصمة هنا</p>
                                <p className="text-xs text-muted-foreground/60">أو اضغط لاختيار ملف من جهازك</p>
                            </div>
                        )}
                    </div>

                    {processingResult && (
                        <Alert variant={processingResult.success ? 'default' : 'destructive'} className={cn("rounded-2xl border-2 animate-in zoom-in-95", processingResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200")}>
                            {processingResult.success ? <FileCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                            <AlertTitle className="font-black">{processingResult.success ? 'نجاح التحليل والمزامنة' : 'خطأ في معالجة الملف'}</AlertTitle>
                            <AlertDescription className="font-bold text-sm">{processingResult.message}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter className="p-8 bg-muted/10 border-t flex justify-end">
                    <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-14 px-16 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 min-w-[320px] gap-3">
                        {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                        {isProcessing ? 'جاري تحليل وتوزيع البيانات...' : 'اعتماد السجلات والمزامنة الحية'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    </div>
  );
}
