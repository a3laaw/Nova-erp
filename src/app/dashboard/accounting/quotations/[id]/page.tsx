
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc, getDocs, collection, query, limit } from 'firebase/firestore';
import type { Quotation, Company, ClientTransaction } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Logo } from '@/components/layout/logo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Printer, Pencil, ArrowRight, FileSignature } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ContractClausesForm } from '@/components/clients/contract-clauses-form';
import { useBranding } from '@/context/branding-context';

const statusTranslations: Record<Quotation['status'], string> = {
    draft: 'مسودة',
    sent: 'تم الإرسال',
    accepted: 'مقبول',
    rejected: 'مرفوض',
    expired: 'منتهي الصلاحية'
};

const statusColors: Record<Quotation['status'], string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800'
};


export default function ViewQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { firestore } = useFirebase();
  const { branding, loading: brandingLoading } = useBranding();

  const [isContractFormOpen, setIsContractFormOpen] = useState(false);

  const quotationRef = useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'quotations', id);
  }, [firestore, id]);

  const { data: quotation, loading: quotationLoading, error: quotationError } = useDocument<Quotation>(firestore, quotationRef ? quotationRef.path : null);

  const prefilledTransaction = useMemo((): Partial<ClientTransaction> | null => {
    if (!quotation) return null;
    return {
      clientId: quotation.clientId,
      transactionType: quotation.subject,
      departmentId: quotation.departmentId,
      transactionTypeId: quotation.transactionTypeId,
      description: quotation.templateDescription || '',
      contract: {
        totalAmount: quotation.totalAmount,
        clauses: quotation.items.map(item => ({
            id: item.id || '',
            name: item.description,
            amount: item.total,
            status: 'غير مستحقة',
            condition: item.condition || ''
        })),
        scopeOfWork: quotation.scopeOfWork || [],
        termsAndConditions: quotation.termsAndConditions || [],
        openClauses: quotation.openClauses || [],
      }
    };
  }, [quotation]);

  const handlePrint = () => {
    window.print();
  };
  
  const formatDate = (dateValue: any) => {
      if (!dateValue) return '';
      try {
          return format(dateValue.toDate(), 'dd/MM/yyyy');
      } catch {
          return '';
      }
  };


  if (quotationLoading || brandingLoading) {
      return (
         <div className="p-8 max-w-4xl mx-auto bg-white space-y-8" dir="rtl">
            <header className="flex justify-between items-center pb-4 border-b">
                <Skeleton className="h-20 w-1/3" />
                <Skeleton className="h-20 w-1/4" />
            </header>
            <main className="space-y-8 mt-8">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-16 w-full" />
                 <Skeleton className="h-24 w-full" />
            </main>
        </div>
      );
  }

  if (!quotation) {
      return (
        <div className="text-center py-10" dir="rtl">
            <p className="text-destructive">لم يتم العثور على عرض السعر المطلوب.</p>
            <Button onClick={() => router.push('/dashboard/accounting/quotations')} className="mt-4">
                العودة إلى عروض الأسعار
            </Button>
        </div>
      );
  }

  return (
    <>
    {isContractFormOpen && prefilledTransaction && (
        <ContractClausesForm
            isOpen={isContractFormOpen}
            onClose={() => setIsContractFormOpen(false)}
            transaction={prefilledTransaction as ClientTransaction}
            clientId={quotation.clientId}
            clientName={quotation.clientName}
            quotationIdToUpdate={quotation.id}
        />
    )}
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
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">عرض سعر</h2>
                                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Quotation</p>
                                <div className='flex items-center gap-2 mt-2'>
                                   <p className="font-mono text-sm text-muted-foreground">{quotation.quotationNumber} : <span className='font-sans'>رقم العرض</span></p>
                                    <Badge variant="outline" className={statusColors[quotation.status]}>{statusTranslations[quotation.status]}</Badge>
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
                     <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                        <div>
                             <p className='font-semibold'>إلى السيد/السادة:</p>
                             <p className='text-muted-foreground'>{quotation.clientName}</p>
                        </div>
                        <div className='text-left'>
                             <p>التاريخ: {formatDate(quotation.date)}</p>
                             <p>صالح حتى: {formatDate(quotation.validUntil)}</p>
                        </div>
                        <div className='col-span-2'>
                            <p><span className='font-semibold'>الموضوع:</span> {quotation.subject}</p>
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">#</TableHead>
                                <TableHead className="w-2/5">الوصف</TableHead>
                                <TableHead className="text-center">الكمية</TableHead>
                                <TableHead className="text-center">سعر الوحدة</TableHead>
                                <TableHead className="text-left">الإجمالي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quotation.items.map((item, index) => (
                                <TableRow key={item.id || index}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col gap-1">
                                            <span>{item.description}</span>
                                            {item.condition && (
                                                <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                                                    - شرط الاستحقاق: {item.condition}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-mono">{item.quantity}</TableCell>
                                    <TableCell className="text-center font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(item.total)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold bg-muted/50 text-lg">
                                <TableCell colSpan={4}>الإجمالي</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(quotation.totalAmount)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                    
                    {quotation.notes && (
                        <div className="pt-4">
                            <h4 className="font-semibold mb-2">ملاحظات وبنود إضافية:</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.notes}</p>
                        </div>
                    )}
                </main>
                
                 <footer className="pt-16">
                    <div className="text-center">
                        <p className="font-semibold">مع خالص الشكر والتقدير</p>
                        <div className="border-t-2 border-gray-300 w-48 mx-auto mt-12 pt-2">
                            <p className="font-semibold">التوقيع</p>
                        </div>
                    </div>
                </footer>
            </div>
             <div className="p-6 bg-muted/50 rounded-b-lg flex justify-end gap-2 no-print">
                {quotation.transactionId ? (
                    <Button variant="outline" disabled>تم تحويله إلى عقد</Button>
                ) : (
                    <Button onClick={() => setIsContractFormOpen(true)}>
                        <FileSignature className="ml-2 h-4 w-4" />
                        تحويل إلى عقد
                    </Button>
                )}
                <Button variant="outline" onClick={() => router.push(`/dashboard/accounting/quotations/${quotation.id}/edit`)}>
                    <Pencil className="ml-2 h-4 w-4" />
                    تعديل
                </Button>
                <Button onClick={handlePrint}>
                    <Printer className="ml-2 h-4 w-4" />
                    طباعة / PDF
                </Button>
            </div>
        </div>
    </div>
    </>
  );
}

    