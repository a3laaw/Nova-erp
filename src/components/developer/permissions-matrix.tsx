
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { 
    ShieldCheck, 
    Save, 
    Loader2, 
    Search,
    LayoutDashboard,
    Settings2,
    Lock,
    FileSignature,
    Workflow,
    MapPin,
    Coins,
    BookOpen,
    Landmark,
    TrendingUp,
    Users,
    Activity,
    Calculator,
    Layers,
    Banknote,
    ListTree,
    Sparkles
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, setDoc, serverTimestamp, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn, cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

/**
 * مصفوفة الصلاحيات السيادية المحدثة (The Dynamic Sovereign Matrix V140.0):
 * - ربط آلي ومباشر مع "المهن" (Jobs) المضافة في إعدادات المنظومة.
 * - كل مهنة جديدة تظهر فوراً كعمود مستقل في المصفوفة.
 * - عزل تام للصلاحيات المالية والفنية والإدارية.
 */

const MODULES = [
    { id: 'dashboard', name: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'clients', name: 'إدارة العملاء', icon: Users },
    { id: 'transactions', name: 'المعاملات', icon: Workflow },
    { id: 'quotations', name: 'عروض الأسعار', icon: Calculator },
    { id: 'contracts', name: 'العقود', icon: FileSignature },
    { id: 'tech_workflow', name: 'المسار الفني', icon: Layers },
    { id: 'site_visits', name: 'الزيارات الميدانية', icon: MapPin },
    { id: 'payment_apps', name: 'المستخلصات', icon: Coins },
    { id: 'journal_entries', name: 'القيود المحاسبية', icon: BookOpen },
    { id: 'vouchers', name: 'سندات القبض والصرف', icon: Landmark },
    { id: 'coa', name: 'شجرة الحسابات', icon: ListTree },
    { id: 'financial_reports', name: 'التقارير المالية', icon: TrendingUp },
    { id: 'hr_employees', name: 'HR - إدارة الموظفين', icon: ShieldCheck },
    { id: 'payroll_leaves', name: 'الرواتب والإجازات', icon: Banknote },
    { id: 'settings', name: 'إعدادات النظام والأدوار', icon: Settings2 },
];

export function PermissionsMatrix() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const tenantId = user?.currentCompanyId;

    // 🛡️ رادار المهن: سحب كافة الوظائف المعرفة في الأقسام 🛡️
    const { data: jobs, loading: jobsLoading } = useSubscription<any>(
        firestore, 
        'jobs', 
        useMemo(() => [where('companyId', '==', tenantId)], [tenantId]),
        true // collectionGroup
    );

    const dynamicRoles = useMemo(() => {
        const base = ['Admin']; // المدير العام دائماً موجود
        const jobNames = (jobs || []).map(j => j.name);
        return Array.from(new Set([...base, ...jobNames]));
    }, [jobs]);

    const matrixPath = useMemo(() => tenantId ? `companies/${tenantId}/settings/permissions_matrix` : null, [tenantId]);
    const { data: currentMatrixDoc, loading: matrixLoading } = useSubscription<any>(firestore, matrixPath || null);

    const [matrix, setMatrix] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (currentMatrixDoc?.[0]) {
            setMatrix(currentMatrixDoc[0].data || {});
        }
    }, [currentMatrixDoc]);

    const togglePermission = (role: string, module: string, action: string) => {
        const key = `${role}-${module}-${action}`;
        setMatrix(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSaveMatrix = async () => {
        if (!firestore || !matrixPath || !tenantId) return;
        setIsSaving(true);
        try {
            await setDoc(doc(firestore, matrixPath), {
                data: matrix,
                updatedAt: serverTimestamp(),
                updatedBy: user?.id
            }, { merge: true });
            toast({ title: '✅ تم حفظ مصفوفة الأمان', description: 'تم تفعيل توزيع الصلاحيات للمهن الجديدة.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally { setIsSaving(false); }
    };

    const filteredModules = useMemo(() => {
        if (!searchQuery) return MODULES;
        return MODULES.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [searchQuery]);

    if (jobsLoading || matrixLoading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary h-12 w-12"/></div>;

    return (
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/95">
            <CardHeader className="bg-slate-900 text-white p-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-3xl border border-white/20 shadow-xl"><Lock className="h-8 w-8" /></div>
                        <div className="text-right">
                            <CardTitle className="text-3xl font-black">مصفوفة الصلاحيات المترابطة بالمهن</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold opacity-70">يتم إضافة أي مهنة تنشئها في "إدارة الأقسام" كعمود جديد هنا آلياً.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={handleSaveMatrix} disabled={isSaving} className="h-14 px-12 rounded-2xl font-black text-xl gap-3 bg-white text-slate-900 shadow-2xl transition-all hover:scale-105 active:scale-95">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} حفظ مصفوفة الأمان
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="p-8 border-b bg-muted/30 flex items-center justify-between no-print">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="بحث في الموديولات..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-12 rounded-2xl border-2 font-bold" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-white font-black px-4 h-8 border-2 border-primary/20 text-primary">
                            <Sparkles className="h-3 w-3 ml-2 animate-pulse"/> تم رصد {dynamicRoles.length} مهنة نشطة
                        </Badge>
                    </div>
                </div>

                <ScrollArea className="w-full">
                    <Table className="border-collapse min-w-[1200px]">
                        <TableHeader className="bg-slate-50 border-b">
                            <TableRow className="h-16">
                                <TableHead className="px-10 font-black text-slate-900 border-l sticky right-0 bg-slate-50 z-20 w-[300px]">الموديول / الشاشة</TableHead>
                                {dynamicRoles.map(role => (
                                    <TableHead key={role} className="text-center font-black text-slate-900 border-l min-w-[180px]">
                                        <div className="flex flex-col items-center">
                                            <span className="text-indigo-600 font-black text-xs">{role}</span>
                                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">View | Create | Edit | Delete</span>
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredModules.map(module => (
                                <TableRow key={module.id} className="h-20 hover:bg-muted/5 border-b last:border-0 group">
                                    <TableCell className="px-10 border-l sticky right-0 bg-white group-hover:bg-slate-50 z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors"><module.icon className="h-5 w-5" /></div>
                                            <span className="font-black text-base text-slate-800">{module.name}</span>
                                        </div>
                                    </TableCell>
                                    {dynamicRoles.map(role => (
                                        <TableCell key={`${role}-${module.id}`} className="text-center border-l bg-slate-50/10">
                                            <div className="flex items-center justify-center gap-4">
                                                <Checkbox checked={!!matrix[`${role}-${module.id}-view`]} onCheckedChange={() => togglePermission(role, module.id, 'view')} className="h-5 w-5 border-2" title="عرض" />
                                                <Checkbox checked={!!matrix[`${role}-${module.id}-create`]} onCheckedChange={() => togglePermission(role, module.id, 'create')} className="h-5 w-5 border-2 border-green-200 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" title="إضافة" />
                                                <Checkbox checked={!!matrix[`${role}-${module.id}-update`]} onCheckedChange={() => togglePermission(role, module.id, 'update')} className="h-5 w-5 border-2 border-blue-200 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" title="تعديل" />
                                                <Checkbox checked={!!matrix[`${role}-${module.id}-delete`]} onCheckedChange={() => togglePermission(role, module.id, 'delete')} className="h-5 w-5 border-2 border-red-200 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600" title="حذف" />
                                            </div>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
            <CardFooter className="p-6 bg-muted/10 border-t flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <span>Nova ERP — Sovereign Role-Based Access Control (RBAC) v4.0</span>
                <span className="flex items-center gap-2"><ShieldCheck className="h-3 w-3" /> تم تأمين مصفوفة الوصول</span>
            </CardFooter>
        </Card>
    );
}
