'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, DownloadCloud, Folder, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, where, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Account, JournalEntry } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';


const defaultChartOfAccounts: Omit<Account, 'id'>[] = [
  // --- الأصول (1) ---
  { code: '1', name: 'الأصول', parentCode: null, isPayable: false, level: 0, description: '', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '11', name: 'أصول متداولة', parentCode: '1', isPayable: false, level: 1, description: '', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '1101', name: 'النقد وما يعادله', parentCode: '11', isPayable: false, level: 2, description: 'النقدية وما في حكمها (في الخزينة والعهد)', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '110101', name: 'النقدية في الخزينة', parentCode: '1101', isPayable: true, level: 3, description: 'النقدية في الخزينة', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '110102', name: 'العهد النقدية', parentCode: '1101', isPayable: true, level: 3, description: 'العهد النقدية للموظفين بشكل مؤقت أو دائم لدفع مصروفات المنشأة', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '1102', name: 'النقدية في البنك', parentCode: '11', isPayable: false, level: 2, description: 'النقدية في البنوك', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '110201', name: 'حساب البنك الجاري - اسم البنك', parentCode: '1102', isPayable: true, level: 3, description: 'حساب البنك الجاري - اسم البنك', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '1103', name: 'العملاء', parentCode: '11', isPayable: true, level: 2, description: 'مبالغ مستحقة على حساب العملاء (بالأجل)', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '1104', name: 'مصروفات مقدمة', parentCode: '11', isPayable: false, level: 2, description: 'مصروف مدفوع مقدماً مثل التأمين وسلف الموظفين وإيجار المكتب', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '110401', name: 'تأمين طبي مقدم', parentCode: '1104', isPayable: true, level: 3, description: 'تأمين طبي مدفوع مقدماً يتم إطفاء ما يخص السنة المالية إلى مصروف', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12', name: 'أصول غير متداولة', parentCode: '1', isPayable: false, level: 1, description: '', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '121', name: 'الأصول الثابتة', parentCode: '12', isPayable: false, level: 2, description: '', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12101', name: 'الأصول الثابتة - المباني', parentCode: '121', isPayable: false, level: 3, description: 'الأصول الثابتة - المباني', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12102', name: 'الأصول الثابتة - المعدات', parentCode: '121', isPayable: false, level: 3, description: 'الأصول الثابتة - المعدات', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12103', name: 'الأصول الثابتة - الأجهزة المكتبية والطابعات', parentCode: '121', isPayable: false, level: 3, description: 'الأصول الثابتة - الأجهزة المكتبية والطابعات', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12104', name: 'الأصول الثابتة - الأثاث والتجهيزات', parentCode: '121', isPayable: false, level: 3, description: 'الأصول الثابتة - الأثاث والتجهيزات', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12105', name: 'الأصول الثابتة - السيارات', parentCode: '121', isPayable: false, level: 3, description: 'الأصول الثابتة - السيارات', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12106', name: 'الأصول الثابتة - الآلات', parentCode: '121', isPayable: false, level: 3, description: 'الأصول الثابتة - الآلات', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12107', name: 'الأصول الثابتة - أخرى', parentCode: '121', isPayable: false, level: 3, description: 'الأصول الثابتة - أخرى', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '122', name: 'إهلاك الأصول الثابتة المتراكم', parentCode: '12', isPayable: false, level: 2, description: 'إهلاك الأصول الثابتة المتراكم', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12201', name: 'إهلاك متراكم المباني', parentCode: '122', isPayable: false, level: 3, description: 'إهلاك متراكم المباني', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12202', name: 'إهلاك متراكم المعدات', parentCode: '122', isPayable: false, level: 3, description: 'إهلاك متراكم المعدات', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12203', name: 'إهلاك متراكم أجهزة مكتبية وطابعات', parentCode: '122', isPayable: false, level: 3, description: 'إهلاك متراكم أجهزة مكتبية وطابعات', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12204', name: 'إهلاك متراكم الأثاث والتجهيزات', parentCode: '122', isPayable: false, level: 3, description: 'إهلاك متراكم الأثاث والتجهيزات', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12205', name: 'إهلاك متراكم السيارات', parentCode: '122', isPayable: false, level: 3, description: 'إهلاك متراكم السيارات', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12206', name: 'إهلاك متراكم الآلات', parentCode: '122', isPayable: false, level: 3, description: 'إهلاك متراكم الآلات', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '12207', name: 'إهلاك متراكم أخرى', parentCode: '122', isPayable: false, level: 3, description: 'إهلاك متراكم أخرى', type: 'asset', statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '2', name: 'الخصوم', parentCode: null, isPayable: false, level: 0, description: '', type: 'liability', statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '21', name: 'الخصوم المتداولة', parentCode: '2', isPayable: false, level: 1, description: '', type: 'liability', statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '2101', name: 'الموردون', parentCode: '21', isPayable: true, level: 2, description: 'المبالغ المستحقة للدفع للموردين', type: 'liability', statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '2102', name: 'أوراق دفع', parentCode: '21', isPayable: true, level: 2, description: 'الشيكات المستحقة الدفع', type: 'liability', statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '2103', name: 'إيرادات غير مكتسبة', parentCode: '21', isPayable: true, level: 2, description: 'مبالغ مستلمة من العملاء مقدماً قبل تقديم الخدمة', type: 'liability', statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '2104', name: 'مصاريف مستحقة', parentCode: '21', isPayable: false, level: 2, description: 'مصروفات تخص الفترة المالية الحالية ولكن لم يتم سدادها بعد', type: 'liability', statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '210401', name: 'رواتب مستحقة', parentCode: '2104', isPayable: true, level: 3, description: 'رواتب الموظفين المستحقة عن الفترة', type: 'liability', statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '3', name: 'حقوق الملكية', parentCode: null, isPayable: false, level: 0, description: '', type: 'equity', statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '31', name: 'رأس المال', parentCode: '3', isPayable: false, level: 1, description: '', type: 'equity', statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '3101', name: 'رأس المال المدفوع', parentCode: '31', isPayable: true, level: 2, description: '', type: 'equity', statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '32', name: 'جاري الشركاء', parentCode: '3', isPayable: true, level: 1, description: 'حسابات الشركاء الشخصية مع الشركة', type: 'equity', statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '33', name: 'أرباح مبقاة / خسائر مدورة', parentCode: '3', isPayable: true, level: 1, description: '', type: 'equity', statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '4', name: 'الإيرادات', parentCode: null, isPayable: false, level: 0, description: '', type: 'income', statement: 'Income Statement', balanceType: 'Credit' },
  { code: '41', name: 'إيرادات النشاط التشغيلي', parentCode: '4', isPayable: false, level: 1, description: '', type: 'income', statement: 'Income Statement', balanceType: 'Credit' },
  { code: '4101', name: 'إيرادات استشارات هندسية', parentCode: '41', isPayable: true, level: 2, description: 'إيرادات من تقديم استشارات هندسية', type: 'income', statement: 'Income Statement', balanceType: 'Credit' },
  { code: '4102', name: 'إيرادات تصميم', parentCode: '41', isPayable: true, level: 2, description: 'إيرادات من أعمال التصميم', type: 'income', statement: 'Income Statement', balanceType: 'Credit' },
  { code: '4103', name: 'إيرادات إشراف', parentCode: '41', isPayable: true, level: 2, description: 'إيرادات من الإشراف على المشاريع', type: 'income', statement: 'Income Statement', balanceType: 'Credit' },
  { code: '5', name: 'المصروفات', parentCode: null, isPayable: false, level: 0, description: '', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '51', name: 'تكلفة الإيرادات', parentCode: '5', isPayable: false, level: 1, description: '', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5101', name: 'رواتب المهندسين والفنيين', parentCode: '51', isPayable: true, level: 2, description: 'رواتب الفريق الهندسي والفني المباشر على المشاريع', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5102', name: 'تكاليف استشاريين من الباطن', parentCode: '51', isPayable: true, level: 2, description: 'تكاليف الاستعانة باستشاريين خارجيين للمشاريع', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5103', name: 'مواد مباشرة للمشاريع', parentCode: '51', isPayable: true, level: 2, description: 'تكاليف المواد المستخدمة مباشرة في المشاريع', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '52', name: 'مصاريف عمومية وإدارية', parentCode: '5', isPayable: false, level: 1, description: '', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5201', name: 'رواتب وأجور الموظفين', parentCode: '52', isPayable: true, level: 2, description: 'رواتب موظفي الإدارة والمحاسبة والموارد البشرية', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5202', name: 'مصاريف تسويق ومبيعات', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف متعلقة بالتسويق والإعلان', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5203', name: 'إيجارات', parentCode: '52', isPayable: true, level: 2, description: 'مصروف إيجار المكتب', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5204', name: 'فواتير كهرباء وماء واتصالات', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف الخدمات العامة للمكتب', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5205', name: 'تراخيص واشتراكات حكومية', parentCode: '52', isPayable: true, level: 2, description: 'رسوم التراخيص والاشتراكات الحكومية', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5206', name: 'مصروفات بنكية', parentCode: '52', isPayable: true, level: 2, description: 'الرسوم والمصاريف البنكية', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5207', name: 'صيانة وإصلاحات', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف صيانة المكتب والمعدات', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5208', name: 'نثريات ومصاريف متنوعة', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف صغيرة ومتفرقة', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5209', name: 'وقود وزيوت سيارات', parentCode: '52', isPayable: true, level: 2, description: 'مصروف وقود وزيوت سيارات الشركة', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5210', name: 'ضيافة وبوفيه', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف الضيافة والبوفيه للمكتب', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5211', name: 'أدوات مكتبية ومطبوعات', parentCode: '52', isPayable: true, level: 2, description: 'تكاليف الأدوات المكتبية والورق والأحبار', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5212', name: 'اشتراكات برامج وتطبيقات', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف الاشتراكات في البرامج السحابية والتطبيقات', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5213', name: 'رسوم التأمينات الاجتماعية', parentCode: '52', isPayable: true, level: 2, description: 'حصة الشركة في التأمينات الاجتماعية', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5214', name: 'صيانة سيارات الشركة', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف الصيانة الدورية وإصلاح السيارات', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5215', name: 'مصاريف الإهلاك', parentCode: '52', isPayable: false, level: 2, description: 'إهلاك الأصول الثابتة', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '521501', name: 'مصروف إهلاك المباني', parentCode: '5215', isPayable: false, level: 3, description: 'قسط الإهلاك السنوي للمباني', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
  { code: '521502', name: 'مصروف إهلاك المعدات', parentCode: '5215', isPayable: false, level: 3, description: 'قسط الإهلاك السنوي للمعدات', type: 'expense', statement: 'Income Statement', balanceType: 'Debit' },
];

const accountTypeTranslations: Record<Account['type'], string> = {
    asset: 'أصل',
    liability: 'خصم',
    equity: 'حقوق ملكية',
    income: 'إيراد',
    expense: 'مصروف',
};

const accountTypeColors: Record<Account['type'], string> = {
    asset: 'bg-blue-100 text-blue-800 border-blue-200',
    liability: 'bg-red-100 text-red-800 border-red-200',
    equity: 'bg-purple-100 text-purple-800 border-purple-200',
    income: 'bg-green-100 text-green-800 border-green-200',
    expense: 'bg-orange-100 text-orange-800 border-orange-200',
};

const getTypeFromCode = (code: string): Account['type'] => {
    if (code.startsWith('1')) return 'asset';
    if (code.startsWith('2')) return 'liability';
    if (code.startsWith('3')) return 'equity';
    if (code.startsWith('4')) return 'income';
    if (code.startsWith('5')) return 'expense';
    return 'asset'; // Default
};


const getStatementType = (code: string): Account['statement'] => {
    if (code.startsWith('1') || code.startsWith('2') || code.startsWith('3')) return 'Balance Sheet';
    return 'Income Statement';
};

const getBalanceType = (code: string): Account['balanceType'] => {
    if (code.startsWith('1') || code.startsWith('5')) return 'Debit';
    return 'Credit';
};


function AccountForm({ isOpen, onClose, onSave, account, parentAccount, accounts }: { isOpen: boolean, onClose: () => void, onSave: (data: Partial<Account>) => void, account: Account | null, parentAccount: Account | null, accounts: Account[] }) {
    const isEditing = !!account;
    const [formData, setFormData] = useState<Partial<Account>>({});

    useEffect(() => {
        if (isOpen) {
            if (isEditing && account) {
                setFormData({ code: account.code, name: account.name, type: account.type, isPayable: account.isPayable });
            } else {
                let nextCode = '';
                let newType: Account['type'] = parentAccount ? parentAccount.type : 'asset';
                const level = parentAccount !== null ? (parentAccount.level || 0) + 1 : 0;

                const relevantAccounts = parentAccount
                    ? accounts.filter(acc => acc.parentCode === parentAccount.code)
                    : accounts.filter(acc => acc.level === 0);
                
                if (relevantAccounts.length === 0) {
                     if (parentAccount) {
                         nextCode = parentAccount.code + (level < 3 ? '1' : '01');
                     } else {
                         const maxRootCode = Math.max(0, ...accounts.filter(a => a.level === 0).map(a => parseInt(a.code, 10)));
                         nextCode = String(maxRootCode + 1);
                     }
                } else {
                    const lastCodeNum = Math.max(...relevantAccounts.map(acc => parseInt(acc.code, 10)));
                    nextCode = String(lastCodeNum + 1);
                }
                
                setFormData({ type: newType, code: nextCode, name: '', isPayable: true });
            }
        }
    }, [account, parentAccount, isEditing, isOpen, accounts]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = formData.code || '';
        const level = parentAccount !== null ? (parentAccount.level || 0) + 1 : 0;
        const type = parentAccount ? parentAccount.type : getTypeFromCode(code);
        const statement = getStatementType(code);
        const balanceType = getBalanceType(code);
        onSave({ ...formData, level, type, statement, balanceType, parentCode: parentAccount?.code || null });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                           {isEditing ? 'تعديل حساب' : parentAccount ? 'إضافة حساب فرعي' : 'إضافة حساب رئيسي'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="code">رمز الحساب</Label>
                            <Input id="code" value={formData.code || ''} onChange={(e) => setFormData(p => ({ ...p, code: e.target.value }))} required dir="ltr" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="name">اسم الحساب</Label>
                            <Input id="name" value={formData.name || ''} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="type">نوع الحساب</Label>
                            <Select value={formData.type} onValueChange={(v) => setFormData(p => ({...p, type: v as Account['type']}))} disabled={!!parentAccount || isEditing}>
                                <SelectTrigger><SelectValue placeholder="اختر النوع..." /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(accountTypeTranslations).map(([key, value]) => (
                                        <SelectItem key={key} value={key}>{value}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="flex items-center space-x-2">
                           <input type="checkbox" id="isPayable" checked={!!formData.isPayable} onChange={(e) => setFormData(p => ({...p, isPayable: e.target.checked}))} className="h-4 w-4" />
                           <Label htmlFor="isPayable">حساب قابل للدفع والتحصيل</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
                        <Button type="submit">حفظ</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}


export default function ChartOfAccountsPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [isSeedAlertOpen, setIsSeedAlertOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
    const [parentAccount, setParentAccount] = useState<Account | null>(null);
    const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [accountBalances, setAccountBalances] = useState<Map<string, number>>(new Map());

    const fetchAllData = useCallback(async () => {
        if (!firestore) return;
        setLoading(true);
        try {
            const accountsQuery = query(collection(firestore, 'chartOfAccounts'), orderBy('code'));
            const entriesQuery = query(collection(firestore, 'journalEntries'), where('status', '==', 'posted'));

            const [accountsSnapshot, entriesSnapshot] = await Promise.all([
                getDocs(accountsQuery),
                getDocs(entriesQuery),
            ]);

            const fetchedAccounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
            setAccounts(fetchedAccounts);

            const journalEntries = entriesSnapshot.docs.map(doc => doc.data() as JournalEntry);
            
            const directBalances = new Map<string, number>();
            journalEntries.forEach(entry => {
                entry.lines.forEach(line => {
                    const acc = fetchedAccounts.find(a => a.id === line.accountId);
                    if (!acc) return; 
                    
                    const currentBalance = directBalances.get(line.accountId) || 0;
                    let balanceChange = 0;
                    
                    if (acc.balanceType === 'Debit') {
                        balanceChange = (line.debit || 0) - (line.credit || 0);
                    } else {
                        balanceChange = (line.credit || 0) - (line.debit || 0);
                    }
                    directBalances.set(line.accountId, currentBalance + balanceChange);
                });
            });

            const aggregatedBalances = new Map<string, number>();
            fetchedAccounts
              .sort((a, b) => (b.level || 0) - (a.level || 0)) 
              .forEach(account => {
                  let totalBalance = directBalances.get(account.id!) || 0;
                  
                  const children = fetchedAccounts.filter(child => 
                      child.parentCode === account.code
                  );
                  
                  children.forEach(child => {
                      totalBalance += aggregatedBalances.get(child.id!) || 0;
                  });
                  
                  aggregatedBalances.set(account.id!, totalBalance);
              });

            setAccountBalances(aggregatedBalances);

        } catch (e) {
            console.error("Error fetching data: ", e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات.' });
        } finally {
            setLoading(false);
        }
    }, [firestore, toast]);
    
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const displayedAccounts = useMemo(() => {
        if (accounts.length === 0) return [];
        
        const accountMap = new Map(accounts.map(acc => [acc.code, acc]));
        const childrenMap = new Map<string, Account[]>();
        
        accounts.forEach(acc => {
            if (acc.parentCode) {
                if (!childrenMap.has(acc.parentCode)) {
                    childrenMap.set(acc.parentCode, []);
                }
                childrenMap.get(acc.parentCode)!.push(acc);
            }
        });

        const getChildren = (code: string): Account[] => {
            return (childrenMap.get(code) || []).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        };
        
        const roots = accounts.filter(a => a.level === 0).sort((a,b) => (a.code || '').localeCompare(b.code || ''));
        
        const finalDisplayedList: Account[] = [];
        
        function buildDisplayList(accountCode: string) {
            const account = accountMap.get(accountCode);
            if (!account) return;

            finalDisplayedList.push(account);

            if (openAccounts.has(accountCode)) {
                const children = getChildren(accountCode);
                children.forEach(child => buildDisplayList(child.code));
            }
        }

        roots.forEach(root => buildDisplayList(root.code));
        return finalDisplayedList;
    }, [accounts, openAccounts]);


    const handleAddClick = () => {
        setEditingAccount(null);
        setParentAccount(null);
        setIsFormOpen(true);
    };

    const handleAddSubAccountClick = (parent: Account) => {
        setParentAccount(parent);
        setEditingAccount(null);
        setIsFormOpen(true);
    };
    
    const handleEditClick = (account: Account) => {
        const parent = accounts.find(a => a.code === account.parentCode) || null;
        setParentAccount(parent);
        setEditingAccount(account);
        setIsFormOpen(true);
    };

    const handleDeleteClick = (account: Account) => {
        setAccountToDelete(account);
        setIsAlertOpen(true);
    };

    const handleSave = async (data: Partial<Account>) => {
        if (!firestore || !data.code || !data.name || !data.type) return;
        setIsSaving(true);
        try {
            if (editingAccount?.id) {
                await updateDoc(doc(firestore, 'chartOfAccounts', editingAccount.id), data);
                toast({ title: 'نجاح', description: 'تم تحديث الحساب.' });
            } else {
                await addDoc(collection(firestore, 'chartOfAccounts'), data);
                toast({ title: 'نجاح', description: 'تمت إضافة الحساب.' });
            }
            setIsFormOpen(false);
            setEditingAccount(null);
            setParentAccount(null);
            await fetchAllData();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الحساب.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteConfirm = async () => {
        if (!firestore || !accountToDelete?.id) return;
        setIsSaving(true);
        try {
            await deleteDoc(doc(firestore, 'chartOfAccounts', accountToDelete.id));
            toast({ title: 'نجاح', description: 'تم حذف الحساب.' });
            setIsAlertOpen(false);
            setAccountToDelete(null);
            await fetchAllData();
        } catch (e) {
             console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الحساب. قد يكون مرتبطًا ببيانات أخرى.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSeedChartOfAccounts = async () => {
        if (!firestore) return;
        setIsSeedAlertOpen(false);
        setIsSeeding(true);
        try {
            const batch = writeBatch(firestore);
            const accountsRef = collection(firestore, 'chartOfAccounts');
            
            // 1. Delete all existing accounts
            const existingAccountsSnap = await getDocs(accountsRef);
            existingAccountsSnap.forEach(doc => {
                batch.delete(doc.ref);
            });

            // 2. Add the new default accounts
            defaultChartOfAccounts.forEach(account => {
                const docRef = doc(accountsRef); // Create a new doc reference for each
                batch.set(docRef, account);
            });

            await batch.commit();
            toast({ title: 'نجاح', description: 'تم مسح الشجرة القديمة وتنزيل شجرة الحسابات الأساسية بنجاح.' });
            await fetchAllData();
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تنزيل شجرة الحسابات.' });
        } finally {
            setIsSeeding(false);
        }
    };

    const toggleAccount = (code: string) => {
        setOpenAccounts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(code)) {
                newSet.delete(code);
            } else {
                newSet.add(code);
            }
            return newSet;
        });
    };

    return (
        <div className="space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>شجرة الحسابات</CardTitle>
                            <CardDescription>عرض وإدارة دليل الحسابات الخاص بالشركة وأرصدتها الحالية.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                             <Button onClick={() => setIsSeedAlertOpen(true)} variant="outline" disabled={isSeeding}>
                                {isSeeding ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <DownloadCloud className="ml-2 h-4 w-4" />}
                                {isSeeding ? 'جاري التنزيل...' : 'تنزيل شجرة حسابات أساسية'}
                            </Button>
                            <Button onClick={handleAddClick}><PlusCircle className="ml-2 h-4 w-4" /> إضافة حساب رئيسي</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-2/5">اسم الحساب</TableHead>
                                    <TableHead>الرمز</TableHead>
                                    <TableHead>النوع</TableHead>
                                    <TableHead>طبيعة الرصيد</TableHead>
                                    <TableHead>القائمة</TableHead>
                                    <TableHead className="text-left">الرصيد</TableHead>
                                    <TableHead className="text-center"><span className="sr-only">الإجراءات</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({length: 5}).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full"/></TableCell></TableRow>
                                    ))
                                ) : displayedAccounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-48">
                                            <div className="flex flex-col items-center justify-center gap-4">
                                                <p className="text-muted-foreground">لا توجد حسابات. ابدأ بإضافة حساب رئيسي، أو قم بتنزيل شجرة الحسابات الأساسية.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    displayedAccounts.map(account => {
                                        const balance = accountBalances.get(account.id!) || 0;
                                        const hasChildren = accounts.some(a => a.parentCode === account.code);
                                        const isOpen = openAccounts.has(account.code);

                                        return (
                                            <TableRow key={account.id} className={account.level === 0 ? 'bg-muted/50' : ''}>
                                                <TableCell style={{ paddingRight: `${(account.level || 0) * 1.5 + 1}rem` }}>
                                                    <div className="flex items-center gap-2 group">
                                                        {hasChildren ? (
                                                            <button onClick={() => toggleAccount(account.code)} className="p-1 -mr-1">
                                                               {isOpen ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
                                                            </button>
                                                        ) : (
                                                            <span className="w-6 h-4 inline-block"></span>
                                                        )}
                                                        <span className="font-medium">{account.name}</span>
                                                        {account.level < 4 && (
                                                            <Button
                                                                type="button" variant="ghost" size="icon"
                                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={(e) => { e.stopPropagation(); handleAddSubAccountClick(account); }}>
                                                                <PlusCircle className="h-4 w-4 text-primary" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono">{account.code}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn(accountTypeColors[account.type], "whitespace-nowrap")}>
                                                        {accountTypeTranslations[account.type]}
                                                    </Badge>
                                                </TableCell>
                                                 <TableCell>
                                                    <Badge variant="secondary">{account.balanceType === 'Debit' ? 'مدين' : 'دائن'}</Badge>
                                                 </TableCell>
                                                <TableCell className="text-xs">{account.statement === 'Balance Sheet' ? 'مركز مالي' : 'قائمة دخل'}</TableCell>
                                                <TableCell className={cn("text-left font-mono", balance < 0 && "text-destructive")}>
                                                    {formatCurrency(balance)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent dir="rtl" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenuItem onClick={() => handleEditClick(account)}><Pencil className="ml-2 h-4 w-4" /> تعديل</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleDeleteClick(account)} className="text-destructive focus:text-destructive"><Trash2 className="ml-2 h-4 w-4" /> حذف</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AccountForm 
                isOpen={isFormOpen} 
                onClose={() => setIsFormOpen(false)} 
                onSave={handleSave} 
                account={editingAccount} 
                parentAccount={parentAccount}
                accounts={accounts}
            />
            
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من رغبتك في حذف الحساب "{accountToDelete?.name}"؟ سيتم حذف جميع الحسابات الفرعية التابعة له. لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">
                            {isSaving ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري الحذف...</> : 'نعم، قم بالحذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog open={isSeedAlertOpen} onOpenChange={setIsSeedAlertOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد تنزيل شجرة الحسابات؟</AlertDialogTitle>
                        <AlertDialogDescription>
                           **تحذير خطير:** سيقوم هذا الإجراء **بمسح جميع الحسابات الحالية** في قاعدة البيانات واستبدالها بشجرة حسابات أساسية. هذا الإجراء لا يمكن التراجع عنه. هل تريد المتابعة؟
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSeeding}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSeedChartOfAccounts} disabled={isSeeding} className="bg-destructive hover:bg-destructive/90">
                            {isSeeding ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري التنزيل...</> : 'نعم، قم بالمسح والتنزيل'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}