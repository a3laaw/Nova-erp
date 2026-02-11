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
import { PlusCircle, FileCheck, CheckCircle } from 'lucide-react';
import type { Vendor, RequestForQuotation, SupplierQuotation } from '@/lib/types';
import { SupplierQuotationForm } from './supplier-quotation-form';
import { formatCurrency } from '@/lib/utils';
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
    ? existingQuote.items.reduce((sum, item) => sum + (item.unitPrice * (rfq.items.find(i => i.id === item.rfqItemId)?.quantity || 0)), 0)
    : 0;

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>{vendor.name}</CardTitle>
          <CardDescription>{vendor.contactPerson || 'لا يوجد جهة اتصال'}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          {existingQuote ? (
            <div className="space-y-2 text-sm p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                <p className="font-semibold">تم استلام عرض السعر</p>
                <p className="text-xs text-muted-foreground">
                    المرجع: {existingQuote.quotationReference}
                </p>
            </div>
          ) : (
             <div className="text-center p-4 border-2 border-dashed rounded-lg">
                <p className="text-sm text-muted-foreground">لم يتم إدخال عرض السعر بعد.</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
            {existingQuote ? (
                 <Button variant="outline" className="w-full" onClick={() => setIsFormOpen(true)}>
                    عرض / تعديل عرض السعر
                </Button>
            ) : (
                <Button className="w-full" onClick={() => setIsFormOpen(true)}>
                    <PlusCircle className="ml-2 h-4 w-4" />
                    إضافة عرض سعر
                </Button>
            )}
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
