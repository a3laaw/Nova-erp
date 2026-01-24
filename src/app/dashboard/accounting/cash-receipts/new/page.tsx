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
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Client, Company } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function NewCashReceiptPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [date, setDate] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);

  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [amountInWords, setAmountInWords] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [type, setType] = useState(''); // advance, milestone, final
  const [reference, setReference] = useState('');

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

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

  const clientOptions = useMemo(() => clients.map(c => ({
      value: c.id,
      label: c.nameAr,
      searchKey: c.mobile,
  })), [clients]);

  const handleSave = async () => {
    if (!firestore) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'Firebase غير متاح.' });
        return;
    }
    // Validation
    if (!selectedClientId || !amount || !date || !type || !paymentMethod || !amountInWords || !description) {
        toast({
            variant: 'destructive',
            title: 'حقول ناقصة',
            description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).',
        });
        return;
    }

    setIsSaving(true);
    try {
        const selectedClient = clients.find(c => c.id === selectedClientId);

        const newReceiptData = {
            clientId: selectedClientId,
            clientNameAr: selectedClient?.nameAr || '',
            clientNameEn: selectedClient?.nameEn || '',
            amount: parseFloat(amount),
            amountInWords: amountInWords,
            receiptDate: Timestamp.fromDate(new Date(date)),
            type: type,
            paymentMethod: paymentMethod,
            description: description,
            reference: reference,
            createdAt: serverTimestamp(),
        };

        await addDoc(collection(firestore, 'cashReceipts'), newReceiptData);
        
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

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>سـنـد قـبـض / Cash Receipt Voucher</CardTitle>
                <CardDescription>CRV-2024-002 : رقم السند</CardDescription>
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
                onSelect={setSelectedClientId}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="grid gap-2">
                <Label htmlFor="amount">المبلغ <span className="text-destructive">*</span></Label>
                <Input id="amount" type="number" placeholder="0.000" className='text-left dir-ltr' value={amount} onChange={e => setAmount(e.target.value)} disabled={isSaving}/>
            </div>
            <div className="md:col-span-2 grid gap-2">
              <Label htmlFor="amountInWords">مبلغ وقدره (كتابة) <span className="text-destructive">*</span></Label>
              <Input
                id="amountInWords"
                value={amountInWords}
                onChange={(e) => setAmountInWords(e.target.value)}
                placeholder="فقط..."
                disabled={isSaving}
                required
              />
            </div>
        </div>
        <div className="grid gap-2">
            <Label htmlFor="description">وذلك عن <span className="text-destructive">*</span></Label>
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
                <Label htmlFor="type">نوع الدفعة <span className="text-destructive">*</span></Label>
                <Select dir="rtl" value={type} onValueChange={setType} disabled={isSaving}>
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
        <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            {isSaving ? 'جاري الحفظ...' : 'حفظ'}
        </Button>
      </CardFooter>
    </Card>
  );
}