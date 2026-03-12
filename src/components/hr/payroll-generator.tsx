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
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  TableFooter
} from '@/components/ui/table';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, updateDoc, Timestamp, orderBy, limit, runTransaction } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { RefreshCw, Trash2, FileDown, FileText, Printer, CheckCircle2, XCircle, Loader2, ShieldCheck, ShieldAlert, Ban, Info, RotateCcw, Banknote, CalendarDays, History, AlertTriangle, LayoutGrid, ListFilter, ChevronDown, CalendarCheck, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from '../ui/alert-dialog';
import type { Employee, MonthlyAttendance, AttendanceRecord, LeaveRequest, PermissionRequest, Holiday, Payslip } from '@/lib/types';
import { format, isValid, getDay, isAfter, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cleanFirestoreData, cn, formatCurrency } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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

export function PayrollGenerator() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { branding } = useBranding();
  const { user: currentUser } = useAuth();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [attLoading, setAttLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [isPrintingSummary, setIsPrintingSummary] = useState(false);
  const [processingMode, setProcessingMode] = useState<'limit_to_file' | 'full_month'>('limit_to_file');
  const [clearPrevious, setClearPrevious] = useState(true);
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', 'in', ['active', 'on-leave'])]);
  const [attendanceDocs, setAttendanceDocs] = useState<MonthlyAttendance[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editableData, setEditableData] = useState<Record<string, { employeeNumber: string, workStartTime: string, workEndTime: string }>>({});
  const [isSavingData, setIsSavingData] = useState(false);
  const [mappingSearch, setMappingSearch] = useState('');

  const payrollQuery = useMemo(() => [
    where('year', '==', parseInt(year)),
    where('month', '==', parseInt(month))
  ], [year, month]);
  
  const { data: monthPayslips } = useSubscription<Payslip>(firestore, 'payroll', payrollQuery);

  const isMonthPaid = useMemo(() => {
    return monthPayslips.length > 0 && monthPayslips.some(p => p.status === 'paid');
  }, [monthPayslips]);

  const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

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

  useEffect(() => {
    setAttendanceDocs([]);
    setIsGenerated(false);
  }, [year, month]);

  const fetchAttendance = async () => {
    if (!firestore) return;
    setAttLoading(true);
    try {
      const snap = await getDocs(query(
        collection(firestore, 'attendance'),
        where('year', '==', parseInt(year)),
        where('month', '==', parseInt(month))
      ));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyAttendance));
      setAttendanceDocs(data);
      if (snap.empty) {
          toast({ title: 'لا توجد بيانات', description: 'لم يتم العثور على سجلات حضور للشهر المختار.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ في التحميل' });
    } finally {
      setAttLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!firestore || !year || !month) return;
    setIsProcessing(true);
    const selectedYearNum = parseInt(year);
    const selectedMonthNum = parseInt(month);

    const processAttendanceLogic = (json: any[]) => {
        return new Promise<void>(async (resolve, reject) => {
            try {
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
                
                if (json.length > 0) {
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
                }

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

                for (const emp of employees) {
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
                                            auditStatus = 'verified';
                                            status = 'present';
                                        } else {
                                            status = 'late';
                                            anomaly = `تأخير عن (${startTimeLimit})`;
                                            auditStatus = 'pending';
                                        }
                                    }
                                }

                                employeeRecords.push({ date: Timestamp.fromDate(stableDay), employeeId: emp.id!, checkIn1: sortedTimes[0], checkOut1: sortedTimes[sortedTimes.length - 1], allPunches: sortedTimes, status, anomalyDescription: anomaly, manualDeductionDays: manualDeduction, auditStatus });
                            } else if (activeLeave) {
                                employeeRecords.push({ 
                                    date: Timestamp.fromDate(stableDay), 
                                    employeeId: emp.id!, 
                                    status: 'present', 
                                    anomalyDescription: `إجازة ${leaveTypeTranslations[activeLeave.leaveType] || ''} (مزامنة آلية)`, 
                                    manualDeductionDays: 0, 
                                    auditStatus: 'verified', 
                                    allPunches: [] 
                                } as any);
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
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                await processAttendanceLogic(json);
                toast({ title: 'نجاح المعالجة', description: 'تم دمج البصمات مع الإجازات والاستئذانات آلياً.' });
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'خطأ', description: err.message });
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsBinaryString(file);
    } else {
        try {
            await processAttendanceLogic([]);
            toast({ title: 'نجاح المزامنة', description: 'تم تحديث سجلات الإجازات والاستئذانات المعتمدة آلياً.' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: err.message });
        } finally {
            setIsProcessing(false);
        }
    }
  };

  const handleDeleteMonth = async () => {
    if (!firestore) return;
    setShowDeleteConfirm(false);
    setAttLoading(true);
    try {
      const snap = await getDocs(query(
        collection(firestore, 'attendance'),
        where('year', '==', parseInt(year)),
        where('month', '==', parseInt(month))
      ));
      if (snap.empty) return;
      const batch = writeBatch(firestore);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setAttendanceDocs([]);
      toast({ title: '✅ تم الحذف', description: `تم تصفير سجلات شهر ${month}/${year}.` });
    } finally {
      setAttLoading(false);
    }
  };

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
        await updateDoc(docRef, { records, updatedAt: serverTimestamp() });
        setAttendanceDocs(prev => prev.map(doc => doc.id === docId ? { ...doc, records } : doc));
        toast({ title: 'تم الحفظ' });
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ' }); }
  };

  const handleBulkAuditAction = async (action: 'waive' | 'apply' | 'reset') => {
    if (!firestore || !currentUser || anomalies.length === 0) return;
    setIsBulkProcessing(true);
    try {
        const batch = writeBatch(firestore);
        const updatedDocIds = new Set(anomalies.map(a => a.docId));
        for (const docId of Array.from(updatedDocIds)) {
            const docRef = doc(firestore, 'attendance', docId);
            const currentDoc = attendanceDocs.find(d => d.id === docId);
            if (!currentDoc) continue;
            const updatedRecords = currentDoc.records.map(r => {
                const isTarget = anomalies.some(pa => pa.docId === docId && pa.record.date.seconds === r.date.seconds);
                if (isTarget) {
                    let manualDeduction = r.manualDeductionDays;
                    if (action === 'waive') manualDeduction = 0;
                    else if (action === 'apply' || action === 'reset') manualDeduction = r.status === 'absent' ? 1 : (r.status === 'half_day' ? 0.5 : 0);
                    return { ...r, auditStatus: action === 'reset' ? 'pending' : (action === 'waive' ? 'waived' : 'verified'), manualDeductionDays: manualDeduction, waivedBy: action === 'reset' ? null : currentUser.fullName, waivedAt: action === 'reset' ? null : new Date() };
                }
                return r;
            });
            batch.update(docRef, { records: updatedRecords, updatedAt: serverTimestamp() });
        }
        await batch.commit();
        toast({ title: 'نجاح الإجراء الجماعي' });
        fetchAttendance();
    } finally { setIsBulkProcessing(false); }
  };

  const handleGeneratePayroll = async () => {
    if (!firestore || !currentUser) return;
    setIsProcessing(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            for (const emp of employees) {
                const att = attendanceDocs.find(a => a.employeeId === emp.id);
                const fullSalary = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
                const dailyRate = fullSalary / 26;
                let netSalary = fullSalary;
                let deductionAmount = 0;
                if (att) {
                    let totalDeductionDays = 0;
                    att.records?.forEach(r => { if (r.auditStatus !== 'waived') totalDeductionDays += (r.manualDeductionDays || 0); });
                    deductionAmount = totalDeductionDays * dailyRate;
                    netSalary = Math.max(0, fullSalary - deductionAmount);
                }
                const pRef = doc(firestore, 'payroll', `${year}-${month}-${emp.id}`);
                transaction.set(pRef, cleanFirestoreData({ employeeId: emp.id, employeeName: emp.fullName, year: parseInt(year), month: parseInt(month), earnings: { basicSalary: emp.basicSalary, housingAllowance: emp.housingAllowance, transportAllowance: emp.transportAllowance, commission: 0 }, deductions: { absenceDeduction: deductionAmount, otherDeductions: 0 }, netSalary, status: 'draft', type: 'Monthly', createdAt: serverTimestamp(), createdBy: currentUser.id }), { merge: true });
            }
        });
        toast({ title: 'تم توليد الرواتب' });
        setIsGenerated(true);
        setShowGenerateConfirm(false);
    } finally { setIsProcessing(false); }
  };

  const handleExportTotalsExcel = () => {
    if (attendanceDocs.length === 0) return;
    const data = attendanceDocs.map(doc => {
        const emp = employees.find(e => e.id === doc.employeeId);
        const presentDays = doc.summary?.presentDays ?? doc.records?.filter(r => r.status === 'present').length;
        const absentDays = doc.summary?.absentDays ?? doc.records?.filter(r => r.status === 'absent').length;
        const lateDays = doc.summary?.lateDays ?? doc.records?.filter(r => r.status === 'late').length;

        return {
            'الرقم الوظيفي': emp?.employeeNumber || '---',
            'اسم الموظف': emp?.fullName || 'غير معروف',
            'القسم': emp?.department || '-',
            'أيام الحضور': presentDays,
            'أيام الغياب': absentDays,
            'عدد التأخيرات': lateDays
        };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "اجماليات الحضور");
    XLSX.writeFile(wb, `اجماليات_الحضور_${month}_${year}.xlsx`);
  };

  const handleExportDetailedExcel = () => {
    if (anomalies.length === 0) return;
    const data = anomalies.map(a => ({
        'الرقم الوظيفي': a.employeeNumber,
        'اسم الموظف': a.empName,
        'التاريخ': format(toFirestoreDate(a.record.date)!, 'yyyy-MM-dd'),
        'نوع المخالفة': a.record.anomalyDescription,
        'الخصم (أيام)': a.record.manualDeductionDays,
        'حالة التدقيق': a.record.auditStatus === 'verified' ? 'معتمد' : a.record.auditStatus === 'waived' ? 'متغاضى عنه' : 'قيد المراجعة'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل المخالفات");
    XLSX.writeFile(wb, `تفاصيل_المخالفات_${month}_${year}.xlsx`);
  };

  const handlePrint = (type: 'summary' | 'detailed') => {
    setIsPrintingSummary(type === 'summary');
    setTimeout(() => { window.print(); }, 100);
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

  const pendingCount = anomalies.filter(a => a.record.auditStatus === 'pending').length;
  const filteredEmployees = useMemo(() => {
    if (!mappingSearch) return employees;
    const lower = mappingSearch.toLowerCase();
    return employees.filter(e => e.fullName.toLowerCase().includes(lower) || e.employeeNumber.includes(lower));
  }, [employees, mappingSearch]);

  return (
    <div className="space-y-8" dir="rtl">
        <div className="space-y-3 mb-6 no-print">
          <div className="flex items-center gap-3 flex-wrap p-2">
            <div className="flex items-center gap-2">
              <Label className="font-black text-sm text-muted-foreground">الفترة الرقابية:</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-24 rounded-xl h-9 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">{[2024,2025,2026,2027].map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-28 rounded-xl h-9 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">{Array.from({length:12},(_,i)=>i+1).map(m=><SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-3xl border-2 border-primary/10 bg-primary/5 space-y-3 shadow-sm">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <RefreshCw className="h-3 w-3"/> إدارة بيانات الحضور
                </span>
                <div className="flex gap-2">
                    <Button onClick={fetchAttendance} disabled={attLoading} className="flex-1 h-10 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 gap-2 shadow-md active:translate-y-0.5 transition-all">
                        {attLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
                        تحميل البيانات
                    </Button>
                </div>
              </div>

              {attendanceDocs.length > 0 && (
                <div className="p-4 rounded-3xl border-2 border-muted bg-muted/30 space-y-3 shadow-sm animate-in fade-in zoom-in-95 md:col-span-3">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck className="h-3 w-3"/> قرارات التدقيق والخيارات الرقابية
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="h-6 text-[9px] text-red-600 hover:bg-red-50 gap-1 font-bold">
                            <Trash2 className="h-3 w-3"/> تصفير بيانات الشهر
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <div className="p-2 rounded-2xl border-2 border-purple-100 bg-white flex gap-2 flex-grow">
                            <Button onClick={() => handleBulkAuditAction('waive')} disabled={isBulkProcessing || pendingCount === 0 || isMonthPaid} variant="outline" className="flex-1 h-9 rounded-xl font-bold text-[10px] border-green-300 text-green-700 hover:bg-green-50 gap-1">
                                <CheckCircle2 className="h-3 w-3"/> تغاضي جماعي
                            </Button>
                            <Button onClick={() => handleBulkAuditAction('apply')} disabled={isBulkProcessing || pendingCount === 0 || isMonthPaid} variant="outline" className="flex-1 h-9 rounded-xl font-bold text-[10px] border-red-300 text-red-700 hover:bg-red-50 gap-1">
                                <XCircle className="h-3 w-3"/> خصم جماعي
                            </Button>
                        </div>
                        
                        <div className="flex gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-9 rounded-xl font-black text-xs gap-2 border-primary/20 text-primary">
                                        <FileDown className="h-4 w-4" /> تصدير Excel <ChevronDown className="h-3 w-3 opacity-50"/>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent dir="rtl" className="w-56 rounded-xl shadow-2xl border-none">
                                    <DropdownMenuItem onClick={handleExportTotalsExcel} className="py-3 font-bold gap-2">
                                        <LayoutGrid className="h-4 w-4 text-primary" /> اجمالي الشهر (للمحاسبة)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportDetailedExcel} className="py-3 font-bold gap-2">
                                        <ListFilter className="h-4 w-4 text-green-600" /> تقرير المخالفات التفصيلي
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-9 rounded-xl font-black text-xs gap-2 border-primary/20 text-primary">
                                        <Printer className="h-4 w-4" /> طباعة التقارير <ChevronDown className="h-3 w-3 opacity-50"/>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent dir="rtl" className="w-56 rounded-xl shadow-2xl border-none">
                                    <DropdownMenuItem onClick={() => handlePrint('summary')} className="py-3 font-bold gap-2">
                                        <LayoutGrid className="h-4 w-4 text-blue-600" /> كشف الحضور الإجمالي
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePrint('detailed')} className="py-3 font-bold gap-2">
                                        <ListFilter className="h-4 w-4 text-primary" /> سجل المخالفات التفصيلي
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
              )}
          </div>
        </div>

        <div className="space-y-6">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
                <CardHeader className="bg-[#0f172a] text-white py-10 px-10 border-b-0 no-print">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                        <div className="space-y-2 text-right order-1 lg:order-2">
                            <div className="flex items-center justify-end gap-3">
                                <CardTitle className="text-3xl font-black text-white tracking-tight">مركز تدقيق الحضور والمخالفات</CardTitle>
                                <div className="p-3 bg-primary/20 rounded-2xl text-primary shadow-inner">
                                    <ShieldCheck className="h-8 w-8" />
                                </div>
                            </div>
                            <CardDescription className="text-slate-400 font-bold text-base leading-relaxed">
                                مراجعة المخالفات المكتشفة واتخاذ قرارات التغاضي أو الخصم المالي قبل صرف الرواتب.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {attLoading ? (
                        <div className="p-20 text-center space-y-4">
                            <Loader2 className="animate-spin h-12 w-12 mx-auto text-primary" />
                            <p className="font-black text-muted-foreground animate-pulse">جاري فحص قاعدة البيانات...</p>
                        </div>
                    ) : (
                        <>
                            <div id="audit-printable-area" className={cn(isPrintingSummary ? "hidden" : "block")}>
                                <div className="hidden print:block p-8 border-b-2 mb-6">
                                    <h1 className="text-2xl font-black">سجل مخالفات الحضور والتدقيق الميداني</h1>
                                    <p className="font-bold">شهر: {month} / {year}</p>
                                </div>
                                <Table>
                                    <TableHeader className="bg-muted/50 h-16">
                                        <TableRow className="border-none">
                                            <TableHead className="px-10 font-black text-[#7209B7]">الرقم الوظيفي</TableHead>
                                            <TableHead className="font-black text-[#7209B7]">اسم الموظف</TableHead>
                                            <TableHead className="font-black text-[#7209B7]">التاريخ</TableHead>
                                            <TableHead className="font-black text-[#7209B7]">المخالفة</TableHead>
                                            <TableHead className="font-black text-[#7209B7]">سجل البصمات</TableHead>
                                            <TableHead className="font-black text-[#7209B7]">الخصم</TableHead>
                                            <TableHead className="text-center no-print font-black text-[#7209B7]">القرار</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {anomalies.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="h-48 text-center text-green-700 font-black italic">سجل الحضور نظيف تماماً لهذا الشهر!</TableCell></TableRow>
                                        ) : anomalies.map((item, idx) => {
                                            const recordDate = toFirestoreDate(item.record.date);
                                            return (
                                            <TableRow key={idx} className={cn("h-24 transition-colors", item.record.auditStatus === 'waived' ? "bg-green-50/30 opacity-60" : item.record.status === 'absent' ? "bg-red-50/40" : "bg-white")}>
                                                <TableCell className="px-10 font-mono font-bold opacity-60 text-xs">{item.employeeNumber}</TableCell>
                                                <TableCell className="font-black text-lg text-gray-800">{item.empName}</TableCell>
                                                <TableCell className="font-bold text-xs text-gray-600">{recordDate ? format(recordDate, 'dd/MM/yyyy', { locale: ar }) : '-'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={item.record.status === 'absent' ? 'destructive' : 'outline'} className="font-black text-[8px] uppercase">
                                                        {item.record.anomalyDescription}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{item.record.status === 'absent' ? <div className="h-8 w-8 rounded-full border-2 border-dashed border-red-200 flex items-center justify-center opacity-40"><XCircle className="h-4 w-4 text-red-400"/></div> : <div className="flex flex-wrap gap-1">{(item.record.allPunches || []).map((p, i) => <Badge key={i} variant="outline" className="font-mono text-[9px] h-5 bg-background shadow-inner">{p}</Badge>)}</div>}</TableCell>
                                                <TableCell><div className="flex flex-col"><span className="font-black text-2xl text-primary font-mono">{item.record.manualDeductionDays || 0}</span><span className="text-[9px] font-bold text-muted-foreground uppercase">يوم خصم</span></div></TableCell>
                                                <TableCell className="text-center no-print px-6">
                                                    {item.record.auditStatus === 'pending' ? (
                                                        <div className="flex justify-center gap-3">
                                                            <Button type="button" size="sm" variant="ghost" className="bg-green-50 text-green-700 border-2 border-green-200 h-10 px-6 rounded-2xl font-black shadow-sm hover:bg-green-600 hover:text-white" onClick={() => handleAuditAction(item.docId, item.record.date, 'waive')} disabled={isMonthPaid}>تغاضي</Button>
                                                            <Button type="button" size="sm" className="bg-red-600 hover:bg-red-700 text-white h-10 px-6 rounded-2xl font-black shadow-lg shadow-red-100" onClick={() => handleAuditAction(item.docId, item.record.date, 'apply')} disabled={isMonthPaid}>اعتماد</Button>
                                                        </div>
                                                    ) : <Button type="button" variant="outline" size="sm" onClick={() => handleAuditAction(item.docId, item.record.date, 'reset')} className="text-muted-foreground h-9 rounded-xl gap-2 font-bold bg-muted/30 border-dashed border-2" disabled={isMonthPaid}><History className="h-3 w-3"/>تغيير القرار</Button>}
                                                </TableCell>
                                            </TableRow>
                                        )})}
                                    </TableBody>
                                </Table>
                            </div>

                            <div id="summary-printable-area" className={cn(isPrintingSummary ? "block" : "hidden", "print:block")}>
                                <div className="hidden print:block p-8 border-b-2 mb-6 text-center">
                                    <h1 className="text-2xl font-black">كشف حضور وانصراف الموظفين الإجمالي</h1>
                                    <p className="font-bold">الفترة: {month} / {year}</p>
                                </div>
                                <Table>
                                    <TableHeader className="bg-muted/50 h-16">
                                        <TableRow className="border-none">
                                            <TableHead className="px-10 font-black">الرقم الوظيفي</TableHead>
                                            <TableHead className="font-black">اسم الموظف</TableHead>
                                            <TableHead className="font-black">القسم</TableHead>
                                            <TableHead className="text-center font-black">أيام الحضور</TableHead>
                                            <TableHead className="text-center font-black">أيام الغياب</TableHead>
                                            <TableHead className="text-center font-black">عدد التأخيرات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {attendanceDocs.map((doc) => {
                                            const emp = employees.find(e => e.id === doc.employeeId);
                                            const presentDays = doc.summary?.presentDays ?? doc.records?.filter(r => r.status === 'present').length;
                                            const absentDays = doc.summary?.absentDays ?? doc.records?.filter(r => r.status === 'absent').length;
                                            const lateDays = doc.summary?.lateDays ?? doc.records?.filter(r => r.status === 'late').length;
                                            return (
                                                <TableRow key={doc.id} className="h-16 border-b">
                                                    <TableCell className="px-10 font-mono font-bold">{emp?.employeeNumber || '---'}</TableCell>
                                                    <TableCell className="font-black">{emp?.fullName || 'غير معروف'}</TableCell>
                                                    <TableCell className="text-xs">{emp?.department || '-'}</TableCell>
                                                    <TableCell className="text-center font-mono">{presentDays}</TableCell>
                                                    <TableCell className="text-center font-mono text-red-600">{absentDays}</TableCell>
                                                    <TableCell className="text-center font-mono text-orange-600">{lateDays}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>

        <div className="no-print pt-10 border-t flex justify-center pb-20">
            <Button 
                onClick={() => setShowGenerateConfirm(true)} 
                disabled={isProcessing || isGenerated || pendingCount > 0 || attendanceDocs.length === 0 || isMonthPaid} 
                className={cn(
                    "h-16 px-20 rounded-[2.5rem] font-black text-2xl shadow-xl shadow-primary/20 gap-4 min-w-[350px] active:translate-y-1 transition-all",
                    isMonthPaid ? "bg-green-600 hover:bg-green-700 cursor-not-allowed opacity-90" : "bg-primary text-white hover:bg-primary/90"
                )}
            >
                {isProcessing ? <Loader2 className="animate-spin h-8 w-8"/> : isMonthPaid ? <CheckCircle2 className="h-8 w-8"/> : <Banknote className="h-8 w-8"/>} 
                {isMonthPaid 
                    ? 'تم اعتماد وصرف رواتب هذا الشهر' 
                    : (pendingCount > 0 
                        ? `بانتظار مراجعتك (${pendingCount} مخالفة)` 
                        : 'اعتماد وصرف الرواتب النهائية')}
            </Button>
        </div>

        <AlertDialog open={showGenerateConfirm} onOpenChange={setShowGenerateConfirm}>
            <AlertDialogContent dir="rtl" className="rounded-3xl border-none shadow-2xl">
                <AlertDialogHeader>
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary w-fit mb-4 shadow-inner"><Banknote className="h-10 w-10"/></div>
                    <AlertDialogTitle className="text-2xl font-black">تأكيد اعتماد وصرف الرواتب؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-base font-medium leading-relaxed">
                        أنت على وشك توليد كشوف الرواتب النهائية لـ {employees.length} موظف لشهر <strong>{month}/{year}</strong>.
                        <br/><br/>
                        <span className="font-black text-primary underline">الأثر المالي:</span> سيقوم النظام بإنشاء "مسودات" كشوف الرواتب بانتظار التحويل البنكي وتوليد القيود المحاسبية للمصاريف.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleGeneratePayroll} disabled={isProcessing} className="bg-primary hover:bg-primary/90 rounded-xl font-black h-12 px-12 shadow-lg shadow-primary/20">
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'نعم، اعتماد الآن'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
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
                    <AlertDialogAction onClick={handleDeleteMonth} disabled={attLoading} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black h-12 px-12 shadow-lg">
                        {attLoading ? <Loader2 className="animate-spin h-4 w-4 animate-spin"/> : 'نعم، قم بالتصفير الآن'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}