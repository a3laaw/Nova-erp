'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Quotation, ClientTransaction } from '@/lib/types';
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
        financialsType: 'fixed',
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
  
  // Total logic remains the same
  const totalAmount = quotation.items.reduce((sum, item) => sum + item.total, 0);

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
    <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:p-0 print:bg-white" dir="rtl">
        <div className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg print:shadow-none print:border-none">
             <div className="p-6 bg-muted/50 rounded-t-lg flex justify-end gap-2 no-print">
                {quotation.status !== 'accepted' && (
                    <Button onClick={() => setIsContractFormOpen(true)} disabled={!quotation.id}>
                        <FileSignature className="ml-2 h-4 w-4" />
                        تحويل إلى عقد
                    </Button>
                )}
                {quotation.status === 'draft' && (
                  <Button variant="outline" onClick={() => router.push(`/dashboard/accounting/quotations/${quotation.id}/edit`)}>
                      <Pencil className="ml-2 h-4 w-4" />
                      تعديل
                  </Button>
                )}
                <Button onClick={handlePrint}>
                    <Printer className="ml-2 h-4 w-4" />
                    طباعة / PDF
                </Button>
            </div>

            <div id="printable-area" className="p-8 md:p-12 printable-content">
                {/* Header Section */}
                <header className="flex justify-between items-start pb-6 mb-8 border-b-2 border-blue-600">
                    <div>
                        <Logo className="h-20 w-20 !p-3" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-200 mt-2">{branding?.company_name || 'Nova ERP'}</h1>
                    </div>
                    <div className="text-left">
                        <h2 className="text-4xl font-bold text-blue-700 dark:text-blue-400">عرض سعر</h2>
                        <p className="font-mono mt-2 text-gray-500 dark:text-gray-400">{quotation.quotationNumber}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">التاريخ: {formatDate(quotation.date)}</p>
                    </div>
                </header>

                {/* Client Info Section */}
                <section className="mb-8">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className='font-semibold text-gray-500'>عرض سعر لـ:</p>
                            <p className='text-lg font-bold text-gray-800'>{quotation.clientName}</p>
                            {/* You can add more client details here if available */}
                        </div>
                        <div className='text-left'>
                            <p className='font-semibold text-gray-500'>الموضوع:</p>
                            <p className='text-lg font-bold text-gray-800'>{quotation.subject}</p>
                        </div>
                    </div>
                </section>
                
                {/* Items Table */}
                <section>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-blue-700 hover:bg-blue-700/90">
                                <TableHead className="w-[50px] text-white">#</TableHead>
                                <TableHead className="w-2/5 text-white">الوصف</TableHead>
                                <TableHead className="text-center text-white">الكمية</TableHead>
                                <TableHead className="text-center text-white">سعر الوحدة</TableHead>
                                <TableHead className="text-left text-white">الإجمالي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quotation.items.map((item, index) => (
                                <TableRow key={item.id || index}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-medium">{item.description}</TableCell>
                                    <TableCell className="text-center font-mono">{item.quantity}</TableCell>
                                    <TableCell className="text-center font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(item.total)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold text-base bg-gray-50">
                                <TableCell colSpan={4} className="text-left">الإجمالي الفرعي</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(totalAmount)}</TableCell>
                            </TableRow>
                            <TableRow className="font-bold text-xl bg-blue-600 text-white">
                                <TableCell colSpan={4} className="text-left">المجموع الإجمالي</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(totalAmount)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </section>

                {/* Terms and Notes Section */}
                {quotation.notes && (
                    <section className="mt-8 pt-6 border-t">
                        <h4 className="font-bold mb-2 text-gray-700">الشروط والملاحظات</h4>
                        <div className="text-sm text-gray-600 whitespace-pre-wrap p-4 bg-gray-50 rounded-md">
                            {quotation.notes}
                        </div>
                    </section>
                )}
                
                {/* Footer Section */}
                <footer className="mt-12 pt-4 border-t-2 border-blue-600 text-center text-xs text-gray-500">
                    <p>إذا كان لديك أي استفسار بخصوص عرض السعر هذا، يرجى التواصل معنا.</p>
                    <p className="font-bold mt-2">{branding?.company_name || 'Nova ERP'}</p>
                </footer>
            </div>
        </div>
    </div>
    </>
  );
}
