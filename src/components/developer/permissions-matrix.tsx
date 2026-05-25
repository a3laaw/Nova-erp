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
    Lock
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn, cleanFirestoreData } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

/**
 * مصفوفة الصلاحيات التفاعلية (Permissions Matrix V32.0):
 * التحكم في 4 عمليات أساسية (عرض، إضافة، تعديل، حذف) لكل فئة وظيفية.
 */

const ROLES = ['Admin', 'Accountant', 'Engineer', 'HR', 'Secretary'];

const MODULES = [
    { id: 'dashboard', name: 'لوحة التحكم (Dashboard)', icon: LayoutDashboard },
    { id: 'clients', name: 'إدارة العملاء والـ CRM', icon: Users },
    { id: 'accounting', name: 'المحاسبة والمالية', icon: Calculator },
    { id: 'construction', name: 'المقاولات والمشاريع', icon: HardHat },
    { id: 'warehouse', name: 'المخازن والمشتريات', icon: ShoppingCart },
    { id: 'hr', name: 'الموارد البشرية والرواتب', icon: ShieldCheck },
    { id: 'settings', name: 'إعدادات النظام', icon: Settings2 },
];

export function PermissionsMatrix() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // جلب مصفوفة الصلاحيات الحالية من Firestore
    const matrixPath = useMemo(() => user?.currentCompanyId ? `companies/${user.currentCompanyId}/settings/permissions_matrix` : null, [user?.currentCompanyId]);
    const { data: currentMatrixDoc } = useSubscription<any>(firestore, matrixPath || null);

    // الحالة المحلية للمصفوفة (index: role_id-module_id-action)
    const [matrix, setMatrix] = useState<Record<string, boolean>>({});

    // تحديث الحالة عند وصول البيانات من الخادم
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
            toast({ title: '✅ تم حفظ مصفوفة الأمان', description: 'تم تحديث صلاحيات الوصول لكافة فئات الموظفين.' });
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
                            <CardTitle className="text-2xl font-black">مصفوفة الصلاحيات والأمان</CardTitle>
                            <CardDescription className="text-indigo-200 font-bold opacity-70">إدارة العلاقة بين الفئة الوظيفية والعمليات المتاحة في النظام.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={handleSaveMatrix} disabled={isSaving} className="h-14 px-12 rounded-2xl font-black text-xl gap-3 bg-white text-slate-900 hover:bg-slate-50 shadow-2xl">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                        حفظ مصفوفة الصلاحيات
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="p-8 border-b bg-muted/30 flex items-center justify-between no-print">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="بحث في الشاشات والموديولات..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-11 rounded-xl border-2" />
                    </div>
                    <div className="flex gap-4">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-bold px-3">E: إضافة</Badge>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-bold px-3">M: تعديل</Badge>
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-bold px-3">D: حذف</Badge>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 border-b">
                            <TableRow className="h-14">
                                <TableHead className="px-10 font-black text-slate-900 border-l min-w-[250px]">الموديول / الشاشة</TableHead>
                                {ROLES.map(role => (
                                    <TableHead key={role} className="text-center font-black text-slate-900 border-l">
                                        <div className="flex flex-col items-center">
                                            <span className="text-indigo-600 font-black">{role}</span>
                                            <span className="text-[9px] text-slate-400 font-bold">عرض | إضافة | تعديل | حذف</span>
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
                                            <span className="font-bold text-slate-800">{module.name}</span>
                                        </div>
                                    </TableCell>
                                    {ROLES.map(role => (
                                        <TableCell key={`${role}-${module.id}`} className="text-center border-l bg-slate-50/20">
                                            <div className="flex items-center justify-center gap-3 px-4">
                                                <PermissionCheck label="V" checked={!!matrix[`${role}-${module.id}-view`]} onChange={() => togglePermission(role, module.id, 'view')} />
                                                <PermissionCheck label="E" checked={!!matrix[`${role}-${module.id}-create`]} onChange={() => togglePermission(role, module.id, 'create')} color="text-green-600" />
                                                <PermissionCheck label="M" checked={!!matrix[`${role}-${module.id}-edit`]} onChange={() => togglePermission(role, module.id, 'edit')} color="text-blue-600" />
                                                <PermissionCheck label="D" checked={!!matrix[`${role}-${module.id}-delete`]} onChange={() => togglePermission(role, module.id, 'delete')} color="text-red-600" />
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

function PermissionCheck({ label, checked, onChange, color = "text-indigo-600" }: any) {
    return (
        <div className="flex flex-col items-center gap-1.5">
            <span className={cn("text-[9px] font-black", color)}>{label}</span>
            <Checkbox checked={checked} onCheckedChange={onChange} className="rounded-md h-5 w-5 border-2" />
        </div>
    );
}

