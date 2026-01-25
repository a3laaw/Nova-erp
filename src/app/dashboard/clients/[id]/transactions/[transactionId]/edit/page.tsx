'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, X } from 'lucide-react';
import { useFirebase, useDoc } from '@/firebase';
import { doc, getDocs, collection, query, orderBy, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Employee, ClientTransaction, Department, TransactionType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transactionId = Array.isArray(params.transactionId) ? params.transactionId[0] : params.transactionId;
  
  const [formData, setFormData] = useState({
      selectedDepartment: '',
      transactionType: '',
      description: '',
      assignedEngineerId: ''
  });
  const [originalData, setOriginalData] = useState<Partial<ClientTransaction> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // --- Reference Data Loading ---
  const [departments, setDepartments] = useState<Department[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [engineers, setEngineers] = useState<Employee[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [loadingTypes, setLoadingTypes] = useState(false);

  // --- Transaction Data Loading ---
  const transactionRef = useMemo(() => {
    if (!firestore || !clientId || !transactionId) return null;
    return doc(firestore, 'clients', clientId, 'transactions', transactionId);
  }, [firestore, clientId, transactionId]);
  const [transactionSnap, transactionLoading, transactionError] = useDoc(transactionRef);
  
  // --- Fetch Departments & Engineers ---
  useEffect(() => {
    if (!firestore) return;
    setLoadingRefs(true);
    const fetchRefData = async () => {
        try {
            const [deptSnap, engSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'departments'), orderBy('name'))),
                getDocs(query(collection(firestore, 'employees'), orderBy('fullName')))
            ]);
            setDepartments(deptSnap.docs.map(d => ({id: d.id, ...d.data()} as Department)));
            setEngineers(engSnap.docs.map(d => ({id: d.id, ...d.data()} as Employee)));
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات المرجعية.' });
        } finally {
            setLoadingRefs(false);
        }
    };
    fetchRefData();
  }, [firestore, toast]);
  
  // --- Fetch Transaction Types when Department changes ---
  useEffect(() => {
    if (!firestore || !formData.selectedDepartment) {
        setTransactionTypes([]);
        return;
    };
    setLoadingTypes(true);
    const fetchTypes = async () => {
        try {
            const typesQuery = query(collection(firestore, `departments/${formData.selectedDepartment}/transactionTypes`), orderBy('name'));
            const typesSnapshot = await getDocs(typesQuery);
            setTransactionTypes(typesSnapshot.docs.map(d => ({id: d.id, ...d.data()} as TransactionType)));
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب أنواع المعاملات.' });
        } finally {
            setLoadingTypes(false);
        }
    };
    fetchTypes();
  }, [firestore, formData.selectedDepartment, toast]);

  // --- Populate Form with existing data ---
  useEffect(() => {
      if (transactionSnap?.exists() && departments.length > 0) {
          const data = transactionSnap.data() as ClientTransaction;
          setOriginalData(data);
          
          const dept = departments.find(d => transactionTypes.some(t => t.name === data.transactionType));
          
          let departmentId = '';
          const foundDept = departments.find(d => data.transactionType.includes(d.name.substring(0, 3)));
          if (foundDept) {
            departmentId = foundDept.id;
          }

          setFormData({
              selectedDepartment: departmentId,
              transactionType: data.transactionType || '',
              description: data.description || '',
              assignedEngineerId: data.assignedEngineerId || ''
          });
      }
  }, [transactionSnap, departments, transactionTypes]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !currentUser || !transactionRef || !originalData) return;
    
    setIsSaving(true);
    
    const changes: string[] = [];
    const updatePayload: any = {};
    
    if (formData.transactionType !== originalData.transactionType) {
        changes.push(`تغير نوع المعاملة من "${originalData.transactionType}" إلى "${formData.transactionType}".`);
        updatePayload.transactionType = formData.transactionType;
    }
    if (formData.description !== (originalData.description || '')) {
        changes.push(`تم تحديث الوصف.`);
        updatePayload.description = formData.description;
    }
    const originalEngineerId = originalData.assignedEngineerId || '';
    if (formData.assignedEngineerId !== originalEngineerId) {
        const oldEngName = engineers.find(e => e.id === originalEngineerId)?.fullName || 'غير مسند';
        const newEngName = engineers.find(e => e.id === formData.assignedEngineerId)?.fullName || 'غير مسند';
        changes.push(`تغير المهندس المسؤول من "${oldEngName}" إلى "${newEngName}".`);
        updatePayload.assignedEngineerId = formData.assignedEngineerId;
    }
    
    if (changes.length === 0) {
        toast({ title: 'لا توجد تغييرات', description: 'لم يتم تعديل أي بيانات.' });
        setIsSaving(false);
        return;
    }
    
    try {
        const batch = writeBatch(firestore);
        batch.update(transactionRef, updatePayload);
        
        const logRef = doc(collection(transactionRef, 'timelineEvents'));
        batch.set(logRef, {
            type: 'log',
            content: `قام ${currentUser.fullName} بتحديث بيانات المعاملة:\n- ${changes.join('\n- ')}`,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userAvatar: currentUser.avatarUrl,
            createdAt: serverTimestamp(),
        });
        
        await batch.commit();
        toast({ title: 'نجاح', description: 'تم تحديث المعاملة بنجاح.' });
        router.back();
    } catch (error) {
        console.error("Error updating transaction:", error);
        toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'فشل حفظ التعديلات.' });
    } finally {
        setIsSaving(false);
    }
  };
  
    const departmentOptions = useMemo(() => departments.map(d => ({ value: d.id, label: d.name })), [departments]);
    const transactionTypeOptions = useMemo(() => transactionTypes.map(t => ({ value: t.name, label: t.name })), [transactionTypes]);
    const engineerOptions = useMemo(() => {
        const selectedDeptName = departments.find(d => d.id === formData.selectedDepartment)?.name;
        if (!selectedDeptName) return [];
        return engineers.filter(e => e.department === selectedDeptName).map(e => ({ value: e.id!, label: e.fullName }));
    }, [engineers, formData.selectedDepartment, departments]);


  if (transactionLoading || loadingRefs) {
      return <Card><CardContent className="p-8"><Skeleton className="h-64 w-full" /></CardContent></Card>;
  }

  if (transactionError) {
      return <Card><CardHeader><CardTitle>خطأ</CardTitle></CardHeader><CardContent><p>فشل تحميل بيانات المعاملة.</p></CardContent></Card>;
  }
  
  return (
    <Card className="max-w-2xl mx-auto" dir="rtl">
        <form onSubmit={handleSubmit}>
            <CardHeader>
                <CardTitle>تعديل المعاملة</CardTitle>
                <CardDescription>تعديل تفاصيل المعاملة الداخلية للعميل.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>القسم <span className="text-destructive">*</span></Label>
                        <InlineSearchList 
                            value={formData.selectedDepartment} 
                            onSelect={(v) => setFormData(p => ({...p, selectedDepartment: v, transactionType: ''}))} 
                            options={departmentOptions} 
                            placeholder="اختر القسم..." 
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>نوع المعاملة <span className="text-destructive">*</span></Label>
                        <InlineSearchList 
                            value={formData.transactionType} 
                            onSelect={(v) => setFormData(p => ({...p, transactionType: v}))} 
                            options={transactionTypeOptions} 
                            placeholder={!formData.selectedDepartment ? "اختر قسمًا أولاً" : loadingTypes ? "تحميل..." : "اختر نوع المعاملة..."} 
                            disabled={!formData.selectedDepartment || loadingTypes}
                        />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label>المهندس المسؤول (اختياري)</Label>
                    <InlineSearchList 
                        value={formData.assignedEngineerId} 
                        onSelect={(v) => setFormData(p => ({...p, assignedEngineerId: v}))} 
                        options={engineerOptions} 
                        placeholder={!formData.selectedDepartment ? "اختر قسمًا أولاً" : "اختر مهندسًا..."} 
                        disabled={!formData.selectedDepartment}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="description">الوصف</Label>
                    <Textarea 
                        id="description" 
                        value={formData.description}
                        onChange={(e) => setFormData(p => ({...p, description: e.target.value}))}
                        rows={3}
                    />
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                 <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
                    <X className="ml-2 h-4 w-4"/> إلغاء
                </Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}
