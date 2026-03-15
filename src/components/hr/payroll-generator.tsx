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
  TableRow,
  TableFooter
} from '@/components/ui/table';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, updateDoc, Timestamp, orderBy, limit, collectionGroup, deleteDoc, runTransaction } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { RefreshCw, Trash2, FileDown, FileText, Printer, CheckCircle2, XCircle, Loader2, ShieldCheck, ShieldAlert, Ban, Info, RotateCcw, Banknote, CalendarDays, History, AlertTriangle, LayoutGrid, ListFilter, ChevronDown, CalendarCheck, Sparkles, FileSpreadsheet, Save, Badge } from 'lucide-react';
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
import { parse, format, isValid, getDay, isAfter, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cleanFirestoreData, cn, formatCurrency } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAppTheme } from '@/context/theme-context';

export function PayrollGenerator() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { branding } = useBranding();
  const { user: currentUser } = useAuth();
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [attLoading, setAttLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [isPrintingSummary, setIsPrintingSummary] = useState(false);
  const [monthIsPaid, setMonthIsPaid] = useState(false);
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', 'in', ['active', 'on-leave'])]);
  const [attendanceDocs, setAttendanceDocs] = useState<MonthlyAttendance[]>([]);

  const payrollQuery = useMemo(() => [
    where('year', '==', parseInt(year)),
    where('month', '==', parseInt(month))
  ], [year, month]);
  
  const { data: monthPayslips, loading: payrollLoading } = useSubscription<Payslip>(firestore, 'payroll', payrollQuery);

  const isMonthPaid = monthIsPaid || (monthPayslips.length > 0 && monthPayslips.some(p => p.status === 'paid'));

  useEffect(() => {
    setAttendanceDocs([]);
    setMonthIsPaid(false);
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

      const payrollSnap = await getDocs(query(
        collection(firestore, 'payroll'),
        where('year', '==', parseInt(year)),
        where('month', '==', parseInt(month)),
        where('status', '==', 'paid'),
        limit(1)
      ));
      setMonthIsPaid(!payrollSnap.empty);

      if (snap.empty) {
          toast({ title: 'لا توجد بيانات', description: 'لم يتم العثور على سجلات حضور للشهر المختار.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ في التحميل' });
    } finally {
      setAttLoading(false);
    }
  };

  const handleGeneratePayroll = async () => {
    if (!firestore || !currentUser) return;
    const filteredEmployees = employees.filter(emp => emp.jobTitle !== 'عامل يومية');
    
    setIsProcessing(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            for (const emp of filteredEmployees) {
                const att = attendanceDocs.find(a => a.employeeId === emp.id);
                const fullSalary = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
                const dailyRate = fullSalary / 26;
                
                let absenceDeduction = 0;
                let lateDeduction = 0;
                
                if (att) {
                    att.records?.forEach(r => {
                        if (r.auditStatus !== 'waived') {
                            if (r.status === 'absent') {
                                absenceDeduction += (r.manualDeductionDays || 1) * dailyRate;
                            } else if (r.status === 'late') {
                                lateDeduction += (r.manualDeductionDays || 0) * dailyRate;
                            }
                        }
                    });
                }

                const netSalary = Math.max(0, fullSalary - (absenceDeduction + lateDeduction));
                const pRef = doc(firestore, 'payroll', `${year}-${month}-${emp.id}`);
                
                transaction.set(pRef, cleanFirestoreData({
                    employeeId: emp.id,
                    employeeName: emp.fullName,
                    year: parseInt(year),
                    month: parseInt(month),
                    type: emp.status === 'on-leave' ? 'Leave' : 'Monthly',
                    earnings: { basicSalary: emp.basicSalary, housingAllowance: emp.housingAllowance, transportAllowance: emp.transportAllowance, commission: 0 },
                    deductions: { 
                        absenceDeduction, 
                        lateDeduction, 
                        otherDeductions: 0 
                    },
                    netSalary,
                    status: 'draft',
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id
                }), { merge: true });
            }
        });
        toast({ title: 'تم توليد الرواتب' });
        setIsGenerated(true);
        setShowGenerateConfirm(false);
    } finally { setIsProcessing(false); }
  };

  const handleDeleteMonth = async () => {
    if (!firestore) return;
    setAttLoading(true);
    try {
        const q = query(
            collection(firestore, 'attendance'),
            where('year', '==', parseInt(year)),
            where('month', '==', parseInt(month))
        );
        const snap = await getDocs(q);
        
        const batch = writeBatch(firestore);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        setAttendanceDocs([]);
        toast({ title: 'تم التصفير بنجاح', description: `تم حذف سجلات الحضور لشهر ${month}/${year}.` });
        setShowDeleteConfirm(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ في الحذف', description: e.message });
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

  const handlePrint = (type: 'summary' | 'detailed') => {
    setIsPrintingSummary(type === 'summary');
    setTimeout(() => { window.print(); }, 100);
  };

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
              <div className={cn(
                  "p-4 rounded-3xl border-2 border-primary/10 space-y-3 shadow-sm",
                  isGlass ? "glass-effect" : "bg-primary/5"
              )}>
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
                <div className={cn(
                    "p-4 rounded-3xl border-2 space-y-3 shadow-sm animate-in fade-in zoom-in-95 md:col-span-3",
                    isGlass ? "glass-effect" : "bg-muted/30 border-muted"
                )}>
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
                                        <Printer className="h-4 w-4" /> طباعة التقارير <ChevronDown className="h-3 w-3 opacity-50"/>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" dir="rtl" className="w-56 rounded-xl shadow-2xl border-none">
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
            <Card className={cn(
                "rounded-[2.5rem] border-none shadow-xl overflow-hidden",
                isGlass ? "glass-effect" : "bg-white"
            )}>
                <CardHeader className={cn(
                    "py-10 px-10 border-b no-print",
                    isGlass ? "bg-white/5" : "bg-gradient-to-l from-white to-purple-50"
                )}>
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                        <div className="space-y-2 text-right order-1 lg:order-2">
                            <div className="flex items-center justify-end gap-3">
                                <CardTitle className="text-3xl font-black text-gray-800 tracking-tight">مركز تدقيق الحضور والمخالفات</CardTitle>
                                <div className="bg-primary/10 rounded-2xl text-primary shadow-inner p-2">
                                    <ShieldCheck className="h-8 w-8" />
                                </div>
                            </div>
                            <CardDescription className="text-muted-foreground font-bold text-base leading-relaxed">
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
                                <Table className="border-collapse">
                                    <TableHeader className="bg-muted/50 h-16">
                                        <TableRow className="border-none">
                                            <TableHead className="px-10 font-black border">الرقم الوظيفي</TableHead>
                                            <TableHead className="font-black border">اسم الموظف</TableHead>
                                            <TableHead className="font-black border">القسم</TableHead>
                                            <TableHead className="text-center font-black border">أيام الحضور</TableHead>
                                            <TableHead className="text-center font-black border">أيام الغياب</TableHead>
                                            <TableHead className="text-center font-black border">عدد التأخيرات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {attendanceDocs.map((doc) => {
                                            const emp = employees.find(e => e.id === doc.employeeId);
                                            if (emp?.jobTitle === 'عامل يومية') return null;

                                            const presentDays = doc.records?.filter(r => r.status === 'present').length || 0;
                                            const absentDays = doc.records?.filter(r => r.status === 'absent').length || 0;
                                            const lateDays = doc.records?.filter(r => r.status === 'late').length || 0;
                                            return (
                                                <TableRow key={doc.id} className="h-16 border">
                                                    <TableCell className="px-10 font-mono font-bold border">{emp?.employeeNumber || '---'}</TableCell>
                                                    <TableCell className="font-black border">{emp?.fullName || 'غير معروف'}</TableCell>
                                                    <TableCell className="text-xs border">{emp?.department || '-'}</TableCell>
                                                    <TableCell className="text-center font-mono border">{presentDays}</TableCell>
                                                    <TableCell className="text-center font-mono text-red-600 border">{absentDays}</TableCell>
                                                    <TableCell className="text-center font-mono text-orange-600 border">{lateDays}</TableCell>
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
                disabled={isProcessing || payrollLoading || pendingCount > 0 || attendanceDocs.length === 0 || isMonthPaid} 
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