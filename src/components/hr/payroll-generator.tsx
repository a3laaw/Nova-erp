'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, updateDoc, Timestamp, runTransaction } from 'firebase/firestore';
import type { Employee, MonthlyAttendance, AttendanceRecord, Account, Payslip } from '@/lib/types';
import { 
    RefreshCw, 
    Trash2, 
    FileDown, 
    Printer, 
    CheckCircle2, 
    XCircle, 
    Loader2, 
    ShieldCheck, 
    Ban, 
    FileText, 
    Info, 
    RotateCcw, 
    Banknote, 
    CalendarDays,
    History,
    AlertTriangle
} from 'lucide-react';
import { formatCurrency, cleanFirestoreData, cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import * as XLSX from 'xlsx';
import { useBranding } from '@/context/branding-context';
import { Separator } from '@/components/ui/separator';
import { Logo } from '../layout/logo';

export function PayrollGenerator() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { branding } = useBranding();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isExportingSummary, setIsExportingSummary] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [attendanceDocs, setAttendanceDocs] = useState<MonthlyAttendance[]>([]);
  const [attLoading, setAttLoading] = useState(false);

  // --- جلب بيانات الموظفين النشطين ---
  useEffect(() => {
    if (!firestore) return;
    const fetchEmployees = async () => {
        setEmployeesLoading(true);
        try {
            const q = query(collection(firestore, 'employees'), where('status', '==', 'active'));
            const snap = await getDocs(q);
            setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
        } finally {
            setEmployeesLoading(false);
        }
    };
    fetchEmployees();
  }, [firestore]);

  // --- دالة تحميل بيانات الحضور (يدوي) ---
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
      } else {
          toast({ title: 'تم التحميل', description: `تم جلب ${data.length} ملف حضور للمراجعة.` });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ في التحميل' });
    } finally {
      setAttLoading(false);
    }
  };

  // --- دالة حذف بيانات الشهر ---
  const handleDeleteMonth = async () => {
    if (!firestore) return;
    const confirmed = window.confirm(`هل أنت متأكد من حذف جميع بيانات الحضور لشهر ${month}/${year}؟ سيؤدي هذا لتصفير سجلات هذا الشهر تماماً.`);
    if (!confirmed) return;
    
    setAttLoading(true);
    try {
      const snap = await getDocs(query(
        collection(firestore, 'attendance'),
        where('year', '==', parseInt(year)),
        where('month', '==', parseInt(month))
      ));
      
      const batch = writeBatch(firestore);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      setAttendanceDocs([]);
      toast({ title: 'تم الحذف', description: `تم تطهير بيانات شهر ${month}/${year} بنجاح.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'خطأ في الحذف' });
    } finally {
      setAttLoading(false);
    }
  };

  // جلب تلقائي فقط عند تغيير الفترة وبشرط وجود داتا محملة مسبقاً (للتزامن)
  useEffect(() => {
    if (attendanceDocs.length > 0) {
      fetchAttendance();
    }
  }, [year, month]);

  // --- حساب المخالفات والأنوماليز للتدقيق ---
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

  // --- دوال التدقيق الفردي ---
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
        toast({ title: 'تم تحديث القرار' });
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ' }); }
  };

  // --- دوال التدقيق الجماعي ---
  const handleBulkAuditAction = async (action: 'waive' | 'apply' | 'reset') => {
    if (!firestore || !currentUser || anomalies.length === 0) return;
    const targets = action === 'reset' ? anomalies : anomalies.filter(a => a.record.auditStatus === 'pending');
    if (targets.length === 0) return;

    setIsBulkProcessing(true);
    try {
        const batch = writeBatch(firestore);
        const updatedDocIds = new Set(targets.map(a => a.docId));
        
        for (const docId of Array.from(updatedDocIds)) {
            const docRef = doc(firestore, 'attendance', docId);
            const currentDoc = attendanceDocs.find(d => d.id === docId);
            if (!currentDoc) continue;

            const updatedRecords = currentDoc.records.map(r => {
                const isTargetAnomaly = targets.some(pa => pa.docId === docId && pa.record.date.seconds === r.date.seconds);
                if (isTargetAnomaly) {
                    let manualDeduction = r.manualDeductionDays;
                    if (action === 'waive') manualDeduction = 0;
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
        toast({ variant: 'destructive', title: 'خطأ' });
    } finally {
        setIsBulkProcessing(false);
    }
  };

  // --- ملخص البيانات للتصدير (يجب تعريفه قبل الدوال التي تستخدمه) ---
  const summaryData = useMemo(() => {
    if (!attendanceDocs || attendanceDocs.length === 0) return [];
    
    return employees.map(emp => {
      const att = attendanceDocs.find(a => a.employeeId === emp.id);
      if (!att) return null;

      let totalAbsent = 0;
      let totalLate = 0;
      let totalDeductionDays = 0;

      att.records?.forEach(r => {
        if (r.auditStatus === 'waived') return;
        if (r.status === 'absent') totalAbsent++;
        else if (r.status === 'late') totalLate++;
        totalDeductionDays += (r.manualDeductionDays || 0);
      });

      const fullSalary = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
      const dailyRate = fullSalary / 26;
      const deductionAmount = totalDeductionDays * dailyRate;

      return {
        empNo: emp.employeeNumber || '',
        name: emp.fullName || '',
        fullSalary,
        absent: totalAbsent,
        lateCount: totalLate,
        deductionDays: totalDeductionDays,
        dailyRate,
        deductionAmount,
        netSalary: fullSalary - deductionAmount
      };
    }).filter(Boolean);
  }, [employees, attendanceDocs]);

  // --- دوال التصدير ---
  const handleExportExcel = useCallback(() => {
    if (summaryData.length === 0) {
        toast({ title: 'لا توجد بيانات', description: 'يرجى تحميل البيانات أولاً.' });
        return;
    }
    const excelRows = summaryData.map(s => ({
        'رقم الموظف': s!.empNo, 
        'اسم الموظف': s!.name, 
        'الراتب الكامل': s!.fullSalary,
        'أيام الغياب': s!.absent, 
        'مرات التأخير': s!.lateCount, 
        'إجمالي أيام الخصم': s!.deductionDays, 
        'إجمالي الخصم (KD)': Math.round(s!.deductionAmount * 1000) / 1000,
        'صافي الراتب المتوقع': Math.round(s!.netSalary * 1000) / 1000,
    }));
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll Summary");
    XLSX.writeFile(wb, `Payroll_Summary_${month}_${year}.xlsx`);
  }, [summaryData, month, year, toast]);

  const handleExportSummaryPDF = useCallback(() => {
    if (summaryData.length === 0) {
        toast({ title: 'لا توجد بيانات للتصدير' });
        return;
    }
    setIsExportingSummary(true);
    setTimeout(() => {
        window.print();
        setIsExportingSummary(false);
    }, 500);
  }, [summaryData]);

  // --- محرك توليد الرواتب النهائي ---
  const handleGeneratePayroll = async () => {
    if (!firestore || !currentUser) return;
    setIsProcessing(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            for (const emp of employees) {
                const att = attendanceDocs.find(a => a.employeeId === emp.id);
                if (!att) continue;

                const fullSalary = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
                const dailyRate = fullSalary / 26;

                let totalDeductionDays = 0;
                att.records?.forEach(r => {
                    if (r.auditStatus !== 'waived') {
                        totalDeductionDays += (r.manualDeductionDays || 0);
                    }
                });

                const deductionAmount = totalDeductionDays * dailyRate;
                const netSalary = Math.max(0, fullSalary - deductionAmount);

                const payslipId = `${year}-${month}-${emp.id}`;
                const pRef = doc(firestore, 'payroll', payslipId);
                
                transaction.set(pRef, cleanFirestoreData({
                    employeeId: emp.id, 
                    employeeName: emp.fullName, 
                    year: parseInt(year), 
                    month: parseInt(month),
                    earnings: { basicSalary: emp.basicSalary, housingAllowance: emp.housingAllowance, transportAllowance: emp.transportAllowance, commission: 0 },
                    deductions: { absenceDeduction: deductionAmount, otherDeductions: 0 },
                    netSalary, 
                    status: 'draft', 
                    type: 'Monthly', 
                    createdAt: serverTimestamp(), 
                    createdBy: currentUser.id
                }), { merge: true });
            }
        });
        toast({ title: 'تم توليد الرواتب', description: 'مسودة الرواتب جاهزة الآن للمراجعة المالية.' });
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ في التوليد' }); }
    finally { setIsProcessing(false); }
  };

  const pendingCount = anomalies.filter(a => a.record.auditStatus === 'pending').length;
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('ar', { month: 'long' });

  return (
    <div className="space-y-8" dir="rtl">
        {/* --- منطقة التحكم الرئيسية (Frames) --- */}
        <div className="space-y-3 mb-6 no-print">
          
          {/* اختيار الفترة */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* الفريم الأول: إدارة البيانات — أحمر */}
              <div className="p-4 rounded-3xl border-2 border-red-100 bg-red-50/30 space-y-3 shadow-[0_4px_0_0_rgba(239,68,68,0.1)]">
                <span className="text-[10px] font-black text-red-700 uppercase tracking-widest flex items-center gap-2">
                    <RotateCcw className="h-3 w-3"/> إدارة سجلات الشهر
                </span>
                <div className="flex gap-2">
                    <Button
                        onClick={fetchAttendance}
                        disabled={attLoading}
                        className="flex-1 h-10 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 gap-2 shadow-md active:translate-y-0.5 transition-all"
                    >
                        {attLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
                        تحميل البيانات
                    </Button>
                    <Button
                        onClick={handleDeleteMonth}
                        disabled={attLoading || attendanceDocs.length === 0}
                        variant="destructive"
                        className="flex-1 h-10 rounded-xl font-bold text-xs gap-2 shadow-md active:translate-y-0.5 transition-all"
                    >
                        <Trash2 className="h-4 w-4"/>
                        تصفير الشهر
                    </Button>
                </div>
              </div>

              {/* الفريم الثاني: التصدير — أخضر */}
              <div className="p-4 rounded-3xl border-2 border-green-100 bg-green-50/30 space-y-3 shadow-[0_4px_0_0_rgba(34,197,94,0.1)]">
                <span className="text-[10px] font-black text-green-700 uppercase tracking-widest flex items-center gap-2">
                    <FileDown className="h-3 w-3"/> أدوات استخراج التقارير
                </span>
                <div className="flex gap-2">
                    <Button
                        onClick={handleExportExcel}
                        disabled={attendanceDocs.length === 0}
                        variant="outline"
                        className="flex-1 h-10 rounded-xl font-bold text-xs border-green-300 text-green-700 hover:bg-green-100 gap-2"
                    >
                        <FileText className="h-4 w-4"/>
                        كشف Excel
                    </Button>
                    <Button
                        onClick={handleExportSummaryPDF}
                        disabled={attendanceDocs.length === 0}
                        variant="outline"
                        className="flex-1 h-10 rounded-xl font-bold text-xs border-green-300 text-green-700 hover:bg-green-100 gap-2"
                    >
                        <Printer className="h-4 w-4"/>
                        طباعة PDF
                    </Button>
                </div>
              </div>

              {/* الفريم الثالث: المراجعة — بنفسجي */}
              {attendanceDocs.length > 0 && (
                <div className="p-4 rounded-3xl border-2 border-purple-100 bg-purple-50/30 space-y-3 shadow-[0_4px_0_0_rgba(168,85,247,0.1)] animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck className="h-3 w-3"/> قرارات التدقيق الجماعي
                        </span>
                        {pendingCount > 0 && <Badge className="bg-purple-600 text-[8px] h-4">{pendingCount} معلق</Badge>}
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => handleBulkAuditAction('waive')} disabled={isBulkProcessing || pendingCount === 0} variant="outline" className="flex-1 h-10 rounded-xl font-bold text-[10px] border-purple-300 text-purple-700 hover:bg-purple-100 gap-1">
                            {isBulkProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <CheckCircle2 className="h-3 w-3"/>} تغاضي للكل
                        </Button>
                        <Button onClick={() => handleBulkAuditAction('apply')} disabled={isBulkProcessing || pendingCount === 0} variant="outline" className="flex-1 h-10 rounded-xl font-bold text-[10px] border-red-300 text-red-700 hover:bg-red-100 gap-1">
                            {isBulkProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <XCircle className="h-3 w-3"/>} خصم للكل
                        </Button>
                    </div>
                </div>
              )}
          </div>
        </div>

        {/* --- مركز تدقيق المخالفات --- */}
        <div className="space-y-6">
            <div className="flex items-center gap-3 px-4">
                <div className="p-2 bg-primary/10 rounded-xl text-primary"><ShieldCheck className="h-6 w-6"/></div>
                <div>
                    <h3 className="text-xl font-black">مركز تدقيق الحضور والمخالفات</h3>
                    <p className="text-xs text-muted-foreground font-medium">مراجعة الغيابات والتأخيرات لكل موظف قبل الاعتماد المالي النهائي.</p>
                </div>
            </div>

            {attLoading ? (
                <div className="p-32 text-center space-y-4">
                    <Loader2 className="animate-spin h-12 w-12 mx-auto text-primary" />
                    <p className="font-black text-muted-foreground animate-pulse">جاري فحص قاعدة البيانات...</p>
                </div>
            ) : attendanceDocs.length === 0 ? (
                <div className="p-32 text-center border-4 border-dashed rounded-[4rem] bg-slate-50/50">
                    <CalendarDays className="h-24 w-24 text-muted-foreground/20 mx-auto mb-6" />
                    <p className="text-3xl font-black text-muted-foreground">لا توجد بيانات محملة</p>
                    <p className="text-sm text-muted-foreground mt-2 font-bold">يرجى اختيار الفترة والضغط على "تحميل بيانات الشهر".</p>
                </div>
            ) : (
                <div id="audit-printable-area" className="border-2 rounded-[2.5rem] overflow-hidden bg-white shadow-2xl">
                    <Table>
                        <TableHeader className="bg-muted/50 h-16">
                            <TableRow className="border-none">
                                <TableHead className="px-8 font-black text-slate-900">الموظف</TableHead>
                                <TableHead className="font-black text-slate-900">التاريخ</TableHead>
                                <TableHead className="font-black text-slate-900">المخالفة</TableHead>
                                <TableHead className="font-black text-slate-900">سجل البصمات</TableHead>
                                <TableHead className="font-black text-slate-900">الخصم</TableHead>
                                <TableHead className="text-center no-print font-black text-slate-900">القرار</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {anomalies.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center text-green-700 font-black italic">سجل الحضور نظيف تماماً لهذا الشهر!</TableCell></TableRow>
                            ) : anomalies.map((item, idx) => {
                                const isAbsent = item.record.status === 'absent';
                                const recordDate = toFirestoreDate(item.record.date);
                                return (
                                <TableRow key={idx} className={cn("h-20 transition-colors", item.record.auditStatus === 'waived' ? "bg-green-50/30 opacity-60" : isAbsent ? "bg-red-50/40" : "bg-white")}>
                                    <TableCell className="px-8"><div className="flex flex-col"><span className="font-black text-base text-gray-800">{item.empName}</span><span className="font-mono text-[10px] text-muted-foreground font-bold">الملف: {item.employeeNumber}</span></div></TableCell>
                                    <TableCell className="font-bold text-xs text-gray-600">{recordDate ? format(recordDate, 'dd/MM/yyyy', { locale: ar }) : '-'}</TableCell>
                                    <TableCell><div className="flex flex-col gap-1"><Badge variant={isAbsent ? 'destructive' : 'outline'} className={cn("w-fit text-[8px] font-black uppercase", isAbsent && "bg-red-600")}>{isAbsent ? 'غياب كامل' : item.record.status === 'half_day' ? 'نصف يوم' : 'تأخير'}</Badge><span className="text-[10px] font-bold text-red-600 leading-tight">{item.record.anomalyDescription}</span></div></TableCell>
                                    <TableCell>{isAbsent ? <Ban className="h-4 w-4 text-red-200" /> : <div className="flex flex-wrap gap-1">{(item.record.allPunches || []).map((p, i) => <Badge key={i} variant="outline" className="font-mono text-[9px] h-4 bg-background">{p}</Badge>)}</div>}</TableCell>
                                    <TableCell><span className="font-black text-lg text-primary font-mono">{item.record.manualDeductionDays || 0} يوم</span></TableCell>
                                    <TableCell className="text-center no-print">
                                        {item.record.auditStatus === 'pending' ? (
                                            <div className="flex justify-center gap-2">
                                                <Button type="button" size="sm" variant="outline" className="bg-green-50 text-green-700 border-green-200 h-8 rounded-lg font-black" onClick={() => handleAuditAction(item.docId, item.record.date, 'waive')}>تغاضي</Button>
                                                <Button type="button" size="sm" className="bg-red-600 hover:bg-red-700 text-white h-8 rounded-lg font-black" onClick={() => handleAuditAction(item.docId, item.record.date, 'apply')}>خصم</Button>
                                            </div>
                                        ) : <Button type="button" variant="ghost" size="sm" onClick={() => handleAuditAction(item.docId, item.record.date, 'reset')} className="text-muted-foreground h-8 rounded-lg gap-2 font-black"><History className="h-3 w-3"/>تغيير القرار</Button>}
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>

        {/* --- زر الاعتماد النهائي --- */}
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

        {/* منطقة الطباعة المخفية */}
        <div id="summary-printable-area" className="fixed -top-[20000px] left-0 w-[1120px] bg-white opacity-100 pointer-events-none" style={{ visibility: 'visible', zIndex: -1000 }} dir="rtl">
            {summaryData.length > 0 && (
                <div className="p-10">
                    <div className="flex justify-between items-start mb-10 border-b-4 border-primary pb-6">
                        <div className="flex items-center gap-4">
                            <Logo className="h-16 w-16" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                            <div>
                                <h1 className="text-2xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                                <p className="text-sm font-bold text-muted-foreground">ملخص مستحقات الموظفين الشهرية</p>
                            </div>
                        </div>
                        <div className="text-left">
                            <h2 className="text-xl font-black text-primary">شهر {monthName} {year}</h2>
                            <p className="text-[10px] text-muted-foreground font-mono">تاريخ الاستخراج: {format(new Date(), 'PPpp', { locale: ar })}</p>
                        </div>
                    </div>
                    <div className="border-2 rounded-3xl overflow-hidden mb-10 bg-white">
                        <Table>
                            <TableHeader className="bg-gray-50 border-b">
                                <TableRow>
                                    <TableHead className="px-6 font-black text-gray-900">الموظف</TableHead>
                                    <TableHead className="font-black text-center text-gray-900">الراتب الكامل</TableHead>
                                    <TableHead className="font-black text-center text-gray-900">الغياب</TableHead>
                                    <TableHead className="font-black text-center text-gray-900">خصم (أيام)</TableHead>
                                    <TableHead className="text-left font-black text-gray-900">إجمالي الخصم</TableHead>
                                    <TableHead className="text-left font-black bg-blue-50 text-blue-700">صافي المستحق</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summaryData.map((s, idx) => (
                                    <TableRow key={idx} className="h-14 border-b">
                                        <TableCell className="px-6 font-bold text-gray-800">{s?.name}</TableCell>
                                        <TableCell className="text-center font-mono font-bold">{formatCurrency(s?.fullSalary || 0)}</TableCell>
                                        <TableCell className="text-center font-mono">{s?.absent} يوم</TableCell>
                                        <TableCell className="text-center font-mono font-bold text-red-600">{s?.deductionDays} يوم</TableCell>
                                        <TableCell className="text-left font-mono font-bold text-red-600">({formatCurrency(s?.deductionAmount || 0)})</TableCell>
                                        <TableCell className="text-left font-mono font-black text-blue-700 bg-blue-50/30">{formatCurrency(s?.netSalary || 0)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="bg-gray-100 font-black h-16">
                                <TableRow>
                                    <TableCell colSpan={5} className="text-right px-10 text-lg">إجمالي الرواتب الصافية للصرف:</TableCell>
                                    <TableCell className="text-left font-mono text-xl text-primary">{formatCurrency(summaryData.reduce((sum, s) => sum + (s?.netSalary || 0), 0))}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                    <div className="grid grid-cols-2 gap-20 text-center mt-20">
                        <div className="space-y-16"><p className="font-black border-b-2 border-gray-800 pb-2">المحاسب المالي</p><div className="pt-2 border-t border-dashed">التوقيع والتاريخ</div></div>
                        <div className="space-y-16"><p className="font-black border-b-2 border-gray-800 pb-2">المدير العام (الاعتماد)</p><div className="pt-2 border-t border-dashed">الختم والموافقة</div></div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}
