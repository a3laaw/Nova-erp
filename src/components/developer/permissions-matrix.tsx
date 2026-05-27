'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
    Sparkles,
    Eye,
    Zap,
    Waves,
    UserCheck
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn, getTenantPath } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';

/**
 * مصفوفة الصلاحيات السيادية (The Ultimate Sovereign Matrix V147.0):
 * - تم إصلاح أخطاء الاستيراد (Select Components).
 * - ربط ديناميكي بكافة المهن المضافة في المنظومة.
 * - دعم مستويات النفاذ (كامل، عرض، جزئي، مخفي).
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
    { id: 'liquidity_radar', name: 'رادار السيولة', icon: Waves },
    { id: 'wbs_mgmt', name: 'إدارة المشاريع (WBS)', icon: Zap },
    { id: 'tasks_scheduling', name: 'المهام والجدولة', icon: Activity },
    { id: 'hr_employees', name: 'HR - إدارة الموظفين', icon: UserCheck },
    { id: 'payroll_leaves', name: 'الرواتب والإجازات', icon: Banknote },
    { id: 'settings', name: 'إعدادات النظام + الأدوار', icon: Settings2 },
];

export function PermissionsMatrix() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const tenantId = user?.currentCompanyId;

    // جلب المهن المعرفة في الأقسام
    const { data: jobs, loading: jobsLoading } = useSubscription<any>(
        firestore, 
        'jobs', 
        useMemo(() => [where('companyId', '==', tenantId)], [tenantId]),
        true 
    );

    const dynamicRoles = useMemo(() => {
        const base = ['Admin', 'مدير مالي', 'مدير مشاريع', 'مدير هندسي', 'محاسب', 'سكرتير', 'مساح ميداني'];
        const jobNames = (jobs || []).map(j => j.name);
        return Array.from(new Set([...base, ...jobNames]));
    }, [jobs]);

    const matrixPath = useMemo(() => tenantId ? `companies/${tenantId}/settings/permissions_matrix` : null, [tenantId]);
    const { data: currentMatrixDoc, loading: matrixLoading } = useSubscription<any>(firestore, matrixPath || null);

    const [matrix, setMatrix] = useState<Record<string, string>>({});

    useEffect(() => {
        if (currentMatrixDoc?.[0]) {
            setMatrix(currentMatrixDoc[0].data || {});
        }
    }, [currentMatrixDoc]);

    const handlePermissionChange = (role: string, moduleId: string, value: string) => {
        const key = `${role}-${moduleId}`;
        setMatrix(prev => ({ ...prev, [key]: value }));
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
            toast({ title: '✅ تم تفعيل مصفوفة الأمان' });
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
                            <CardTitle className="text-3xl font-black text-white">مصفوفة الرتب والصلاحيات السيادية</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold opacity-70">تحكم كامل في نفاذ الموظفين والمديرين لكافة أجزاء المنظومة.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={handleSaveMatrix} disabled={isSaving} className="h-14 px-12 rounded-2xl font-black text-xl gap-3 bg-white text-slate-900 shadow-2xl transition-all hover:scale-105 active:scale-95">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} حفظ وتفعيل المصفوفة
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
                            <Sparkles className="h-3 w-3 ml-2 animate-pulse"/> تم رصد {dynamicRoles.length} رتبة وظيفية
                        </Badge>
                    </div>
                </div>

                <ScrollArea className="w-full">
                    <Table className="border-collapse min-w-[1500px]">
                        <TableHeader className="bg-slate-50 border-b">
                            <TableRow className="h-16">
                                <TableHead className="px-10 font-black text-slate-900 border-l sticky right-0 bg-slate-50 z-20 w-[300px]">الموديول / الشاشة</TableHead>
                                {dynamicRoles.map(role => (
                                    <TableHead key={role} className="text-center font-black text-indigo-600 border-l min-w-[150px]">{role}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredModules.map(module => (
                                <TableRow key={module.id} className="h-20 hover:bg-muted/5 border-b group">
                                    <TableCell className="px-10 border-l sticky right-0 bg-white group-hover:bg-slate-50 z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors"><module.icon className="h-5 w-5" /></div>
                                            <span className="font-black text-base text-slate-800">{module.name}</span>
                                        </div>
                                    </TableCell>
                                    {dynamicRoles.map(role => {
                                        const value = matrix[`${role}-${module.id}`] || 'none';
                                        return (
                                            <TableCell key={`${role}-${module.id}`} className="text-center border-l bg-slate-50/10 px-4">
                                                <Select value={value} onValueChange={(v) => handlePermissionChange(role, module.id, v)}>
                                                    <SelectTrigger className={cn(
                                                        "h-9 rounded-xl font-black text-[10px] border-2",
                                                        value === 'full' ? "bg-green-600 text-white border-green-600" :
                                                        value === 'partial' ? "bg-blue-600 text-white border-blue-600" :
                                                        value === 'view' ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                                                        "bg-white text-slate-300 border-slate-100"
                                                    )}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent dir="rtl">
                                                        <SelectItem value="full" className="font-black text-green-600">كامل (تحكم)</SelectItem>
                                                        <SelectItem value="partial" className="font-black text-blue-600">جزئي (ما يخصه)</SelectItem>
                                                        <SelectItem value="view" className="font-black text-indigo-600">عرض فقط</SelectItem>
                                                        <SelectItem value="none" className="font-black text-slate-400">- مخفي تماماً -</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
        </Card>
    );
}