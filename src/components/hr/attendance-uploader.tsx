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
import { Loader2, Upload, FileCheck, AlertTriangle } from 'lucide-react';
import type { Employee, MonthlyAttendance } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

// Expected columns in the Excel file
const EXPECTED_COLUMNS = ['employeeNumber', 'date', 'checkIn', 'checkOut'];

export function AttendanceUploader() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<{ success: boolean, message: string } | null>(null);
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
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

        // Validate columns
        const firstRow = json[0];
        if (!firstRow || !EXPECTED_COLUMNS.every(col => col in firstRow)) {
            throw new Error(`الملف يجب أن يحتوي على الأعمدة التالية: ${EXPECTED_COLUMNS.join(', ')}`);
        }

        const employeeMap = new Map(employees.map(emp => [String(emp.employeeNumber), emp.id]));
        const attendanceByEmployee = new Map<string, { records: any[], summary: any }>();
        
        json.forEach(row => {
            const employeeId = employeeMap.get(String(row.employeeNumber));
            if (employeeId) {
                if (!attendanceByEmployee.has(employeeId)) {
                    attendanceByEmployee.set(employeeId, {
                        records: [],
                        summary: { presentDays: 0, absentDays: 0, lateDays: 0, leaveDays: 0, totalDays: 0 }
                    });
                }
                const attendanceData = attendanceByEmployee.get(employeeId)!;
                // Simple status logic for demonstration
                const status = (row.checkIn || row.checkOut) ? 'present' : 'absent';
                
                attendanceData.records.push({
                    date: new Date((row.date - (25567 + 1)) * 86400 * 1000), // Convert Excel date
                    checkIn: row.checkIn || null,
                    checkOut: row.checkOut || null,
                    status: status
                });

                if (status === 'present') attendanceData.summary.presentDays++;
                else attendanceData.summary.absentDays++;
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
      <Button onClick={handleUpload} disabled={!file || isProcessing}>
        {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
        {isProcessing ? 'جاري المعالجة...' : 'رفع ومعالجة الملف'}
      </Button>

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
