'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, updateDoc, Timestamp, orderBy } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Loader2, FileSpreadsheet, RotateCcw, CheckCircle2, Fingerprint, Save, Search, UserCheck, Clock, ShieldCheck, BadgeInfo, X, Info, AlertTriangle, CalendarRange, Trash2, FileDown, ShieldAlert, FileText, Ban } from 'lucide-react';
import type { Employee, MonthlyAttendance, AttendanceRecord, LeaveRequest, PermissionRequest, Holiday } from '@/lib/types';
import { parse, format, isValid, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isAfter, endOfDay } from 'date-fns';
import { cleanFirestoreData, cn } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '../ui/badge';
import { toFirestoreDate } from '@/services/date-converter';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

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
    } 
    else if (typeof val === 'string') {
        const cleaned = val.trim();
        const dateMatch = cleaned.match(/(\d{1,4}[-/\.]\d{1,2}[-/\.]\d{1,4})/);
        const timeMatch = cleaned.match(/(\d{1,2}:\d{2}(:\d{2})?(\s?[AaPp][Mm])?)/);

        if (dateMatch) {
            const dateStr = dateMatch[0];
            const formats = ['dd-MM-yyyy', 'd-M-yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 'd/M/yyyy', 'dd.MM.yyyy', 'dd-MM-yy', 'MM-dd-yyyy', 'MM/dd/yyyy'];
            for (const fmt of formats) {
                const p = parse(dateStr, fmt, new Date());
                if (isValid(p)) {
                    if (p.getFullYear() < 2000) break;
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

    if (parsedDate && isValid(parsedDate)) {
        return { date: parsedDate, timeStr };
    }
    return null;
};

export function AttendanceUploader() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { branding } = useBranding();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearPrevious, setClearPrevious] = useState(true);
  const [processingMode, setProcessingMode] = useState<'limit_to_file' | 'full_month'>('limit_to_file');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  
  const [summary, setSummary] = useState<{ workingDays: number, totalPunches: number, autoAbsences: number, coveredByPolicy: number } | null>(null);
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editableData, setEditableData] = useState<Record<string, { employeeNumber: string, workStartTime: string, workEndTime: string }>>({});
  const [isSavingData, setIsSavingData] = useState(false);
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

  const [attendanceDocs, setAttendanceDocs] = useState<MonthlyAttendance[]>([]);
  const [attLoading, setAttLoading] = useState(false);

  const fetchAttendance = useCallback(async () => {
    if (!firestore) return;
    setAttLoading(true);
    try {
      const snap = await getDocs(query(
        collection(firestore, 'attendance'),
        where('year', '==', parseInt(year)),
        where('month', '==', parseInt(month))
      ));
      setAttendanceDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyAttendance)));
    } catch (e) {
      console.error(e);
    } finally {
      setAttLoading(false);
    }
  }, [firestore, year, month]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const anomalies = useMemo(() => {
    const list: { docId: string, record: AttendanceRecord, empName: string, employeeNumber: string }[] = [];
    if (!attendanceDocs || attendanceDocs.length === 0) return [];

    const selectedMonth = parseInt(month);
    const selectedYear = parseInt(year);

    attendanceDocs.forEach(attendanceDoc => {
        const emp = employees.find(e => e.id === attendanceDoc.employeeId);
        attendanceDoc.records?.forEach(r => {
            const recordDate = toFirestoreDate(r.date);
            if (!recordDate) return;
            if ((recordDate.getMonth() + 1) !== selectedMonth || recordDate.getFullYear() !== selectedYear) return;
            if (r.status !== 'present') {
                list.push({ 
                    docId: attendanceDoc.id!, 
                    record: r, 
                    empName: emp?.fullName || 'موظف غير معروف', 
                    employeeNumber: emp?.employeeNumber || '000'
                });
            }
        });
    });
    return list.sort((a, b) => (toFirestoreDate(a.record.date)?.getTime() || 0) - (toFirestoreDate(b.record.date)?.getTime() || 0));
  }, [attendanceDocs, employees, month, year]);

  const handleClearData = async () => {
    if (!firestore) return;
    setIsClearing(true);
    try {
        const batch = writeBatch(firestore);
        const q = query(collection(firestore, 'attendance'), where('year', '==', parseInt(year)), where('month', '==', parseInt(month)));
        const snap = await getDocs(q);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        toast({ title: 'تم تصفير البيانات', description: `تم حذف كافة سجلات شهر ${month}/${year} من النظام.` });
        fetchAttendance();
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في المسح' });
    } finally {
        setIsClearing(false);
        setIsClearConfirmOpen(false);
    }
  };

  const handleExportAuditExcel = () => {
    if (anomalies.length === 0) {
        toast({ title: 'لا توجد مخالفات لتصديرها' });
        return;
    }
    const data = anomalies.map(a => ({
        'الموظف': a.empName,
        'رقم البصمة': a.employeeNumber,
        'التاريخ': format(toFirestoreDate(a.record.date)!, 'yyyy-MM-dd'),
        'الحالة': a.record.status === 'absent' ? 'غياب' : 'تأخير/نقص بصمة',
        'المخالفة': a.record.anomalyDescription,
        'الخصم المعتمد (أيام)': a.record.manualDeductionDays,
        'حالة التدقيق': a.record.auditStatus === 'verified' ? 'معتمد' : a.record.auditStatus === 'waived' ? 'متغاضى عنه' : 'قيد المراجعة'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل المخالفات");
    XLSX.writeFile(wb, `سجل_مخالفات_${month}_${year}.xlsx`);
  };

  const handleUpload = async () => {
    if (!file || !firestore || !year || !month) return;
    setIsProcessing(true);
    const selectedYearNum = parseInt(year);
    const selectedMonthNum = parseInt(month);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (json.length === 0) throw new Error("الملف المرفوع فارغ.");

        const monthStart = startOfMonth(new Date(selectedYearNum, selectedMonthNum - 1));
        const monthEnd = endOfMonth(monthStart);

        const [leavesSnap, permissionsSnap] = await Promise.all([
            getDocs(query(collection(firestore, 'leaveRequests'), where('status', 'in', ['approved', 'on-leave', 'returned']))),
            getDocs(query(collection(firestore, 'permissionRequests'), where('status', '==', 'approved')))
        ]);

        const approvedLeaves = leavesSnap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest));
        const approvedPermissions = permissionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PermissionRequest));

        const employeeMap = new Map(employees.filter(emp => !!emp.employeeNumber).map(emp => [String(emp.employeeNumber), emp]));
        const excelPunches = new Map<string, Set<string>>(); 
        let lastDateInFile: Date | null = null;
        const detectedMonths = new Set<string>();
        
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
                if (parsed) {
                    const pMonth = parsed.date.getMonth() + 1;
                    const pYear = parsed.date.getFullYear();
                    if (pYear > 2000) detectedMonths.add(`${pYear}-${pMonth}`);
                    if (pYear === selectedYearNum && pMonth === selectedMonthNum) {
                        const dateKey = `${emp.id}_${format(parsed.date, 'yyyy-MM-dd')}`;
                        if (!excelPunches.has(dateKey)) excelPunches.set(dateKey, new Set());
                        if (parsed.timeStr && parsed.timeStr !== "00:00") {
                            excelPunches.get(dateKey)!.add(parsed.timeStr);
                            if (!lastDateInFile || parsed.date > lastDateInFile) lastDateInFile = parsed.date;
                        }
                    }
                }
            }
        });

        if (detectedMonths.size > 0 && !detectedMonths.has(`${selectedYearNum}-${selectedMonthNum}`)) throw new Error("الشهر في الملف غير مطابق للاختيار.");
        if (excelPunches.size === 0) throw new Error("لا توجد بصمات مطابقة للفترة.");

        let processingLimitDate = processingMode === 'full_month' ? monthEnd : (lastDateInFile || new Date());
        const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const holidayIndexes = new Set((branding?.work_hours?.holidays || []).map(h => dayNameToIndex[h]));
        const workingDaysInMonth = allDaysInMonth.filter(day => !holidayIndexes.has(getDay(day)));

        const batch = writeBatch(firestore);

        if (clearPrevious) {
            const existingSnap = await getDocs(query(collection(firestore, 'attendance'), where('year', '==', selectedYearNum), where('month', '==', selectedMonthNum)));
            existingSnap.forEach(d => batch.delete(d.ref));
        }

        const workHours = branding?.work_hours?.general;
        const mEnd = workHours?.morning_end_time || '13:00';
        const eStart = workHours?.evening_start_time || '16:00';

        for (const emp of Array.from(employeeMap.values())) {
            const employeeRecords: AttendanceRecord[] = [];
            for (const day of workingDaysInMonth) {
                const stableDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0);
                const dateKey = `${emp.id}_${format(stableDay, 'yyyy-MM-dd')}`;
                const punches = excelPunches.get(dateKey);

                if (!isAfter(stableDay, endOfDay(processingLimitDate))) {
                    const activeLeave = approvedLeaves.find(l => l.employeeId === emp.id && stableDay >= toFirestoreDate(l.startDate)! && stableDay <= toFirestoreDate(l.endDate)!);
                    const activePermission = approvedPermissions.find(p => p.employeeId === emp.id && isSameDay(stableDay, toFirestoreDate(p.date)!));

                    if (punches && punches.size > 0) {
                        const sortedTimes = Array.from(punches).sort();
                        let status: AttendanceRecord['status'] = 'present';
                        let anomaly = '';
                        let manualDeduction = 0;
                        let auditStatus: AttendanceRecord['auditStatus'] = 'verified';

                        const startTimeLimit = emp.workStartTime || workHours?.morning_start_time || '08:00';
                        if (sortedTimes[0] > startTimeLimit) {
                            if (activePermission?.type === 'late_arrival') {
                                anomaly = 'تأخير مسموح (إذن تأخير)';
                            } else {
                                status = 'late';
                                anomaly = `تأخير عن (${startTimeLimit})`;
                                auditStatus = 'pending';
                            }
                        }

                        if (!emp.workStartTime && !emp.workEndTime) {
                            const hasMorning = sortedTimes.some(t => t <= mEnd);
                            const hasEvening = sortedTimes.some(t => t >= eStart);
                            if (hasMorning && !hasEvening) {
                                if (activePermission?.type === 'early_departure') {
                                    anomaly = anomaly ? `${anomaly} + خروج مسموح` : 'خروج مسموح';
                                } else {
                                    status = 'half_day';
                                    anomaly = anomaly ? `${anomaly} + بصمة واحدة` : 'بصمة صباحية فقط';
                                    manualDeduction = 0.5;
                                    auditStatus = 'pending';
                                }
                            }
                        }
                        employeeRecords.push({ date: Timestamp.fromDate(stableDay), employeeId: emp.id!, checkIn1: sortedTimes[0], checkOut1: sortedTimes[sortedTimes.length - 1], allPunches: sortedTimes, status, anomalyDescription: anomaly, manualDeductionDays: manualDeduction, auditStatus });
                    } else if (activeLeave) {
                        employeeRecords.push({ date: Timestamp.fromDate(stableDay), employeeId: emp.id!, status: 'present', anomalyDescription: `إجازة ${leaveTypeTranslations[activeLeave.leaveType] || ''}`, manualDeductionDays: 0, auditStatus: 'verified', allPunches: [] } as any);
                    } else {
                        employeeRecords.push({ date: Timestamp.fromDate(stableDay), employeeId: emp.id!, status: 'absent', anomalyDescription: 'غائب (بدون بصمة)', manualDeductionDays: 1, auditStatus: 'pending', allPunches: [] } as any);
                    }
                }
            }

            if (employeeRecords.length > 0) {
                const docId = `${selectedYearNum}-${selectedMonthNum}-${emp.id}`;
                const summary = {
                    presentDays: employeeRecords.filter(r => r.status === 'present').length,
                    absentDays: employeeRecords.filter(r => r.status === 'absent').length,
                    lateDays: employeeRecords.filter(r => r.status === 'late').length,
                    totalDeductionDays: employeeRecords.reduce((sum, r) => sum + (r.manualDeductionDays || 0), 0),
                    totalWorkingDays: employeeRecords.length
                };
                batch.set(doc(firestore, 'attendance', docId), { employeeId: emp.id, year: selectedYearNum, month: selectedMonthNum, records: employeeRecords, summary, updatedAt: serverTimestamp() });
            }
        }

        await batch.commit();
        toast({ title: 'نجاح التوليد', description: 'تم إنشاء سجلات الحضور. يمكنك الآن البدء بالتدقيق.' });
        setFile(null);
        fetchAttendance();
      } catch (error: any) { toast({ variant: 'destructive', title: 'خطأ', description: error.message }); } finally { setIsProcessing(false); }
    };
    reader.readAsBinaryString(file!);
  };

  const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  const handleAuditAction = async (docId: string, date: any, action: 'waive' | 'apply' | 'reset') => {
    if (!firestore || !currentUser) return;
    try {
        const docRef = doc(firestore, 'attendance', docId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        const records = snap.data().records.map((r: any) => {
            if (r.date.seconds === date.seconds) {
                let manualDeduction = r.manualDeductionDays;
                if (action === 'waive') manualDeduction = 0;
                else if (action === 'reset') manualDeduction = r.status === 'absent' ? 1 : (r.status === 'half_day' ? 0.5 : 0);
                return { ...r, auditStatus: action === 'reset' ? 'pending' : (action === 'waive' ? 'waived' : 'verified'), manualDeductionDays: manualDeduction, waivedBy: action === 'reset' ? null : currentUser.fullName, waivedAt: action === 'reset' ? null : new Date() };
            }
            return r;
        });
        await updateDoc(docRef, { records, updatedAt: serverTimestamp() });
        setAttendanceDocs(prev => prev.map(doc => doc.id === docId ? { ...doc, records } : doc));
        toast({ title: 'تم الحفظ' });
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ' }); }
  };

  return (
    <Tabs defaultValue="upload" dir="rtl" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-14 rounded-2xl bg-muted/50 p-1.5 shadow-inner">
            <TabsTrigger value="upload" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md">
                <FileSpreadsheet className="h-4 w-4" /> 1. رفع ومعالجة الملف
            </TabsTrigger>
            <TabsTrigger value="mapping" className="rounded-xl font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md">
                <Fingerprint className="h-4 w-4" /> 2. مطابقة البصمة والدوام
            </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-0 animate-in fade-in zoom-in-95 duration-300">
            <div className="space-y-8">
                <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
                    <CardHeader className="bg-muted/10 border-b pb-6 px-8">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-3">
                                <CalendarRange className="h-6 w-6 text-primary" />
                                <CardTitle className="text-xl font-black text-gray-800">إعدادات الفترة ونطاق الرقابة</CardTitle>
                            </div>
                            <div className="flex gap-4 bg-background p-2 rounded-2xl border shadow-inner">
                                <div className="grid gap-1">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground mr-1">السنة</Label>
                                    <Select value={year} onValueChange={setYear}>
                                        <SelectTrigger className="h-9 w-28 rounded-xl border-none shadow-none"><SelectValue /></SelectTrigger>
                                        <SelectContent dir="rtl">{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <Separator orientation="vertical" className="h-8 my-auto" />
                                <div className="grid gap-1">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground mr-1">الشهر</Label>
                                    <Select value={month} onValueChange={setMonth}>
                                        <SelectTrigger className="h-9 w-28 rounded-xl border-none shadow-none"><SelectValue /></SelectTrigger>
                                        <SelectContent dir="rtl">{Array.from({length:12}, (_,i)=>i+1).map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <RadioGroup value={processingMode} onValueChange={(v: any) => setProcessingMode(v)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className={cn(
                                "relative flex items-center space-x-4 space-x-reverse p-6 rounded-[2rem] border-2 transition-all cursor-pointer group h-28 shadow-[0_5px_0_0_rgba(0,0,0,0.05)] active:translate-y-1 active:shadow-none",
                                processingMode === 'limit_to_file' ? "bg-primary/5 border-primary" : "bg-card border-slate-100 hover:border-primary/20"
                            )} onClick={() => setProcessingMode('limit_to_file')}>
                                <RadioGroupItem value="limit_to_file" id="r1" className="h-6 w-6" />
                                <div className="flex-1">
                                    <Label htmlFor="r1" className="font-black text-lg cursor-pointer block text-primary">أيام محددة (بناءً على الملف)</Label>
                                    <p className="text-[10px] text-muted-foreground font-bold mt-1">يحتسب الغياب فقط للأيام الموثقة في الملف المرفوع.</p>
                                </div>
                            </div>
                            <div className={cn(
                                "relative flex items-center space-x-4 space-x-reverse p-6 rounded-[2rem] border-2 transition-all cursor-pointer group h-28 shadow-[0_5px_0_0_rgba(0,0,0,0.05)] active:translate-y-1 active:shadow-none",
                                processingMode === 'full_month' ? "bg-primary/5 border-primary" : "bg-card border-slate-100 hover:border-primary/20"
                            )} onClick={() => setProcessingMode('full_month')}>
                                <RadioGroupItem value="full_month" id="r2" className="h-6 w-6" />
                                <div className="flex-1">
                                    <Label htmlFor="r2" className="font-black text-lg cursor-pointer block text-primary">الشهر كامل (إغلاق نهائي)</Label>
                                    <p className="text-[10px] text-muted-foreground font-bold mt-1">يحسب الغياب حتى آخر يوم في الشهر (للتقارير النهائية).</p>
                                </div>
                            </div>
                        </RadioGroup>

                        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-amber-50/30 rounded-[2rem] border-2 border-dashed border-amber-200">
                            <div className="flex items-center gap-4">
                                <Checkbox id="purge" checked={clearPrevious} onCheckedChange={(c) => setClearPrevious(!!c)} className="h-6 w-6 rounded-lg border-amber-400 data-[state=checked]:bg-amber-600" />
                                <div>
                                    <Label htmlFor="purge" className="font-black text-base text-amber-900 cursor-pointer">تطهير البيانات السابقة لهذا الشهر</Label>
                                    <p className="text-xs text-amber-700 font-medium">تفعيل هذا الخيار سيمسح أي بصمات قديمة مسجلة لهذا الشهر ويبدأ من الصفر.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
                    <CardContent className="p-12">
                        <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-[4rem] p-20 text-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/20 group relative overflow-hidden">
                            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".xlsx, .xls, .csv" />
                            <FileSpreadsheet className="h-24 w-24 mx-auto opacity-20 mb-6 group-hover:scale-110 group-hover:opacity-40 transition-all text-primary" />
                            <p className="font-black text-3xl text-gray-700">{file ? file.name : "اسحب وأفلت ملف الإكسيل هنا"}</p>
                            <p className="text-sm text-muted-foreground mt-4 font-bold max-w-sm mx-auto">سيقوم المحاسب الذكي بمطابقة البصمات مع الإجازات والاستئذانات آلياً.</p>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-center border-t p-10 bg-muted/10">
                        <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-16 px-20 rounded-[2.5rem] font-black text-2xl shadow-[0_8px_0_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none bg-primary text-white hover:bg-primary/90 gap-4 min-w-[350px] transition-all">
                            {isProcessing ? <Loader2 className="animate-spin h-8 w-8"/> : <RotateCcw className="h-8 w-8"/>} 
                            بدء التحليل والإنشاء اليدوي
                        </Button>
                    </CardFooter>
                </Card>

                {/* --- مركز تدقيق الحضور والمخالفات --- */}
                <div className="space-y-6">
                    <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                        <CardHeader className="bg-slate-900 text-white pb-8 px-8">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck className="h-8 w-8 text-primary" />
                                        <CardTitle className="text-2xl font-black">مركز تدقيق الحضور والمخالفات</CardTitle>
                                    </div>
                                    <CardDescription className="text-slate-400 font-bold">مراجعة المخالفات المكتشفة واتخاذ قرارات التغاضي أو الخصم المالي.</CardDescription>
                                </div>
                                <div className="flex gap-3 bg-white/10 p-2 rounded-2xl border border-white/10 shadow-inner">
                                    <Button variant="ghost" onClick={() => setIsClearConfirmOpen(true)} disabled={isClearing || attendanceDocs.length === 0} className="h-10 px-6 rounded-xl font-black text-red-400 hover:bg-red-500 hover:text-white gap-2 transition-all shadow-[0_4px_0_0_rgba(0,0,0,0.2)] active:translate-y-1 active:shadow-none border border-red-500/20">
                                        <Trash2 className="h-4 w-4" /> تصفير الداتا الحالية
                                    </Button>
                                    <Button variant="ghost" onClick={handleExportAuditExcel} disabled={anomalies.length === 0} className="h-10 px-6 rounded-xl font-black text-green-400 hover:bg-green-600 hover:text-white gap-2 transition-all shadow-[0_4px_0_0_rgba(0,0,0,0.2)] active:translate-y-1 active:shadow-none border border-green-500/20">
                                        <FileDown className="h-4 w-4" /> تصدير المخالفات (Excel)
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {attLoading ? (
                                <div className="p-20 text-center space-y-4">
                                    <Loader2 className="animate-spin h-12 w-12 mx-auto text-primary" />
                                    <p className="font-black text-muted-foreground animate-pulse">جاري فحص قاعدة البيانات...</p>
                                </div>
                            ) : attendanceDocs.length === 0 ? (
                                <div className="p-32 text-center border-b rounded-b-[2.5rem] bg-slate-50/50">
                                    <Ban className="h-20 w-20 text-muted-foreground/20 mx-auto mb-6" />
                                    <p className="text-2xl font-black text-muted-foreground">لا توجد سجلات حضور مسجلة لهذه الفترة.</p>
                                    <p className="text-sm text-muted-foreground mt-2 font-bold">يرجى رفع ملف الإكسيل للبدء بالتحليل.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-muted/50 h-16">
                                        <TableRow className="border-none">
                                            <TableHead className="px-10 font-black text-[#7209B7]">الموظف</TableHead>
                                            <TableHead className="font-black text-[#7209B7]">التاريخ</TableHead>
                                            <TableHead className="font-black text-[#7209B7]">المخالفة</TableHead>
                                            <TableHead className="font-black text-[#7209B7]">سجل البصمات</TableHead>
                                            <TableHead className="font-black text-[#7209B7]">الخصم</TableHead>
                                            <TableHead className="text-center font-black text-[#7209B7]">القرار الرقابي</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {anomalies.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="h-48 text-center text-green-700 font-black italic">سجل الحضور نظيف تماماً لهذا الشهر!</TableCell></TableRow>
                                        ) : anomalies.map((item, idx) => {
                                            const isAbsent = item.record.status === 'absent';
                                            return (
                                            <TableRow key={idx} className={cn("h-24 transition-colors", item.record.auditStatus === 'waived' ? "bg-green-50/30 opacity-60" : isAbsent ? "bg-red-50/40" : "bg-white")}>
                                                <TableCell className="px-10"><div className="flex flex-col"><span className="font-black text-lg text-gray-800">{item.empName}</span><span className="font-mono text-[10px] text-muted-foreground font-bold">الملف: {item.employeeNumber}</span></div></TableCell>
                                                <TableCell className="font-bold text-xs text-gray-600">{format(toFirestoreDate(item.record.date)!, 'dd/MM/yyyy', { locale: ar })}</TableCell>
                                                <TableCell><div className="flex flex-col gap-1"><Badge variant={isAbsent ? 'destructive' : 'outline'} className={cn("w-fit text-[8px] font-black uppercase", isAbsent && "bg-red-600")}>{isAbsent ? 'غياب كامل' : 'تأخير/نقص بصمة'}</Badge><span className="text-[10px] font-bold text-red-600 leading-tight">{item.record.anomalyDescription}</span></div></TableCell>
                                                <TableCell>{isAbsent ? <div className="h-8 w-8 rounded-full border-2 border-dashed border-red-200 flex items-center justify-center opacity-40"><X className="h-4 w-4 text-red-400"/></div> : <div className="flex flex-wrap gap-1">{(item.record.allPunches || []).map((p, i) => <Badge key={i} variant="outline" className="font-mono text-[9px] h-5 bg-background shadow-inner">{p}</Badge>)}</div>}</TableCell>
                                                <TableCell><div className="flex flex-col"><span className="font-black text-2xl text-primary font-mono">{item.record.manualDeductionDays || 0}</span><span className="text-[9px] font-bold text-muted-foreground uppercase">يوم خصم</span></div></TableCell>
                                                <TableCell className="text-center px-6">
                                                    {item.record.auditStatus === 'pending' ? (
                                                        <div className="flex justify-center gap-3">
                                                            <Button type="button" size="sm" variant="ghost" className="bg-green-50 text-green-700 border-2 border-green-200 h-10 px-6 rounded-2xl font-black shadow-sm hover:bg-green-600 hover:text-white" onClick={() => handleAuditAction(item.docId, item.record.date, 'waive')}>تغاضي</Button>
                                                            <Button type="button" size="sm" className="bg-red-600 hover:bg-red-700 text-white h-10 px-6 rounded-2xl font-black shadow-lg shadow-red-100" onClick={() => handleAuditAction(item.docId, item.record.date, 'apply')}>اعتماد الخصم</Button>
                                                        </div>
                                                    ) : <Button type="button" variant="outline" size="sm" onClick={() => handleAuditAction(item.docId, item.record.date, 'reset')} className="text-muted-foreground h-9 rounded-xl gap-2 font-bold bg-muted/30 border-dashed border-2"><History className="h-3 w-3"/>تغيير القرار</Button>}
                                                </TableCell>
                                            </TableRow>
                                        )})}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </TabsContent>

        <TabsContent value="mapping" className="mt-0 animate-in fade-in zoom-in-95 duration-300">
            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black flex items-center gap-3">
                                <Fingerprint className="text-primary h-7 w-7" /> مطابقة البصمة والدوام المخصص
                            </CardTitle>
                            <CardDescription className="text-base font-medium">تحديد أرقام البصمة وساعات الدوام لكل موظف لضمان دقة الرقابة المالية.</CardDescription>
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                            <Input placeholder="بحث بالاسم أو الرقم..." value={mappingSearch} onChange={(e) => setMappingSearch(e.target.value)} className="pl-10 h-12 rounded-2xl bg-white border-none shadow-inner font-bold" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[550px] overflow-y-auto scrollbar-none">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow className="h-14">
                                    <TableHead className="px-10 py-4 font-black text-gray-800">اسم الموظف</TableHead>
                                    <TableHead className="font-black text-gray-800">رقم البصمة</TableHead>
                                    <TableHead className="font-black text-center text-gray-800">بداية الدوام</TableHead>
                                    <TableHead className="font-black text-center text-gray-800">نهاية الدوام</TableHead>
                                    <TableHead className="w-32 text-center font-black text-gray-800">الحالة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employeesLoading ? (
                                    Array.from({length: 5}).map((_, i) => <TableRow key={i}><TableCell colSpan={5} className="px-10 py-6"><Skeleton className="h-10 w-full rounded-2xl"/></TableCell></TableRow>)
                                ) : filteredEmployees.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic font-bold">لا توجد سجلات للموظفين.</TableCell></TableRow>
                                ) : (
                                    filteredEmployees.map((emp) => {
                                        const current = editableData[emp.id!] || { employeeNumber: '', workStartTime: '', workEndTime: '' };
                                        const isChanged = emp.employeeNumber !== current.employeeNumber || (emp.workStartTime || '') !== current.workStartTime || (emp.workEndTime || '') !== current.workEndTime;
                                        const isFullTime = !current.workStartTime && !current.workEndTime;
                                        return (
                                            <TableRow key={emp.id} className={cn("hover:bg-primary/5 transition-colors h-20 border-b last:border-0", !isFullTime && "bg-sky-50/20")}>
                                                <TableCell className="px-10"><div className="flex flex-col"><span className="font-black text-base text-gray-800">{emp.fullName}</span><span className="text-[10px] text-muted-foreground font-bold">{emp.department}</span></div></TableCell>
                                                <TableCell><Input value={current.employeeNumber} onChange={(e) => setEditableData(prev => ({...prev, [emp.id!]: { ...current, employeeNumber: e.target.value }}))} className="font-mono font-black h-10 rounded-xl border-2 w-32 text-center text-primary" placeholder="000"/></TableCell>
                                                <TableCell><Input type="time" value={current.workStartTime} onChange={(e) => setEditableData(prev => ({...prev, [emp.id!]: { ...current, workStartTime: e.target.value }}))} className="font-mono h-10 rounded-xl border-2 w-32 mx-auto text-center"/></TableCell>
                                                <TableCell><Input type="time" value={current.workEndTime} onChange={(e) => setEditableData(prev => ({...prev, [emp.id!]: { ...current, workEndTime: e.target.value }}))} className="font-mono h-10 rounded-xl border-2 w-32 mx-auto text-center"/></TableCell>
                                                <TableCell className="text-center px-6">{isChanged ? <Badge className="bg-orange-600 text-white font-black text-[9px] animate-pulse rounded-lg">بانتظار الحفظ</Badge> : isFullTime ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100 font-black text-[9px] rounded-lg">كامل (رسمي)</Badge> : <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-100 font-black text-[9px] rounded-lg">جزئي (مخصص)</Badge>}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="justify-end border-t p-8 bg-muted/10">
                    <div className="flex-1 text-xs text-muted-foreground font-bold pr-4 flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> اترك حقول الوقت فارغة إذا كان الموظف يتبع الدوام الرسمي الكامل للمكتب.</div>
                    <Button onClick={handleSaveMappingData} disabled={isSavingData} className="h-14 px-12 rounded-2xl font-black text-lg gap-2 shadow-[0_6px_0_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none bg-primary text-white">{isSavingData ? <Loader2 className="animate-spin h-5 w-5"/> : <Save className="h-5 w-5"/>} حفظ كافة البيانات</Button>
                </CardFooter>
            </Card>
        </TabsContent>

        <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
            <AlertDialogContent dir="rtl" className="rounded-3xl border-none shadow-2xl">
                <AlertDialogHeader>
                    <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4"><ShieldAlert className="h-10 w-10"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد تصفير بيانات الفترة؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-base font-medium leading-relaxed">
                        أنت على وشك حذف جميع سجلات الحضور المعتمدة والمدققة لشهر <strong>{month}/{year}</strong> نهائياً. 
                        <br/><br/>
                        <span className="text-red-600 font-black underline">تحذير:</span> لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearData} disabled={isClearing} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black h-12 px-12 shadow-lg">
                        {isClearing ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، قم بالتصفير الآن'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </Tabs>
  );
}