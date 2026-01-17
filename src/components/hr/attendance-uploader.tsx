'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, File, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import type { Employee, LeaveRequest, MonthlyAttendance, AttendanceRecord } from '@/lib/types';
import { getDaysInMonth, format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';


interface ExcelRow {
  'الرقم المدني': string;
  'التاريخ (YYYY-MM-DD)': string;
  'وقت الدخول (HH:MM)': string;
  'وقت الخروج (HH:MM)': string;
}

export function AttendanceUploader() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedData, setParsedData] = useState<ExcelRow[]>([]);
  const [ignoreCheckIn, setIgnoreCheckIn] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (
        selectedFile.type === 'application/vnd.ms-excel' ||
        selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        setFile(selectedFile);
        handleParseFile(selectedFile);
      } else {
        toast({
          variant: 'destructive',
          title: 'ملف غير صالح',
          description: 'الرجاء رفع ملف Excel بصيغة .xls أو .xlsx',
        });
      }
    }
  };

  const handleParseFile = (fileToParse: File) => {
    setIsParsing(true);
    setParsedData([]);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);
        
        // Validate headers
        const headers = Object.keys(json[0] || {});
        const requiredHeaders = ['الرقم المدني', 'التاريخ (YYYY-MM-DD)', 'وقت الدخول (HH:MM)', 'وقت الخروج (HH:MM)'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
            toast({
                variant: 'destructive',
                title: 'أعمدة ناقصة',
                description: `الملف لا يحتوي على الأعمدة المطلوبة: ${missingHeaders.join(', ')}`,
            });
            setFile(null);
            return;
        }

        setParsedData(json);
        toast({ title: 'نجاح', description: `تمت قراءة ${json.length} سجل بنجاح.` });
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'خطأ في القراءة', description: 'لم نتمكن من قراءة ملف Excel. تأكد من سلامته.' });
        setFile(null);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsBinaryString(fileToParse);
  };
  
  const handleSave = async () => {
    if (parsedData.length === 0) {
        toast({ variant: 'destructive', title: 'لا توجد بيانات', description: 'لا توجد بيانات للحفظ. الرجاء رفع ملف أولاً.' });
        return;
    }
     if (!firestore) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات.' });
      return;
    }
    setIsSaving(true);
    try {
        const monthlyData = new Map<string, { employeeId: string; year: number; month: number; civilId: string; records: ExcelRow[] }>();
        const civilIds = new Set<string>();

        parsedData.forEach(row => {
            const civilId = String(row['الرقم المدني']);
            const dateStr = row['التاريخ (YYYY-MM-DD)'];
            
            if (!civilId || !dateStr) return;

            try {
            const date = new Date(dateStr);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const key = `${year}-${month}-${civilId}`;

            civilIds.add(civilId);

            if (!monthlyData.has(key)) {
                monthlyData.set(key, { employeeId: '', year, month, civilId, records: [] });
            }
            monthlyData.get(key)!.records.push(row);
            } catch(e) {
            console.warn(`Skipping invalid date row: ${dateStr}`);
            }
        });

        if (civilIds.size === 0) {
            throw new Error("No valid records with Civil IDs found in the file.");
        }
        
        const employeesRef = collection(firestore, 'employees');
        const q = query(employeesRef, where('civilId', 'in', Array.from(civilIds)));
        const employeesSnapshot = await getDocs(q);

        const civilIdToEmployeeMap = new Map<string, Employee>();
        employeesSnapshot.forEach(doc => {
            const emp = { id: doc.id, ...doc.data() } as Employee;
            civilIdToEmployeeMap.set(emp.civilId, emp);
        });
        
        const batch = writeBatch(firestore);

        for (const [key, data] of monthlyData.entries()) {
            const employee = civilIdToEmployeeMap.get(data.civilId);
            if (!employee || !employee.id) {
            console.warn(`No employee found for Civil ID: ${data.civilId}. Skipping ${data.records.length} records.`);
            continue;
            }
            
            data.employeeId = employee.id;

            const leavesRef = collection(firestore, 'leaveRequests');
            const leavesQuery = query(leavesRef, where('employeeId', '==', employee.id), where('status', '==', 'approved'));
            const leavesSnapshot = await getDocs(leavesQuery);
            const approvedLeaveDays = new Set<string>();
            leavesSnapshot.forEach(doc => {
                const leave = doc.data();
                if (leave.startDate && leave.endDate) {
                    const startDate = leave.startDate.toDate();
                    const endDate = leave.endDate.toDate();
                    for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
                        if(d.getFullYear() === data.year && d.getMonth() + 1 === data.month) {
                            approvedLeaveDays.add(format(d, 'yyyy-MM-dd'));
                        }
                    }
                }
            });

            const totalDaysInMonth = getDaysInMonth(new Date(data.year, data.month - 1));
            const processedRecords: AttendanceRecord[] = [];
            
            const recordsByDate = new Map<string, ExcelRow>();
            data.records.forEach(r => recordsByDate.set(r['التاريخ (YYYY-MM-DD)'], r));
            
            let presentDays = 0, absentDays = 0, lateDays = 0, leaveDays = 0;

            for (let day = 1; day <= totalDaysInMonth; day++) {
                const dateStr = format(new Date(data.year, data.month - 1, day), 'yyyy-MM-dd');
                
                if (approvedLeaveDays.has(dateStr)) {
                    processedRecords.push({ date: dateStr, status: 'leave' });
                    leaveDays++;
                    continue;
                }

                const record = recordsByDate.get(dateStr);
                const isPresent = ignoreCheckIn ? !!record : (record && record['وقت الدخول (HH:MM)'] && record['وقت الدخول (HH:MM)'] !== '-');
                
                if (isPresent) {
                    processedRecords.push({
                        date: dateStr,
                        checkIn: record?.['وقت الدخول (HH:MM)'],
                        checkOut: record?.['وقت الخروج (HH:MM)'],
                        status: 'present'
                    });
                    presentDays++;
                } else {
                    processedRecords.push({ date: dateStr, status: 'absent' });
                    absentDays++;
                }
            }
            
            const attendanceDoc: MonthlyAttendance = {
                employeeId: data.employeeId,
                year: data.year,
                month: data.month,
                records: processedRecords,
                summary: { totalDays: totalDaysInMonth, presentDays, absentDays, lateDays, leaveDays }
            };
            
            const docId = `${data.year}-${String(data.month).padStart(2, '0')}-${data.employeeId}`;
            const docRef = doc(firestore, 'attendance', docId);
            
            batch.set(docRef, attendanceDoc, { merge: true });
        }
        
        await batch.commit();

        toast({
            title: 'تم الحفظ بنجاح',
            description: `تمت معالجة وحفظ البيانات بنجاح.`
        });
        setFile(null);
        setParsedData([]);
    } catch(error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع.';
        toast({ variant: 'destructive', title: 'فشل الحفظ', description: errorMessage });
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>رفع سجلات الحضور</CardTitle>
        <CardDescription>
          ارفع ملف Excel يحتوي على سجلات الحضور والانصراف اليومية للموظفين.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
          <File className="mx-auto h-12 w-12 text-muted-foreground" />
          <Label htmlFor="attendance-file" className="block text-sm font-medium text-primary cursor-pointer hover:underline">
            {isParsing ? 'جاري قراءة الملف...' : (file ? `الملف المحدد: ${file.name}` : 'اختر ملف Excel (.xlsx, .xls)')}
          </Label>
          <Input id="attendance-file" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls" disabled={isParsing || isSaving} />
          <p className="text-xs text-muted-foreground">تأكد من أن الملف يحتوي على الأعمدة: الرقم المدني، التاريخ، وقت الدخول، وقت الخروج.</p>
        </div>
        
        <div className="flex items-center space-x-2" dir="rtl">
            <Checkbox id="ignoreCheckIn" checked={ignoreCheckIn} onCheckedChange={(checked) => setIgnoreCheckIn(checked as boolean)} />
            <Label htmlFor="ignoreCheckIn" className="cursor-pointer">
                اعتبار الموظف حاضرًا بمجرد وجود سجل له في اليوم (تجاهل وقت الدخول)
            </Label>
        </div>


        {parsedData.length > 0 && (
          <div className='space-y-4'>
             <h3 className="font-semibold">معاينة البيانات (أول 5 صفوف)</h3>
             <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {Object.keys(parsedData[0]).map(key => <TableHead key={key}>{key}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {parsedData.slice(0, 5).map((row, i) => (
                            <TableRow key={i}>
                                {Object.values(row).map((val, j) => <TableCell key={j}>{String(val)}</TableCell>)}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
             <p className='text-sm text-muted-foreground text-center'>... و {Math.max(0, parsedData.length - 5)} صفوف أخرى.</p>

             <div className='flex justify-end'>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    <Save className="ml-2 h-4 w-4" />
                    حفظ البيانات في قاعدة البيانات
                </Button>
             </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
