
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Logo } from '@/components/layout/logo';
import { formatCurrency } from '@/lib/utils';
import type { Client, ClientTransaction } from '@/lib/types';
import { useBranding } from '@/context/branding-context';
import { PrintableDocument } from '../layout/printable-document';
import { Ruler, Building2, Droplets, Zap, Layers, Package, Check } from 'lucide-react';

interface TransactionContractProps {
  client: Client;
  transaction: ClientTransaction;
}

const arabicOrdinals = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً'];

const roofExtensionLabels: Record<string, string> = {
    none: 'بدون توسعة',
    quarter: 'ربع دور',
    half: 'نصف دور'
};

const basementLabels: Record<string, string> = {
    none: 'بدون سرداب',
    full: 'سرداب كامل',
    half: 'سرداب نص',
    vault: 'قبو'
};

const extensionTypeLabels: Record<string, string> = {
    ordinary: 'عادي',
    suspended: 'معلق'
};

const toiletTypeLabels: Record<string, string> = {
    ordinary: 'عادي',
    suspended: 'معلق'
};

const showerTypeLabels: Record<string, string> = {
    ordinary: 'عادي',
    hidden: 'مخفي'
};

export function TransactionContract({ client, transaction }: TransactionContractProps) {
    const { branding } = useBranding();
    const [contractDate, setContractDate] = useState('');
    const [contractNumber, setContractNumber] = useState('');
    
    const scopeOfWork = transaction.contract?.scopeOfWork || [];
    const clauses = transaction.contract?.clauses || [];
    const terms = transaction.contract?.termsAndConditions || [];
    const openClauses = transaction.contract?.openClauses || [];
    const financialsType = transaction.contract?.financialsType || 'fixed';
    const specs = transaction.contract?.specs;

    // منطق العرض الشرطي للمواصفات
    const isSanitary = transaction.transactionType?.includes('صحي');
    const isElectrical = transaction.transactionType?.includes('كهرباء');
    
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

    if (!transaction.contract) return null;

    return (
        <PrintableDocument>
            <div className="space-y-8">
                <header className="pb-4 border-b-4 border-primary">
                    <div className="flex justify-between items-center">
                         <div className="flex items-center gap-4">
                            <Logo className="h-20 w-20 !p-3" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                            <div>
                                <h1 className="text-xl font-bold">{branding?.company_name}</h1>
                                <p className="text-xs text-gray-500">{branding?.address}</p>
                            </div>
                        </div>
                        <div className="text-left">
                            <h2 className="text-3xl font-black text-primary tracking-tighter">عـقـد اتـفـاق</h2>
                            <p className="font-mono text-sm mt-1">{contractDate}</p>
                            <p className="font-mono text-xs text-gray-500">{contractNumber}</p>
                        </div>
                    </div>
                </header>

                <section>
                    <h3 className="font-black border-r-4 border-primary pr-2 mb-4 text-lg">أطراف الاتفاقية</h3>
                    <div className="grid grid-cols-2 gap-8 text-sm p-6 bg-muted/20 rounded-2xl border">
                        <div>
                            <p className="font-bold text-primary mb-1">الطرف الأول (الشركة):</p>
                            <p className="font-semibold text-base">{branding?.company_name || 'Nova ERP'}.</p>
                        </div>
                        <div>
                            <p className="font-bold text-primary mb-1">الطرف الثاني (المالك):</p>
                            <p className="font-semibold text-base">{client.nameAr}</p>
                            <p className="text-xs text-muted-foreground mt-1">الرقم المدني: {client.civilId}</p>
                            <p className="text-xs text-muted-foreground">العنوان: {clientAddress}</p>
                        </div>
                    </div>
                </section>

                {/* --- المواصفات الفنية المدمجة في العقد --- */}
                {specs && (
                    <section>
                        <h3 className="font-black border-r-4 border-primary pr-2 mb-4 text-lg">المواصفات الفنية والمساحات</h3>
                        <div className="p-6 border-2 border-dashed rounded-3xl space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="flex items-center gap-3">
                                    <Ruler className="h-5 w-5 text-primary" />
                                    <div><p className="text-[10px] font-bold text-muted-foreground uppercase">المساحة الإجمالية:</p><p className="font-bold">{specs.totalArea} م²</p></div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Layers className="h-5 w-5 text-primary" />
                                    <div><p className="text-[10px] font-bold text-muted-foreground uppercase">عدد الأدوار:</p><p className="font-bold">{specs.floorsCount} دور</p></div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Building2 className="h-5 w-5 text-primary" />
                                    <div><p className="text-[10px] font-bold text-muted-foreground uppercase">السرداب:</p><p className="font-bold">{basementLabels[specs.basementType]}</p></div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Layers className="h-5 w-5 text-primary" />
                                    <div><p className="text-[10px] font-bold text-muted-foreground uppercase">السطح:</p><p className="font-bold">{roofExtensionLabels[specs.roofExtension]}</p></div>
                                </div>
                            </div>

                            {/* تفاصيل الصحي المحترفة - نفس الصورة */}
                            {isSanitary && (
                                <div className="border-2 rounded-2xl overflow-hidden bg-blue-50/10 border-blue-100">
                                    <div className="bg-blue-600 text-white p-2 text-center text-xs font-black">تفاصيل عقد التمديدات والأدوات الصحية</div>
                                    <table className="w-full text-center border-collapse">
                                        <thead>
                                            <tr className="bg-blue-50 text-[10px] font-black text-blue-800 border-b border-blue-100">
                                                <th className="p-2 border-l border-blue-100">حمامات</th>
                                                <th className="p-2 border-l border-blue-100">مطابخ</th>
                                                <th className="p-2 border-l border-blue-100">غرف غسيل</th>
                                                <th className="p-2 border-l border-blue-100">نوع التمديد</th>
                                                <th className="p-2 border-l border-blue-100">المراحيض</th>
                                                <th className="p-2 border-l border-blue-100">الشاورات</th>
                                                <th className="p-2">توفير المواد</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-xs font-bold">
                                            <tr>
                                                <td className="p-3 border-l border-blue-100">{specs.bathroomsCount}</td>
                                                <td className="p-3 border-l border-blue-100">{specs.kitchensCount}</td>
                                                <td className="p-3 border-l border-blue-100">{specs.laundryRoomsCount}</td>
                                                <td className="p-3 border-l border-blue-100">{extensionTypeLabels[specs.sanitaryExtensionType || 'ordinary']}</td>
                                                <td className="p-3 border-l border-blue-100">{toiletTypeLabels[specs.toiletType || 'ordinary']}</td>
                                                <td className="p-3 border-l border-blue-100">{showerTypeLabels[specs.showerType || 'ordinary']}</td>
                                                <td className="p-3">{specs.sanitaryMaterialsIncluded ? 'شامل المواد' : 'لا يشمل المواد'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* الكهرباء */}
                            {isElectrical && (
                                <div className="flex items-center gap-3 border-r-4 border-yellow-400 pr-4 bg-yellow-50/30 p-4 rounded-xl">
                                    <Zap className="h-6 w-6 text-yellow-600" />
                                    <div><p className="text-[10px] font-bold text-yellow-800 uppercase">نقاط الكهرباء والمخطط:</p><p className="font-bold">{specs.electricalPointsCount} نقطة (حسب المخطط المعتمد رقم: {specs.planReferenceNumber || '-'})</p></div>
                                </div>
                            )}
                        </div>
                    </section>
                )}
                
                {scopeOfWork.length > 0 && (
                    <section>
                        <h3 className="font-black border-r-4 border-primary pr-2 mb-4 text-lg">نطاق العمل</h3>
                        <div className="space-y-2 text-sm p-6 bg-muted/10 rounded-2xl border">
                            {scopeOfWork.map((item, index) => (
                                <div key={item.id} className="pb-2 border-b last:border-0 border-dashed">
                                    <p className="font-bold text-primary">{arabicOrdinals[index] || `${index + 1}-`} {item.title}</p>
                                    <p className="text-muted-foreground pr-4 text-xs leading-relaxed">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section>
                    <h3 className="font-black border-r-4 border-primary pr-2 mb-4 text-lg">البنود المالية وطريقة الدفع</h3>
                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr className="h-12">
                                    <th className="p-2 text-right font-black px-6">بيان الدفعة</th>
                                    <th className="p-2 text-left font-black px-6">المبلغ (د.ك)</th>
                                </tr>
                            </thead>
                            <tbody>
                            {clauses.map((clause, index) => (
                                <tr key={clause.id} className="border-t h-12">
                                    <td className="p-2 px-6 font-medium">
                                        {index + 1}. {clause.name}
                                        {financialsType === 'percentage' && clause.percentage != null && (
                                            <span className="text-[10px] text-muted-foreground"> ({clause.percentage}%)</span>
                                        )}
                                    </td>
                                    <td className="p-2 px-6 text-left font-mono font-bold">
                                        {formatCurrency(clause.amount)}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-4 bg-primary/5 h-16 font-black text-lg">
                                    <td className="p-2 px-6 text-right">إجمالي قيمة الاتفاقية</td>
                                    <td className="p-2 px-6 text-left font-mono text-primary text-xl">{formatCurrency(totalAmount)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </section>

                <section className="pt-20">
                    <div className="grid grid-cols-2 gap-20 text-center text-sm">
                        <div>
                            <p className="font-black border-b-2 border-foreground pb-2 mb-16">الطرف الأول (الشركة)</p>
                            <div className="pt-2 border-t border-dashed">التوقيع والختم</div>
                        </div>
                        <div>
                            <p className="font-black border-b-2 border-foreground pb-2 mb-16">الطرف الثاني (المالك)</p>
                            <div className="pt-2 border-t border-dashed">التوقيع</div>
                        </div>
                    </div>
                </section>
            </div>
        </PrintableDocument>
    );
}
