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
import { RefreshCw, Trash2, FileDown, FileText, Printer, CheckCircle2, XCircle, Loader2, ShieldCheck, ShieldAlert, Ban, Info, RotateCcw, Banknote, CalendarDays, History, AlertTriangle, CalendarRange, Trash2 as Trash, FileDown as Download, Printer as Print, Search, Fingerprint, Sparkles, FileSpreadsheet, Save } from 'lucide-react';
import type { Employee, MonthlyAttendance, AttendanceRecord, LeaveRequest, PermissionRequest, Holiday } from '@/lib/types';
import { parse, format, isValid, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isAfter, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { Checkbox } from '../ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '../ui/badge';
import { toFirestoreDate } from '@/services/date-converter';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import { useRouter } from 'next/navigation';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const dayNameToIndex: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

const leaveTypeTranslations: Record<string, string> = {
    'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون أجر'
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
  const { theme } = useAppTheme();
  const router = useRouter();
  const isGlass = theme === 'glass';
  const tenantId = currentUser?.currentCompanyId;

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [clearPrevious, setClearPrevious] = useState(true);
  const [processingMode, setProcessingMode] = useState<'limit_to_file' | 'full_month'>('limit_to_file');
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', 'in', ['active', 'on-leave'])]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editableData, setEditableData] = useState<Record<string, any>>({});
  const [mappingSearch, setMappingSearch] = useState('');

  useEffect(() => {
    if (employees.length > 0) {
        const data: Record<string, any> = {};
        employees.forEach(emp => {
            data[emp.id!] = {
                employeeNumber: emp.employeeNumber || '',
                workStartTime: emp.workStartTime || '',
                workEndTime: emp.workEndTime || ''
            };
        });
        setEditableData(data);
    }
  }, [employees]);

  const handleUpload = async () => {
    if (!firestore || !year || !month || !tenantId) return;
    setIsProcessing(true);
    const selectedYearNum = parseInt(year);
    const selectedMonthNum = parseInt(month);

    const processAttendanceLogic = (json: any[]) => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const monthStart = startOfMonth(new Date(selectedYearNum, selectedMonthNum - 1));
                const monthEnd = endOfMonth(monthStart);

                const [leavesSnap, permissionsSnap] = await Promise.all([
                    getDocs(query(collection(firestore, getTenantPath('leaveRequests', tenantId)), where('status', 'in', ['approved', 'on-leave', 'returned']))),
                    getDocs(query(collection(firestore, getTenantPath('permissionRequests', tenantId)), where('status', '==', 'approved')))
                ]);

                const approvedLeaves = leavesSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
                const approvedPermissions = permissionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PermissionRequest));

                const employeeMap = new Map(employees.filter(emp => !!emp.employeeNumber).map(emp => [String(emp.employeeNumber), emp]));
                const excelPunches = new Map<string, Set<string>>(); 
                let lastDateInFile: Date | null = null;
                
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
                        if (parsed && parsed.date.getMonth() + 1 === selectedMonthNum && parsed.date.getFullYear() === selectedYearNum) {
                            const dateKey = `${emp.id}_${format(parsed.date, 'yyyy-MM-dd')}`;
                            if (!excelPunches.has(dateKey)) excelPunches.set(dateKey, new Set());
                            if (parsed.timeStr !== "00:00") excelPunches.get(dateKey)!.add(parsed.timeStr);
                            if (!lastDateInFile || parsed.date > lastDateInFile) lastDateInFile = parsed.date;
                        }
                    }
                });

                let limitDate = processingMode === 'full_month' ? monthEnd : (lastDateInFile || new Date());
                const workingDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).filter(d => !((branding?.work_hours?.holidays || []).map(h => dayNameToIndex[h]).includes(getDay(d))));

                const batch = writeBatch(firestore);
                const attPath = getTenantPath('attendance', tenantId);

                if (clearPrevious) {
                    const oldQ = query(collection(firestore, attPath), where('year', '==', selectedYearNum), where('month', '==', selectedMonthNum));
                    const oldSnap = await getDocs(oldQ);
                    oldSnap.forEach(d => batch.delete(d.ref));
                }

                for (const emp of employees) {
                    const records: AttendanceRecord[] = [];
                    for (const day of workingDays) {
                        const stableDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0);
                        if (isAfter(stableDay, endOfDay(limitDate))) continue;

                        const dateKey = `${emp.id}_${format(stableDay, 'yyyy-MM-dd')}`;
                        const punches = excelPunches.get(dateKey);
                        const activeLeave = approvedLeaves.find(l => l.employeeId === emp.id && stableDay >= toFirestoreDate(l.startDate)! && stableDay <= toFirestoreDate(l.endDate)!);
                        const activePermission = approvedPermissions.find(p => p.employeeId === emp.id && format(stableDay, 'yyyyMMdd') === format(toFirestoreDate(p.date)!, 'yyyyMMdd'));

                        if (punches && punches.size > 0) {
                            const sorted = Array.from(punches).sort();
                            let status: AttendanceRecord['status'] = 'present';
                            let audit: AttendanceRecord['auditStatus'] = 'verified';
                            let anomaly = '';

                            if (activeLeave) { anomaly = `تعارض بصمة مع إجازة`; audit = 'pending'; }
                            else {
                                const startLimit = emp.workStartTime || branding?.work_hours?.general?.morning_start_time || '08:00';
                                if (sorted[0] > startLimit) {
                                    if (activePermission?.type === 'late_arrival') { anomaly = 'تأخير مسموح'; }
                                    else { status = 'late'; anomaly = `تأخير عن ${startLimit}`; audit = 'pending'; }
                                }
                            }
                            records.push({ date: Timestamp.fromDate(stableDay), employeeId: emp.id!, checkIn1: sorted[0], checkOut1: sorted[sorted.length-1], checkIn2: null, checkOut2: null, status, anomalyDescription: anomaly, auditStatus: audit, manualDeductionDays: 0, allPunches: sorted });
                        } else if (activeLeave) {
                             records.push({ date: Timestamp.fromDate(stableDay), employeeId: emp.id!, status: 'present', anomalyDescription: `إجازة ${leaveTypeTranslations[activeLeave.leaveType]}`, auditStatus: 'verified', manualDeductionDays: 0, allPunches: [] } as any);
                        } else {
                             records.push({ date: Timestamp.fromDate(stableDay), employeeId: emp.id!, status: 'absent', anomalyDescription: 'غائب', auditStatus: 'pending', manualDeductionDays: 1, allPunches: [] } as any);
                        }
                    }
                    if (records.length > 0) {
                        const docRef = doc(firestore, attPath, `${selectedYearNum}-${selectedMonthNum}-${emp.id}`);
                        batch.set(docRef, { employeeId: emp.id, year: selectedYearNum, month: selectedMonthNum, records, updatedAt: serverTimestamp(), companyId: tenantId });
                    }
                }

                await batch.commit().catch(async (e) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({ path: attPath, operation: 'write' }));
                    throw e;
                });
                resolve();
            } catch (err) { reject(err); }
        });
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(e.target?.result, { type: 'binary' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                await processAttendanceLogic(json);
                toast({ title: 'نجاح المعالجة' });
                router.push('/dashboard/hr/payroll');
            } catch (err: any) { toast({ variant: 'destructive', title: 'خطأ', description: err.message }); setIsProcessing(false); }
        };
        reader.readAsBinaryString(file);
    } else {
        processAttendanceLogic([]).then(() => { toast({ title: 'مزامنة ناجحة' }); router.push('/dashboard/hr/payroll'); }).catch(e => { setIsProcessing(false); });
    }
  };

  const handleSaveMapping = async () => {
    if (!firestore || !tenantId) return;
    const batch = writeBatch(firestore);
    let changed = false;
    for (const empId in editableData) {
        const curr = editableData[empId];
        const orig = employees.find(e => e.id === empId);
        if (orig && (orig.employeeNumber !== curr.employeeNumber || orig.workStartTime !== curr.workStartTime)) {
            batch.update(doc(firestore, getTenantPath(`employees/${empId}`, tenantId)), { employeeNumber: curr.employeeNumber, workStartTime: curr.workStartTime || null, workEndTime: curr.workEndTime || null });
            changed = true;
        }
    }
    if (changed) { await batch.commit(); toast({ title: 'تم الحفظ' }); }
  };

  const filteredEmployees = employees.filter(e => e.fullName.includes(mappingSearch) || e.employeeNumber.includes(mappingSearch));

  return (
    <Tabs defaultValue="upload" dir="rtl" className="space-y-0">
        <div className={cn(isGlass ? "tabs-frame-secondary" : "mb-8")}>
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">رفع ومعالجة الملف</TabsTrigger>
                <TabsTrigger value="mapping">مطابقة البصمة والدوام</TabsTrigger>
            </TabsList>
        </div>
        <TabsContent value="upload" className="mt-0">
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
        </TabsContent>
        <TabsContent value="mapping">
            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-muted/10 border-b p-8"><CardTitle className="text-xl font-black">إعدادات أرقام البصمة</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50"><TableRow><TableHead className="px-8">الموظف</TableHead><TableHead>رقم البصمة</TableHead><TableHead>بداية الدوام</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {filteredEmployees.map(emp => (
                                <TableRow key={emp.id} className="h-16 border-b">
                                    <TableCell className="px-8 font-bold">{emp.fullName}</TableCell>
                                    <TableCell><Input value={editableData[emp.id!]?.employeeNumber} onChange={e => setEditableData(p => ({...p, [emp.id!]: {...p[emp.id!], employeeNumber: e.target.value}}))} className="w-32 rounded-xl" /></TableCell>
                                    <TableCell><Input type="time" value={editableData[emp.id!]?.workStartTime} onChange={e => setEditableData(p => ({...p, [emp.id!]: {...p[emp.id!], workStartTime: e.target.value}}))} className="w-32 rounded-xl" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="p-8 border-t bg-muted/5"><Button onClick={handleSaveMapping} className="rounded-xl font-black h-11 px-8 gap-2"><Save className="h-4 w-4"/> حفظ الإعدادات</Button></CardFooter>
            </Card>
        </TabsContent>
    </Tabs>
  );
}
