'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Printer, Save, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit, doc, runTransaction, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';
import type { Client, Company, ClientTransaction } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { numberToArabicWords, formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { useAuth } from '@/context/auth-context';

export default function NewCashReceiptPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [date, setDate] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  
  const [clientProjects, setClientProjects] = useState<ClientTransaction[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [amount, setAmount] = useState('');
  const [amountInWords, setAmountInWords] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [type, setType] = useState(''); // advance, milestone, final
  const [reference, setReference] = useState('');

  const [voucherNumber, setVoucherNumber] = useState('جاري التوليد...');
  const [isGeneratingVoucher, setIsGeneratingVoucher] = useState(true);

  useEffect(() => {
    if (!firestore) return;

    const generateVoucherNumber = async () => {
        setIsGeneratingVoucher(true);
        try {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'cashReceipts');
            const counterDoc = await getDoc(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            setVoucherNumber(`CRV-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        } catch (error) {
            console.error("Error generating voucher number:", error);
            setVoucherNumber('خطأ');
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل توليد رقم سند تلقائي.' });
        } finally {
            setIsGeneratingVoucher(false);
        }
    };

    generateVoucherNumber();
  }, [firestore, toast]);

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (amount && !isNaN(parseFloat(amount))) {
        setAmountInWords(numberToArabicWords(amount));
    } else {
        setAmountInWords('');
    }
  }, [amount]);


  // Effect to fetch initial company and client data
  useEffect(() => {
    if (!firestore) return;

    const fetchCompany = async () => {
        setCompanyLoading(true);
        try {
            const q = query(collection(firestore, 'companies'), limit(1));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const companyData = snapshot.docs[0].data() as Company;
                setCompany({ id: snapshot.docs[0].id, ...companyData });
            }
        } catch (error) {
            console.error("Error fetching company data:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات الشركة.' });
        } finally {
            setCompanyLoading(false);
        }
    };
    fetchCompany();

    const fetchClients = async () => {
      setClientsLoading(true);
      try {
        const q = query(collection(firestore, 'clients'), where('isActive', '==', true));
        const snapshot = await getDocs(q);
        const fetchedClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        fetchedClients.sort((a, b) => a.nameAr.localeCompare(b.nameAr));
        setClients(fetchedClients);
      } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة العملاء.' });
      } finally {
        setClientsLoading(false);
      }
    };
    fetchClients();
  }, [firestore, toast]);
  
  // Effect to fetch client's projects (transactions with contracts) when a client is selected
  useEffect(() => {
    if (!firestore || !selectedClientId) {
        setClientProjects([]);
        setSelectedProjectId('');
        return;
    }
    
    const fetchClientProjects = async () => {
        setProjectsLoading(true);
        try {
            const projectsQuery = query(collection(firestore, `clients/${selectedClientId}/transactions`), where('contract', '!=', null));
            const snapshot = await getDocs(projectsQuery);
            const fetchedProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientTransaction));
            setClientProjects(fetchedProjects);
        } catch (error) {
            console.error("Error fetching client projects:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب عقود العميل.' });
        } finally {
            setProjectsLoading(false);
        }
    };

    fetchClientProjects();
  }, [firestore, selectedClientId, toast]);
  
  // Effect for automatic description generation
  useEffect(() => {
      if (!selectedProjectId || !amount || parseFloat(amount) <= 0) {
          setDescription(''); // Reset description if no project or amount
          return;
      }
      
      const project = clientProjects.find(p => p.id === selectedProjectId);
      if (!project || !project.contract?.clauses) {
          setDescription('');
          return;
      }
      
      let remainingAmount = parseFloat(amount);
      const descriptionParts: string[] = [];
      const unpaidClauses = project.contract.clauses.filter(c => c.status !== 'مدفوعة');
      
      for (const clause of unpaidClauses) {
          if (remainingAmount <= 0) break;
          
          // NOTE: This is a simplified logic. A real system would need to track partial payments on each clause.
          // For now, we assume the clause.amount is the full remaining amount for that clause.
          const clauseAmount = clause.amount;
          
          if (remainingAmount >= clauseAmount) {
              descriptionParts.push(`سداد كامل للدفعة "${clause.name}" بقيمة ${formatCurrency(clauseAmount)}`);
              remainingAmount -= clauseAmount;
          } else {
              descriptionParts.push(`سداد جزئي من الدفعة "${clause.name}" بقيمة ${formatCurrency(remainingAmount)}`);
              const remainingInClause = clauseAmount - remainingAmount;
              descriptionParts.push(`(المتبقي من هذه الدفعة: ${formatCurrency(remainingInClause)})`);
              remainingAmount = 0;
          }
      }
      
      if (remainingAmount > 0) {
          descriptionParts.push(`مبلغ إضافي قدره ${formatCurrency(remainingAmount)} كدفعة مقدمة على الحساب.`);
      }
      
      setDescription(descriptionParts.join('\n'));

  }, [amount, selectedProjectId, clientProjects]);

  const clientOptions = useMemo(() => clients.map(c => ({
      value: c.id,
      label: c.nameAr,
      searchKey: c.mobile,
  })), [clients]);

  const projectOptions = useMemo(() => clientProjects.map(p => {
    const dateString = p.createdAt?.toDate ? format(p.createdAt.toDate(), 'dd/MM/yyyy') : '';
    return {
        value: p.id!,
        label: dateString ? `${p.transactionType} (${dateString})` : p.transactionType,
    }
  }), [clientProjects]);

  const handleSave = async () => {
    if (!firestore || !currentUser) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'Firebase غير متاح أو المستخدم غير مسجل.' });
        return;
    }
    // Validation
    if (!selectedClientId || !amount || !date || !paymentMethod) {
        toast({
            variant: 'destructive',
            title: 'حقول ناقصة',
            description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).',
        });
        return;
    }

    if (isGeneratingVoucher) {
        toast({ variant: 'destructive', title: 'الرجاء الانتظار', description: 'جاري توليد رقم السند.' });
        return;
    }

    setIsSaving(true);
    try {
        await runTransaction(firestore, async (transaction_fs) => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'cashReceipts');
            const counterDoc = await transaction_fs.get(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            
            transaction_fs.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            const newVoucherNumber = `CRV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

            const selectedClient = clients.find(c => c.id === selectedClientId);
            const selectedProject = clientProjects.find(p => p.id === selectedProjectId);

            const newReceiptData: any = { 
                voucherNumber: newVoucherNumber,
                voucherSequence: nextNumber,
                voucherYear: currentYear,
                clientId: selectedClientId,
                clientNameAr: selectedClient?.nameAr || '',
                clientNameEn: selectedClient?.nameEn || '',
                amount: parseFloat(amount),
                amountInWords: amountInWords,
                receiptDate: Timestamp.fromDate(new Date(date)),
                paymentMethod: paymentMethod,
                description: description,
                reference: reference,
                createdAt: serverTimestamp(),
            };
            
            if (selectedProjectId && selectedProject) {
                newReceiptData.projectId = selectedProjectId;
                newReceiptData.projectNameAr = selectedProject.transactionType;
            }

            if(type) {
                newReceiptData.type = type;
            }

            const newReceiptRef = doc(collection(firestore, 'cashReceipts'));
            transaction_fs.set(newReceiptRef, newReceiptData);
            
            // If a project is linked, add the description as a comment to its timeline
            if (selectedProjectId && description) {
                const timelineCommentRef = doc(collection(firestore, `clients/${selectedClientId}/transactions/${selectedProjectId}/timelineEvents`));
                transaction_fs.set(timelineCommentRef, {
                    type: 'comment',
                    content: `[سند قبض رقم: ${newVoucherNumber}]\n${description}`,
                    userId: currentUser.id,
                    userName: currentUser.fullName,
                    userAvatar: currentUser.avatarUrl,
                    createdAt: serverTimestamp(),
                });
            }
        });
        
        toast({
            title: 'نجاح',
            description: 'تم حفظ سند القبض بنجاح.',
        });

        router.push('/dashboard/accounting');

    } catch (error) {
        console.error("Error saving cash receipt:", error);
        toast({
            variant: 'destructive',
            title: 'خطأ في الحفظ',
            description: 'لم يتم حفظ السند، الرجاء المحاولة مرة أخرى.',
        });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    // Reset project-specific fields
    setSelectedProjectId('');
    setClientProjects([]);
    setDescription('');
  };


  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>سـنـد قـبـض / Cash Receipt Voucher</CardTitle>
                <CardDescription>{isGeneratingVoucher ? <Skeleton className="h-4 w-32" /> : voucherNumber} : رقم السند</CardDescription>
            </div>
            {companyLoading ? (
                <div className='text-left space-y-1'>
                    <Skeleton className="h-5 w-64" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
            ) : company ? (
                <div className='text-left'>
                    <p className='font-semibold'>{company.nameEn || company.name}</p>
                    <p className='text-sm text-muted-foreground'>{company.address}</p>
                    <p className='text-sm text-muted-foreground'>CR: {company.crNumber}</p>
                </div>
            ) : (
                <div className='text-left'>
                    <p className='font-semibold'>Dar Belaih Al-Mesfir Engineering Consultants</p>
                    <p className='text-sm text-muted-foreground'>Kuwait City, Kuwait</p>
                    <p className='text-sm text-muted-foreground'>CR: 123456</p>
                </div>
            )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="md:col-span-2 grid gap-2">
              <Label htmlFor="receivedFrom">استلمنا من السيد/السادة <span className="text-destructive">*</span></Label>
              <InlineSearchList 
                value={selectedClientId}
                onSelect={handleClientChange}
                options={clientOptions}
                placeholder={clientsLoading ? 'جاري التحميل...' : 'ابحث عن عميل بالاسم أو الجوال...'}
                disabled={clientsLoading || isSaving}
              />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="date">التاريخ <span className="text-destructive">*</span></Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSaving}/>
            </div>
        </div>
        
        <div className="grid gap-2">
            <Label htmlFor="project">ربط بعقد/مشروع (اختياري)</Label>
            <InlineSearchList 
                value={selectedProjectId}
                onSelect={setSelectedProjectId}
                options={projectOptions}
                placeholder={!selectedClientId ? 'اختر عميلاً أولاً' : projectsLoading ? 'جاري جلب العقود...' : 'اختر العقد المراد سداد دفعة له...'}
                disabled={!selectedClientId || projectsLoading || isSaving}
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="grid gap-2">
                <Label htmlFor="amount">المبلغ <span className="text-destructive">*</span></Label>
                <Input id="amount" type="number" placeholder="0.000" className='text-left dir-ltr' value={amount} onChange={e => setAmount(e.target.value)} disabled={isSaving}/>
            </div>
            <div className="md:col-span-2 grid gap-2">
              <Label htmlFor="amountInWords">مبلغ وقدره (كتابة)</Label>
               <div className='p-2 text-sm text-muted-foreground border rounded-md min-h-[40px] bg-muted/50'>
                 {amountInWords || '(سيتم ملؤه تلقائياً)'}
              </div>
            </div>
        </div>
        <div className="grid gap-2">
            <Label htmlFor="description">وذلك عن</Label>
            <Textarea id="description" placeholder="وصف عملية الدفع..." value={description} onChange={e => setDescription(e.target.value)} disabled={isSaving}/>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="grid gap-2">
                <Label htmlFor="paymentMethod">طريقة الدفع <span className="text-destructive">*</span></Label>
                 <Select dir='rtl' value={paymentMethod} onValueChange={setPaymentMethod} disabled={isSaving}>
                    <SelectTrigger id="paymentMethod">
                        <SelectValue placeholder="اختر طريقة الدفع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Cash">نقداً</SelectItem>
                        <SelectItem value="Cheque">شيك</SelectItem>
                        <SelectItem value="Bank Transfer">تحويل بنكي</SelectItem>
                        <SelectItem value="K-Net">كي-نت</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="grid gap-2">
                <Label htmlFor="type">نوع الدفعة (يدوي)</Label>
                <Select dir="rtl" value={type} onValueChange={setType} disabled={isSaving || !!selectedProjectId}>
                    <SelectTrigger id="type">
                        <SelectValue placeholder="اختر نوع الدفعة" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="advance">دفعة مقدمة</SelectItem>
                        <SelectItem value="milestone">دفعة مرحلية</SelectItem>
                        <SelectItem value="final">دفعة أخيرة</SelectItem>
                        <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reference">رقم الشيك/المرجع</Label>
              <Input id="reference" placeholder="رقم المرجع..." value={reference} onChange={e => setReference(e.target.value)} disabled={isSaving}/>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-20 pt-16">
            <div className="text-center">
                <div className="border-t pt-2">
                    <p className="font-semibold">المستلم</p>
                    <p className="text-sm text-muted-foreground">Receiver's Signature</p>
                </div>
            </div>
            <div className="text-center">
                <div className="border-t pt-2">
                    <p className="font-semibold">المحاسب</p>
                     <p className="text-sm text-muted-foreground">Accountant's Signature</p>
                </div>
            </div>
        </div>
        
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push('/dashboard/accounting')} disabled={isSaving}>
            <X className="ml-2 h-4 w-4" />
            إلغاء
        </Button>
        <Button variant="outline" disabled={isSaving}>
            <Printer className="ml-2 h-4 w-4" />
            طباعة
        </Button>
        <Button onClick={handleSave} disabled={isSaving || isGeneratingVoucher}>
            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            {isSaving ? 'جاري الحفظ...' : 'حفظ'}
        </Button>
      </CardFooter>
    </Card>
  );
}
