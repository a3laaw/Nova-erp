
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
import { Printer, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { Client, Company } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function NewCashReceiptPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [date, setDate] = useState('');
  
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState('');
  
  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);

  useEffect(() => {
    // Set date on client to avoid hydration mismatch
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
              <Label htmlFor="receivedFrom">استلمنا من السيد/السادة</Label>
              <InlineSearchList 
                value={selectedClientId}
                onSelect={setSelectedClientId}
                options={clientOptions}
                placeholder={clientsLoading ? 'جاري التحميل...' : 'ابحث عن عميل بالاسم أو الجوال...'}
                disabled={clientsLoading}
              />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="date">التاريخ</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="grid gap-2">
                <Label htmlFor="amount">المبلغ</Label>
                <Input id="amount" type="number" placeholder="0.00" className='text-left dir-ltr' />
            </div>
            <div className="md:col-span-2 grid gap-2">
              <Label htmlFor="amountInWords">مبلغ وقدره</Label>
              <Input id="amountInWords" placeholder="المبلغ كتابة..." />
            </div>
        </div>
        <div className="grid gap-2">
            <Label htmlFor="description">وذلك عن</Label>
            <Textarea id="description" placeholder="وصف عملية الدفع..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="grid gap-2">
                <Label htmlFor="paymentMethod">طريقة الدفع</Label>
                 <Select dir='rtl'>
                    <SelectTrigger id="paymentMethod">
                        <SelectValue placeholder="اختر طريقة الدفع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Cash">نقداً</SelectItem>
                        <SelectItem value="Cheque">شيك</SelectItem>
                        <SelectItem value="Bank Transfer">تحويل بنكي</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reference">رقم الشيك/المرجع</Label>
              <Input id="reference" placeholder="رقم المرجع..." />
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
        <Button variant="outline" onClick={() => router.push('/dashboard/accounting')}>
            <X className="ml-2 h-4 w-4" />
            إلغاء
        </Button>
        <Button variant="outline">
            <Printer className="ml-2 h-4 w-4" />
            طباعة
        </Button>
        <Button>
            <Save className="ml-2 h-4 w-4" />
            حفظ
        </Button>
      </CardFooter>
    </Card>
  );
}
