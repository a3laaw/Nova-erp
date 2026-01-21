'use client';

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';
import { formatCurrency } from '@/lib/utils';
import { Printer, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Client, ClientTransaction, ContractClause } from '@/lib/types';
import { contractTemplates } from '@/lib/contract-templates';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

interface TransactionContractProps {
  client: Client;
  transaction: ClientTransaction;
}

export function TransactionContract({ client, transaction }: TransactionContractProps) {
    const router = useRouter();
    const [contractDate, setContractDate] = useState('');
    const [contractNumber, setContractNumber] = useState('');
    const [hasDiscount, setHasDiscount] = useState(false);
    const [discountAmount, setDiscountAmount] = useState(0);
    
    const template = useMemo(() => contractTemplates.find(t => t.transactionTypes.includes(transaction.transactionType)), [transaction.transactionType]);
    
    const initialClauses = useMemo(() => {
        if (transaction.contract?.clauses && transaction.contract.clauses.length > 0) {
            return JSON.parse(JSON.stringify(transaction.contract.clauses));
        }
        if (template) {
            return JSON.parse(JSON.stringify(template.clauses));
        }
        return [];
    }, [transaction, template]);

    const [clauses, setClauses] = useState<ContractClause[]>(initialClauses);
    
    useEffect(() => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        setContractDate(`${day}/${month}/${year}`);
        setContractNumber(`TX-CONTRACT-${year}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`);
    }, []);

    const totalAmount = useMemo(() => {
        return clauses.reduce((sum, clause) => sum + clause.amount, 0);
    }, [clauses]);
    
    const handleExport = () => {
        // Dynamic import to ensure it runs only on the client
        import('html2pdf.js').then(module => {
            const html2pdf = module.default;
            const element = document.getElementById('contract-content');
            const opt = {
              margin:       0.5,
              filename:     `scoop_Contract_${client.nameAr}_${transaction.transactionType}.pdf`,
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
    
    const contractTitle = template?.title || transaction.transactionType;

    if (!template) {
        return (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-4xl mx-auto text-center" dir="rtl">
                <h2 className="text-xl font-bold text-destructive">لا يوجد نموذج عقد</h2>
                <p className="text-muted-foreground mt-2">
                    لا يوجد نموذج عقد مرتبط بنوع هذه المعاملة: "{transaction.transactionType}".
                </p>
                <Button onClick={() => router.back()} className="mt-4">
                    <ArrowRight className="ml-2 h-4 w-4" />
                    العودة
                </Button>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-4xl mx-auto" dir="rtl">
            <div className="print:hidden mb-6 flex justify-between items-center no-print">
                 <Button variant="outline" onClick={() => router.back()}>
                    <ArrowRight className="ml-2 h-4 w-4" />
                    العودة
                </Button>
                <Button onClick={handleExport}><Printer className="ml-2 h-4 w-4" /> تصدير PDF</Button>
            </div>

            <div id="contract-content" className="space-y-8 printable-content">
                <header className="flex justify-between items-center pb-4 border-b">
                    <div className="flex items-center gap-4">
                        <Logo className="h-20 w-20 !p-3" />
                        <div>
                           <h1 className="text-xl font-bold">سكوب للاستشارات الهندسية</h1>
                           <p className="text-sm text-gray-500">scoop Engineering Consultants</p>
                           <p className="text-xs text-gray-500 mt-2">الكويت - شرق - شارع عبدالعزيز حمد الصقر - الدور 23 - مركز الراية - مكتب رقم 2 - نقال 99389650</p>
                        </div>
                    </div>
                    <div className="text-left">
                        <h2 className="text-2xl font-bold text-gray-700">{contractTitle}</h2>
                        <p className="font-mono text-sm mt-1">{contractDate}</p>
                        <p className="font-mono text-xs text-gray-500">{contractNumber}</p>
                    </div>
                </header>

                <section>
                    <h3 className="font-bold mb-2">أطراف الاتفاقية</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-lg">
                        <div>
                            <p className="font-semibold">الطرف الأول:</p>
                            <p>مكتب سكوب للاستشارات الهندسية (scoop)، ويمثله المهندس/ بليه علي المسفر.</p>
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
                    <h3 className="font-bold mb-2">البنود المالية</h3>
                    <div className="border rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="p-2 text-right font-semibold">البند</th>
                                    <th className="p-2 text-left font-semibold">المبلغ (د.ك)</th>
                                </tr>
                            </thead>
                            <tbody>
                            {clauses.map((clause) => (
                                <tr key={clause.id} className="border-t">
                                    <td className="p-2">{clause.name}</td>
                                    <td className="p-2 text-left font-mono">
                                        {/* Static text for PDF view */}
                                        {formatCurrency(clause.amount)}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 font-bold bg-gray-50 dark:bg-gray-700/50">
                                    <td className="p-2 text-right">الإجمالي</td>
                                    <td className="p-2 text-left font-mono">{formatCurrency(totalAmount)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                     <div className="mt-4 text-sm p-2 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-md">
                        <strong>ملاحظة: </strong>
                        هذا العقد يمثل اتفاقية للمعاملة المحددة فقط.
                    </div>
                </section>
                
                <section className="pt-16">
                    <div className="grid grid-cols-2 gap-8 text-center text-sm">
                        <div>
                            <p className="font-bold">الطرف الأول (المهندس)</p>
                            <div className="mt-12 border-t pt-2">التوقيع</div>
                        </div>
                        <div>
                            <p className="font-bold">الطرف الثاني (المالك)</p>
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
