'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, ShieldCheck, ArrowRight, Search, Pencil, Trash2, Key } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { useFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, query, orderBy, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '../ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { RoleForm } from './role-form';

export interface RolePermission {
    id: string;
    name: string;
    module: 'Accounting' | 'HR' | 'Purchasing' | 'Construction' | 'Clients' | 'Settings' | 'All';
}

export interface Role {
    id?: string;
    name: string;
    description?: string;
    permissions: string[]; // IDs of permissions
    companyId: string;
    createdAt?: any;
}

export function RolesTable() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);

    const fetchRoles = useCallback(async () => {
        if (!firestore || !currentUser?.companyId) return;
        setLoading(true);
        try {
            const rolesRef = collection(firestore, 'roles');
            const q = query(
                rolesRef, 
                where('companyId', '==', currentUser.companyId),
                orderBy('name', 'asc')
            );
            const querySnapshot = await getDocs(q);
            const rolesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
            setRoles(rolesList);
        } catch (error) {
            console.error("Error fetching roles:", error);
            toast({ variant: 'destructive', title: 'خطأ في جلب الأدوار' });
        } finally {
            setLoading(false);
        }
    }, [firestore, currentUser?.companyId, toast]);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);

    const filteredRoles = useMemo(() => {
        if (!searchQuery) return roles;
        const lower = searchQuery.toLowerCase();
        return roles.filter(r => 
            r.name.toLowerCase().includes(lower) || 
            r.description?.toLowerCase().includes(lower)
        );
    }, [roles, searchQuery]);

    const handleSaveRole = async (roleData: Partial<Role>) => {
        if (!firestore || !currentUser?.companyId) return;
        try {
            if (selectedRole?.id) { 
                await updateDoc(doc(firestore, 'roles', selectedRole.id), roleData);
                toast({ title: 'نجاح التحديث', description: 'تم تحديث بيانات الدور بنجاح.' });
            } else { 
                await addDoc(collection(firestore, 'roles'), {
                    ...roleData,
                    companyId: currentUser.companyId,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                });
                toast({ title: 'تم الإنشاء', description: 'تم إنشاء الدور الجديد بنجاح.' });
            }
            setIsFormOpen(false);
            fetchRoles();
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        }
    };

    const handleDeleteRole = async (roleId: string) => {
        if (!firestore) return;
        if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الدور؟ لا يمكن التراجع عن هذا الإجراء.')) return;
        
        try {
            await deleteDoc(doc(firestore, 'roles', roleId));
            toast({ title: 'تم الحذف', description: 'تم حذف الدور بنجاح.' });
            fetchRoles();
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ في الحذف' });
        }
    };

    return (
    <div className="space-y-8" dir="rtl">
        <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-blue-50 dark:from-card dark:to-card">
            <CardHeader className="pb-8 px-8 border-b">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-600 shadow-inner">
                            <Key className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black text-blue-900">إدارة الأدوار (أنواع النشاط)</CardTitle>
                            <CardDescription className="text-base font-medium">حدد أنواع الأنشطة في شركتك وخصص لكل منها الصلاحيات المناسبة.</CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => router.back()} variant="ghost" className="rounded-xl font-bold gap-2 text-blue-700 hover:bg-blue-50">
                            <ArrowRight className="h-4 w-4" /> العودة
                        </Button>
                        <Button onClick={() => { setSelectedRole(null); setIsFormOpen(true); }} className="h-11 px-8 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-blue-100 bg-blue-600 hover:bg-blue-700">
                            <PlusCircle className="h-5 w-5" /> إضافة دور جديد
                        </Button>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-muted/10 border-b p-8 px-10">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                    <Input
                        placeholder="بحث باسم الدور..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-12 rounded-2xl bg-white border-none shadow-inner font-bold"
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="h-14">
                            <TableHead className="px-10 font-black text-gray-800">اسم الدور (نوع النشاط)</TableHead>
                            <TableHead className="font-black text-gray-800">الوصف</TableHead>
                            <TableHead className="font-black text-gray-800 text-center">عدد الصلاحيات</TableHead>
                            <TableHead className="w-[100px] text-center"><span className="sr-only">الإجراءات</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={4} className="px-10 py-6"><Skeleton className="h-10 w-full rounded-2xl" /></TableCell></TableRow>
                            ))
                        ) : filteredRoles.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="h-64 text-center text-muted-foreground italic font-bold">لا توجد أدوار معرفة حالياً.</TableCell></TableRow>
                        ) : (
                            filteredRoles.map((role) => (
                                <TableRow key={role.id} className="hover:bg-primary/5 transition-colors h-24 border-b last:border-0 group">
                                    <TableCell className="px-10">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                                                <ShieldCheck className="h-5 w-5" />
                                            </div>
                                            <span className="font-black text-lg text-gray-800">{role.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-muted-foreground font-medium">{role.description || 'لا يوجد وصف'}</span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="px-4 py-1 rounded-xl font-black text-blue-700 bg-blue-50 border-blue-100">
                                            {role.permissions?.length || 0} صلاحية
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl border bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-5 w-5" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" dir="rtl" className="rounded-2xl shadow-2xl border-none p-2">
                                                <DropdownMenuLabel className="font-black px-3 py-2">خيارات الدور</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => { setSelectedRole(role); setIsFormOpen(true); }} className="gap-2 rounded-xl py-3 font-bold">
                                                    <Pencil className="h-4 w-4 text-primary" /> تعديل الصلاحيات
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleDeleteRole(role.id!)} className="text-destructive gap-2 rounded-xl py-3 font-bold focus:bg-red-50">
                                                    <Trash2 className="h-4 w-4" /> حذف الدور
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        
        {isFormOpen && (
            <RoleForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSave={handleSaveRole}
                role={selectedRole}
            />
        )}
    </div>
    );
}
