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
import { Label } from '@/components/ui/label';
import { ArrowRight, Printer, Pencil } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useFirebase, useDoc } from '@/firebase';
import { doc, getDocs, collection, query, limit } from 'firebase/firestore';
import type { CashReceipt, Company } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

function InfoDisplay({ label, value }: { label: string, value: string | undefined }) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <div className='p-2 text-sm text-muted-foreground border rounded-md min-h-[40px] bg-muted/50 print:bg-transparent print:border-gray-300'>
                {value || '-'}
            </div>
        </div>
    );
}

export default function ViewCashReceiptPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { firestore } = useFirebase();

  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);

  const receiptRef = useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'cashReceipts', id);
  }, [firestore, id]);

  const [receiptSnap, receiptLoading, receiptError] = useDoc(receiptRef);

  const receipt = useMemo(() => {
    if (receiptSnap?.exists()) {
      return { id: receiptSnap.id, ...receiptSnap.data() } as CashReceipt;
    }
    return null;
  }, [receiptSnap]);


  // Effect to fetch initial company data
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
        } finally {
            setCompanyLoading(false);
        }
    };
    fetchCompany();
  }, [firestore]);
  
  const handlePrint = () => {
    window.print();
  };
  
  const formattedDate = useMemo(() => {
      if (!receipt?.receiptDate) return '';
      try {
          return format(receipt.receiptDate.toDate(), 'yyyy-MM-dd');
      } catch {
          return '';
      }
  }, [receipt]);


  if (receiptLoading || companyLoading) {
      return (
         <Card className="max-w-4xl mx-auto printable-content">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-32 mt-2" />
                    </div>
                    <div className='text-left space-y-1'>
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
            </CardHeader>
             <CardContent className="space-y-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
             </CardContent>
             <CardFooter className="flex justify-end gap-2 no-print">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
             </CardFooter>
        </Card>
      );
  }

  if (!receipt) {
      return (
        <div className="text-center py-10" dir="rtl">
            <p className="text-destructive">لم يتم العثور على سند القبض المطلوب.</p>
            <Button onClick={() => router.push('/dashboard/accounting')} className="mt-4">
            العودة إلى المحاسبة
            </Button>
        </div>
      );
  }

  return (
    <Card className="max-w-4xl mx-auto printable-content print:shadow-none print:border-none">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>سـنـد قـبـض / Cash Receipt Voucher</CardTitle>
                <CardDescription>{receipt.voucherNumber} : رقم السند</CardDescription>
            </div>
            {company ? (
                <div className='text-left'>
                    <p className='font-semibold'>{company.nameEn || company.name}</p>
                    <p className='text-sm text-muted-foreground'>{company.address}</p>
                    <p className='text-sm text-muted-foreground'>CR: {company.crNumber}</p>
                </div>
            ) : (
                <div className='text-left'>
                    <p className='font-semibold'>Dar Belaih Al-Mesfir Engineering Consultants</p>
                </div>
            )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="md:col-span-2">
                <InfoDisplay label="استلمنا من السيد/السادة" value={receipt.clientNameAr} />
            </div>
             <div className="grid gap-2">
                <Label>التاريخ</Label>
                <Input value={formattedDate} type="date" readOnly disabled className="bg-muted/50 print:bg-transparent" />
            </div>
        </div>
        
        {receipt.projectNameAr && (
            <InfoDisplay label="بخصوص العقد/المشروع" value={receipt.projectNameAr} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="grid gap-2">
                <Label>المبلغ</Label>
                <Input value={receipt.amount.toFixed(3)} className='text-left dir-ltr bg-muted/50 print:bg-transparent' readOnly disabled />
            </div>
            <div className="md:col-span-2 grid gap-2">
              <Label>مبلغ وقدره (كتابة)</Label>
               <div className='p-2 text-sm border rounded-md min-h-[40px] print:border-gray-300'>
                 {receipt.amountInWords}
              </div>
            </div>
        </div>
        <div className="grid gap-2">
            <Label>وذلك عن</Label>
            <div className='p-2 text-sm border rounded-md min-h-[80px] whitespace-pre-wrap print:border-gray-300'>
                {receipt.description || '-'}
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InfoDisplay label="طريقة الدفع" value={receipt.paymentMethod} />
            <InfoDisplay label="نوع الدفعة" value={receipt.type} />
            <InfoDisplay label="رقم الشيك/المرجع" value={receipt.reference} />
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
      <CardFooter className="flex justify-end gap-2 no-print">
        <Button variant="outline" onClick={() => router.push('/dashboard/accounting')}>
            <ArrowRight className="ml-2 h-4 w-4" />
            العودة
        </Button>
         <Button variant="outline" onClick={() => router.push(`/dashboard/accounting/cash-receipts/${receipt.id}/edit`)}>
            <Pencil className="ml-2 h-4 w-4" />
            تعديل
        </Button>
        <Button onClick={handlePrint}>
            <Printer className="ml-2 h-4 w-4" />
            طباعة
        </Button>
      </CardFooter>
    </Card>
  );
}
