
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { 
    ShieldCheck, 
    Save, 
    Loader2, 
    Search,
    Users,
    Calculator,
    HardHat,
    ShoppingCart,
    LayoutDashboard,
    Settings2,
    Lock,
    Clock,
    FileSignature,
    Workflow,
    MapPin,
    Coins,
    BookOpen,
    Landmark,
    TrendingUp
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn, cleanFirestoreData } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

/**
 * مصفوفة الصلاحيات التفاعلية المحدثة (Matrix V134.0):
 * تم تحديث الأدوار والموديولات لتطابق المصفوفة الإدارية المعتمدة.
 */

const ROLES = ['Admin', 'CFO', 'ProjectManager', 'EngineeringManager', 'Engineer', 'Accountant', 'Secretary', 'Surveyor'];

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

    const matrixPath = useMemo(() => user?.currentCompanyId ? `companies/${user.currentCompanyId}/settings/permissions_matrix` : null, [user?.currentCompanyId]);
    const { data: currentMatrixDoc } = useSubscription<any>(firestore, matrixPath || null);

    const [matrix, setMatrix] = useState<Record<string, boolean>>({});

    useMemo(() => {
        if (currentMatrixDoc?.[0]) {
            setMatrix(currentMatrixDoc[0].data || {});
        }
    }, [currentMatrixDoc]);

    const togglePermission = (role: string, module: string, action: string) => {
        const key = `${role}-${module}-${action}`;
        setMatrix(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSaveMatrix = async () => {
        if (!firestore || !matrixPath || !user?.currentCompanyId) return;
        setIsSaving(true);
        try {
            await setDoc(doc(firestore, matrixPath), {
                data: matrix,
                updatedAt: serverTimestamp(),
                updatedBy: user.id
            }, { merge: true });
            toast({ title: '✅ تم حفظ مصفوفة الأمان' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        } finally { setIsSaving(false); }
    };

    const filteredModules = useMemo(() => {
        if (!searchQuery) return MODULES;
        return MODULES.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [searchQuery]);

    return (
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/95">
            <CardHeader className="bg-slate-900 text-white p-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-3xl border border-white/20 shadow-xl"><Lock className="h-8 w-8" /></div>
                        <div className="text-right">
                            <CardTitle className="text-2xl font-black">مصفوفة الصلاحيات والأدوار المحدثة</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold opacity-70">إدارة الأدوار الجديدة (مدير مشاريع، مساح، إلخ) وتخصيص الوصول.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={handleSaveMatrix} disabled={isSaving} className="h-14 px-12 rounded-2xl font-black text-xl gap-3 bg-white text-slate-900 shadow-2xl">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />} حفظ مصفوفة الأمان
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="p-8 border-b bg-muted/30 flex items-center justify-between no-print">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="بحث في الموديولات..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-11 rounded-xl border-2 font-bold" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 border-b">
                            <TableRow className="h-14">
                                <TableHead className="px-10 font-black text-slate-900 border-l min-w-[250px]">الموديول / الشاشة</TableHead>
                                {ROLES.map(role => (
                                    <TableHead key={role} className="text-center font-black text-slate-900 border-l min-w-[150px]">
                                        <div className="flex flex-col items-center">
                                            <span className="text-indigo-600 font-black">{role}</span>
                                            <span className="text-[8px] text-slate-400 font-bold">V | C | U | D</span>
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredModules.map(module => (
                                <TableRow key={module.id} className="h-20 hover:bg-muted/5 border-b last:border-0">
                                    <TableCell className="px-10 border-l">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-100 rounded-xl text-slate-500"><module.icon className="h-5 w-5" /></div>
                                            <span className="font-black text-sm text-slate-800">{module.name}</span>
                                        </div>
                                    </TableCell>
                                    {ROLES.map(role => (
                                        <TableCell key={`${role}-${module.id}`} className="text-center border-l bg-slate-50/20">
                                            <div className="flex items-center justify-center gap-3">
                                                <Checkbox checked={!!matrix[`${role}-${module.id}-view`]} onCheckedChange={() => togglePermission(role, module.id, 'view')} className="h-4 w-4" />
                                                <Checkbox checked={!!matrix[`${role}-${module.id}-create`]} onCheckedChange={() => togglePermission(role, module.id, 'create')} className="h-4 w-4 border-green-200 data-[state=checked]:bg-green-600" />
                                                <Checkbox checked={!!matrix[`${role}-${module.id}-update`]} onCheckedChange={() => togglePermission(role, module.id, 'update')} className="h-4 w-4 border-blue-200 data-[state=checked]:bg-blue-600" />
                                                <Checkbox checked={!!matrix[`${role}-${module.id}-delete`]} onCheckedChange={() => togglePermission(role, module.id, 'delete')} className="h-4 w-4 border-red-200 data-[state=checked]:bg-red-600" />
                                            </div>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

function ListTree(props: any) { return <ListTreeIcon {...props} /> }
import { ListTree as ListTreeIcon, Banknote } from 'lucide-react';
