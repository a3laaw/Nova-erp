'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, updateDoc, Timestamp, runTransaction } from 'firebase/firestore';
import type { Employee, MonthlyAttendance, AttendanceRecord, Account } from '@/lib/types';
import { Loader2, Calculator, ShieldCheck, Printer, CheckCircle2, History, AlertCircle, RefreshCw, CalendarDays, CheckCircle, Ban, FileDown, Check, X, ShieldAlert, FileText, Info, RotateCcw } from 'lucide-react';
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
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingSummary, setIsExportingSummary] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

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
        
        await updateDoc(docRef, { records, updatedAt: serverTimestamp() });
        setAttendanceDocs(prev => prev.map(doc => doc.id === docId ? { ...doc, records } : doc));
        toast({ title: 'تم الحفظ', description: 'تم تحديث حالة المخالفة.' });
    } catch (e) { 
        toast({ variant: 'destructive', title: 'خطأ في التحديث' }); 
    }
  };

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
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تنفيذ الإجراء الجماعي.' });
    } finally {
        setIsBulkProcessing(false);
    }
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

                let totalDeductionDays = 0;
                att?.records?.forEach(r => {
                    if (r.auditStatus !== 'waived') {
                        totalDeductionDays += (r.manualDeductionDays || 0);
                    }
                });

                const deductionAmount = totalDeductionDays * dailyRate;
                const netSalary = Math.max(0, fullSalary - deductionAmount);

                const payslipId = `${year}-${month}-${emp.id}`;
                const pRef = doc(firestore, 'payroll', payslipId);
                
                transaction.set(pRef, cleanFirestoreData({
                    employeeId: emp.id, employeeName: emp.fullName, year: parseInt(year), month: parseInt(month),
                    earnings: { basicSalary: emp.basicSalary, housingAllowance: emp.housingAllowance, transportAllowance: emp.transportAllowance, commission: 0 },
                    deductions: { absenceDeduction: deductionAmount, otherDeductions: 0 },
                    netSalary, status: 'draft', type: 'Monthly', createdAt: serverTimestamp(), createdBy: currentUser.id
                }), { merge: true });
            }
        });
        toast({ title: 'تم توليد الرواتب', description: 'مسودة الرواتب جاهزة الآن للمراجعة المالية.' });
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ في التوليد' }); }
    finally { setIsProcessing(false); }
  };

  const timeToMinutes = (timeStr: string | null | undefined): number => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const parts = timeStr.trim().split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  };

  const summaryData = useMemo(() => {
    if (!attendanceDocs || attendanceDocs.length === 0) return [];
    
    const globalWorkHours = branding?.work_hours?.general;
    return employees.map(emp => {
      const att = attendanceDocs.find(a => a.employeeId === emp.id);
      if (!att) return null;

      let totalAbsent = 0;
      let totalLate = 0;
      let totalLateMinutes = 0;
      let totalHalfDay = 0;
      let totalDeductionDays = 0;

      const empStartTimeLimit = emp.workStartTime || globalWorkHours?.morning_start_time || '08:00';
      const limitMins = timeToMinutes(empStartTimeLimit);

      att.records?.forEach(r => {
        if (r.auditStatus === 'waived') return;
        if (r.status === 'absent') totalAbsent++;
        else {
            if (r.checkIn1) {
                const checkInMins = timeToMinutes(r.checkIn1);
                const diff = checkInMins - limitMins;
                if (diff > 0) { totalLateMinutes += diff; totalLate++; }
            }
            if (r.status === 'half_day') totalHalfDay++;
        }
        totalDeductionDays += (r.manualDeductionDays || 0);
      });

      const fullSalary = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
      const dailyRate = fullSalary / 26;
      const deductionAmount = totalDeductionDays * dailyRate;
      const lateHours = Math.floor(totalLateMinutes / 60);
      const lateMins = totalLateMinutes % 60;

      return {
        empNo: emp.employeeNumber || '',
        name: emp.fullName || '',
        fullSalary,
        absent: totalAbsent,
        lateCount: totalLate,
        lateTime: `${lateHours}:${String(lateMins).padStart(2, '0')}`,
        lateMins: totalLateMinutes,
        halfDays: totalHalfDay,
        deductionDays: totalDeductionDays,
        dailyRate,
        deductionAmount,
        netSalary: fullSalary - deductionAmount
      };
    }).filter(Boolean);
  }, [employees, attendanceDocs, branding]);

  const handleExportExcel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (summaryData.length === 0) {
        toast({ title: 'لا توجد بيانات', description: 'يرجى انتظار تحميل البيانات أولاً.' });
        return;
    }
    const excelRows = summaryData.map(s => ({
        'رقم الموظف': s!.empNo, 
        'اسم الموظف': s!.name, 
        'الراتب الكامل': s!.fullSalary,
        'أيام الغياب': s!.absent, 
        'عدد مرات التأخير': s!.lateCount, 
        'إجمالي دقائق التأخير': s!.lateMins,
        'إجمالي أيام الخصم': s!.deductionDays, 
        'إجمالي الخصم (KD)': Math.round(s!.deductionAmount * 1000) / 1000,
        'صافي الراتب المتوقع': Math.round(s!.netSalary * 1000) / 1000,
    }));
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `حضور ${month}-${year}`);
    XLSX.writeFile(wb, `كشف_رواتب_مختصر_${month}_${year}.xlsx`);
  }, [summaryData, month, year, toast]);

  const handleExportSummaryPDF = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (summaryData.length === 0) {
        toast({ title: 'لا توجد بيانات للتصدير' });
        return;
    }
    setIsExportingSummary(true);

    // إنشاء عنصر مؤقت مرئي خارج الشاشة بطريقة صحيحة
    const element = document.getElementById('summary-printable-area');
    if (!element) {
        setIsExportingSummary(false);
        return;
    }

    // نسخ العنصر ووضعه في مكان يراه html2pdf
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.position = 'absolute';
    clone.style.top = '0';
    clone.style.left = '-9999px';
    clone.style.width = '1120px';
    clone.style.visibility = 'visible';
    clone.style.opacity = '1';
    clone.style.zIndex = '-1';
    document.body.appendChild(clone);

    const opt = {
      margin: [0.5, 0.5],
      filename: `ملخص_رواتب_${month}_${year}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true, 
        scrollY: 0,
        backgroundColor: '#ffffff',
        windowWidth: 1120
      },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    };

    setTimeout(() => {
        import('html2pdf.js').then(module => {
            const html2pdf = module.default;
            html2pdf().from(clone).set(opt).save()
            .then(() => {
                document.body.removeChild(clone);
                setIsExportingSummary(false);
                toast({ title: 'نجاح التصدير' });
            })
            .catch((err: any) => {
                if (document.body.contains(clone)) document.body.removeChild(clone);
                console.error(err);
                setIsExportingSummary(false);
                toast({ variant: 'destructive', title: 'خطأ في التصدير' });
            });
        });
    }, 300);
  }, [summaryData, month, year, toast]);

  const handleExportPDF = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const element = document.getElementById('audit-printable-area');
    if (!element) {
        toast({ variant: 'destructive', title: 'لا توجد بيانات للتصدير' });
        return;
    }
    setIsExportingPDF(true);

    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.position = 'absolute';
    clone.style.top = '0';
    clone.style.left = '-9999px';
    clone.style.width = '1120px';
    clone.style.visibility = 'visible';
    clone.style.opacity = '1';
    document.body.appendChild(clone);

    const opt = {
      margin: [0.5, 0.5],
      filename: `تقرير_مخالفات_${month}_${year}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true, 
          scrollY: 0, 
          backgroundColor: '#ffffff',
          windowWidth: 1120
      },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    };

    import('html2pdf.js').then(module => {
      const html2pdf = module.default;
      html2pdf().from(clone).set(opt).save()
      .then(() => {
          document.body.removeChild(clone);
          setIsExportingPDF(false);
          toast({ title: 'نجاح التصدير' });
      })
      .catch((err: any) => {
          if (document.body.contains(clone)) document.body.removeChild(clone);
          setIsExportingPDF(false);
          toast({ variant: 'destructive', title: 'خطأ في التصدير' });
      });
    });
  }, [month, year, toast]);

  const pendingAnomaliesCount = anomalies.filter(a => a.record.auditStatus === 'pending').length;
  const processedAnomaliesCount = anomalies.filter(a => a.record.auditStatus !== 'pending').length;
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('ar', { month: 'long' });

  return (
    <div className="space-y-8" dir="rtl">
        <div className="flex flex-col md:flex-row gap-4 p-6 bg-[#F8F9FE] rounded-[2.5rem] border shadow-inner no-print justify-between items-end">
            <div className="flex gap-4">
                <div className="grid gap-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground mr-1">السنة</Label>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="h-10 w-32 rounded-xl"><SelectValue/></SelectTrigger>
                        <SelectContent dir="rtl">{[2025, 2026, 2027].map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="grid gap-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground mr-1">الشهر</Label>
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger className="h-10 w-32 rounded-xl"><SelectValue/></SelectTrigger>
                        <SelectContent dir="rtl">{Array.from({length:12},(_,i)=>i+1).map(m=><SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={handleExportExcel} disabled={summaryData.length === 0} className="rounded-xl font-bold border-2 h-10 gap-2 text-green-700 border-green-200 hover:bg-green-50"><FileDown className="h-4 w-4"/> تصدير Excel</Button>
                <Button type="button" variant="outline" onClick={handleExportSummaryPDF} disabled={isExportingSummary || summaryData.length === 0} className="rounded-xl font-bold border-2 h-10 gap-2 text-primary border-primary/20 hover:bg-primary/5">
                    {isExportingSummary ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileText className="h-4 w-4"/>} 
                    تصدير PDF (ملخص)
                </Button>
                <Button type="button" variant="outline" onClick={handleExportPDF} disabled={isExportingPDF || anomalies.length === 0} className="rounded-xl font-bold border-2 h-10 gap-2 text-red-700 border-red-200 hover:bg-red-50">
                    {isExportingPDF ? <Loader2 className="h-4 w-4 animate-spin"/> : <ShieldAlert className="h-4 w-4"/>} 
                    تقرير المخالفات PDF
                </Button>
                <Button type="button" onClick={handleGeneratePayroll} disabled={isProcessing || pendingAnomaliesCount > 0 || attLoading} className="rounded-xl font-black h-10 px-8 shadow-xl shadow-primary/20 bg-primary text-white hover:bg-primary/90">
                    {isProcessing ? <Loader2 className="animate-spin ml-2 h-4 w-4"/> : <Calculator className="ml-2 h-4 w-4"/>} 
                    {pendingAnomaliesCount > 0 ? `بانتظار مراجعتك (${pendingAnomaliesCount} مخالفة)` : 'اعتماد وصرف الرواتب'}
                </Button>
            </div>
        </div>

        {/* 🛡️ منطقة الطباعة: مخفية عن المستخدم ولكن مرئية للمحرك */}
        <div 
            id="summary-printable-area" 
            className="fixed -top-[20000px] left-0 w-[1120px] bg-white opacity-100 pointer-events-none"
            style={{ visibility: 'visible', zIndex: -1000 }}
            dir="rtl"
        >
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
                                    <TableHead className="font-black text-center text-gray-900">التأخير (د)</TableHead>
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
                                        <TableCell className="text-center font-mono">{s?.lateMins} د</TableCell>
                                        <TableCell className="text-center font-mono font-bold text-red-600">{s?.deductionDays} يوم</TableCell>
                                        <TableCell className="text-left font-mono font-bold text-red-600">({formatCurrency(s?.deductionAmount || 0)})</TableCell>
                                        <TableCell className="text-left font-mono font-black text-blue-700 bg-blue-50/30">{formatCurrency(s?.netSalary || 0)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="bg-gray-100 font-black h-16">
                                <TableRow>
                                    <TableCell colSpan={6} className="text-right px-10 text-lg">إجمالي الرواتب الصافية للصرف:</TableCell>
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

        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 gap-4">
                <div className="space-y-1">
                    <h3 className="text-2xl font-black flex items-center gap-3">
                        <ShieldCheck className="text-primary h-8 w-8"/> 
                        مركز تدقيق الحضور والمخالفات
                    </h3>
                    <p className="text-xs text-muted-foreground font-bold flex items-center gap-1"><RefreshCw className="h-3 w-3"/> مراجعة المخالفات التفصيلية قبل الاعتماد المالي.</p>
                </div>
                
                <div className="flex flex-wrap gap-2 animate-in slide-in-from-left-4 duration-500">
                    {pendingAnomaliesCount > 0 && (
                        <Badge variant="destructive" className="animate-pulse rounded-lg h-9 px-4 font-black gap-2">
                            <AlertCircle className="h-4 w-4" />
                            يوجد {pendingAnomaliesCount} مخالفة
                        </Badge>
                    )}
                    {(pendingAnomaliesCount > 0 || processedAnomaliesCount > 0) && (
                        <div className="flex bg-muted/50 p-1 rounded-xl border shadow-inner no-print items-center">
                            {pendingAnomaliesCount > 0 && (
                                <>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => handleBulkAuditAction('waive')} disabled={isBulkProcessing} className="h-7 text-[10px] font-black text-green-700 hover:bg-green-100 rounded-lg gap-1">
                                        {isBulkProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <CheckCircle2 className="h-3 w-3" />}
                                        تغاضي عن الكل
                                    </Button>
                                    <Separator orientation="vertical" className="h-4 mx-1 my-auto" />
                                    <Button type="button" size="sm" variant="ghost" onClick={() => handleBulkAuditAction('apply')} disabled={isBulkProcessing} className="h-7 text-[10px] font-black text-red-700 hover:bg-red-100 rounded-lg gap-1">
                                        {isBulkProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <ShieldAlert className="h-3 w-3" />}
                                        اعتماد الخصم للكل
                                    </Button>
                                </>
                            )}
                            {processedAnomaliesCount > 0 && (
                                <>
                                    {pendingAnomaliesCount > 0 && <Separator orientation="vertical" className="h-4 mx-1 my-auto" />}
                                    <Button type="button" size="sm" variant="ghost" onClick={() => handleBulkAuditAction('reset')} disabled={isBulkProcessing} className="h-7 text-[10px] font-black text-gray-600 hover:bg-gray-200 rounded-lg gap-1">
                                        {isBulkProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <RotateCcw className="h-3 w-3" />}
                                        إعادة تعيين للتدقيق
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {attLoading ? (
                <div className="p-32 text-center"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary" /><p className="mt-4 font-bold text-muted-foreground">جاري فحص سجلات الحضور...</p></div>
            ) : attendanceDocs.length === 0 ? (
                <div className="p-32 text-center border-4 border-dashed rounded-[4rem] bg-slate-50/50"><CalendarDays className="h-24 w-24 text-muted-foreground/20 mx-auto mb-6" /><p className="text-3xl font-black text-muted-foreground">لا توجد بيانات لهذا الشهر</p></div>
            ) : (
                <div id="audit-printable-area" className="border-2 rounded-[2.5rem] overflow-hidden bg-white shadow-2xl">
                    <Table>
                        <TableHeader className="bg-muted/50 h-16">
                            <TableRow className="border-none">
                                <TableHead className="px-8 font-black text-[#7209B7]">الموظف</TableHead>
                                <TableHead className="font-black text-[#7209B7]">التاريخ</TableHead>
                                <TableHead className="font-black text-[#7209B7]">المخالفة</TableHead>
                                <TableHead className="font-black text-[#7209B7]">سجل البصمات</TableHead>
                                <TableHead className="font-black text-[#7209B7]">الخصم</TableHead>
                                <TableHead className="text-center no-print font-black text-[#7209B7]">القرار</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {anomalies.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center text-green-700 font-bold italic">لا توجد مخالفات في سجلات الحضور.</TableCell></TableRow>
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
                                    <TableCell className="text-center no-print">{item.record.auditStatus === 'pending' ? (
                                        <div className="flex justify-center gap-2">
                                            <Button type="button" size="sm" variant="outline" className="bg-green-50 text-green-700 border-green-200 h-8 rounded-lg font-black" onClick={() => handleAuditAction(item.docId, item.record.date, 'waive')}>تغاضي</Button>
                                            <Button type="button" size="sm" className="bg-red-600 hover:bg-red-700 text-white h-8 rounded-lg font-black" onClick={() => handleAuditAction(item.docId, item.record.date, 'apply')}>خصم</Button>
                                        </div>
                                    ) : <Button type="button" variant="ghost" size="sm" onClick={() => handleAuditAction(item.docId, item.record.date, 'reset')} className="text-muted-foreground h-8 rounded-lg gap-2 font-black"><History className="h-3 w-3"/>تغيير القرار</Button>}</TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    </div>
  );
}
