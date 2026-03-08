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
import { Loader2, Upload, FileCheck, AlertTriangle, DownloadCloud, Info, Calendar as CalendarIcon, ListFilter } from 'lucide-react';
import type { Employee, MonthlyAttendance } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { parse, format, isSameDay } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../ui/card';
import { toFirestoreDate } from '@/services/date-converter';
import { DateInput } from '../ui/date-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '@/lib/utils';

const EXPECTED_COLUMNS = ['employeeNumber', 'employeeName', 'date', 'checkIn1', 'checkOut1', 'checkIn2', 'checkOut2'];

const parseExcelTime = (excelTime: any): { hours: number, minutes: number } | null => {
    if (typeof excelTime !== 'number' || excelTime < 0 || excelTime > 1) {
        if (typeof excelTime === 'string' && excelTime.includes(':')) {
            const [h, m] = excelTime.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) {
                return { hours: h, minutes: m };
            }
        }
        return null;
    }
    const date = XLSX.SSF.parse_date_code(excelTime);
    return { hours: date.h, minutes: date.m };
};

export function AttendanceUploader() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [uploadMode, setUploadMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
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
    if (employees.length === 0) {
      toast({ variant: 'destructive', title: 'لا يوجد موظفون', description: 'لا يوجد موظفون نشطون لإنشاء نموذج لهم.' });
      return;
    }

    const templateData = employees.map(emp => ({
        employeeNumber: emp.employeeNumber,
        employeeName: emp.fullName, 
        date: uploadMode === 'daily' && selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
        checkIn1: '',
        checkOut1: '',
        checkIn2: '',
        checkOut2: '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
    const fileName = uploadMode === 'daily' && selectedDate 
        ? `Daily_Attendance_${format(selectedDate, 'yyyy-MM-dd')}.xlsx`
        : `Monthly_Attendance_${year}-${month}.xlsx`;
        
    XLSX.writeFile(workbook, fileName);
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

        if (!json[0] || !EXPECTED_COLUMNS.every(col => col in json[0])) {
            throw new Error(`تنسيق الملف غير صحيح. تأكد من استخدام النموذج الرسمي.`);
        }

        const employeeMap = new Map(employees.map(emp => [String(emp.employeeNumber), emp]));
        
        const newRecordsByEmployee = new Map<string, any[]>();
        json.forEach(row => {
            const emp = employeeMap.get(String(row.employeeNumber));
            if (!emp?.id) return;

            let rowDate: Date;
            if (typeof row.date === 'number') {
                rowDate = new Date((row.date - (25567 + 1)) * 86400 * 1000);
            } else {
                rowDate = new Date(row.date);
            }

            if (!isValidDate(rowDate)) return;

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

            if (!newRecordsByEmployee.has(emp.id)) newRecordsByEmployee.set(emp.id, []);
            newRecordsByEmployee.get(emp.id)!.push(record);
        });

        const batch = writeBatch(firestore);
        
        for (const [employeeId, newItems] of newRecordsByEmployee.entries()) {
            const sampleDate = newItems[0].date;
            const docYear = sampleDate.getFullYear();
            const docMonth = sampleDate.getMonth() + 1;
            const docId = `${docYear}-${docMonth}-${employeeId}`;
            const docRef = doc(firestore, 'attendance', docId);
            
            const existingDoc = await getDoc(docRef);
            let mergedRecords = existingDoc.exists() ? (existingDoc.data().records || []) : [];

            mergedRecords = mergedRecords.map((r: any) => ({ ...r, date: toFirestoreDate(r.date) }));

            newItems.forEach(newItem => {
                const existingIdx = mergedRecords.findIndex((r: any) => r.date && isSameDay(r.date, newItem.date));
                if (existingIdx > -1) mergedRecords[existingIdx] = newItem;
                else mergedRecords.push(newItem);
            });

            const summary = {
                presentDays: mergedRecords.filter((r: any) => r.status === 'present' || r.status === 'late').length,
                absentDays: mergedRecords.filter((r: any) => r.status === 'absent').length,
                lateDays: mergedRecords.filter((r: any) => r.status === 'late').length,
                totalDays: mergedRecords.length
            };

            batch.set(docRef, {
                employeeId,
                year: docYear,
                month: docMonth,
                records: mergedRecords,
                summary,
                updatedAt: serverTimestamp()
            }, { merge: true });
        }

        await batch.commit();
        setProcessingResult({ success: true, message: `تم تحديث بيانات الحضور لـ ${newRecordsByEmployee.size} موظف بنجاح.` });
        toast({ title: 'نجاح التحديث', description: 'تم دمج سجلات الحضور الجديدة في النظام.' });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

      } catch (error: any) {
        setProcessingResult({ success: false, message: error.message });
        toast({ variant: 'destructive', title: 'خطأ في الرفع', description: error.message });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file!);
  };

  const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('ar', { month: 'long' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start" dir="rtl">
        <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ListFilter className="h-5 w-5 text-primary" />
                        إعدادات نموذج الرفع
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="flex bg-muted p-1 rounded-xl border shadow-inner">
                        <Button 
                            variant="ghost" 
                            className={cn("flex-1 rounded-lg font-bold text-xs", uploadMode === 'daily' && "bg-white shadow-sm text-primary")}
                            onClick={() => setUploadMode('daily')}
                        >
                            رفع يومي
                        </Button>
                        <Button 
                            variant="ghost" 
                            className={cn("flex-1 rounded-lg font-bold text-xs", uploadMode === 'monthly' && "bg-white shadow-sm text-primary")}
                            onClick={() => setUploadMode('monthly')}
                        >
                            رفع شهري مجمع
                        </Button>
                    </div>

                    {uploadMode === 'daily' ? (
                        <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                            <Label className="font-bold text-xs pr-1">تاريخ اليوم المختار:</Label>
                            <DateInput value={selectedDate} onChange={setSelectedDate} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="grid gap-2">
                                <Label className="text-xs font-bold">السنة</Label>
                                <Select value={year} onValueChange={setYear}>
                                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs font-bold">الشهر</Label>
                                <Select value={month} onValueChange={setMonth}>
                                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <Button onClick={handleDownloadTemplate} variant="outline" className="w-full h-12 rounded-xl border-dashed border-primary/30 text-primary font-bold gap-2 hover:bg-primary/5">
                        <DownloadCloud className="h-5 w-5" />
                        تنزيل نموذج {uploadMode === 'daily' ? 'اليوم' : 'الشهر'}
                    </Button>
                </CardContent>
            </Card>

            <Alert className="rounded-2xl border-blue-100 bg-blue-50/50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800 font-bold">نظام الدمج الذكي</AlertTitle>
                <AlertDescription className="text-blue-700 text-xs leading-relaxed">
                    عند رفع ملف "يومي"، سيقوم النظام بتحديث سجل هذا اليوم فقط داخل كشف الموظف الشهري دون التأثير على بقية أيام الشهر.
                </AlertDescription>
            </Alert>
        </div>

        <div className="lg:col-span-2">
            <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-muted/30 border-b pb-8">
                    <CardTitle className="text-xl font-black">رفع ومعالجة الملف</CardTitle>
                    <CardDescription>اسحب ملف الإكسل المعبأ هنا ليتم تحديث أرصدة الحضور آلياً.</CardDescription>
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
                                <p className="text-xs text-muted-foreground font-bold">جاهز للرفع والمعالجة</p>
                            </div>
                        ) : (
                            <div className="mt-6 space-y-1">
                                <p className="text-base font-bold text-muted-foreground">اسحب وأفلت الملف هنا</p>
                                <p className="text-xs text-muted-foreground/60">أو اضغط لاختيار ملف من جهازك</p>
                            </div>
                        )}
                    </div>

                    {processingResult && (
                        <Alert variant={processingResult.success ? 'default' : 'destructive'} className={cn("rounded-2xl border-2 animate-in zoom-in-95", processingResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200")}>
                            {processingResult.success ? <FileCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                            <AlertTitle className="font-black">{processingResult.success ? 'نجاح المعالجة' : 'خطأ في الملف'}</AlertTitle>
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