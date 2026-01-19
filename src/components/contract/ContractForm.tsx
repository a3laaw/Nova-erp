'use client';

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';
import { formatCurrency } from '@/lib/utils';
import html2pdf from 'html2pdf.js';
import { Printer } from 'lucide-react';

interface ClientData {
  nameAr?: string;
  civilId?: string;
  address?: {
    governorate: string;
    area: string;
    block: string;
    street: string;
    houseNumber: string;
  };
}

interface ContractItem {
  id: number;
  description: string;
  amount: number;
}

const initialFinancialClauses: ContractItem[] = [
  { id: 1, description: 'عند توقيع العقد', amount: 800 },
  { id: 2, description: 'عند الانتهاء من المخططات التنفيذية', amount: 700 },
  { id: 3, description: 'عند الانتهاء من اعمال التشطيبات بالكامل', amount: 500 },
];

export function ContractForm({ client }: { client: ClientData }) {
  const [financialClauses, setFinancialClauses] = useState<ContractItem[]>(initialFinancialClauses);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [contractDate, setContractDate] = useState('');

  useEffect(() => {
    // Set date on client to avoid hydration mismatch
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    setContractDate(`${day}/${month}/${year}`);
  }, []);

  const handleAmountChange = (id: number, value: string) => {
    const newAmount = Number(value);
    if (!isNaN(newAmount)) {
      setFinancialClauses(clauses =>
        clauses.map(clause =>
          clause.id === id ? { ...clause, amount: newAmount } : clause
        )
      );
    }
  };

  const totalAmount = useMemo(() => {
    return financialClauses.reduce((sum, clause) => sum + clause.amount, 0);
  }, [financialClauses]);
  
  const handleExport = () => {
    const element = document.getElementById('contract-content');
    const opt = {
      margin:       0.5,
      filename:     `BMEC_Contract_${client.nameAr}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(element).set(opt).save();
  };

  const clientAddress = client.address ? [
    client.address.governorate, 
    client.address.area, 
    `قطعة ${client.address.block}`, 
    `شارع ${client.address.street}`, 
    `منزل ${client.address.houseNumber}`
  ].filter(Boolean).join('، ') : 'غير محدد';


  return (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-4xl mx-auto" dir="rtl">
        {/* Toolbar - hidden in print */}
        <div className="print:hidden mb-6 flex justify-between items-center">
            <h2 className="text-xl font-bold">نموذج العقد الإلكتروني</h2>
            <Button onClick={handleExport}><Printer className="ml-2 h-4 w-4" /> تصدير PDF</Button>
        </div>

        {/* Content to be exported */}
        <div id="contract-content" className="space-y-8">
            <header className="flex justify-between items-center pb-4 border-b">
                <div className="flex items-center gap-4">
                    <Logo className="h-20 w-20 !p-3" />
                    <div>
                        <h1 className="text-xl font-bold">دار بليه المسفر للاستشارات الهندسية</h1>
                        <p className="text-sm text-gray-500">Baleeh Al-Musfir Engineering Consultants (BMEC)</p>
                        <p className="text-xs text-gray-500 mt-2">السالمية، قطعة 4، شارع 4، مبنى 4</p>
                    </div>
                </div>
                <div className="text-left">
                     <h2 className="text-2xl font-bold text-gray-700">اتفاقية تصميم</h2>
                     <p className="font-mono mt-1">{contractDate}</p>
                </div>
            </header>

            <section>
                <h3 className="font-bold mb-2">أطراف الاتفاقية</h3>
                <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-lg">
                    <div>
                        <p className="font-semibold">الطرف الأول:</p>
                        <p>دار بليه المسفر للاستشارات الهندسية (BMEC)، ويمثلها المهندس/ بليه علي المسفر.</p>
                    </div>
                     <div>
                        <p className="font-semibold">الطرف الثاني:</p>
                        <p>السيد/ {client.nameAr}</p>
                        <p>الرقم المدني: {client.civilId}</p>
                        <p>العنوان: {clientAddress}</p>
                    </div>
                </div>
            </section>

            <section>
                <h3 className="font-bold mb-2">موضوع الاتفاقية</h3>
                 <div className="text-sm p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <p>اتفق الطرفان على أن يقوم الطرف الأول بعمل التصاميم الهندسية والإشراف على التشطيبات لمشروع الطرف الثاني، وذلك وفق البنود التالية:</p>
                    <ul className="list-disc pr-6 mt-2 space-y-1">
                        <li>عمل تصميم كامل للواجهات الخارجية 3D.</li>
                        <li>عمل تصميم داخلي 3D لـ (صالة العائلة - صالة استقبال - غرفة نوم رئيسية).</li>
                        <li>عمل المخططات التنفيذية اللازمة للتصميم.</li>
                        <li>الإشراف على مراحل التشطيبات واختيار المواد.</li>
                        <li>مدة التصميم شهرين من تاريخ توقيع العقد.</li>
                        <li>مدة الإشراف 8 أشهر من بداية التشطيبات.</li>
                    </ul>
                </div>
            </section>

             <section>
                <h3 className="font-bold mb-2">البنود المالية</h3>
                <div className="border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="p-2 text-right font-semibold">#</th>
                                <th className="p-2 text-right font-semibold">البند</th>
                                <th className="p-2 text-left font-semibold">المبلغ (د.ك)</th>
                            </tr>
                        </thead>
                        <tbody>
                        {financialClauses.map((clause, index) => (
                            <tr key={clause.id} className="border-t">
                                <td className="p-2">{clause.id}</td>
                                <td className="p-2">{clause.description}</td>
                                <td className="p-2 text-left font-mono">
                                    {/* Editable input for form view */}
                                    <Input
                                        type="number"
                                        value={clause.amount}
                                        onChange={(e) => handleAmountChange(clause.id, e.target.value)}
                                        className="text-left print:hidden"
                                    />
                                    {/* Static text for PDF view */}
                                    <span className="hidden print:inline">{formatCurrency(clause.amount)}</span>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 font-bold bg-gray-50 dark:bg-gray-700/50">
                                <td colSpan={2} className="p-2 text-right">الإجمالي</td>
                                <td className="p-2 text-left font-mono">{formatCurrency(totalAmount)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="mt-4 space-y-2 print:hidden">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="has-discount" checked={hasDiscount} onCheckedChange={(checked) => setHasDiscount(checked as boolean)} />
                        <Label htmlFor="has-discount">هل هناك خصم على العقد؟</Label>
                    </div>
                    {hasDiscount && (
                        <div className="grid grid-cols-3 gap-4 items-center">
                            <Label htmlFor="discount-amount" className="text-right">قيمة الخصم (د.ك)</Label>
                             <Input
                                id="discount-amount"
                                type="number"
                                value={discountAmount}
                                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                                className="col-span-2"
                            />
                        </div>
                    )}
                </div>
                 {hasDiscount && discountAmount > 0 && (
                     <div className="mt-4 text-sm p-2 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-md">
                        <strong>ملاحظة: </strong>
                        يوجد خصم خاص بقيمة {formatCurrency(discountAmount)} على هذا العقد. الإجمالي لا يشمل الخصم.
                    </div>
                 )}
            </section>
            
            <section className="pt-16">
                 <div className="grid grid-cols-2 gap-8 text-center text-sm">
                    <div>
                        <p className="font-bold">الطرف الأول</p>
                        <p>دار بليه المسفر للاستشارات الهندسية</p>
                        <p className="mt-12 border-t pt-2">التوقيع</p>
                    </div>
                     <div>
                        <p className="font-bold">الطرف الثاني</p>
                        <p>{client.nameAr}</p>
                        <p className="mt-12 border-t pt-2">التوقيع</p>
                    </div>
                </div>
            </section>
        </div>

        {/* This style block hides UI elements during printing */}
        <style jsx global>{`
            @media print {
                .print\\:hidden {
                    display: none;
                }
                .print\\:inline {
                    display: inline;
                }
                 body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            }
        `}</style>
    </div>
  );
}
