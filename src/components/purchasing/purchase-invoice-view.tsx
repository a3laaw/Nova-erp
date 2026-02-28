
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

interface PurchaseInvoiceViewProps {
  grn: any;
  vendor: any;
}

export function PurchaseInvoiceView({ grn, vendor }: PurchaseInvoiceViewProps) {
    const { branding } = useBranding();
    
    const grnDate = toFirestoreDate(grn.date);
    const totalAmount = grn.totalValue || 0;

    return (
        <PrintableDocument>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex justify-between items-start border-b-4 border-blue-600 pb-6">
                    <div className="flex items-center gap-4">
                        <Logo className="h-20 w-20 !p-2 border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <div>
                            <h1 className="text-2xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                            <p className="text-xs text-muted-foreground mt-1">قسم المشتريات والمخازن</p>
                        </div>
                    </div>
                    <div className="text-left space-y-1">
                        <h2 className="text-3xl font-black text-blue-700 tracking-tighter">فاتورة مشتريات (استلام)</h2>
                        <p className="text-lg font-bold text-gray-400 tracking-widest font-mono">PURCHASE INVOICE</p>
                        <p className="font-mono text-xl font-black bg-muted px-3 py-1 rounded-lg inline-block border mt-2">
                            {grn.grnNumber}
                        </p>
                    </div>
                </div>

                {/* Vendor Info */}
                <div className="grid grid-cols-2 gap-8 p-6 bg-blue-50/20 rounded-2xl border border-blue-100">
                    <div className="space-y-3">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">المورد / Supplier:</p>
                            <p className="text-xl font-black text-blue-800">{vendor?.name || grn.vendorName}</p>
                        </div>
                        <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">الشخص المسؤول:</span> <span className="font-bold">{vendor?.contactPerson || '-'}</span></p>
                            <p><span className="text-muted-foreground">رقم الهاتف:</span> <span className="font-bold">{vendor?.phone || '-'}</span></p>
                        </div>
                    </div>
                    <div className="space-y-3 text-left">
                        <div className="flex justify-between items-baseline border-b border-dashed pb-2">
                            <span className="text-xs font-bold text-muted-foreground">تاريخ الاستلام:</span>
                            <span className="font-bold">{grnDate ? format(grnDate, 'dd/MM/yyyy', { locale: ar }) : '-'}</span>
                        </div>
                        <div className="flex justify-between items-baseline border-b border-dashed pb-2">
                            <span className="text-xs font-bold text-muted-foreground">رقم أمر الشراء:</span>
                            <span className="font-mono font-bold text-blue-600">{grn.purchaseOrderId?.substring(0,8)}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs font-bold text-muted-foreground">حالة القيد:</span>
                            <Badge className="bg-green-600">مرحّل للحسابات</Badge>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="border-2 rounded-[2rem] overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/80">
                            <TableRow className="h-12 border-b-2">
                                <TableHead className="w-12 text-center font-bold">م</TableHead>
                                <TableHead className="font-bold text-foreground">بيان الأصناف المستلمة</TableHead>
                                <TableHead className="w-24 text-center font-bold text-foreground">الكمية</TableHead>
                                <TableHead className="w-32 text-center font-bold text-foreground">سعر الشراء</TableHead>
                                <TableHead className="w-40 text-left font-bold text-foreground px-8">الإجمالي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {grn.itemsReceived?.map((item: any, idx: number) => (
                                <TableRow key={idx} className="h-14 border-b last:border-0 hover:bg-transparent">
                                    <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground bg-muted/5 border-l">{idx + 1}</TableCell>
                                    <TableCell className="px-4 font-bold">{item.itemName}</TableCell>
                                    <TableCell className="text-center font-mono font-bold text-lg">{item.quantityReceived}</TableCell>
                                    <TableCell className="text-center font-mono font-bold">{formatCurrency(item.unitPrice)}</TableCell>
                                    <TableCell className="text-left font-mono font-black text-lg px-8 bg-blue-50/30 border-r">
                                        {formatCurrency(item.quantityReceived * item.unitPrice)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter className="bg-blue-600/5">
                            <TableRow className="h-20 border-t-4 border-blue-600/20">
                                <TableCell colSpan={4} className="text-right px-12 font-black text-2xl">إجمالي مديونية المورد:</TableCell>
                                <TableCell className="text-left font-mono text-3xl font-black text-blue-700 px-8 border-r bg-blue-600/5">
                                    {formatCurrency(totalAmount)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>

                <div className="p-4 bg-muted/10 rounded-xl border border-dashed text-center">
                    <p className="text-sm font-bold text-blue-800">{numberToArabicWords(totalAmount)}</p>
                </div>

                <div className="grid grid-cols-3 gap-8 mt-24 text-center text-xs">
                    <div className="space-y-16">
                        <p className="font-black border-b-2 border-foreground pb-2">أمين المخزن المستلم</p>
                        <div className="pt-2 text-muted-foreground">التوقيع والتاريخ</div>
                    </div>
                    <div className="space-y-16">
                        <p className="font-black border-b-2 border-foreground pb-2">الإدارة المالية</p>
                        <div className="pt-2 text-muted-foreground">المراجعة والترحيل</div>
                    </div>
                    <div className="space-y-16">
                        <p className="font-black border-b-2 border-foreground pb-2">اعتماد المشتريات</p>
                        <div className="pt-2 text-muted-foreground">الموافقة النهائية</div>
                    </div>
                </div>
            </div>
        </PrintableDocument>
    );
}
