
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Employee, MonthlyAttendance, AttendanceRecord } from '@/lib/types';
import { Loader2, Calculator, ShieldCheck, Printer, CheckCircle2, History, AlertCircle, RefreshCw, CalendarDays, CheckCircle, Ban } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

export function PayrollGenerator() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [isProcessing, setIsProcessing] = useState(false);

  // جلب كافة الموظفين لضمان عرض بياناتهم حتى لو تغيرت حالتهم
  const { data: employees = [] } = useSubscription<Employee>(firestore, 'employees');
  
  const attendanceQuery = useMemo(() => [
    where('year', '==', parseInt(year)),
    where('month', '==', parseInt(month))
  ], [year, month]);
  
  const { data: attendanceDocs, loading: attLoading } = useSubscription<MonthlyAttendance>(firestore, 'attendance', attendanceQuery);

  // ✨ مركز تدقيق المخالفات: تم تبسيط المنطق لضمان عدم ضياع أي سجل تم اكتشافه آلياً
  const anomalies = useMemo(() => {
    const list: { docId: string, record: AttendanceRecord, empName: string, employeeNumber: string, lastUpdated?: any }[] = [];
    
    if (!attendanceDocs || attendanceDocs.length === 0) return [];

    attendanceDocs.forEach(attendanceDoc => {
        const emp = employees.find(e => e.id === attendanceDoc.employeeId);
        
        attendanceDoc.records?.forEach(r => {
            // أي سجل حالته ليست "حاضر" (present) يجب أن يظهر في قائمة التدقيق
            if (r.status !== 'present') {
                list.push({ 
                    docId: attendanceDoc.id!, 
                    record: r, 
                    empName: emp?.fullName || 'موظف غير معرف', 
                    employeeNumber: emp?.employeeNumber || '000',
                    lastUpdated: attendanceDoc.updatedAt
                });
            }
        });
    });
    
    // ترتيب حسب التاريخ (من الأقدم للأحدث لمراجعة منطقية)
    return list.sort((a, b) => {
        const dateA = toFirestoreDate(a.record.date)?.getTime() || 0;
        const dateB = toFirestoreDate(b.record.date)?.getTime() || 0;
        return dateA - dateB;
    });
  }, [attendanceDocs, employees]);

  const handleAuditAction = async (docId: string, date: any, action: 'waive' | 'apply') => {
    if (!firestore || !currentUser) return;
    try {
        const docRef = doc(firestore, 'attendance', docId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        
        const records = snap.data().records.map((r: any) => {
            if (r.date.seconds === date.seconds) {
                return { 
                    ...r, 
                    auditStatus: action === 'waive' ? 'waived' : 'verified',
                    manualDeductionDays: action === 'waive' ? 0 : r.manualDeductionDays,
                    waivedBy: currentUser.fullName,
                    waivedAt: new Date()
                };
            }
            return r;
        });
        
        await updateDoc(docRef, { records, updatedAt: serverTimestamp() });
        toast({ title: 'تم الحفظ', description: 'تم تحديث حالة المخالفة.' });
    } catch (e) { 
        console.error("Audit action failed:", e);
        toast({ variant: 'destructive', title: 'خطأ في التحديث' }); 
    }
  };

  const handleGeneratePayroll = async () => {
    if (!firestore || !currentUser) return;
    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);
        
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
            batch.set(doc(firestore, 'payroll', payslipId), cleanFirestoreData({
                employeeId: emp.id, employeeName: emp.fullName, year: parseInt(year), month: parseInt(month),
                earnings: { basicSalary: emp.basicSalary, housingAllowance: emp.housingAllowance, transportAllowance: emp.transportAllowance, commission: 0 },
                deductions: { absenceDeduction: deductionAmount, otherDeductions: 0 },
                netSalary, status: 'draft', type: 'Monthly', createdAt: serverTimestamp(), createdBy: currentUser.id
            }), { merge: true });
        }

        await batch.commit();
        toast({ title: 'تم توليد الرواتب', description: 'مسودة الرواتب جاهزة الآن للمراجعة المالية.' });
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ في التوليد' }); }
    finally { setIsProcessing(false); }
  };

  const pendingAnomaliesCount = anomalies.filter(a => a.record.auditStatus === 'pending').length;

  return (
    <div className="space-y-8" dir="rtl">
        <div className="flex flex-col md:flex-row gap-4 p-6 bg-[#F8F9FE] rounded-[2rem] border shadow-inner no-print justify-between items-end">
            <div className="flex gap-4">
                <div className="grid gap-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground mr-1">السنة</Label><Select value={year} onValueChange={setYear}><SelectTrigger className="h-10 w-32 rounded-xl"><SelectValue/></SelectTrigger><SelectContent dir="rtl">{[2025, 2026, 2027].map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground mr-1">الشهر</Label><Select value={month} onValueChange={setMonth}><SelectTrigger className="h-10 w-32 rounded-xl"><SelectValue/></SelectTrigger><SelectContent dir="rtl">{Array.from({length:12},(_,i)=>i+1).map(m=><SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="flex gap-3">
                <Button variant="outline" onClick={() => window.print()} className="rounded-xl font-bold border-2 h-10 gap-2"><Printer className="h-4 w-4"/> طباعة تقرير المخالفات</Button>
                <Button onClick={handleGeneratePayroll} disabled={isProcessing || pendingAnomaliesCount > 0} className="rounded-xl font-black h-10 px-8 shadow-xl shadow-primary/20 bg-primary text-white hover:bg-primary/90">
                    {isProcessing ? <Loader2 className="animate-spin ml-2 h-4 w-4"/> : <Calculator className="ml-2 h-4 w-4"/>} 
                    {pendingAnomaliesCount > 0 ? `بانتظار مراجعتك (${pendingAnomaliesCount} مخالفة)` : 'اعتماد وصرف الرواتب'}
                </Button>
            </div>
        </div>

        <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
                <div className="space-y-1">
                    <h3 className="text-2xl font-black flex items-center gap-3">
                        <ShieldCheck className="text-primary h-8 w-8"/> 
                        مركز تدقيق الحضور والمخالفات
                    </h3>
                    <p className="text-xs text-muted-foreground font-bold flex items-center gap-1"><RefreshCw className="h-3 w-3"/> يعرض هذا المركز كافة الغيابات والتأخيرات المكتشفة في ملف البصمة المرفوع.</p>
                </div>
                {pendingAnomaliesCount > 0 && (
                    <Badge variant="destructive" className="animate-pulse rounded-lg h-8 px-4 font-black">
                        <AlertCircle className="h-4 w-4 ml-2" />
                        يوجد {pendingAnomaliesCount} مخالفة بانتظار قرارك
                    </Badge>
                )}
            </div>

            {attLoading ? (
                <div className="p-32 text-center">
                    <Loader2 className="animate-spin h-12 w-12 mx-auto text-primary" />
                    <p className="mt-4 font-bold text-muted-foreground">جاري فحص سجلات الحضور...</p>
                </div>
            ) : attendanceDocs.length === 0 ? (
                <div className="p-32 text-center border-4 border-dashed rounded-[4rem] bg-slate-50/50">
                    <CalendarDays className="h-24 w-24 text-muted-foreground/20 mx-auto mb-6" />
                    <p className="text-3xl font-black text-muted-foreground">لا توجد بيانات لهذا الشهر</p>
                    <p className="text-lg font-medium text-muted-foreground/60 mt-3">يرجى رفع ملف البصمة أولاً من تبويب "رفع الحضور والانصراف".</p>
                </div>
            ) : anomalies.length === 0 ? (
                <div className="p-32 text-center border-4 border-dashed rounded-[4rem] bg-green-50/10 border-green-100">
                    <CheckCircle className="h-24 w-24 text-green-600/20 mx-auto mb-6" />
                    <p className="text-3xl font-black text-green-800">التزام كامل! لا توجد مخالفات</p>
                    <p className="text-lg font-medium text-green-700/60 mt-3">كافة الموظفين ملتزمون بالبصمة في كافة أيام العمل الرسمية لهذا الشهر.</p>
                </div>
            ) : (
                <div className="border-2 rounded-[2.5rem] overflow-hidden bg-white shadow-2xl printable-area">
                    <Table>
                        <TableHeader className="bg-muted/50 h-16">
                            <TableRow>
                                <TableHead className="px-8">الموظف</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>الحالة / المخالفة</TableHead>
                                <TableHead>سجل البصمات (Punches)</TableHead>
                                <TableHead>الخصم المستحق</TableHead>
                                <TableHead className="text-center no-print">القرار الإداري</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {anomalies.map((item, idx) => {
                                const isAbsent = item.record.status === 'absent';
                                const recordDate = toFirestoreDate(item.record.date);
                                
                                return (
                                <TableRow key={idx} className={cn("h-24 transition-colors", item.record.auditStatus === 'waived' ? "bg-green-50/30 opacity-60" : isAbsent ? "bg-red-50/40" : "bg-white")}>
                                    <TableCell className="px-8">
                                        <div className="flex flex-col">
                                            <span className="font-black text-lg">{item.empName}</span>
                                            <span className="font-mono text-[10px] text-muted-foreground">الملف: {item.employeeNumber}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold text-sm">
                                        {recordDate ? format(recordDate, 'eeee, dd MMMM', { locale: ar }) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1.5">
                                            <Badge variant={isAbsent ? 'destructive' : 'outline'} className={cn("w-fit text-[9px] font-black uppercase", isAbsent && "bg-red-600 animate-pulse")}>
                                                {isAbsent ? 'غياب كامل (مكتشف آلياً)' : item.record.status === 'half_day' ? 'نصف يوم' : 'تأخير صباحي'}
                                            </Badge>
                                            <span className="text-[10px] font-bold text-red-600 leading-tight">{item.record.anomalyDescription}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {isAbsent ? (
                                            <div className="flex items-center gap-2 text-red-400 opacity-40"><Ban className="h-4 w-4"/> <span className="text-xs font-bold">لا يوجد سجل</span></div>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5 max-w-[180px]">
                                                {(item.record.allPunches || []).map((p, i) => (
                                                    <Badge key={i} variant="outline" className="font-mono text-[10px] px-2 h-5 bg-background shadow-sm">{p}</Badge>
                                                ))}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-black text-xl text-primary">{item.record.manualDeductionDays || 0} يوم</span>
                                            {item.record.auditStatus === 'waived' && <span className="text-[9px] text-green-600 font-bold flex items-center gap-1"><CheckCircle2 className="h-2 w-2"/> تم التغاضي</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center no-print">
                                        {item.record.auditStatus === 'pending' ? (
                                            <div className="flex justify-center gap-3">
                                                <Button size="sm" variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-600 hover:text-white rounded-xl font-bold h-10 px-6" onClick={() => handleAuditAction(item.docId, item.record.date, 'waive')}>
                                                    تغاضي
                                                </Button>
                                                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold h-10 px-6" onClick={() => handleAuditAction(item.docId, item.record.date, 'apply')}>
                                                    اعتماد الخصم
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button variant="ghost" size="sm" onClick={() => handleAuditAction(item.docId, item.record.date, 'waive')} className="text-muted-foreground h-10 rounded-xl gap-2 font-bold">
                                                <History className="h-4 w-4" /> تغيير القرار
                                            </Button>
                                        )}
                                    </TableCell>
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
