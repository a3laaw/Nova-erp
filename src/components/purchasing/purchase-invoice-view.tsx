
'use client';

import { useMemo } from 'react';
import { useBranding } from '@/context/branding-context';
import { PrintableDocument } from '../layout/printable-document';
import { Logo } from '../layout/logo';
import { formatCurrency, numberToArabicWords } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

interface PurchaseInvoiceViewProps {
  grn: any;
  vendor: any;
}

export function PurchaseInvoiceView({ grn, vendor }: PurchaseInvoiceViewProps) {
    const { branding } = useBranding();
    
    const grnDate = toFirestoreDate(grn.date);
    const totalAmount = grn.totalValue || 0;
    const itemsSubtotal = grn.itemsReceived?.reduce((sum: number, i: any) => sum + (i.quantityReceived * i.unitPrice), 0) || 0;

    return (
        <PrintableDocument>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex justify-between items-start border-b-4 border-blue-600 pb-6">
                    <div className="flex items-center gap-4">
                        <Logo className="h-20 w-20 !p-2 border bg-white" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <div>
                            <h1 className="text-2xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                            <p className="text-xs text-muted-foreground mt-1">قسم المشتريات والمخازن</p>
                            <p className="text-[10px] text-muted-foreground">{branding?.address}</p>
                        </div>
                    </div>
                    <div className="text-left space-y-1">
                        <h2 className="text-3xl font-black text-blue-700 tracking-tighter">فاتورة مشتريات</h2>
                        <p className="text-lg font-bold text-gray-400 tracking-widest font-mono">PURCHASE INVOICE</p>
                        <div className="pt-2">
                            <p className="font-mono text-xl font-black bg-muted px-3 py-1 rounded-lg inline-block border">
                                {grn.grnNumber}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Info Bar */}
                <div className="grid grid-cols-2 gap-8 p-6 bg-blue-50/20 rounded-2xl border border-blue-100">
                    <div className="space-y-3">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">المورد / Supplier:</p>
                            <p className="text-xl font-black text-blue-800">{vendor?.name || grn.vendorName}</p>
                        </div>
                        <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">رقم الهاتف:</span> <span className="font-bold" dir="ltr">{vendor?.phone || '-'}</span></p>
                            <p><span className="text-muted-foreground">جهة الاتصال:</span> <span className="font-bold">{vendor?.contactPerson || '-'}</span></p>
                        </div>
                    </div>
                    <div className="space-y-3 text-left">
                        <div className="flex justify-between items-baseline border-b border-dashed pb-2">
                            <span className="text-xs font-bold text-muted-foreground">تاريخ الاستحقاق (الاستلام):</span>
                            <span className="font-bold">{grnDate ? format(grnDate, 'dd/MM/yyyy', { locale: ar }) : '-'}</span>
                        </div>
                        <div className="flex justify-between items-baseline border-b border-dashed pb-2">
                            <span className="text-xs font-bold text-muted-foreground">مرجع طلب الشراء:</span>
                            <span className="font-mono font-bold text-blue-600">{grn.purchaseOrderId?.substring(0,8)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs font-bold text-muted-foreground">حالة القيد المالي:</span>
                            <Badge className="bg-green-600 font-bold px-3">مرحّل للحسابات</Badge>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/80">
                            <TableRow className="h-12 border-b-2">
                                <TableHead className="w-12 text-center font-bold">م</TableHead>
                                <TableHead className="font-bold text-foreground text-right px-4">بيان الأصناف الموردة</TableHead>
                                <TableHead className="w-24 text-center font-bold text-foreground">الكمية</TableHead>
                                <TableHead className="w-32 text-center font-bold text-foreground">سعر الوحدة</TableHead>
                                <TableHead className="w-40 text-left font-bold text-foreground px-8">الإجمالي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {grn.itemsReceived?.map((item: any, idx: number) => (
                                <TableRow key={idx} className="h-14 border-b last:border-0 hover:bg-transparent">
                                    <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground bg-muted/5 border-l">{idx + 1}</TableCell>
                                    <TableCell className="px-4 font-bold">{item.itemName}</TableCell>
                                    <TableCell className="text-center font-mono font-black text-lg">{item.quantityReceived}</TableCell>
                                    <TableCell className="text-center font-mono font-bold text-primary">{formatCurrency(item.unitPrice)}</TableCell>
                                    <TableCell className="text-left font-mono font-black text-lg px-8 bg-blue-50/10 border-r">
                                        {formatCurrency(item.quantityReceived * item.unitPrice)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Summary Calculations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                    <div className="space-y-4">
                        <div className="p-4 bg-muted/10 rounded-2xl border border-dashed text-center h-full flex flex-col justify-center">
                            <p className="text-xs text-muted-foreground mb-1 uppercase font-bold tracking-widest">المبلغ الإجمالي كتابةً</p>
                            <p className="text-sm font-bold text-blue-800 leading-relaxed">{numberToArabicWords(totalAmount)}</p>
                        </div>
                    </div>
                    
                    <div className="bg-muted/30 rounded-2xl p-6 space-y-3 border">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground font-bold">إجمالي البنود:</span>
                            <span className="font-mono font-bold">{formatCurrency(itemsSubtotal)}</span>
                        </div>
                        {grn.discountAmount > 0 && (
                            <div className="flex justify-between items-center text-sm text-green-700">
                                <span className="font-bold">الخصم المكتسب (-):</span>
                                <span className="font-mono font-bold">({formatCurrency(grn.discountAmount)})</span>
                            </div>
                        )}
                        {grn.deliveryFees > 0 && (
                            <div className="flex justify-between items-center text-sm text-red-700">
                                <span className="font-bold">رسوم التوصيل (+):</span>
                                <span className="font-mono font-bold">{formatCurrency(grn.deliveryFees)}</span>
                            </div>
                        )}
                        <Separator className="bg-gray-300 h-0.5" />
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-xl font-black text-blue-900">الصافي النهائي:</span>
                            <span className="text-3xl font-black text-blue-700 font-mono">{formatCurrency(totalAmount)}</span>
                        </div>
                    </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-3 gap-8 mt-24 text-center text-[10px] uppercase font-bold text-muted-foreground">
                    <div className="space-y-16">
                        <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">أمين المستودع</p>
                        <div className="pt-2 border-t border-dashed">توقيع الاستلام</div>
                    </div>
                    <div className="space-y-16">
                        <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">الإدارة المالية</p>
                        <div className="pt-2 border-t border-dashed">المراجعة والترحيل</div>
                    </div>
                    <div className="space-y-16">
                        <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">اعتماد المشتريات</p>
                        <div className="pt-2 border-t border-dashed">الموافقة النهائية</div>
                    </div>
                </div>

                <footer className="pt-12 text-center text-[9px] text-muted-foreground border-t opacity-60 italic">
                    تم إنشاء هذه الفاتورة آلياً بناءً على إذن استلام المواد المعتمد في نظام Nova ERP.
                </footer>
            </div>
        </PrintableDocument>
    );
}
