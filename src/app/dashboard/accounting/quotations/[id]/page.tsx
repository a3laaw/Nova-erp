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

  const { data: quotation, loading: quotationLoading } = useDocument<Quotation>(firestore, quotationRef ? quotationRef.path : null);

  // تحضير بيانات العقد من واقع عرض السعر المختار
  const prefilledTransaction = useMemo((): Partial<ClientTransaction> | null => {
    if (!quotation) return null;
    return {
      id: quotation.projectId || undefined, // ربط العقد بهيكل المشروع إن وجد
      clientId: quotation.clientId,
      transactionType: quotation.subject,
      description: quotation.templateDescription || '',
      contract: {
        totalAmount: quotation.totalAmount || 0,
        financialsType: quotation.financialsType || 'fixed',
        clauses: (quotation.items || []).map(item => ({
            id: item.id || Math.random().toString(36).substring(7),
            name: item.description,
            amount: item.total || 0,
            status: 'غير مستحقة',
            condition: item.condition || '',
            percentage: item.percentage
        })),
        scopeOfWork: quotation.scopeOfWork || [],
        termsAndConditions: quotation.termsAndConditions || [],
        openClauses: quotation.openClauses || [],
      }
    };
  }, [quotation]);

  const handlePrint = () => window.print();
  
  const formatDate = (dateValue: any) => {
      if (!dateValue) return '-';
      try {
          const d = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
          return format(d, 'dd/MM/yyyy');
      } catch { return '-'; }
  };

  if (quotationLoading || brandingLoading) {
      return <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl"><Skeleton className="h-32 w-full rounded-xl" /><Skeleton className="h-96 w-full rounded-xl" /></div>;
  }

  if (!quotation) return <div className="text-center py-20" dir="rtl"><p className="text-destructive">لم يتم العثور على عرض السعر.</p></div>;

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
                    <Button onClick={() => setIsContractFormOpen(true)} className="bg-green-600 hover:bg-green-700 font-bold gap-2">
                        <FileSignature className="h-4 w-4" />
                        قبول العرض وإنشاء العقد
                    </Button>
                )}
                {quotation.status === 'draft' && (
                  <Button variant="outline" onClick={() => router.push(`/dashboard/accounting/quotations/${quotation.id}/edit`)}>
                      <Pencil className="ml-2 h-4 w-4" /> تعديل
                  </Button>
                )}
                <Button onClick={handlePrint} variant="outline" className="gap-2">
                    <Printer className="h-4 w-4" /> طباعة
                </Button>
            </div>

            <div id="printable-area" className="p-8 md:p-12 printable-content">
                <header className="flex justify-between items-start pb-6 mb-8 border-b-4 border-primary">
                    <div>
                        <Logo className="h-20 w-20 !p-3 shadow-inner border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <h1 className="text-2xl font-black mt-2">{branding?.company_name || 'Nova ERP'}</h1>
                    </div>
                    <div className="text-left space-y-1">
                        <h2 className="text-3xl font-black text-primary tracking-tighter">عرض سعر رسمي</h2>
                        <p className="font-mono text-sm text-muted-foreground">{quotation.quotationNumber}</p>
                        <p className="text-xs text-muted-foreground">التاريخ: {formatDate(quotation.date)}</p>
                        <Badge className={cn("mt-2", statusColors[quotation.status])}>{statusTranslations[quotation.status]}</Badge>
                    </div>
                </header>

                <section className="grid grid-cols-2 gap-8 mb-8 p-6 bg-muted/20 rounded-2xl border">
                    <div>
                        <p className='text-[10px] uppercase font-black text-muted-foreground mb-1'>السيد المالك / Client:</p>
                        <p className='text-lg font-bold'>{quotation.clientName}</p>
                    </div>
                    <div className='text-left'>
                        <p className='text-[10px] uppercase font-black text-muted-foreground mb-1'>الموضوع / Subject:</p>
                        <p className='text-lg font-bold'>{quotation.subject}</p>
                    </div>
                </section>
                
                <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/80">
                            <TableRow className="h-12 border-b-2">
                                <TableHead className="w-12 text-center font-bold">#</TableHead>
                                <TableHead className="font-bold text-foreground">البيان / الدفعة</TableHead>
                                <TableHead className="w-32 text-center font-bold text-foreground">{quotation.financialsType === 'percentage' ? 'النسبة' : 'سعر الوحدة'}</TableHead>
                                <TableHead className="w-40 text-left font-bold text-foreground px-8">الإجمالي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quotation.items.map((item, index) => (
                                <TableRow key={index} className="h-14 border-b last:border-0">
                                    <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground bg-muted/5 border-l">{index + 1}</TableCell>
                                    <TableCell className="font-bold">{item.description}</TableCell>
                                    <TableCell className="text-center font-mono font-bold">
                                        {quotation.financialsType === 'percentage' ? `${item.percentage}%` : formatCurrency(item.unitPrice || 0)}
                                    </TableCell>
                                    <TableCell className="text-left font-mono font-black text-primary px-8 bg-primary/[0.02] border-r">
                                        {formatCurrency(item.total || 0)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter className="bg-primary/5">
                            <TableRow className="h-20 border-t-4 border-primary/20">
                                <TableCell colSpan={3} className="text-right px-12 font-black text-xl">المجموع الإجمالي للعرض:</TableCell>
                                <TableCell className="text-left font-mono text-2xl font-black text-primary px-8 border-r bg-primary/5">
                                    {formatCurrency(quotation.totalAmount || 0)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>

                {quotation.notes && (
                    <section className="mt-8">
                        <h4 className="font-black mb-2 text-primary flex items-center gap-2"><ArrowRight className="h-4 w-4"/> ملاحظات وشروط إضافية:</h4>
                        <div className="text-sm leading-loose whitespace-pre-wrap p-6 bg-muted/10 rounded-2xl border-2 border-dashed">
                            {quotation.notes}
                        </div>
                    </section>
                )}
                
                <footer className="mt-20 pt-6 border-t text-center text-[10px] text-muted-foreground">
                    <p>هذا العرض سارٍ لغاية {formatDate(quotation.validUntil)} ومعد آلياً عبر نظام Nova ERP.</p>
                </footer>
            </div>
        </div>
    </div>
    </>
  );
}
