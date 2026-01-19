
'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { clients } from '@/lib/data';
import { Printer, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/language-context';

export default function NewCashReceiptPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const [date, setDate] = useState('');

  useEffect(() => {
    // Set date on client to avoid hydration mismatch
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>سـنـد قـبـض / Cash Receipt Voucher</CardTitle>
                <CardDescription>CRV-2024-002 : رقم السند</CardDescription>
            </div>
            <div className='text-left'>
                <p className='font-semibold'>Dar Belaih Al-Mesfir Engineering Consultants</p>
                <p className='text-sm text-muted-foreground'>Kuwait City, Kuwait</p>
                <p className='text-sm text-muted-foreground'>CR: 123456</p>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="md:col-span-2 grid gap-2">
              <Label htmlFor="receivedFrom">استلمنا من السيد/السادة</Label>
              <Select dir='rtl'>
                <SelectTrigger id="receivedFrom">
                    <SelectValue placeholder="اختر العميل..." />
                </SelectTrigger>
                <SelectContent>
                    {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>{client.name[language]}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="date">التاريخ</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="grid gap-2">
                <Label htmlFor="amount">المبلغ</Label>
                <Input id="amount" type="number" placeholder="0.00" className='text-left dir-ltr' />
            </div>
            <div className="md:col-span-2 grid gap-2">
              <Label htmlFor="amountInWords">مبلغ وقدره</Label>
              <Input id="amountInWords" placeholder="المبلغ كتابة..." />
            </div>
        </div>
        <div className="grid gap-2">
            <Label htmlFor="description">وذلك عن</Label>
            <Textarea id="description" placeholder="وصف عملية الدفع..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="grid gap-2">
                <Label htmlFor="paymentMethod">طريقة الدفع</Label>
                 <Select dir='rtl'>
                    <SelectTrigger id="paymentMethod">
                        <SelectValue placeholder="اختر طريقة الدفع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Cash">نقداً</SelectItem>
                        <SelectItem value="Cheque">شيك</SelectItem>
                        <SelectItem value="Bank Transfer">تحويل بنكي</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reference">رقم الشيك/المرجع</Label>
              <Input id="reference" placeholder="رقم المرجع..." />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-20 pt-16">
            <div className="text-center">
                <div className="border-t pt-2">
                    <p className="font-semibold">المستلم</p>
                    <p className="text-sm text-muted-foreground">Receiver's Signature</p>
                </div>
            </div>
            <div className="text-center">
                <div className="border-t pt-2">
                    <p className="font-semibold">المحاسب</p>
                     <p className="text-sm text-muted-foreground">Accountant's Signature</p>
                </div>
            </div>
        </div>
        
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push('/dashboard/accounting')}>
            <X className="ml-2 h-4 w-4" />
            إلغاء
        </Button>
        <Button variant="outline">
            <Printer className="ml-2 h-4 w-4" />
            طباعة
        </Button>
        <Button>
            <Save className="ml-2 h-4 w-4" />
            حفظ
        </Button>
      </CardFooter>
    </Card>
  );
}
