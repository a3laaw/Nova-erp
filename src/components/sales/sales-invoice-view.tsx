
'use client';

import { useMemo } from 'react';
import { useBranding } from '@/context/branding-context';
import { PrintableDocument } from '../layout/printable-document';
import { Logo } from '../layout/logo';
import { formatCurrency, numberToArabicWords, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '../ui/badge';

interface SalesInvoiceViewProps {
  invoice: any; // materialIssue/adjustment of type sales_delivery
  client: any;
}

export function SalesInvoiceView({ invoice, client }: SalesInvoiceViewProps) {
    const { branding } = useBranding();
    
    const invoiceDate = toFirestoreDate(invoice.date);
    const totalAmount = useMemo(() => 
        invoice.items?.reduce((sum: number, item: any) => sum + (item.total || 0), 0) || 0
    , [invoice.items]);

    const clientAddress = client?.address ? [
        client.address.governorate, 
        client.address.area, 
        client.address.block ? `قطعة ${client.address.block}` : '',
        client.address.street ? `شارع ${client.address.street}` : '',
        client.address.houseNumber ? `قسيمة ${client.address.houseNumber}` : ''
    ].filter(Boolean).join(' - ') : 'غير محدد';

    return (
        <PrintableDocument>
            <div className="space-y-8">
                {/* Header Section */}
                <div className="flex justify-between items-start border-b-4 border-primary pb-6">
                    <div className="flex items-center gap-4">
                        <Logo className="h-20 w-20 !p-2 border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <div>
                            <h1 className="text-2xl font-black text-foreground">{branding?.company_name || 'Nova ERP'}</h1>
                            <p className="text-xs text-muted-foreground mt-1 max-w-xs">{branding?.address}</p>
                            <p className="text-xs text-muted-foreground">هاتف: {branding?.phone}</p>
                        </div>
                    </div>
                    <div className="text-left space-y-1">
                        <h2 className="text-4xl font-black text-primary tracking-tighter">فاتورة مبيعات</h2>
                        <p className="text-lg font-bold text-muted-foreground tracking-widest font-mono">SALES INVOICE</p>
                        <div className="pt-4">
                            <p className="font-mono text-xl font-black bg-muted px-3 py-1 rounded-lg inline-block border">
                                {invoice.adjustmentNumber?.replace('MI', 'INV') || 'INV-TEMP'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Info Bar */}
                <div className="grid grid-cols-2 gap-8 p-6 bg-muted/20 rounded-2xl border">
                    <div className="space-y-3">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">فاتورة لـ / Bill To:</p>
                            <p className="text-xl font-black text-primary">{client?.nameAr || invoice.clientName || 'عميل نقدي'}</p>
                        </div>
                        <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">الهاتف:</span> <span className="font-bold">{client?.mobile || '-'}</span></p>
                            <p><span className="text-muted-foreground">العنوان:</span> <span className="font-medium text-xs">{clientAddress}</span></p>
                        </div>
                    </div>
                    <div className="space-y-3 text-left">
                        <div className="flex justify-between items-baseline border-b border-dashed pb-2">
                            <span className="text-xs font-bold text-muted-foreground">تاريخ الفاتورة:</span>
                            <span className="font-bold">{invoiceDate ? format(invoiceDate, 'dd/MM/yyyy', { locale: ar }) : '-'}</span>
                        </div>
                        <div className="flex justify-between items-baseline border-b border-dashed pb-2">
                            <span className="text-xs font-bold text-muted-foreground">رقم مرجع التسليم:</span>
                            <span className="font-mono font-bold">{invoice.adjustmentNumber}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs font-bold text-muted-foreground">طريقة الدفع:</span>
                            <Badge variant="outline" className="font-bold">آجل / على الحساب</Badge>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="border-2 rounded-3xl overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/80">
                            <TableRow className="h-12 border-b-2">
                                <TableHead className="w-12 text-center font-bold">#</TableHead>
                                <TableHead className="font-bold text-foreground">بيان المواد / الخدمات</TableHead>
                                <TableHead className="w-24 text-center font-bold text-foreground">الكمية</TableHead>
                                <TableHead className="w-32 text-center font-bold text-foreground">سعر الوحدة</TableHead>
                                <TableHead className="w-40 text-left font-bold text-foreground px-8">الإجمالي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoice.items?.map((item: any, idx: number) => (
                                <TableRow key={idx} className="h-14 border-b last:border-0 hover:bg-transparent">
                                    <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground bg-muted/5 border-l">{idx + 1}</TableCell>
                                    <TableCell className="px-4 font-bold">{item.itemName}</TableCell>
                                    <TableCell className="text-center font-mono font-bold text-lg">{item.quantity}</TableCell>
                                    <TableCell className="text-center font-mono font-bold text-primary">{formatCurrency(item.unitCost * 1.2)}</TableCell> {/* مثال: إضافة هامش ربح للعرض فقط */}
                                    <TableCell className="text-left font-mono font-black text-lg px-8 bg-primary/[0.02] border-r">
                                        {formatCurrency(item.total * 1.2)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter className="bg-primary/5">
                            <TableRow className="h-20 border-t-4 border-primary/20">
                                <TableCell colSpan={4} className="text-right px-12 font-black text-xl">صافي مبلغ الفاتورة:</TableCell>
                                <TableCell className="text-left font-mono text-3xl font-black text-primary px-8 border-r bg-primary/5">
                                    {formatCurrency(totalAmount * 1.2)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>

                {/* Tafqeet */}
                <div className="p-4 bg-muted/10 rounded-xl border border-dashed text-center">
                    <p className="text-sm font-bold text-primary">{numberToArabicWords(totalAmount * 1.2)}</p>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-20 mt-24 text-center text-xs">
                    <div className="space-y-12">
                        <p className="font-black border-b-2 border-foreground pb-2">توقيع المستلم (العميل)</p>
                        <div className="pt-2 text-muted-foreground">أقر باستلام المواد المذكورة أعلاه بحالة جيدة</div>
                    </div>
                    <div className="space-y-12">
                        <p className="font-black border-b-2 border-foreground pb-2">ختم المعرض / الشركة</p>
                        <div className="pt-2 text-muted-foreground">قسم المبيعات والتجارة</div>
                    </div>
                </div>

                <footer className="pt-12 text-center text-[10px] text-muted-foreground border-t">
                    <p>شكراً لتعاملكم معنا. يرجى الاحتفاظ بهذه الفاتورة لأغراض الكفالة أو المراجعة.</p>
                </footer>
            </div>
        </PrintableDocument>
    );
}
