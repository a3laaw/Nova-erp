'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '../ui/button';
import { PlusCircle, CheckCircle, FileText, ExternalLink, Calendar } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation } from '@/lib/types';
import { SupplierQuotationForm } from './supplier-quotation-form';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';

interface SupplierQuotationCardProps {
  rfq: RequestForQuotation;
  vendor: Vendor;
  existingQuote?: SupplierQuotation;
}

export function SupplierQuotationCard({ rfq, vendor, existingQuote }: SupplierQuotationCardProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const quoteTotal = existingQuote
    ? existingQuote.items.reduce((sum, item) => {
        const rfqQty = rfq.items.find(i => i.id === item.rfqItemId)?.quantity || 0;
        return sum + (item.unitPrice * rfqQty);
    }, 0)
    : 0;

  return (
    <>
      <Card className={cn(
          "flex flex-col rounded-3xl transition-all duration-300 border-2 overflow-hidden group",
          existingQuote ? "border-green-500/20 bg-green-50/10 shadow-lg" : "border-muted hover:border-primary/30"
      )}>
        <CardHeader className={cn(
            "pb-4 border-b",
            existingQuote ? "bg-green-500/5" : "bg-muted/30"
        )}>
          <div className="flex justify-between items-start">
              <div className="p-2 bg-background rounded-xl border shadow-sm group-hover:scale-110 transition-transform">
                  <FileText className={cn("h-6 w-6", existingQuote ? "text-green-600" : "text-primary")} />
              </div>
              {existingQuote && <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle className="h-3 w-3"/> عرض مستلم</div>}
          </div>
          <CardTitle className="mt-4 text-xl font-black">{vendor.name}</CardTitle>
          <CardDescription className="flex items-center gap-2">
              {vendor.contactPerson || 'لا توجد بيانات اتصال'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow pt-6 space-y-4">
          {existingQuote ? (
            <div className="space-y-4">
                <div className="flex justify-between items-end border-b pb-3 border-dashed border-green-500/20">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">إجمالي قيمة العرض</span>
                    <span className="text-2xl font-black text-green-700 font-mono">{formatCurrency(quoteTotal)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">التاريخ:</span>
                        <span className="font-bold">{format(toFirestoreDate(existingQuote.date)!, 'dd/MM/yyyy')}</span>
                    </div>
                    {existingQuote.deliveryTimeDays && (
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">التوريد:</span>
                            <span className="font-bold">{existingQuote.deliveryTimeDays} يوم</span>
                        </div>
                    )}
                </div>
            </div>
          ) : (
             <div className="h-32 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed rounded-2xl bg-muted/5 opacity-60">
                <p className="text-xs font-bold text-muted-foreground">بانتظار تسعير المورد...</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="p-6 bg-muted/10">
            <Button 
                variant={existingQuote ? "secondary" : "default"} 
                className="w-full h-11 rounded-xl font-bold gap-2 shadow-md transition-all active:scale-95" 
                onClick={() => setIsFormOpen(true)}
            >
                {existingQuote ? (
                    <>
                        <Pencil className="h-4 w-4" />
                        تعديل بيانات العرض
                    </>
                ) : (
                    <>
                        <PlusCircle className="h-4 w-4" />
                        إضافة عرض السعر
                    </>
                )}
            </Button>
        </CardFooter>
      </Card>

      <SupplierQuotationForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        rfq={rfq}
        vendor={vendor}
        existingQuote={existingQuote}
      />
    </>
  );
}
