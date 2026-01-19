'use client';

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';
import { formatCurrency } from '@/lib/utils';
import { Printer, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
  plotNumber?: string;
}

interface ContractItem {
  id: number;
  description: string;
  amount: number;
}

const initialFinancialClauses: ContractItem[] = [
  { id: 1, description: 'الدفعة الأولى: عند توقيع العقد', amount: 300 },
  { id: 2, description: 'الدفعة الثانية: عند الانتهاء من الأرضي', amount: 150 },
  { id: 3, description: 'الدفعة الثالثة: عند الانتهاء من الدور الأول', amount: 150 },
  { id: 4, description: 'الدفعة الرابعة: عند الانتهاء من الدور الثاني', amount: 100 },
  { id: 5, description: 'الدفعة الخامسة: عند استلام رخصة البناء', amount: 100 },
];

export function ContractForm({ client }: { client: ClientData }) {
  const router = useRouter();
  const [financialClauses, setFinancialClauses] = useState<ContractItem[]>(initialFinancialClauses);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [contractDate, setContractDate] = useState('');
  const [contractNumber, setContractNumber] = useState('');

  useEffect(() => {
    // Set date and contract number on client to avoid hydration mismatch
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    setContractDate(`${day}/${month}/${year}`);
    setContractNumber(`CONTRACT-${year}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`);
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
    import('html2pdf.js').then(module => {
        const html2pdf = module.default;
        const element = document.getElementById('contract-content');
        const opt = {
          margin:       0.5,
          filename:     `BMEC_Contract_${client.nameAr}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    });
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
        <div className="print:hidden mb-6 flex justify-between items-center">
            <Button variant="outline" onClick={() => router.back()}>
                <ArrowRight className="ml-2 h-4 w-4" />
                العودة
            </Button>
            <Button onClick={handleExport}><Printer className="ml-2 h-4 w-4" /> تصدير PDF</Button>
        </div>

        <div id="contract-content" className="space-y-6">
            {/* Header */}
            <header className="flex justify-between items-center pb-4 border-b">
                <div className="flex items-center gap-4">
                    <Logo className="h-20 w-20 !p-3" />
                    <div>
                        <h1 className="text-xl font-bold">دار بليه المسفر للاستشارات الهندسية</h1>
                        <p className="text-sm text-gray-500">Dar Belaih Al-Mesfir Engineering Consultants</p>
                        <p className="text-xs text-gray-500 mt-2">الكويت - شرق - شارع عبدالعزيز حمد الصقر - الدور 23 - مركز الراية - مكتب رقم 2 - نقال 99389650</p>
                    </div>
                </div>
                <div className="text-left">
                     <h2 className="text-2xl font-bold text-gray-700">اتفاقية تصميم</h2>
                     <p className="font-mono text-sm mt-1">{contractDate}</p>
                     <p className="font-mono text-xs text-gray-500">{contractNumber}</p>
                </div>
            </header>

            {/* Parties */}
            <section>
                <h3 className="font-bold mb-2">البند الأول: أطراف الاتفاقية</h3>
                <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-lg">
                    <div>
                        <p className="font-semibold">الطرف الأول:</p>
                        <p>مكتب دار بليه المسفر للاستشارات الهندسية (BMEC)، ويمثله المهندس/ بليه علي المسفر.</p>
                    </div>
                     <div>
                        <p className="font-semibold">الطرف الثاني:</p>
                        <p>السيد/ {client.nameAr || '...'}</p>
                        <p>الرقم المدني: {client.civilId || '...'}</p>
                        <p>العنوان: {clientAddress}</p>
                    </div>
                </div>
            </section>

            {/* Specification Table */}
            <section>
                 <h3 className="font-bold mb-2">جدول التخصيص</h3>
                 <div className="border rounded-lg p-4 text-sm space-y-2">
                    <div className="flex justify-between"><span>اسم العميل:</span> <span className="font-semibold">{client.nameAr || 'محمد فهد العبدالوهاب'}</span></div>
                    <div className="flex justify-between"><span>رقم القسيمة:</span> <span className="font-semibold">{client.plotNumber || '483'}</span></div>
                    <div className="flex justify-between"><span>المنطقة:</span> <span className="font-semibold">{client.address?.area || 'قطعة 1 ض 1'}</span></div>
                 </div>
                 <div className="text-sm p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/50 mt-2">
                    <p className="font-bold mb-2">بنود الاتفاقية:</p>
                    <ol className="list-decimal list-inside space-y-1">
                        <li>المخطط المعماري (بدون سرداب)</li>
                        <li>توزيع فرش المعماري</li>
                        <li>المخطط الإنشائي</li>
                        <li>استخراج رخصة البناء من البلدية</li>
                        <li>رخصة الأشغال</li>
                        <li>فحص التربة</li>
                        <li>ترخيص إيصال التيار الكهربائي (ON LINE)</li>
                        <li>المخطط المساحي</li>
                    </ol>
                </div>
            </section>

            {/* Payment Milestones (Editable) */}
            <section>
                <h3 className="font-bold mb-2">الدفعات المالية</h3>
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
                        {financialClauses.map((clause) => (
                            <tr key={clause.id} className="border-t">
                                <td className="p-2">{clause.id}</td>
                                <td className="p-2">{clause.description}</td>
                                <td className="p-2 text-left font-mono">
                                    <Input
                                        type="number"
                                        value={clause.amount}
                                        onChange={(e) => handleAmountChange(clause.id, e.target.value)}
                                        className="text-left print:hidden h-8"
                                    />
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
                                className="col-span-2 h-8"
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
            
            {/* Financial Conditions (Static) */}
            <section>
                <h3 className="font-bold mb-2">البنود المالية والشروط</h3>
                <div className="text-xs p-4 border rounded-lg space-y-2 bg-gray-50">
                   <p>1. في حال طلب تعديلات معمارية بعد اعتماد المخطط المعماري والبدء بوضع الأعمدة، يتم دفع مبلغ مبلّغًا وقدره (100 د.ك).</p>
                   <p>2. بعد اعتماد المالك (المخطط المعماري) واعتماده مخطط (وضع الأعمدة) وانتقال المعاملة لمرحلة (المخطط الإنشائي)، فإن أي تعديل في المرحلتين يتطلب دفع مبلغ مبلّغًا وقدره (200 د.ك).</p>
                   <p>3. في حال طلب فسخ العقد يتم استحقاق الطرف الأول ما تبقى له من دفعات عند دفعات الطَّرف الثاني ولا يتم استرجاع أي مبلغ من الدفعات السابقة.</p>
                   <p>4. بعد اعتماد المالك للمخططات ورسم المعاملة وإرسالها للبلدية وصدور الرخصة فإن أي تعديل يجب إعادة إعداده من جديد ويُلزم المالك بدفع مبلغ قدره (380 د.ك).</p>
                   <p>5. عند قيام المالك بإيقاف أو تجميد أعمال المهندس بعد مباشرة أي مباشرة، يحق للمهندس أن يتقاضى كامل بدل الاتعاب عن الأعمال التي أنجزها تنفيذًا للعقد.</p>
                   <p>6. مدة العقد سنتان من تاريخ توقيع العقد وفي حالة انتهاء المدة ولم يتم الانتهاء من التصميم لأي سبب كان يتم إضافة 40% من قيمة العقد الأصلي.</p>
                   <p>7. حرر هذا العقد للعمل عند اللزوم.</p>
                </div>
            </section>
            
            {/* Signatures */}
            <section className="pt-12">
                 <div className="grid grid-cols-2 gap-8 text-center text-sm">
                    <div>
                        <p className="font-bold">الطرف الأول (المهندس)</p>
                        <p>م. بليه علي المسفر</p>
                        <div className="mt-12 border-t pt-2">التوقيع</div>
                    </div>
                     <div>
                        <p className="font-bold">الطرف الثاني (المالك)</p>
                        <p>{client.nameAr || '...'}</p>
                        <div className="mt-12 border-t pt-2">التوقيع</div>
                    </div>
                </div>
                <div className="mt-8 text-center">
                    <p className="font-bold text-lg">ختم الشركة</p>
                </div>
            </section>
        </div>
        <style jsx global>{`
            @media print {
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            }
        `}</style>
    </div>
  );
}
