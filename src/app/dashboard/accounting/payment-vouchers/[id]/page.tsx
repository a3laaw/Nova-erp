
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowRight, Printer, Pencil } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useFirebase, useDoc } from '@/firebase';
import { doc, getDocs, collection, query, limit } from 'firebase/firestore';
import type { PaymentVoucher, Company } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Logo } from '@/components/layout/logo';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useBranding } from '@/context/branding-context';


const paymentMethodTranslations: Record<string, string> = {
    'Cash': 'نقداً',
    'Cheque': 'شيك',
    'Bank Transfer': 'تحويل بنكي',
};

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    paid: 'مدفوع',
    cancelled: 'ملغي',
};

const InfoRow = ({ label, value }: { label: string, value: React.ReactNode | string | undefined | null }) => (
    <div className="flex items-baseline">
        <span className="w-40 font-semibold text-gray-600 dark:text-gray-400">{label}:</span>
        <span className="flex-1 border-b border-dashed border-gray-400 pb-1 text-gray-800 dark:text-gray-200">{value || '---'}</span>
    </div>
);


export default function ViewPaymentVoucherPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { firestore } = useFirebase();
  const { branding, loading: brandingLoading } = useBranding();

  const voucherRef = useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'paymentVouchers', id);
  }, [firestore, id]);

  const [voucherSnap, voucherLoading, voucherError] = useDoc(voucherRef);

  const voucher = useMemo(() => {
    if (voucherSnap?.exists()) {
      return { id: voucherSnap.id, ...voucherSnap.data() } as PaymentVoucher;
    }
    return null;
  }, [voucherSnap]);

  
  const handlePrint = () => {
    window.print();
  };
  
  const formattedDate = useMemo(() => {
      if (!voucher?.paymentDate) return '';
      try {
          return format(voucher.paymentDate.toDate(), 'dd / MM / yyyy');
      } catch {
          return '';
      }
  }, [voucher]);


  if (voucherLoading || brandingLoading) {
      return (
         <div className="p-8 max-w-4xl mx-auto bg-white space-y-8">
            <header className="flex justify-between items-center pb-4 border-b">
                <Skeleton className="h-20 w-1/3" />
                <Skeleton className="h-20 w-1/4" />
            </header>
            <main className="space-y-8 mt-8">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-16 w-full" />
            </main>
        </div>
      );
  }

  if (!voucher) {
      return (
        <div className="text-center py-10" dir="rtl">
            <p className="text-destructive">لم يتم العثور على سند الصرف المطلوب.</p>
            <Button onClick={() => router.push('/dashboard/accounting/payment-vouchers')} className="mt-4">
                العودة إلى سندات الصرف
            </Button>
        </div>
      );
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
        <div className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none">
            <div id="printable-area" className="p-8 md:p-12 printable-content">
                 <header className="pb-4 border-b-2 border-gray-800 dark:border-gray-300">
                    {branding?.letterhead_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                            src={branding.letterhead_image_url} 
                            alt={`${branding.company_name || ''} Letterhead`}
                            className="w-full h-auto object-contain max-h-[150px] mb-4"
                        />
                    ) : (
                        <div className="flex justify-between items-start">
                             <div className="text-left flex-shrink-0">
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">سـنـد صـرف</h2>
                                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Payment Voucher</p>
                                <div className='flex items-center gap-2 mt-2'>
                                   <p className="font-mono text-sm text-muted-foreground">{voucher.voucherNumber} : <span className='font-sans'>رقم السند</span></p>
                                    <Badge variant="outline" className={statusColors[voucher.status] || ''}>{statusTranslations[voucher.status] || voucher.status}</Badge>
                                </div>
                            </div>
                             <div className="flex items-center gap-4">
                               <Logo className="h-16 w-16 !p-3" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                <div>
                                   <h1 className="font-bold text-lg">{branding?.company_name}</h1>
                                   <p className="text-sm text-muted-foreground">{branding?.nameEn}</p>
                                   <p className="text-xs text-muted-foreground mt-2">{branding?.address}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </header>

                <main className="py-8 space-y-8">
                     <div className="grid grid-cols-5 gap-x-8 gap-y-4">
                        <div className="col-span-3">
                            <InfoRow label="اصرفوا لأمر السيد/السادة" value={voucher.payeeName} />
                        </div>
                        <div className="col-span-2">
                             <div className="flex items-baseline">
                                <span className="w-20 font-semibold text-gray-600 dark:text-gray-400">التاريخ:</span>
                                <span className="flex-1 border-b border-dashed border-gray-400 pb-1 text-center font-mono text-gray-800 dark:text-gray-200">{formattedDate}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <InfoRow label="مبلغ وقدره" value={formatCurrency(voucher.amount)} />
                    </div>

                    <InfoRow label="وذلك مبلغ وقدره" value={voucher.amountInWords} />
                    
                    <div className="space-y-2">
                        <Label className="font-semibold text-gray-600 dark:text-gray-400">وذلك عن:</Label>
                        <div className='p-3 text-sm border rounded-md min-h-[100px] bg-gray-50 dark:bg-gray-800/50 whitespace-pre-wrap text-gray-800 dark:text-gray-200'>
                            {voucher.description || '-'}
                        </div>
                    </div>
                    
                     <div className={cn("grid gap-8 pt-4", voucher.paymentMethod !== 'Cash' && voucher.reference ? 'grid-cols-2' : 'grid-cols-1')}>
                         <InfoRow label="طريقة الدفع" value={paymentMethodTranslations[voucher.paymentMethod] || voucher.paymentMethod} />
                         
                         {voucher.paymentMethod !== 'Cash' && voucher.reference && (
                             <InfoRow 
                                label={voucher.paymentMethod === 'Cheque' ? 'رقم الشيك' : 'رقم المرجع'} 
                                value={voucher.reference} 
                             />
                         )}
                    </div>
                </main>
                
                 <footer className="pt-24">
                    <div className="grid grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="border-t-2 border-gray-300 pt-2">
                                <p className="font-semibold">المستلم</p>
                                <p className="text-sm text-muted-foreground">Receiver's Signature</p>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="border-t-2 border-gray-300 pt-2">
                                <p className="font-semibold">المحاسب</p>
                                <p className="text-sm text-muted-foreground">Accountant</p>
                            </div>
                        </div>
                         <div className="text-center">
                            <div className="border-t-2 border-gray-300 pt-2">
                                <p className="font-semibold">المدير المالي</p>
                                <p className="text-sm text-muted-foreground">CFO</p>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
             <div className="p-6 bg-muted/50 rounded-b-lg flex justify-end gap-2 no-print">
                <Button variant="outline" onClick={() => router.push(`/dashboard/accounting/payment-vouchers/${voucher.id}/edit`)}>
                    <Pencil className="ml-2 h-4 w-4" />
                    تعديل
                </Button>
                <Button onClick={handlePrint}>
                    <Printer className="ml-2 h-4 w-4" />
                    طباعة
                </Button>
            </div>
        </div>
    </div>
  );
}
