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
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, updateDoc, Timestamp, orderBy, limit, collectionGroup, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Loader2, FileSpreadsheet, RotateCcw, CheckCircle2, Fingerprint, Save, Search, UserCheck, Clock, ShieldCheck, BadgeInfo, X, Info, AlertTriangle, CalendarRange, Trash2, FileDown, ShieldAlert, FileText, Ban, History, AlertCircle, XCircle } from 'lucide-react';
import type { Employee, MonthlyAttendance, AttendanceRecord, LeaveRequest, PermissionRequest, Holiday } from '@/lib/types';
import { parse, format, isValid, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isAfter, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cleanFirestoreData, cn } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { toFirestoreDate } from '@/services/date-converter';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useAuth } from '@/context/auth-context';

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
  const { user: currentUser } = useAuth();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearPrevious, setClearPrevious] = useState(true);
  const [processingMode, setProcessingMode] = useState<'limit_to_file' | 'full_month'>('limit_to_file');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editableData, setEditableData] = useState<Record<string, { employeeNumber: string, workStartTime: string, workEndTime: string }>>({});
  const [isSavingData, setIsSavingData] = useState(false);
  const [mappingSearch, setMappingSearch] = useState('');

  const [attendanceDocs, setAttendanceDocs] = useState<MonthlyAttendance[]>([]);
  const [attLoading, setAttLoading] = useState(false);

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
            if (r.status !== 'present' || r.anomalyDescription?.includes('تعارض')) {
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
                    
                    if (pYear !== selectedYearNum || pMonth !== selectedMonthNum) {
                        throw new Error(`الملف يحتوي على تواريخ لشهر ${pMonth}/${pYear}. الرجاء اختيار الفترة الصحيحة.`);
                    }

                    const dateKey = `${emp.id}_${format(parsed.date, 'yyyy-MM-dd')}`;
                    if (!excelPunches.has(dateKey)) excelPunches.set(dateKey, new Set());
                    if (parsed.timeStr && parsed.timeStr !== "00:00") {
                        excelPunches.get(dateKey)!.add(parsed.timeStr);
                        if (!lastDateInFile || parsed.date > lastDateInFile) lastDateInFile = parsed.date;
                    }
                }
            }
        });

        if (excelPunches.size === 0) throw new Error("لا توجد بصمات مطابقة للفترة المحددة في الملف.");

        let processingLimitDate = processingMode === 'full_month' ? monthEnd : (lastDateInFile || new Date());
        const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const holidayIndexes = new Set((branding?.work_hours?.holidays || []).map(h => dayNameToIndex[h]));
        const workingDaysInMonth = allDaysInMonth.filter(day => !holidayIndexes.has(getDay(day)));

        const batch = writeBatch(firestore);

        if (clearPrevious) {
            const oldQ = query(collection(firestore, 'attendance'), where('year', '==', selectedYearNum), where('month', '==', selectedMonthNum));
            const oldSnap = await getDocs(oldQ);
            oldSnap.forEach(d => batch.delete(d.ref));
        }

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

                        if (activeLeave) {
                            anomaly = `⚠️ تعارض: بصمة موجودة أثناء إجازة (${leaveTypeTranslations[activeLeave.leaveType]})`;
                            auditStatus = 'pending';
                        } else {
                            const startTimeLimit = emp.workStartTime || branding?.work_hours?.general?.morning_start_time || '08:00';
                            if (sortedTimes[0] > startTimeLimit) {
                                if (activePermission?.type === 'late_arrival') {
                                    anomaly = 'تأخير مسموح (إذن تأخير)';
                                } else {
                                    status = 'late';
                                    anomaly = `تأخير عن (${startTimeLimit})`;
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
                batch.set(doc(firestore, 'attendance', docId), {
                    employeeId: emp.id,
                    year: selectedYearNum,
                    month: selectedMonthNum,
                    records: employeeRecords,
                    updatedAt: serverTimestamp()
                });
            }
        }

        await batch.commit();
        toast({ title: 'نجاح التوليد', description: 'تم إنشاء سجلات الحضور والملخصات الإحصائية بنجاح.' });
        setFile(null);
        if (fileInputRef.current) { fileInputRef.current.value = ''; }
        fetchAttendance();
      } catch (error: any) { toast({ variant: 'destructive', title: 'خطأ in الملف', description: error.message }); } finally { setIsProcessing(false); }
    };
    reader.readAsBinaryString(file!);
  };

  const handleSaveMappingData = async () => {
    if (!firestore || employees.length === 0) return;
    setIsSavingData(true);
    try {
        const batch = writeBatch(firestore);
        let hasChanges = false;

        for (const empId in editableData) {
            const current = editableData[empId];
            const original = employees.find(e => e.id === empId);
            
            if (original) {
                const needsUpdate = 
                    original.employeeNumber !== current.employeeNumber ||
                    (original.workStartTime || '') !== current.workStartTime ||
                    (original.workEndTime || '') !== current.workEndTime;

                if (needsUpdate) {
                    const empRef = doc(firestore, 'employees', empId);
                    batch.update(empRef, {
                        employeeNumber: current.employeeNumber,
                        workStartTime: current.workStartTime || null,
                        workEndTime: current.workEndTime || null
                    });
                    hasChanges = true;
                }
            }
        }

        if (hasChanges) {
            await batch.commit();
            toast({ title: 'تم حفظ البيانات', description: 'تم تحديث أرقام البصمة وساعات الدوام بنجاح.' });
        } else {
            toast({ title: 'لا توجد تغييرات', description: 'لم يتم تعديل أي بيانات للحفظ.' });
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
    } finally {
        setIsSavingData(false);
    }
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

  const handleBulkAuditAction = async (action: 'waive' | 'apply' | 'reset') => {
    if (!firestore || !currentUser || anomalies.length === 0) return;
    const targets = action === 'reset' ? anomalies : anomalies.filter(a => a.record.auditStatus === 'pending');
    if (targets.length === 0 && action !== 'reset') return;

    setIsBulkProcessing(true);
    try {
        const batch = writeBatch(firestore);
        const updatedDocIds = new Set(anomalies.map(a => a.docId));
        
        for (const docId of Array.from(updatedDocIds)) {
            const docRef = doc(firestore, 'attendance', docId);
            const currentDoc = attendanceDocs.find(d => d.id === docId);
            if (!currentDoc) continue;

            const updatedRecords = currentDoc.records.map(r => {
                const isTargetAnomaly = anomalies.some(pa => pa.docId === docId && pa.record.date.seconds === r.date.seconds);
                if (isTargetAnomaly) {
                    let manualDeduction = r.manualDeductionDays;
                    if (action === 'waive') manualDeduction = 0;
                    else if (action === 'apply') {
                        manualDeduction = r.status === 'absent' ? 1 : (r.status === 'half_day' ? 0.5 : 0);
                    }
                    else if (action === 'reset') {
                        manualDeduction = r.status === 'absent' ? 1 : (r.status === 'half_day' ? 0.5 : 0);
                    }

                    return {
                        ...r,
                        auditStatus: action === 'reset' ? 'pending' : (action === 'waive' ? 'waived' : 'verified'),
                        manualDeductionDays: manualDeduction,
                        waivedBy: action === 'reset' ? null : currentUser.fullName,
                        waivedAt: action === 'reset' ? null : new Date()
                    };
                }
                return r;
            });

            batch.update(docRef, { records: updatedRecords, updatedAt: serverTimestamp() });
        }

        await batch.commit();
        toast({ title: 'نجاح الإجراء الجماعي', description: action === 'reset' ? 'تمت إعادة تعيين جميع المخالفات.' : `تم ${action === 'waive' ? 'التغاضي عن' : 'اعتماد'} المخالفات.` });
        fetchAttendance();
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في الإجراء الجماعي.' });
    } finally {
        setIsBulkProcessing(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!mappingSearch) return employees;
    const lower = mappingSearch.toLowerCase();
    return employees.filter(e => e.fullName.toLowerCase().includes(lower) || e.employeeNumber.includes(lower));
  }, [employees, mappingSearch]);

  const pendingCount = anomalies.filter(a => a.record.auditStatus === 'pending').length;

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
                {/* Professional Dark Header for Upload Section */}
                <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                    <CardHeader className="bg-[#0f172a] text-white py-10 px-10 border-b-0">
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                            <div className="space-y-2 text-right order-1 lg:order-2">
                                <div className="flex items-center justify-end gap-3">
                                    <CardTitle className="text-3xl font-black text-white tracking-tight">إعدادات الفترة ونطاق الرقابة</CardTitle>
                                    <div className="p-3 bg-primary/20 rounded-2xl text-primary shadow-inner">
                                        <CalendarRange className="h-8 w-8" />
                                    </div>
                                </div>
                                <CardDescription className="text-slate-400 font-bold text-base leading-relaxed">
                                    حدد الشهر والسنة المستهدفة لاحتساب الرواتب ومطابقة البصمات.
                                </CardDescription>
                            </div>

                            {/* Selection Controls */}
                            <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] shadow-2xl backdrop-blur-sm min-w-[420px] order-2 lg:order-1">
                                <div className="flex gap-6 justify-center">
                                    <div className="grid gap-1">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 mr-1">السنة الرقابية</Label>
                                        <Select value={year} onValueChange={setYear}>
                                            <SelectTrigger className="h-11 w-32 rounded-xl border-white/10 bg-white/5 text-white font-black"><SelectValue /></SelectTrigger>
                                            <SelectContent dir="rtl">{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 mr-1">الشهر المستهدف</Label>
                                        <Select value={month} onValueChange={setMonth}>
                                            <SelectTrigger className="h-11 w-32 rounded-xl border-white/10 bg-white/5 text-white font-black"><SelectValue /></SelectTrigger>
                                            <SelectContent dir="rtl">{Array.from({length:12}, (_,i)=>i+1).map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
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
                    <CardContent className="p-8">
                        <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-[3rem] p-10 text-center cursor-pointer hover:bg-primary/5 transition-all bg-muted/20 group relative overflow-hidden">
                            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".xlsx, .xls, .csv" />
                            <FileSpreadsheet className="h-12 w-12 mx-auto opacity-20 mb-4 group-hover:scale-110 group-hover:opacity-40 transition-all text-primary" />
                            <p className="font-black text-xl text-gray-700">{file ? file.name : "اسحب وأفلت ملف الإكسيل هنا"}</p>
                            <p className="text-xs text-muted-foreground mt-2 font-bold max-w-xs mx-auto">سيقوم المحاسب الذكي بمطابقة البصمات مع الإجازات والاستئذانات آلياً.</p>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-center border-t p-6 bg-muted/10">
                        <Button onClick={handleUpload} disabled={!file || isProcessing} className="h-12 px-12 rounded-2xl font-black text-lg shadow-[0_4px_0_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none bg-primary text-white hover:bg-primary/90 gap-3 min-w-[280px] transition-all">
                            {isProcessing ? <Loader2 className="animate-spin h-5 w-5"/> : <RotateCcw className="h-5 w-5"/>} 
                            بدء التحليل والمعالجة
                        </Button>
                    </CardFooter>
                </Card>

                <div className="space-y-6">
                    <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                        <CardHeader className="bg-[#0f172a] text-white py-10 px-10 border-b-0">
                            <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                                <div className="space-y-2 text-right order-1 lg:order-2">
                                    <div className="flex items-center justify-end gap-3">
                                        <CardTitle className="text-3xl font-black text-white tracking-tight">مركز تدقيق الحضور والمخالفات</CardTitle>
                                        <div className="p-3 bg-primary/20 rounded-2xl text-primary shadow-inner">
                                            <ShieldCheck className="h-8 w-8" />
                                        </div>
                                    </div>
                                    <CardDescription className="text-slate-400 font-bold text-base leading-relaxed">
                                        مراجعة المخالفات المكتشفة واتخاذ قرارات التغاضي أو الخصم المالي.
                                    </CardDescription>
                                </div>

                                {/* Control Box */}
                                <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] shadow-2xl backdrop-blur-sm min-w-[420px] order-2 lg:order-1">
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center px-4">
                                            <button onClick={() => handleBulkAuditAction('waive')} disabled={isBulkProcessing || pendingCount === 0} className="flex items-center gap-2 text-green-400 hover:text-green-300 transition-all text-xs font-black disabled:opacity-20"><CheckCircle2 className="h-4 w-4" /> تغاضي عن الكل</button>
                                            <button onClick={() => handleBulkAuditAction('apply')} disabled={isBulkProcessing || pendingCount === 0} className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-all text-xs font-black disabled:opacity-20"><XCircle className="h-4 w-4" /> خصم للكل</button>
                                            <button onClick={() => handleBulkAuditAction('reset')} disabled={isBulkProcessing} className="flex items-center gap-2 text-slate-300 hover:text-white transition-all text-xs font-black group"><RotateCcw className={cn("h-4 w-4 transition-transform group-hover:rotate-180", isBulkProcessing && "animate-spin")} /> إعادة تعيين</button>
                                        </div>
                                        <Separator className="bg-white/10" />
                                        <div className="flex justify-center gap-16 px-4">
                                            <button onClick={handleExportAuditExcel} disabled={anomalies.length === 0} className="flex items-center gap-2 text-green-400 hover:text-green-300 transition-all text-xs font-black disabled:opacity-20"><FileDown className="h-4 w-4" /> تصدير Excel</button>
                                            <button onClick={() => setIsClearConfirmOpen(true)} disabled={isClearing || attendanceDocs.length === 0} className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-all text-xs font-black disabled:opacity-20"><Trash2 className="h-4 w-4" /> تصفير الداتا</button>
                                        </div>
                                    </div>
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
                                            <TableHead className="text-center font-black text-[#7209B7]">القرار</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {anomalies.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="h-48 text-center text-green-700 font-black italic">سجل الحضور نظيف تماماً لهذا الشهر!</TableCell></TableRow>
                                        ) : anomalies.map((item, idx) => {
                                            const isAbsent = item.record.status === 'absent';
                                            const isConflict = item.record.anomalyDescription?.includes('تعارض');
                                            return (
                                            <TableRow key={idx} className={cn("h-24 transition-colors", item.record.auditStatus === 'waived' ? "bg-green-50/30 opacity-60" : isConflict ? "bg-amber-50/50" : isAbsent ? "bg-red-50/40" : "bg-white")}>
                                                <TableCell className="px-10"><div className="flex flex-col"><span className="font-black text-lg text-gray-800">{item.empName}</span><span className="font-mono text-[10px] text-muted-foreground font-bold">الملف: {item.employeeNumber}</span></div></TableCell>
                                                <TableCell className="font-bold text-xs text-gray-600">{format(toFirestoreDate(item.record.date)!, 'dd/MM/yyyy', { locale: ar })}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <Badge variant={isAbsent ? 'destructive' : isConflict ? 'default' : 'outline'} className={cn("w-fit text-[8px] font-black uppercase", isAbsent && "bg-red-600", isConflict && "bg-amber-600")}>
                                                            {isAbsent ? 'غياب كامل' : isConflict ? 'تعارض رقابي حاد' : 'تأخير/نقص بصمة'}
                                                        </Badge>
                                                        <span className={cn("text-[10px] font-bold leading-tight", isConflict ? "text-amber-700" : "text-red-600")}>
                                                            {item.record.anomalyDescription}
                                                        </span>
                                                    </div>
                                                </TableCell>
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
                <CardHeader className="bg-[#0f172a] text-white py-10 px-10 border-b-0">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                        <div className="space-y-2 text-right order-1 lg:order-2">
                            <div className="flex items-center justify-end gap-3">
                                <CardTitle className="text-3xl font-black text-white tracking-tight">مطابقة البصمة والدوام المخصص</CardTitle>
                                <div className="p-3 bg-primary/20 rounded-2xl text-primary shadow-inner">
                                    <Fingerprint className="h-8 w-8" />
                                </div>
                            </div>
                            <CardDescription className="text-slate-400 font-bold text-base leading-relaxed">
                                تحديد أرقام البصمة وساعات الدوام لكل موظف لضمان دقة الرقابة المالية.
                            </CardDescription>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] shadow-2xl backdrop-blur-sm min-w-[420px] order-2 lg:order-1">
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                                <Input placeholder="بحث بالاسم أو الرقم..." value={mappingSearch} onChange={(e) => setMappingSearch(e.target.value)} className="pl-10 h-12 rounded-2xl bg-white/10 border-white/10 text-white placeholder:text-slate-400 font-bold" />
                            </div>
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
                    <Button onClick={handleSaveMappingData} disabled={isSavingData} className="h-14 px-12 rounded-2xl font-black text-lg gap-2 shadow-[0_6px_0_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none bg-primary text-white">{isSavingData ? <Loader2 className="h-5 w-5"/> : <Save className="h-5 w-5"/>} حفظ كافة البيانات</Button>
                </CardFooter>
            </Card>
        </TabsContent>

        <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
            <AlertDialogContent dir="rtl" className="rounded-3xl border-none shadow-2xl">
                <AlertDialogHeader>
                    <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4 shadow-inner"><ShieldAlert className="h-10 w-10"/></div>
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
                        {isClearing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'نعم، قم بالتصفير الآن'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </Tabs>
  );
}
