'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Employee, MonthlyAttendance, Payslip, AttendanceRecord } from '@/lib/types';
import { Loader2, Calculator, ShieldCheck, AlertCircle, CheckCircle2, UserX } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';

export function PayrollGenerator() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(true);

  const { data: employees = [] } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
  
  const attendanceQuery = useMemo(() => [
    where('year', '==', parseInt(year)),
    where('month', '==', parseInt(month))
  ], [year, month]);
  
  const { data: attendanceDocs, loading: attLoading } = useSubscription<MonthlyAttendance>(firestore, 'attendance', attendanceQuery);

  // استخراج كافة السجلات التي تحتاج مراجعة
  const anomalies = useMemo(() => {
    const list: { docId: string, record: AttendanceRecord, empName: string }[] = [];
    attendanceDocs.forEach(doc => {
        const emp = employees.find(e => e.id === doc.employeeId);
        doc.records?.forEach(r => {
            if (r.status !== 'present' && r.auditStatus === 'pending') {
                list.push({ docId: doc.id!, record: r, empName: emp?.fullName || 'موظف' });
            }
        });
    });
    return list;
  }, [attendanceDocs, employees]);

  const handleAuditAction = async (docId: string, date: any, action: 'waive' | 'apply') => {
    if (!firestore) return;
    try {
        const docRef = doc(firestore, 'attendance', docId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        
        const records = snap.data().records.map((r: any) => {
            if (r.date.seconds === date.seconds) {
                return { 
                    ...r, 
                    auditStatus: action === 'waive' ? 'waived' : 'verified',
                    manualDeductionDays: action === 'waive' ? 0 : r.manualDeductionDays 
                };
            }
            return r;
        });
        
        await updateDoc(docRef, { records });
        toast({ title: 'تم التحديث' });
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ' }); }
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
        toast({ title: 'نجاح', description: 'تم توليد مسودة الرواتب بنجاح.' });
        setIsAuditing(false);
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ في التوليد' }); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-8" dir="rtl">
        <div className="flex gap-4 p-4 bg-muted/50 rounded-2xl border no-print">
            <div className="grid gap-1.5"><Label className="text-xs">السنة</Label><Select value={year} onValueChange={setYear}><SelectTrigger className="h-9 w-32"><SelectValue/></SelectTrigger><SelectContent>{[2025, 2026].map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label className="text-xs">الشهر</Label><Select value={month} onValueChange={setMonth}><SelectTrigger className="h-9 w-32"><SelectValue/></SelectTrigger><SelectContent>{Array.from({length:12},(_,i)=>i+1).map(m=><SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent></Select></div>
        </div>

        {isAuditing ? (
            <div className="space-y-6 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black flex items-center gap-2">
                        <ShieldCheck className="text-primary"/> مراجعة مخالفات البصمة ({anomalies.length})
                    </h3>
                    <Button onClick={handleGeneratePayroll} disabled={isProcessing || anomalies.length > 0} className="rounded-xl font-black h-12 px-10 shadow-xl">
                        {isProcessing ? <Loader2 className="animate-spin ml-2"/> : <Calculator className="ml-2"/>} اعتماد الحضور وتوليد الرواتب
                    </Button>
                </div>

                {anomalies.length > 0 ? (
                    <div className="border-2 rounded-[2rem] overflow-hidden bg-white shadow-lg">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>الموظف</TableHead>
                                    <TableHead>التاريخ</TableHead>
                                    <TableHead>الحالة المرصودة</TableHead>
                                    <TableHead>البصمات</TableHead>
                                    <TableHead>الخصم المقترح</TableHead>
                                    <TableHead className="text-center">إجراء المدير</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {anomalies.map((item, idx) => (
                                    <TableRow key={idx} className="h-20 hover:bg-muted/20">
                                        <TableCell className="font-black">{item.empName}</TableCell>
                                        <TableCell className="font-bold text-xs">{format(toFirestoreDate(item.record.date)!, 'eeee, dd MMMM', { locale: ar })}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Badge variant="destructive" className="w-fit text-[10px]">{item.record.status === 'half_day' ? 'نص يوم' : 'بصمة ناقصة'}</Badge>
                                                <span className="text-[10px] font-bold text-red-600">{item.record.anomalyDescription}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                                                {item.record.allPunches.map((p, i) => <Badge key={i} variant="outline" className="font-mono text-[9px] px-1 h-4">{p}</Badge>)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-black text-primary">{item.record.manualDeductionDays || 0} يوم</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center gap-2">
                                                <Button size="sm" variant="outline" className="bg-green-50 text-green-700 border-green-200 font-bold" onClick={() => handleAuditAction(item.docId, item.record.date, 'waive')}>
                                                    <CheckCircle2 className="h-3 w-3 ml-1"/> تغاضي
                                                </Button>
                                                <Button size="sm" className="bg-red-600 font-bold" onClick={() => handleAuditAction(item.docId, item.record.date, 'apply')}>
                                                    اعتماد الخصم
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="p-20 text-center border-2 border-dashed rounded-[3rem] bg-green-50/50">
                        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                        <p className="text-xl font-black text-green-800">لا توجد مخالفات تحتاج مراجعة لهذا الشهر!</p>
                        <p className="text-sm text-green-700 mt-2">يمكنك الآن ضغط زر التوليد في الأعلى لإصدار كشوف الرواتب.</p>
                    </div>
                )}
            </div>
        ) : (
            <div className="p-20 text-center space-y-6">
                <CheckCircle2 className="h-20 w-20 text-green-600 mx-auto" />
                <h3 className="text-2xl font-black">تم توليد الرواتب بنجاح</h3>
                <Button onClick={() => setIsAuditing(true)} variant="outline">العودة للتدقيق</Button>
            </div>
        )}
    </div>
  );
}
