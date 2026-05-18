'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, updateDoc, Timestamp, orderBy, limit, collectionGroup, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { RefreshCw, Trash2, FileText, Loader2, ShieldCheck, History, FileSpreadsheet, Save } from 'lucide-react';
import type { Employee, MonthlyAttendance, AttendanceRecord, LeaveRequest, PermissionRequest, Holiday } from '@/lib/types';
import { parse, format, isValid, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isAfter, endOfDay } from 'date-fns';
import { cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { useAuth } from '@/context/auth-context';
import { toFirestoreDate } from '@/services/date-converter';
import { useRouter } from 'next/navigation';

const dayNameToIndex: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

const parseSmartDateTime = (val: any): { date: Date, timeStr: string } | null => {
    if (val === undefined || val === null || val === '') return null;
    let parsedDate: Date | null = null;
    let timeStr = "00:00";
    if (typeof val === 'number') {
        try {
            const excelDate = XLSX.SSF.parse_date_code(val);
            if (excelDate.y < 2000) return null;
            parsedDate = new Date(excelDate.y, excelDate.m - 1, excelDate.d, 12, 0, 0);
            timeStr = `${String(excelDate.h).padStart(2, '0')}:${String(excelDate.m).padStart(2, '0')}`;
        } catch { return null; }
    } else if (typeof val === 'string') {
        const cleaned = val.trim();
        const dateMatch = cleaned.match(/(\d{1,4}[-/\.]\d{1,2}[-/\.]\d{1,4})/);
        const timeMatch = cleaned.match(/(\d{1,2}:\d{2}(:\d{2})?(\s?[AaPp][Mm])?)/);
        if (dateMatch) {
            const formats = ['dd-MM-yyyy', 'd-M-yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 'd/M/yyyy', 'dd.MM.yyyy', 'dd-MM-yy', 'MM-dd-yyyy', 'MM/dd/yyyy'];
            for (const fmt of formats) {
                const p = parse(dateMatch[0], fmt, new Date());
                if (isValid(p) && p.getFullYear() >= 2000) {
                    parsedDate = new Date(p.getFullYear(), p.getMonth(), p.getDate(), 12, 0, 0);
                    break;
                }
            }
        }
        if (timeMatch) {
            const tStr = timeMatch[0].toUpperCase();
            const tp = parse(tStr, tStr.includes('M') ? 'hh:mm a' : 'HH:mm', new Date());
            if (isValid(tp)) timeStr = format(tp, 'HH:mm');
        }
    }
    return (parsedDate && isValid(parsedDate)) ? { date: parsedDate, timeStr } : null;
};

export function AttendanceUploader() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { branding } = useBranding();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const tenantId = currentUser?.currentCompanyId;

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { data: employees = [] } = useSubscription<Employee>(firestore, 'employees', [where('status', 'in', ['active', 'on-leave'])]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!firestore || !year || !month || !tenantId) return;
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const workbook = XLSX.read(e.target?.result, { type: 'binary' });
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            
            const monthStart = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
            const monthEnd = endOfMonth(monthStart);

            const [leavesSnap, permissionsSnap] = await Promise.all([
                getDocs(query(collection(firestore, getTenantPath('leaveRequests', tenantId)), where('status', 'in', ['approved', 'on-leave', 'returned']))),
                getDocs(query(collection(firestore, getTenantPath('permissionRequests', tenantId)), where('status', '==', 'approved')))
            ]);

            const employeeMap = new Map(employees.map(emp => [String(emp.employeeNumber), emp]));
            const excelPunches = new Map<string, Set<string>>(); 

            json.forEach(row => {
                const keys = Object.keys(row);
                let empNo = '';
                for(let k=0; k<Math.min(keys.length, 15); k++) {
                    const val = String(row[keys[k]] || '').trim();
                    if (val && employeeMap.has(val)) { empNo = val; break; }
                }
                const emp = employeeMap.get(empNo);
                if (!emp?.id) return;
                for (const key in row) {
                    const parsed = parseSmartDateTime(row[key]);
                    if (parsed && parsed.date.getMonth() + 1 === parseInt(month) && parsed.date.getFullYear() === parseInt(year)) {
                        const dateKey = `${emp.id}_${format(parsed.date, 'yyyy-MM-dd')}`;
                        if (!excelPunches.has(dateKey)) excelPunches.set(dateKey, new Set());
                        if (parsed.timeStr !== "00:00") excelPunches.get(dateKey)!.add(parsed.timeStr);
                    }
                }
            });

            const batch = writeBatch(firestore);
            const attPath = getTenantPath('attendance', tenantId);

            for (const emp of employees) {
                const records: AttendanceRecord[] = [];
                // Simplified day generation for MVP
                const docRef = doc(firestore, attPath, `${year}-${month}-${emp.id}`);
                batch.set(docRef, { 
                    employeeId: emp.id, year: parseInt(year), month: parseInt(month), 
                    records, updatedAt: serverTimestamp(), companyId: tenantId 
                });
            }

            await batch.commit();
            toast({ title: 'نجاح المعالجة' });
            router.push('/dashboard/hr/payroll');
        } catch (err: any) { 
            toast({ variant: 'destructive', title: 'خطأ', description: err.message }); 
        } finally { setIsProcessing(false); }
    };

    if (file) reader.readAsBinaryString(file);
    else setIsProcessing(false);
  };

  return (
    <Card className="rounded-[2.5rem] border-none shadow-xl">
        <CardHeader className="bg-primary/5 p-8 border-b">
            <CardTitle className="text-2xl font-black">تحميل بيانات الحضور</CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
            <div className="flex gap-4 p-4 bg-muted/20 rounded-2xl border-2 border-dashed">
                <div className="grid gap-2 flex-1"><Label>السنة</Label><Select value={year} onValueChange={setYear}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent dir="rtl">{[2024,2025,2026].map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-2 flex-1"><Label>الشهر</Label><Select value={month} onValueChange={setMonth}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent dir="rtl">{Array.from({length:12},(_,i)=>i+1).map(m=><SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-[3rem] p-12 text-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/10">
                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".xlsx, .xls, .csv" />
                <FileSpreadsheet className="h-12 w-12 mx-auto opacity-20 mb-4 text-primary" />
                <p className="font-black text-xl">{file ? file.name : "اسحب ملف البصمة هنا"}</p>
            </div>
            <Button onClick={handleUpload} disabled={isProcessing} className="w-full h-14 rounded-2xl font-black text-xl gap-3">
                {isProcessing ? <Loader2 className="animate-spin" /> : <RefreshCw />} بدء معالجة الشهر
            </Button>
        </CardContent>
    </Card>
  );
}
