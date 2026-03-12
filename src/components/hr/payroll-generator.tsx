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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, updateDoc, Timestamp, orderBy, limit, runTransaction } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { RefreshCw, Trash2, FileDown, FileText, Printer, CheckCircle2, XCircle, Loader2, ShieldCheck, ShieldAlert, Ban, Info, RotateCcw, Banknote, CalendarDays, History, AlertTriangle, ListFilter, LayoutList, ChevronDown } from 'lucide-react';
import type { Employee, MonthlyAttendance, AttendanceRecord, LeaveRequest, PermissionRequest, Holiday } from '@/lib/types';
import { format, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cleanFirestoreData, cn, formatCurrency } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';

export function PayrollGenerator() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { branding } = useBranding();
  const { user: currentUser } = useAuth();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [attendanceDocs, setAttendanceDocs] = useState<MonthlyAttendance[]>([]);
  const [attLoading, setAttLoading] = useState(false);

  useEffect(() => {
    if (!firestore) return;
    const fetchEmployees = async () => {
        setEmployeesLoading(true);
        try {
            const q = query(collection(firestore, 'employees'), where('status', 'in', ['active', 'on-leave']));
            const snap = await getDocs(q);
            setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
        } finally {
            setEmployeesLoading(false);
        }
    };
    fetchEmployees();
  }, [firestore]);

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
                } else if (emp.status !== 'on-leave') {
                    deductionAmount = fullSalary; netSalary = 0;
                }
                const pRef = doc(firestore, 'payroll', `${year}-${month}-${emp.id}`);
                transaction.set(pRef, cleanFirestoreData({ employeeId: emp.id, employeeName: emp.fullName, year: parseInt(year), month: parseInt(month), earnings: { basicSalary: emp.basicSalary, housingAllowance: emp.housingAllowance, transportAllowance: emp.transportAllowance, commission: 0 }, deductions: { absenceDeduction: deductionAmount, otherDeductions: 0 }, netSalary, status: 'draft', type: 'Monthly', createdAt: serverTimestamp(), createdBy: currentUser.id }), { merge: true });
            }
        });
        toast({ title: 'تم توليد الرواتب' });
    } finally { setIsProcessing(false); }
  };

  // --- دوال التصدير المحدثة ---

  const handleExportTotalsExcel = () => {
    if (attendanceDocs.length === 0) return;
    const data = attendanceDocs.map(doc => {
        const emp = employees.find(e => e.id === doc.employeeId);
        return {
            'الرقم الوظيفي': emp?.employeeNumber || '---',
            'اسم الموظف': emp?.fullName || 'غير معروف',
            'القسم': emp?.department || '-',
            'أيام الحضور': doc.summary?.presentDays || 0,
            'أيام الغياب': doc.summary?.absentDays || 0,
            'أيام الإجازة': doc.summary?.leaveDays || 0,
            'عدد التأخيرات': doc.summary?.lateDays || 0
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

  const handlePrintAudit = () => window.print();

  const pendingCount = anomalies.filter(a => a.record.auditStatus === 'pending').length;

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
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck className="h-3 w-3"/> قرارات التدقيق الجماعي
                        </span>
                        {pendingCount > 0 && <Badge className="bg-purple-600 text-[8px] h-4 px-2">{pendingCount} معلق</Badge>}
                    </div>

                    <div className="p-3 rounded-2xl border-2 border-purple-100 bg-purple-50/30 flex gap-2">
                        <Button onClick={() => handleBulkAuditAction('waive')} disabled={isBulkProcessing || pendingCount === 0} variant="outline" className="flex-1 h-10 rounded-xl font-bold text-[10px] border-green-300 text-green-700 hover:bg-green-50 gap-1">
                            {isBulkProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <CheckCircle2 className="h-3 w-3"/>} تغاضي عن الكل
                        </Button>
                        <Button onClick={() => handleBulkAuditAction('apply')} disabled={isBulkProcessing || pendingCount === 0} variant="outline" className="flex-1 h-10 rounded-xl font-bold text-[10px] border-red-300 text-red-700 hover:bg-red-50 gap-1">
                            {isBulkProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <XCircle className="h-3 w-3"/>} خصم للكل
                        </Button>
                        <Button onClick={() => handleBulkAuditAction('reset')} disabled={isBulkProcessing} variant="outline" className="flex-1 h-10 rounded-xl font-bold text-[10px] border-muted text-muted-foreground hover:bg-muted gap-1">
                            {isBulkProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <RotateCcw className="h-3 w-3"/>} إعادة تعيين
                        </Button>
                    </div>
                </div>
              )}
          </div>
        </div>

        <div className="space-y-6">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
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

                        <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] shadow-2xl backdrop-blur-sm min-w-[420px] order-2 lg:order-1" dir="rtl">
                            <div className="grid grid-cols-2 gap-4">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="bg-white/10 border-white/20 text-white font-black h-11 rounded-xl gap-2 hover:bg-white/20">
                                            <FileDown className="h-4 w-4 text-green-400" /> تصدير Excel <ChevronDown className="h-3 w-3 opacity-50"/>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent dir="rtl" className="w-56 rounded-xl shadow-2xl border-none">
                                        <DropdownMenuItem onClick={handleExportTotalsExcel} className="py-3 font-bold gap-2">
                                            <LayoutList className="h-4 w-4 text-primary" /> اجمالي الشهر (للمحاسبة)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleExportDetailedExcel} className="py-3 font-bold gap-2">
                                            <ListFilter className="h-4 w-4 text-green-600" /> سجل المخالفات التفصيلي
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="bg-white/10 border-white/20 text-white font-black h-11 rounded-xl gap-2 hover:bg-white/20">
                                            <Printer className="h-4 w-4 text-blue-400" /> طباعة التقارير <ChevronDown className="h-3 w-3 opacity-50"/>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent dir="rtl" className="w-56 rounded-xl shadow-2xl border-none">
                                        <DropdownMenuItem onClick={handlePrintAudit} className="py-3 font-bold gap-2">
                                            <FileText className="h-4 w-4 text-primary" /> سجل التدقيق الحالي
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="py-3 font-bold gap-2 text-red-600">
                                            <Trash2 className="h-4 w-4" /> تصفير بيانات الفترة
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
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
                        <div id="audit-printable-area">
                            <Table>
                                <TableHeader className="bg-muted/50 h-16">
                                    <TableRow className="border-none">
                                        <TableHead className="px-10 font-black text-[#7209B7]">رقم الملف</TableHead>
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
                                        const isAbsent = item.record.status === 'absent';
                                        const isConflict = item.record.anomalyDescription?.includes('تعارض');
                                        const recordDate = toFirestoreDate(item.record.date);
                                        return (
                                        <TableRow key={idx} className={cn("h-24 transition-colors", item.record.auditStatus === 'waived' ? "bg-green-50/30 opacity-60" : isConflict ? "bg-amber-50/50" : isAbsent ? "bg-red-50/40" : "bg-white")}>
                                            <TableCell className="px-10 font-mono font-bold opacity-60 text-xs">{item.employeeNumber}</TableCell>
                                            <TableCell className="font-black text-lg text-gray-800">{item.empName}</TableCell>
                                            <TableCell className="font-bold text-xs text-gray-600">{recordDate ? format(recordDate, 'dd/MM/yyyy', { locale: ar }) : '-'}</TableCell>
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
                                            <TableCell>{isAbsent ? <div className="h-8 w-8 rounded-full border-2 border-dashed border-red-200 flex items-center justify-center opacity-40"><XCircle className="h-4 w-4 text-red-400"/></div> : <div className="flex flex-wrap gap-1">{(item.record.allPunches || []).map((p, i) => <Badge key={i} variant="outline" className="font-mono text-[9px] h-5 bg-background shadow-inner">{p}</Badge>)}</div>}</TableCell>
                                            <TableCell><div className="flex flex-col"><span className="font-black text-2xl text-primary font-mono">{item.record.manualDeductionDays || 0}</span><span className="text-[9px] font-bold text-muted-foreground uppercase">يوم خصم</span></div></TableCell>
                                            <TableCell className="text-center no-print px-6">
                                                {item.record.auditStatus === 'pending' ? (
                                                    <div className="flex justify-center gap-3">
                                                        <Button type="button" size="sm" variant="ghost" className="bg-green-50 text-green-700 border-2 border-green-200 h-10 px-6 rounded-2xl font-black shadow-sm hover:bg-green-600 hover:text-white" onClick={() => handleAuditAction(item.docId, item.record.date, 'waive')}>تغاضي</Button>
                                                        <Button type="button" size="sm" className="bg-red-600 hover:bg-red-700 text-white h-10 px-6 rounded-2xl font-black shadow-lg shadow-red-100" onClick={() => handleAuditAction(item.docId, item.record.date, 'apply')}>اعتماد</Button>
                                                    </div>
                                                ) : <Button type="button" variant="outline" size="sm" onClick={() => handleAuditAction(item.docId, item.record.date, 'reset')} className="text-muted-foreground h-9 rounded-xl gap-2 font-bold bg-muted/30 border-dashed border-2"><History className="h-3 w-3"/>تغيير القرار</Button>}
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <div className="no-print pt-10 border-t flex justify-center pb-20">
            <Button 
                onClick={handleGeneratePayroll} 
                disabled={isProcessing || pendingCount > 0 || attendanceDocs.length === 0} 
                className="h-16 px-20 rounded-[2.5rem] font-black text-2xl shadow-xl shadow-primary/20 bg-primary text-white hover:bg-primary/90 gap-4 min-w-[350px] active:translate-y-1 transition-all"
            >
                {isProcessing ? <Loader2 className="animate-spin h-8 w-8"/> : <Banknote className="h-8 w-8"/>} 
                {pendingCount > 0 ? `بانتظار مراجعتك (${pendingCount} مخالفة)` : 'اعتماد وصرف الرواتب النهائية'}
            </Button>
        </div>

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
                        {attLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : 'نعم، قم بالتصفير الآن'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
