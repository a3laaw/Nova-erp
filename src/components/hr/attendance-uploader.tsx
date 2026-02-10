'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Loader2, Upload, FileCheck, AlertTriangle, DownloadCloud } from 'lucide-react';
import type { Employee, MonthlyAttendance } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { parse } from 'date-fns';

// Expected columns in the Excel file
const EXPECTED_COLUMNS = ['employeeNumber', 'date', 'checkIn1', 'checkOut1', 'checkIn2', 'checkOut2'];

const parseExcelTime = (excelTime: any): { hours: number, minutes: number } | null => {
    if (typeof excelTime !== 'number' || excelTime < 0 || excelTime > 1) {
        // If it's a string like '08:00', try parsing it
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

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<{ success: boolean, message: string } | null>(null);
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    if (employeesLoading) {
      toast({
        title: 'الرجاء الانتظار',
        description: 'جاري تحميل قائمة الموظفين.',
      });
      return;
    }
    if (employees.length === 0) {
      toast({
        variant: 'destructive',
        title: 'لا يوجد موظفون',
        description: 'لا يوجد موظفون نشطون لإنشاء نموذج لهم.',
      });
      return;
    }

    const templateData = employees.map(emp => ({
        employeeNumber: emp.employeeNumber,
        date: '',
        checkIn1: '',
        checkOut1: '',
        checkIn2: '',
        checkOut2: '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    worksheet['!cols'] = [
      { wch: 20 }, // employeeNumber
      { wch: 15 }, // date
      { wch: 15 }, // checkIn1
      { wch: 15 }, // checkOut1
      { wch: 15 }, // checkIn2
      { wch: 15 }, // checkOut2
    ];

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

        const firstRow = json[0];
        if (!firstRow || !EXPECTED_COLUMNS.every(col => col in firstRow)) {
            throw new Error(`الملف يجب أن يحتوي على الأعمدة التالية باللغة الإنجليزية: ${EXPECTED_COLUMNS.join(', ')}`);
        }

        const employeeMap = new Map(employees.map(emp => [String(emp.employeeNumber), emp]));
        const attendanceByEmployee = new Map<string, { records: any[], summary: any }>();
        
        json.forEach(row => {
            const employee = employeeMap.get(String(row.employeeNumber));
            if (employee && employee.id) {
                if (!attendanceByEmployee.has(employee.id)) {
                    attendanceByEmployee.set(employee.id, {
                        records: [],
                        summary: { presentDays: 0, absentDays: 0, lateDays: 0, leaveDays: 0, totalDays: 0 }
                    });
                }
                const attendanceData = attendanceByEmployee.get(employee.id)!;
                
                const t1 = parseExcelTime(row.checkIn1);
                const t2 = parseExcelTime(row.checkOut1);
                const t3 = parseExcelTime(row.checkIn2);
                const t4 = parseExcelTime(row.checkOut2);
                
                let totalWorkMinutes = 0;
                if (t1 && t4) {
                    const date1 = new Date(0, 0, 0, t1.hours, t1.minutes);
                    const date4 = new Date(0, 0, 0, t4.hours, t4.minutes);
                    let duration = (date4.getTime() - date1.getTime()) / (1000 * 60);

                    if (t2 && t3) {
                        const date2 = new Date(0, 0, 0, t2.hours, t2.minutes);
                        const date3 = new Date(0, 0, 0, t3.hours, t3.minutes);
                        const breakDuration = (date3.getTime() - date2.getTime()) / (1000 * 60);
                        if (breakDuration > 0) {
                            duration -= breakDuration;
                        }
                    }
                    totalWorkMinutes = duration;
                } else if (t1 && t2) { // Handles case with only 2 check-ins
                    const date1 = new Date(0, 0, 0, t1.hours, t1.minutes);
                    const date2 = new Date(0, 0, 0, t2.hours, t2.minutes);
                    totalWorkMinutes = (date2.getTime() - date1.getTime()) / (1000 * 60);
                }

                let status: 'present' | 'absent' | 'late' | 'leave' = 'absent';
                if (t1) {
                    status = 'present';
                    if (employee.workStartTime) {
                        try {
                            const workStartTime = parse(employee.workStartTime, 'HH:mm', new Date());
                            const checkInTime = new Date(0, 0, 0, t1.hours, t1.minutes);
                            if (checkInTime > workStartTime) {
                                status = 'late';
                            }
                        } catch (timeError) {
                            console.warn("Could not parse time for lateness check", { checkInValue: row.checkIn1, workStartTime: employee.workStartTime });
                        }
                    }
                }

                const formatTime = (time: { hours: number, minutes: number } | null) => {
                    if (!time) return null;
                    return `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`;
                };

                attendanceData.records.push({
                    date: new Date((row.date - (25567 + 1)) * 86400 * 1000), // Convert Excel date
                    checkIn1: formatTime(t1),
                    checkOut1: formatTime(t2),
                    checkIn2: formatTime(t3),
                    checkOut2: formatTime(t4),
                    totalHours: totalWorkMinutes > 0 ? parseFloat((totalWorkMinutes / 60).toFixed(2)) : null,
                    status: status
                });

                if (status === 'present') attendanceData.summary.presentDays++;
                else if (status === 'late') {
                    attendanceData.summary.presentDays++;
                    attendanceData.summary.lateDays++;
                }
                else if (status === 'absent') attendanceData.summary.absentDays++;
                attendanceData.summary.totalDays++;
            }
        });
        
        const batch = writeBatch(firestore);
        
        for (const [employeeId, data] of attendanceByEmployee.entries()) {
            const docId = `${year}-${month}-${employeeId}`;
            const docRef = doc(firestore, 'attendance', docId);
            const attendanceDoc: Omit<MonthlyAttendance, 'id'> = {
                employeeId,
                year: parseInt(year),
                month: parseInt(month),
                records: data.records,
                summary: data.summary,
            };
            batch.set(docRef, attendanceDoc, { merge: true });
        }

        await batch.commit();

        setProcessingResult({ success: true, message: `تمت معالجة و حفظ سجلات الحضور لـ ${attendanceByEmployee.size} موظف بنجاح.` });
        toast({ title: 'نجاح', description: 'تم رفع ملف الحضور بنجاح.' });
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'فشل في قراءة ومعالجة الملف.';
        setProcessingResult({ success: false, message });
        toast({ variant: 'destructive', title: 'خطأ', description: message });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };
  
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="grid gap-2">
            <Label htmlFor="year-select">السنة</Label>
            <Select value={year} onValueChange={setYear}>
                <SelectTrigger id="year-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
         <div className="grid gap-2">
            <Label htmlFor="month-select">الشهر</Label>
            <Select value={month} onValueChange={setMonth}>
                <SelectTrigger id="month-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
         <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="attendance-file">ملف الحضور (Excel)</Label>
            <Input id="attendance-file" type="file" onChange={handleFileChange} accept=".xlsx, .xls" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button onClick={handleUpload} disabled={!file || isProcessing}>
            {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
            {isProcessing ? 'جاري المعالجة...' : 'رفع ومعالجة الملف'}
        </Button>
        <Button onClick={handleDownloadTemplate} variant="outline" disabled={employeesLoading}>
            {employeesLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="ml-2 h-4 w-4" />}
            تنزيل النموذج الرسمي
        </Button>
      </div>

       <Alert variant="default" className="bg-blue-50 border-blue-200">
            <AlertTriangle className="h-4 w-4 !text-blue-600" />
            <AlertTitle className="text-blue-800">ملاحظة هامة</AlertTitle>
            <AlertDescription className="text-blue-700">
                النموذج الذي يتم تنزيله يحتوي على أسماء أعمدة باللغة الإنجليزية. هذه الأسماء ضرورية لعملية الرفع الآلي ويجب عدم تغييرها.
            </AlertDescription>
        </Alert>

      {processingResult && (
        <Alert variant={processingResult.success ? 'default' : 'destructive'} className={processingResult.success ? 'bg-green-50 border-green-200' : ''}>
            {processingResult.success ? <FileCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <AlertTitle>{processingResult.success ? 'نجاح' : 'خطأ'}</AlertTitle>
            <AlertDescription>{processingResult.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

