'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, LayoutDashboard, Calculator, Users, ShoppingCart, HardHat, Settings, Search } from 'lucide-react';
import { cn } from "@/lib/utils";
import type { Role, RolePermission } from './roles-table';

interface RoleFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (role: Partial<Role>) => Promise<void>;
    role: Role | null;
}

const ALL_PERMISSIONS: RolePermission[] = [
    // Accounting
    { id: 'acc:view', name: 'عرض المحاسبة والمالية', module: 'Accounting' },
    { id: 'acc:create_jv', name: 'إنشاء قيود يومية', module: 'Accounting' },
    { id: 'acc:view_reports', name: 'عرض التقارير المالية', module: 'Accounting' },
    { id: 'acc:manage_coa', name: 'إدارة شجرة الحسابات', module: 'Accounting' },
    { id: 'acc:manage_vouchers', name: 'إدارة السندات (قبض/صرف)', module: 'Accounting' },
    
    // HR
    { id: 'hr:view', name: 'عرض الموارد البشرية', module: 'HR' },
    { id: 'hr:manage_employees', name: 'إدارة بيانات الموظفين', module: 'HR' },
    { id: 'hr:manage_payroll', name: 'إدارة الرواتب ومسير الرواتب', module: 'HR' },
    { id: 'hr:manage_attendance', name: 'إدارة الحضور والانصراف', module: 'HR' },
    { id: 'hr:manage_leaves', name: 'إدارة الإجازات والاستئذانات', module: 'HR' },
    
    // Construction
    { id: 'con:view', name: 'عرض المشاريع والإنشاءات', module: 'Construction' },
    { id: 'con:manage_projects', name: 'إدارة المشاريع', module: 'Construction' },
    { id: 'con:site_visits', name: 'الزيارات الميدانية والتقارير اليومية', module: 'Construction' },
    { id: 'con:manage_boq', name: 'إدارة جداول الكميات (BOQ)', module: 'Construction' },
    { id: 'con:manage_subcontractors', name: 'إدارة المقاولين من الباطن', module: 'Construction' },
    
    // Purchasing & Warehouse
    { id: 'pur:view', name: 'عرض المشتريات والمخازن', module: 'Purchasing' },
    { id: 'pur:manage_requests', name: 'إدارة طلبات الشراء (RFQ/PO)', module: 'Purchasing' },
    { id: 'pur:manage_inventory', name: 'إدارة المخزون والمستودعات', module: 'Purchasing' },
    { id: 'pur:manage_vendors', name: 'إدارة الموردين', module: 'Purchasing' },
    
    // Clients & Appointments
    { id: 'cli:view', name: 'عرض العملاء والمعاملات', module: 'Clients' },
    { id: 'cli:manage_clients', name: 'إدارة بيانات العملاء', module: 'Clients' },
    { id: 'cli:manage_appointments', name: 'إدارة المواعيد والتقويم', module: 'Clients' },
    { id: 'cli:manage_contracts', name: 'إدارة العقود والاتفاقيات', module: 'Clients' },
    
    // Settings
    { id: 'set:view', name: 'عرض الإعدادات', module: 'Settings' },
    { id: 'set:manage_company', name: 'إدارة بيانات الشركة', module: 'Settings' },
    { id: 'set:manage_users', name: 'إدارة المستخدمين والأدوار', module: 'Settings' },
    { id: 'set:manage_reference', name: 'إدارة البيانات المرجعية والترقيم', module: 'Settings' },
];

const MODULE_ICONS: Record<string, any> = {
    Accounting: Calculator,
    HR: Users,
    Construction: HardHat,
    Purchasing: ShoppingCart,
    Clients: LayoutDashboard,
    Settings: Settings,
};

const MODULE_NAMES: Record<string, string> = {
    Accounting: 'المحاسبة والمالية',
    HR: 'الموارد البشرية',
    Construction: 'المشاريع والإنشاءات',
    Purchasing: 'المشتريات والمخازن',
    Clients: 'العملاء والمعاملات',
    Settings: 'إعدادات النظام',
};

export function RoleForm({ isOpen, onClose, onSave, role }: RoleFormProps) {
    const [name, setName] = useState(role?.name || '');
    const [description, setDescription] = useState(role?.description || '');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>(role?.permissions || []);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (role) {
            setName(role.name);
            setDescription(role.description || '');
            setSelectedPermissions(role.permissions || []);
        } else {
            setName('');
            setDescription('');
            setSelectedPermissions([]);
        }
    }, [role, isOpen]);

    const togglePermission = (permissionId: string) => {
        setSelectedPermissions(prev => 
            prev.includes(permissionId) 
                ? prev.filter(id => id !== permissionId)
                : [...prev, permissionId]
        );
    };

    const toggleModule = (module: string) => {
        const modulePerms = ALL_PERMISSIONS.filter(p => p.module === module).map(p => p.id);
        const allSelected = modulePerms.every(id => selectedPermissions.includes(id));
        
        if (allSelected) {
            setSelectedPermissions(prev => prev.filter(id => !modulePerms.includes(id)));
        } else {
            setSelectedPermissions(prev => Array.from(new Set([...prev, ...modulePerms])));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        
        setIsSubmitting(true);
        try {
            await onSave({
                name,
                description,
                permissions: selectedPermissions,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const groupedPermissions = ALL_PERMISSIONS.reduce((acc, curr) => {
        if (!acc[curr.module]) acc[curr.module] = [];
        if (!searchQuery || curr.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            acc[curr.module].push(curr);
        }
        return acc;
    }, {} as Record<string, RolePermission[]>);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl" className="max-w-4xl p-0 rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <DialogHeader className="p-8 px-10 bg-gradient-to-l from-blue-600 to-blue-500 text-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                                <Shield className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black">{role ? 'تعديل الدور' : 'إضافة دور جديد'}</DialogTitle>
                                <p className="text-blue-50/80 font-medium">حدد اسم الدور والصلاحيات الممنوحة له بدقة.</p>
                            </div>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 p-8 px-10">
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-lg font-black text-gray-700">اسم الدور (نوع النشاط) <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="مثال: مهندس موقع، محاسب أول..."
                                        className="h-12 rounded-xl font-bold border-gray-200 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description" className="text-lg font-black text-gray-700">وصف مختصر</Label>
                                    <Input
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="وصف طبيعة عمل هذا الدور..."
                                        className="h-12 rounded-xl font-bold border-gray-200 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b pb-4">
                                    <h3 className="text-xl font-black text-blue-900">تخصيص الصلاحيات</h3>
                                    <div className="relative w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="بحث في الصلاحيات..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10 h-10 rounded-xl bg-gray-50 border-none font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(groupedPermissions).map(([module, perms]) => {
                                        if (perms.length === 0) return null;
                                        const Icon = MODULE_ICONS[module] || Shield;
                                        const modulePermIds = ALL_PERMISSIONS.filter(p => p.module === module).map(p => p.id);
                                        const isAllSelected = modulePermIds.every(id => selectedPermissions.includes(id));
                                        
                                        return (
                                            <Card key={module} className="rounded-3xl border-gray-100 shadow-sm overflow-hidden">
                                                <CardHeader className="p-4 bg-muted/30 border-b flex flex-row items-center justify-between space-y-0">
                                                    <div className="flex items-center gap-2">
                                                        <Icon className="h-5 w-5 text-blue-600" />
                                                        <CardTitle className="text-base font-black text-gray-800">{MODULE_NAMES[module]}</CardTitle>
                                                    </div>
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => toggleModule(module)}
                                                        className="text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg"
                                                    >
                                                        {isAllSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-4 space-y-3">
                                                    {perms.map((permission) => (
                                                        <div key={permission.id} className="flex items-center gap-3 group">
                                                            <Checkbox
                                                                id={permission.id}
                                                                checked={selectedPermissions.includes(permission.id)}
                                                                onCheckedChange={() => togglePermission(permission.id)}
                                                                className="rounded-md border-2 border-blue-100 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                            />
                                                            <Label
                                                                htmlFor={permission.id}
                                                                className="text-sm font-bold text-gray-600 group-hover:text-blue-700 cursor-pointer transition-colors"
                                                            >
                                                                {permission.name}
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-8 px-10 border-t bg-gray-50/50 shrink-0 flex gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold h-12 px-8">تراجع</Button>
                        <Button 
                            type="submit" 
                            disabled={isSubmitting || !name.trim()}
                            className="rounded-xl font-black h-12 px-12 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100"
                        >
                            {isSubmitting ? 'جاري الحفظ...' : role ? 'تحديث الدور' : 'حفظ الدور الجديد'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
