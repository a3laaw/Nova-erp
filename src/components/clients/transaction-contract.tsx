'use client';

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';
import { formatCurrency } from '@/lib/utils';
import { Printer, Save, Loader2, ArrowRight } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Client, ClientTransaction, ContractClause } from '@/lib/types';
import { contractTemplates } from '@/lib/contract-templates';
import { useRouter } from 'next/navigation';

interface TransactionContractProps {
  client: Client;
  transaction: ClientTransaction;
}

export function TransactionContract({ client, transaction }: TransactionContractProps) {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

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
    const [contractDate, setContractDate] = useState('');

    useEffect(() => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        setContractDate(`${day}/${month}/${year}`);
    }, []);

    const handleAmountChange = (id: number, value: string) => {
        const newAmount = Number(value);
        if (!isNaN(newAmount)) {
        setClauses(clauses =>
            clauses.map(clause =>
            clause.id === id ? { ...clause, amount: newAmount } : clause
            )
        );
        }
    };

    const totalAmount = useMemo(() => {
        return clauses.reduce((sum, clause) => sum + clause.amount, 0);
    }, [clauses]);

    const handleSave = async () => {
        if (!firestore || !transaction?.id || !client?.id) return;
        setIsSaving(true);
        try {
            const transactionRef = doc(firestore, 'clients', client.id, 'transactions', transaction.id);
            await updateDoc(transactionRef, {
                contract: {
                clauses: clauses,
                totalAmount: totalAmount,
                }
            });
            toast({ title: 'نجاح', description: 'تم حفظ بنود العقد بنجاح.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ بنود العقد.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleExport = () => {
        import('html2pdf.js').then(module => {
            const html2pdf = module.default;
            const element = document.getElementById('contract-content');
            const opt = {
            margin:       0.5,
            filename:     `BMEC_Contract_${client.nameAr}_${transaction.transactionType}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().from(element).set(opt).save();
        });
    };

    const clientAddress = client.address ? [
        (client.address as any).governorate, 
        (client.address as any).area, 
        `قطعة ${(client.address as any).block}`, 
        `شارع ${(client.address as any).street}`, 
        `منزل ${(client.address as any).houseNumber}`
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
            <div className="print:hidden mb-6 flex justify-between items-center">
                 <Button variant="outline" onClick={() => router.back()}>
                    <ArrowRight className="ml-2 h-4 w-4" />
                    العودة إلى تفاصيل المعاملة
                </Button>
                <div className="flex gap-2">
                     <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                        <span className="mr-2">حفظ التعديلات</span>
                    </Button>
                    <Button onClick={handleExport}><Printer className="ml-2 h-4 w-4" /> تصدير PDF</Button>
                </div>
            </div>

            <div id="contract-content" className="space-y-8">
                <header className="flex justify-between items-center pb-4 border-b">
                    <div className="flex items-center gap-4">
                        <Logo className="h-20 w-20 !p-3" />
                        <div>
                            <h1 className="text-xl font-bold">دار بليه المسفر للاستشارات الهندسية</h1>
                            <p className="text-sm text-gray-500">Baleeh Al-Musfir Engineering Consultants (BMEC)</p>
                        </div>
                    </div>
                    <div className="text-left">
                        <h2 className="text-2xl font-bold text-gray-700">{contractTitle}</h2>
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
                            <p>الرقم المدني: {(client as any).civilId}</p>
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
                            {clauses.map((clause, index) => (
                                <tr key={clause.id} className="border-t">
                                    <td className="p-2">{clause.name}</td>
                                    <td className="p-2 text-left font-mono">
                                        <Input
                                            type="number"
                                            value={clause.amount}
                                            onChange={(e) => handleAmountChange(clause.id, e.target.value)}
                                            className="text-left print:hidden"
                                        />
                                        <span className="hidden print:inline">{formatCurrency(clause.amount)}</span>
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
