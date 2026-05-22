'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Quotation } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Logo } from '@/components/layout/logo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Printer, Pencil, ArrowRight, FileSignature, Ruler, Building2, Layers, ScrollText, Calculator, SeparatorHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ContractClausesForm } from '@/components/clients/contract-clauses-form';
import { useBranding } from '@/context/branding-context';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    sent: 'تم الإرسال',
    accepted: 'مقبول / عقد مبرم',
    rejected: 'مرفوض',
    expired: 'منتهي'
};

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    sent: 'bg-blue-100 text-blue-800 border-blue-200',
    accepted: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
    expired: 'bg-gray-100 text-gray-800 border-gray-200'
};

const roofExtensionLabels: Record<string, string> = {
    none: 'بدون توسعة',
    quarter: 'ربع دور',
    half: 'نصف دور'
};

const basementLabels: Record<string, string> = {
    none: 'بدون سرداب',
    full: 'سرداب كامل',
    half: 'سرداب نص',
    vault: 'قبو'
};

const arabicOrdinals = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];

export default function ViewQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { firestore } = useFirebase();
  const { branding, loading: brandingLoading } = useBranding();

  const [isContractFormOpen, setIsContractFormOpen] = useState(false);

  const quotationRef = useMemo(() => (firestore && id ? doc(firestore, 'quotations', id) : null), [firestore, id]);
  const { data: quotation, loading: quotationLoading } = useDocument<Quotation>(firestore, quotationRef ? quotationRef.path : null);

  const formatDate = (dateValue: any) => {
      const d = toFirestoreDate(dateValue);
      return d ? format(d, 'dd/MM/yyyy', { locale: ar }) : '-';
  };

  if (quotationLoading || brandingLoading) {
      return (
        <div className="p-12 max-w-4xl mx-auto space-y-10" dir="rtl">
            <Skeleton className="h-32 w-full rounded-[2.5rem]" />
            <Skeleton className="h-[600px] w-full rounded-[3rem]" />
        </div>
      );
  }

  if (!quotation) return <div className="text-center py-20 font-black opacity-30">لم يتم العثور على عرض السعر.</div>;

  return (
    <>
    {isContractFormOpen && (
        <ContractClausesForm
            isOpen={isContractFormOpen}
            onClose={() => setIsContractFormOpen(false)}
            transaction={quotation as any} 
            clientId={quotation.clientId}
            clientName={quotation.clientName}
            quotationIdToUpdate={quotation.id}
        />
    )}
    <div className="bg-gray-100 p-4 sm:p-12 print:p-0 print:bg-white" dir="rtl">
        <div className="max-w-5xl mx-auto bg-white shadow-2xl rounded-[3.5rem] overflow-hidden print:shadow-none border">
             <div className="p-8 bg-muted/30 rounded-t-[3.5rem] flex justify-between items-center no-print border-b">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-black rounded-2xl h-12 text-slate-500 hover:bg-white">
                    <ArrowRight className="h-5 w-5"/> العودة
                </Button>
                <div className="flex gap-4">
                    {quotation.status !== 'accepted' && (
                        <Button onClick={() => setIsContractFormOpen(true)} className="bg-green-600 hover:bg-green-700 font-black gap-2 h-12 px-8 rounded-2xl shadow-xl shadow-green-100">
                            <FileSignature className="h-5 w-5" /> قبول العرض وتوقيع العقد
                        </Button>
                    )}
                    {quotation.status === 'draft' && (
                        <Button variant="outline" onClick={() => router.push(`/dashboard/accounting/quotations/${quotation.id}/edit`)} className="h-12 px-8 rounded-2xl font-bold border-2">
                            <Pencil className="ml-2 h-4 w-4" /> تعديل العرض
                        </Button>
                    )}
                    <Button onClick={() => window.print()} variant="outline" className="gap-2 h-12 px-8 rounded-2xl font-bold border-2">
                        <Printer className="h-4 w-4" /> طباعة / PDF
                    </Button>
                </div>
            </div>

            <div id="printable-area" className="p-12 md:p-16 space-y-10 bg-white">
                <header className="flex justify-between items-start pb-8 border-b-8 border-primary">
                    <div className="flex items-center gap-6">
                        <Logo className="h-20 w-16 !p-2 shadow-inner border rounded-2xl" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <div className="space-y-1 text-right">
                            <h1 className="text-2xl font-black text-[#1e1b4b]">{branding?.company_name || 'Nova ERP'}</h1>
                            <p className="text-[10px] text-muted-foreground font-bold">{branding?.address}</p>
                            <p className="text-[9px] font-mono opacity-60">REF: {quotation.quotationNumber}</p>
                        </div>
                    </div>
                    <div className="text-left space-y-1">
                        <h2 className="text-3xl font-black text-primary tracking-tighter">عرض سعر رسمي</h2>
                        <p className="text-lg font-bold text-gray-400 uppercase tracking-widest font-mono">QUOTATION PROPOSAL</p>
                        <div className="pt-2">
                            <Badge variant="outline" className={cn("px-6 py-1 border-2 font-black text-xs rounded-full shadow-sm", statusColors[quotation.status])}>
                                {statusTranslations[quotation.status]}
                            </Badge>
                        </div>
                    </div>
                </header>

                <section className="grid grid-cols-2 gap-8 p-8 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-inner">
                    <div className="text-right">
                        <p className='text-[9px] uppercase font-black text-slate-400 mb-1 tracking-widest'>السيد المالك المحترم / Client Name:</p>
                        <p className='text-2xl font-black text-slate-900'>{quotation.clientName}</p>
                    </div>
                    <div className='text-left border-r-4 border-primary/20 pr-6'>
                        <p className='text-[9px] uppercase font-black text-primary mb-1 tracking-widest'>موضوع العرض / Subject:</p>
                        <p className='text-xl font-black text-primary leading-tight'>{quotation.subject}</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-1">تاريخ الإصدار: {formatDate(quotation.date)}</p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-xl font-black text-[#1e1b4b] flex items-center gap-3 border-r-8 border-indigo-600 pr-4">
                        <Layers className="h-6 w-6 text-indigo-600" /> المواصفات الإنشائية للمشروع
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-8 border-4 border-slate-50 rounded-[2.5rem] bg-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-100" />
                        <div className="space-y-1 text-right">
                            <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1 justify-end"><Ruler className="h-3 w-3" /> المساحة الإجمالية</Label>
                            <p className="text-2xl font-black text-indigo-600 font-mono">{quotation.totalArea} <span className="text-xs">م²</span></p>
                        </div>
                        <div className="space-y-1 text-right">
                            <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1 justify-end"><Building2 className="h-3 w-3" /> عدد الأدوار</Label>
                            <p className="text-2xl font-black text-slate-800">{quotation.floorsCount}</p>
                        </div>
                        <div className="space-y-1 text-right">
                            <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">خيار السرداب</Label>
                            <p className="text-base font-bold">{basementLabels[quotation.basementType]}</p>
                        </div>
                        <div className="space-y-1 text-right">
                            <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">توسعة السطح</Label>
                            <p className="text-base font-bold">{roofExtensionLabels[quotation.roofExtension]}</p>
                        </div>
                    </div>
                </section>

                <div className="space-y-10">
                    {quotation.layoutBlocks?.map((block: any, bIdx: number) => (
                        <div key={block.id} className="animate-in fade-in duration-700">
                            {block.type === 'preamble' ? (
                                <section className="space-y-3">
                                    <h4 className="text-xl font-black text-primary border-r-8 border-primary pr-4">{block.title}</h4>
                                    <div className="p-8 bg-slate-50/50 rounded-[2rem] border-2 border-slate-100">
                                        <p className="text-lg leading-[1.7] font-medium text-slate-700 whitespace-pre-wrap text-right">{block.content}</p>
                                    </div>
                                </section>
                            ) : (
                                <section className="space-y-6">
                                    <h3 className="text-xl font-black text-[#1e1b4b] flex items-center gap-3 border-r-8 border-primary pr-4">
                                        <Calculator className="h-6 w-6 text-primary"/> الترتيبات المالية للدفعات
                                    </h3>
                                    <div className="border-4 border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl">
                                        <Table>
                                            <TableHeader className="bg-slate-900 h-14">
                                                <TableRow className="border-none">
                                                    <TableHead className="w-16 text-center text-white border-l border-white/10 font-black">#</TableHead>
                                                    <TableHead className="px-8 font-black text-lg text-white text-right">بيان الدفعة المستحقة</TableHead>
                                                    <TableHead className="w-48 text-center font-black text-lg text-white">
                                                        {quotation.financialsType === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}
                                                    </TableHead>
                                                    <TableHead className="w-56 text-left px-10 font-black text-lg text-white">الإجمالي</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {quotation.items.map((item, index) => {
                                                    const rowTotal = quotation.financialsType === 'percentage' 
                                                        ? (item.percentage / 100) * (quotation.totalAmount || 0)
                                                        : item.unitPrice; 
                                                    
                                                    return (
                                                        <TableRow key={index} className="h-20 border-b last:border-0 hover:bg-transparent">
                                                            <TableCell className="text-center font-mono font-black text-slate-300 border-l">
                                                                {index + 1}
                                                            </TableCell>
                                                            <TableCell className="px-8 text-right">
                                                                <p className="font-black text-xl text-slate-800 leading-tight">الدفعة {arabicOrdinals[index] || (index + 1)}</p>
                                                                <p className="text-xs font-bold text-primary mt-1">{item.triggerCondition}</p>
                                                            </TableCell>
                                                            <TableCell className="text-center font-mono font-black text-2xl opacity-40">
                                                                {quotation.financialsType === 'percentage' ? `${item.percentage}%` : formatCurrency(item.unitPrice || 0)}
                                                            </TableCell>
                                                            <TableCell className="text-left font-mono font-black text-2xl text-primary px-10 bg-primary/[0.02] border-r">
                                                                {formatCurrency(rowTotal || 0)}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                            <TableFooter className="bg-primary text-white h-24">
                                                <TableRow className="border-none hover:bg-primary">
                                                    <TableCell colSpan={3} className="text-right px-12">
                                                        <p className="text-3xl font-black tracking-tighter">إجمالي قيمة التعاقد:</p>
                                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-60 mt-0.5 text-right">Total Fixed Contract Sum</p>
                                                    </TableCell>
                                                    <TableCell className="text-left font-mono text-4xl font-black px-10 bg-white/10 border-r border-white/20">
                                                        {formatCurrency(quotation.totalAmount || 0)}
                                                    </TableCell>
                                                </TableRow>
                                            </TableFooter>
                                        </Table>
                                    </div>
                                </section>
                            )}
                        </div>
                    ))}
                </div>

                <footer className="mt-20 pt-8 border-t-2 border-dashed text-center space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">هذا العرض سارٍ لغاية {formatDate(quotation.validUntil)} ومعد آلياً عبر نظام Nova ERP.</p>
                </footer>
            </div>
        </div>
    </div>
    </>
  );
}
