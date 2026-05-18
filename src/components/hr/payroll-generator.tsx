'use client';

import { useState, useMemo } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription, 
} from '@/components/ui/card';
import { Button } from '../ui/button';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { RefreshCw, Loader2, Banknote, ShieldCheck } from 'lucide-react';
import type { Employee, Payslip } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export function PayrollGenerator() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const tenantId = currentUser?.currentCompanyId;

  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);

  const handleGeneratePayroll = async () => {
    if (!firestore || !currentUser || !tenantId) return;
    
    setIsProcessing(true);
    const BATCH_SIZE = 200; // 🛡️ Limit per batch for safety

    try {
        const payrollPath = getTenantPath('payroll', tenantId);
        
        for (let i = 0; i < employees.length; i += BATCH_SIZE) {
            const batch = writeBatch(firestore);
            const chunk = employees.slice(i, i + BATCH_SIZE);

            chunk.forEach(emp => {
                const fullSalary = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
                const pRef = doc(firestore, payrollPath, `${year}-${month}-${emp.id}`);
                
                batch.set(pRef, cleanFirestoreData({
                    employeeId: emp.id,
                    employeeName: emp.fullName,
                    year: parseInt(year),
                    month: parseInt(month),
                    earnings: { basicSalary: emp.basicSalary, housingAllowance: emp.housingAllowance, transportAllowance: emp.transportAllowance },
                    netSalary: fullSalary,
                    status: 'draft',
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                    companyId: tenantId
                }), { merge: true });
            });

            await batch.commit();
        }

        toast({ title: 'تم توليد الرواتب بنجاح' });
        router.push('/dashboard/hr/payroll');
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في التوليد' });
    } finally { setIsProcessing(false); }
  };

  return (
    <Card className="rounded-[2.5rem] border-none shadow-xl">
        <CardHeader className="bg-primary/5 p-8 border-b">
            <CardTitle className="text-2xl font-black">معالجة كشوف الرواتب</CardTitle>
            <CardDescription>توليد مسودات الرواتب لجميع الموظفين النشطين في الفترة المحددة.</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
            <div className="flex gap-4 p-4 bg-muted/20 rounded-2xl border-2 border-dashed">
                <div className="grid gap-2 flex-1"><Label>السنة</Label><Select value={year} onValueChange={setYear}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent dir="rtl">{[2024,2025,2026].map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-2 flex-1"><Label>الشهر</Label><Select value={month} onValueChange={setMonth}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent dir="rtl">{Array.from({length:12},(_,i)=>i+1).map(m=><SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Button onClick={handleGeneratePayroll} disabled={isProcessing || employees.length === 0} className="w-full h-14 rounded-2xl font-black text-xl gap-3">
                {isProcessing ? <Loader2 className="animate-spin h-6 w-6" /> : <Banknote className="h-6 w-6" />} بدء التوليد لـ {employees.length} موظف
            </Button>
        </CardContent>
    </Card>
  );
}
