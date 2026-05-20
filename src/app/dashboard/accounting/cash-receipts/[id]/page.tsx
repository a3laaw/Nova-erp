'use client';

import { useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { CashReceipt } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Banknote, FileText, Target, ShieldCheck, Printer, Pencil } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { PrintLayout } from '@/components/print/print-layout';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

const InfoRow = ({ label, value }: { label: string, value: any }) => (
    <div className="flex items-baseline gap-4 border-b border-dashed border-slate-200 pb-2">
        <span className="w-48 font-black text-slate-500 text-sm">{label}:</span>
        <span className="flex-1 font-bold text-lg text-slate-900">{value || '---'}</span>
    </div>
);

export default function ViewCashReceiptPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { firestore } = useFirebase();

  const receiptRef = useMemo(() => (firestore && id ? doc(firestore, 'cashReceipts', id) : null), [firestore, id]);
  const { data: receipt, loading } = useDocument<CashReceipt>(firestore, receiptRef?.path || null);

  if (loading) return (
    <div className="max-w-4xl mx-auto p-8"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>
  );

  if (!receipt) return <div className="text-center py-20 font-bold">لم يتم العثور على السند المطلوب.</div>;

  const apptDate = toFirestoreDate(receipt.receiptDate);

  return (
    <PrintLayout documentName={`Receipt_${receipt.voucherNumber}`} className="my-10">
        <div className="space-y-10">
            {/* عنوان السند الداخلي */}
            <div className="flex justify-between items-center no-print pb-4">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold rounded-xl">
                    <ArrowRight className="h-4 w-4"/> عودة
                </Button>
                <Button asChild variant="outline" className="gap-2 rounded-xl border-primary/20 text-primary">
                    <Link href={`/dashboard/accounting/cash-receipts/${receipt.id}/edit`}>
                        <Pencil className="h-4 w-4" /> تعديل البيانات
                    </Link>
                </Button>
            </div>

            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">سـنـد قـبـض نـقـدي</h2>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest font-mono">Official Receipt Voucher</p>
                </div>
                <div className="text-left">
                    <Badge variant="outline" className="h-10 px-6 rounded-2xl border-2 border-primary/20 bg-primary/5 text-primary font-mono font-black text-lg">
                        {receipt.voucherNumber}
                    </Badge>
                </div>
            </div>

            <main className="space-y-8 bg-slate-50/50 p-10 rounded-[2.5rem] border-2 border-slate-100">
                <InfoRow 
                    label="استلمنا من السيد/السادة" 
                    value={receipt.clientNameAr} 
                />
                
                <div className="grid grid-cols-2 gap-10">
                    <InfoRow 
                        label="تاريخ السند" 
                        value={apptDate ? format(apptDate, 'eeee, dd MMMM yyyy', { locale: ar }) : '-'} 
                    />
                    <InfoRow 
                        label="طريقة الدفع" 
                        value={<Badge className="bg-white border-2 text-primary font-black px-4 h-7 rounded-full">{receipt.paymentMethod}</Badge>} 
                    />
                </div>

                <div className="p-8 bg-white rounded-3xl border-2 border-primary/10 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                        <Label className="font-black text-xl text-primary flex items-center gap-2">
                            <Banknote className="h-6 w-6" /> المبلغ المستلم
                        </Label>
                        <span className="text-4xl font-black font-mono text-primary">{formatCurrency(receipt.amount)}</span>
                    </div>
                    <Separator className="bg-primary/5" />
                    <p className="text-center italic font-bold text-slate-600 text-lg">{receipt.amountInWords}</p>
                </div>

                <div className="space-y-3">
                    <Label className="font-black text-slate-500 text-xs flex items-center gap-2 uppercase tracking-widest">
                        <FileText className="h-3 w-3" /> وذلك عن / البيان:
                    </Label>
                    <div className="p-8 bg-white rounded-3xl border min-h-[140px] text-lg leading-loose font-medium text-slate-800 shadow-inner">
                        {receipt.description}
                    </div>
                </div>

                {receipt.projectNameAr && (
                    <div className="flex items-center gap-4 p-6 bg-primary/5 rounded-3xl border border-primary/10">
                        <div className="p-3 bg-white rounded-2xl shadow-sm"><Target className="h-6 w-6 text-primary" /></div>
                        <div>
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">ارتباط مركز الربحية (المشروع)</p>
                            <p className="font-black text-lg text-slate-900">{receipt.projectNameAr}</p>
                        </div>
                    </div>
                )}
            </main>

            <footer className="pt-24">
                <div className="grid grid-cols-2 gap-20 text-center">
                    <div className="space-y-20">
                        <p className="font-black text-lg border-b-2 border-slate-900 pb-2">توقيع المستلم</p>
                        <div className="h-1 bg-slate-100 rounded-full" />
                    </div>
                    <div className="space-y-20">
                        <p className="font-black text-lg border-b-2 border-slate-900 pb-2">اعتماد الإدارة المالية</p>
                        <div className="h-1 bg-slate-100 rounded-full" />
                    </div>
                </div>
            </footer>
        </div>
    </PrintLayout>
  );
}
