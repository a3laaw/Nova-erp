
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
import { useBranding, type BrandingSettings } from '@/context/branding-context';
import Image from 'next/image';

interface TransactionContractProps {
  client: Client;
  transaction: ClientTransaction;
}

const arabicOrdinals = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً'];


export function TransactionContract({ client, transaction }: TransactionContractProps) {
    const router = useRouter();
    const { branding } = useBranding();
    const [contractDate, setContractDate] = useState('');
    const [contractNumber, setContractNumber] = useState('');
    
    const scopeOfWork = transaction.contract?.scopeOfWork || [];
    const clauses = transaction.contract?.clauses || [];
    const terms = transaction.contract?.termsAndConditions || [];
    const openClauses = transaction.contract?.openClauses || [];
    const financialsType = transaction.contract?.financialsType || 'fixed';
    
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
    
    const clientAddress = client.address ? [
        client.address.governorate, 
        client.address.area, 
        `قطعة ${client.address.block}`, 
        `شارع ${client.address.street}`, 
        `منزل ${client.address.houseNumber}`
    ].filter(Boolean).join('، ') : 'غير محدد';
    
    const contractTitle = transaction.transactionType;

    if (!transaction.contract) {
        return (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-4xl mx-auto text-center" dir="rtl">
                <h2 className="text-xl font-bold text-destructive">لا يوجد عقد لهذه المعاملة</h2>
                <p className="text-muted-foreground mt-2">
                    الرجاء إنشاء عقد من صفحة العميل أولاً.
                </p>
                <Button onClick={() => router.back()} className="mt-4">
                    <ArrowRight className="ml-2 h-4 w-4" />
                    العودة
                </Button>
            </div>
        )
    }

    return (
        <div 
            id="contract-content" 
            className="space-y-8 printable-content bg-no-repeat bg-top bg-cover p-8 md:p-12"
            style={branding?.letterhead_image_url ? { backgroundImage: `url(${branding.letterhead_image_url})` } : {}}
        >
            <header className="pb-4 border-b">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Logo className="h-20 w-20 !p-3" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <div>
                            <h1 className="text-xl font-bold">{branding?.company_name}</h1>
                            <p className="text-sm text-gray-500">{branding?.letterhead_text}</p>
                            <p className="text-xs text-gray-500 mt-2">{branding?.address}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {branding?.phone && `Phone: ${branding.phone}`}
                                {branding?.phone && branding?.email && ' | '}
                                {branding?.email && `Email: ${branding.email}`}
                            </p>
                        </div>
                    </div>
                    <div className="text-left">
                        <h2 className="text-2xl font-bold text-gray-700">{contractTitle}</h2>
                        <p className="font-mono text-sm mt-1">{contractDate}</p>
                        <p className="font-mono text-xs text-gray-500">{contractNumber}</p>
                    </div>
                </div>
            </header>

            <section>
                <h3 className="font-bold mb-2">أطراف الاتفاقية</h3>
                <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-lg">
                    <div>
                        <p className="font-semibold">الطرف الأول:</p>
                        <p>{branding?.company_name || 'Nova ERP'}.</p>
                    </div>
                    <div>
                        <p className="font-semibold">الطرف الثاني:</p>
                        <p>السيد/ {client.nameAr}</p>
                        <p>الرقم المدني: {client.civilId}</p>
                        <p>العنوان: {clientAddress}</p>
                    </div>
                </div>
            </section>
            
            {scopeOfWork.length > 0 && (
                <section>
                    <h3 className="font-bold mb-2">نطاق العمل</h3>
                    <div className="space-y-2 text-sm p-4 border rounded-lg">
                        {scopeOfWork.map((item, index) => (
                            <div key={item.id} className="pb-2">
                                <p className="font-semibold">{arabicOrdinals[index] || `${index + 1}-`} {item.title}</p>
                                <p className="text-muted-foreground pr-4">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section>
                <h3 className="font-bold mb-2">الشروط والأحكام</h3>
                <div className="space-y-2 text-sm p-4 border rounded-lg">
                    {terms.length > 0 ? (
                        terms.map((term, index) => (
                            <div key={term.id} className="flex gap-2">
                                <span className="font-semibold">{arabicOrdinals[index] || `${index + 1}-`}</span>
                                <p>{term.text}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted-foreground">لا توجد شروط وأحكام خاصة.</p>
                    )}
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
                                <td className="p-2">
                                    {index + 1}. {clause.name}
                                    {financialsType === 'percentage' && clause.percentage != null && (
                                        <span className="text-xs text-gray-500"> (وهي تمثل {clause.percentage}% من قيمة العقد)</span>
                                    )}
                                </td>
                                <td className="p-2 text-left font-mono">
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
            </section>

            {openClauses.length > 0 && (
                <section>
                    <h3 className="font-bold mb-2">بنود إضافية</h3>
                    <div className="space-y-2 text-sm p-4 border rounded-lg">
                        {openClauses.map((clause, index) => (
                            <div key={clause.id} className="flex gap-2">
                                <span className="font-semibold">{arabicOrdinals[index] || `${index + 1}-`}</span>
                                <p>{clause.text}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
            
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
    );
}
