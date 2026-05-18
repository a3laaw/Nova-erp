'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, ShieldCheck, Search, Pencil, Trash2, UserX, UserCheck, Loader2, Sparkles, Banknote } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { UserForm } from './user-form';
import type { UserProfile, Employee } from '@/lib/types';
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
import { useFirebase } from '@/firebase';
import { collection, doc, updateDoc, serverTimestamp, getDocs, query, orderBy, where, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '../ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { cn, cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { useCompany } from '@/context/company-context';

const roleTranslations: Record<UserProfile['role'], string> = {
    Admin: 'مدير نظام',
    Engineer: 'مهندس تنفيذ',
    Accountant: 'محاسب مالي',
    Secretary: 'سكرتارية',
    HR: 'موارد بشرية',
    Developer: 'مطور سيادي',
    User: 'مستخدم'
};

const roleColors: Record<UserProfile['role'], string> = {
    Admin: 'bg-red-50 text-red-700 border-red-100',
    Engineer: 'bg-blue-50 text-blue-700 border-blue-100',
    Accountant: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    Secretary: 'bg-purple-50 text-purple-700 border-purple-100',
    HR: 'bg-pink-50 text-pink-700 border-pink-100',
    Developer: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    User: 'bg-slate-50 text-slate-700 border-slate-100',
};

interface UserWithEmployee extends UserProfile {
    employeeFullName?: string;
    employeeCivilId?: string;
}

export function UsersTable() {
    const { firestore, auth } = useFirebase();
    const { user: currentUser } = useAuth();
    const { currentCompany } = useCompany();
    const { toast } = useToast();

    const [users, setUsers] = useState<UserWithEmployee[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [userToToggle, setUserToToggle] = useState<UserWithEmployee | null>(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);

    const tenantId = currentUser?.currentCompanyId;

    const fetchUsersAndEmployees = useCallback(async () => {
        if (!firestore || !tenantId) return;
        setLoading(true);
        try {
            const employeesPath = getTenantPath('employees', tenantId);
            const usersPath = getTenantPath('users', tenantId);

            const [employeesSnapshot, usersSnapshot] = await Promise.all([
                getDocs(query(collection(firestore, employeesPath), orderBy('fullName'))),
                getDocs(query(collection(firestore, usersPath), orderBy('createdAt', 'desc')))
            ]);

            const empList = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            setEmployees(empList);

            const usersList = usersSnapshot.docs.map(doc => {
                const userData = { id: doc.id, ...doc.data() } as UserProfile;
                const employee = empList.find(e => e.id === userData.employeeId);
                return {
                    ...userData,
                    employeeFullName: employee?.fullName,
                    employeeCivilId: employee?.civilId,
                };
            });
            setUsers(usersList);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ في التحميل', description: 'فشل جلب قائمة المستخدمين.' });
        } finally {
            setLoading(false);
        }
    }, [firestore, tenantId, toast]);

    useEffect(() => {
        if (tenantId) fetchUsersAndEmployees();
    }, [tenantId, fetchUsersAndEmployees]);

    const filteredUsers = useMemo(() => {
        if (!searchQuery) return users;
        const lower = searchQuery.toLowerCase();
        return users.filter(u => 
            u.username.toLowerCase().includes(lower) || 
            u.employeeFullName?.toLowerCase().includes(lower)
        );
    }, [users, searchQuery]);

    const quotaInfo = useMemo(() => {
        const totalLimit = currentCompany?.maxUsersLimit || 5;
        const usedCount = users.length;
        return {
            totalLimit,
            usedCount,
            isFull: usedCount >= totalLimit,
        };
    }, [currentCompany, users]);

    /**
     * محرك الحفظ السيادي:
     * يستدعي الـ API لإنشاء حساب Auth وتوثيق الفهرس العالمي والمنشأة في وقت واحد.
     */
    const handleSaveUser = async (userData: Partial<UserProfile> & { newPassword?: string }) => {
        if (!firestore || !auth?.currentUser || !tenantId || savingRef.current) return;
        
        savingRef.current = true;
        setIsSaving(true);

        try {
            const idToken = await auth.currentUser.getIdToken();
            
            // 🚀 استدعاء محرك إدارة الهوية الآمن (API)
            const response = await fetch('/api/manage-tenant-user', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ 
                    action: 'create_tenant_user',
                    companyId: tenantId,
                    email: userData.email,
                    password: userData.newPassword,
                    displayName: userData.fullName,
                    username: userData.username,
                    role: userData.role,
                    employeeId: userData.employeeId
                })
            });

            const result = await response.json();
            if (result.success) {
                toast({ title: '✅ تم تفعيل الحساب', description: 'تم إنشاء حساب الموظف وفهرسته بنجاح.' });
                setIsFormOpen(false);
                fetchUsersAndEmployees();
            } else {
                throw new Error(result.error || 'فشل محرك التفعيل في السيرفر.');
            }
        } catch (error: any) {
            console.error("IAM Engine Error:", error);
            toast({ 
                variant: 'destructive', 
                title: 'خطأ في التفعيل', 
                description: error.message || 'حدث خطأ أثناء محاولة تأسيس الحساب.' 
            });
        } finally {
            setIsSaving(false);
            savingRef.current = false;
        }
    };
    
    const handleToggleActivation = async (user: UserWithEmployee) => {
        if (!firestore || !tenantId) return;
        const usersPath = getTenantPath(`users/${user.id}`, tenantId);
        try {
            await updateDoc(doc(firestore, usersPath), { 
                isActive: !user.isActive,
                updatedAt: serverTimestamp()
            });
            toast({ title: 'نجاح الإجراء', description: 'تم تحديث حالة الحساب.' });
            fetchUsersAndEmployees();
        } catch (e) {
            toast({ variant: 'destructive', title: 'عائق صلاحيات' });
        }
    };

    const handleDeleteUser = async (user: UserWithEmployee) => {
        if (!firestore || !tenantId || !confirm(`سيتم حذف حساب ${user.username} نهائياً. هل أنت متأكد؟`)) return;
        
        try {
            const batch = writeBatch(firestore);
            const userRef = doc(firestore, getTenantPath(`users/${user.id}`, tenantId));
            batch.delete(userRef);

            const globalQuery = query(collection(firestore, 'global_users'), where('email', '==', user.email));
            const globalSnap = await getDocs(globalQuery);
            globalSnap.forEach(d => batch.delete(d.ref));

            await batch.commit();
            toast({ title: 'تم الحذف', description: 'تم مسح الحساب وفهرسته بالكامل.' });
            fetchUsersAndEmployees();
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ في الحذف' });
        }
    };

    return (
    <div className="space-y-8" dir="rtl">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                    <ShieldCheck className="h-8 w-8" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-[#1e1b4b]">إدارة حسابات الموظفين</h2>
                    <p className="text-sm font-bold text-slate-500 mt-1">تفعيل صلاحيات الدخول للمهندسين والمحاسبين داخل المنشأة.</p>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-white/50 p-2 rounded-2xl border shadow-inner">
                <div className="px-6 py-1 border-l border-slate-200 text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">تراخيص المستخدمين</p>
                    <div className="flex items-center justify-center gap-2">
                        <span className={cn("text-2xl font-black font-mono", quotaInfo.isFull ? "text-red-600" : "text-primary")}>
                            {quotaInfo.usedCount}
                        </span>
                        <span className="text-slate-400 font-black text-xl">/</span>
                        <span className="text-slate-500 font-black text-2xl font-mono">
                            {quotaInfo.totalLimit}
                        </span>
                    </div>
                </div>
                <Button 
                    onClick={() => { setSelectedUser(null); setIsFormOpen(true); }} 
                    disabled={quotaInfo.isFull || loading}
                    className="h-12 rounded-xl font-black gap-2 shadow-lg"
                >
                    <PlusCircle className="h-5 w-5" /> إضافة مستخدم
                </Button>
            </div>
        </div>

        <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-muted/10 border-b p-8 px-10">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1e1b4b] opacity-40" />
                    <Input
                        placeholder="بحث بالاسم أو اسم المستخدم..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-12 rounded-2xl bg-white border-none shadow-inner font-black text-[#1e1b4b]"
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-[#F8F9FE] h-14">
                        <TableRow className="border-none">
                            <TableHead className="px-10 font-black text-[#7209B7]">حساب الدخول (Username)</TableHead>
                            <TableHead className="font-black text-[#7209B7]">الموظف المرتبط</TableHead>
                            <TableHead className="font-black text-[#7209B7]">الدور</TableHead>
                            <TableHead className="font-black text-[#7209B7] text-center">الحالة</TableHead>
                            <TableHead className="w-[100px] text-center font-black text-[#7209B7]">إجراء</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={5} className="px-10 py-6"><Skeleton className="h-10 w-full rounded-2xl" /></TableCell></TableRow>
                            ))
                        ) : filteredUsers.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="h-48 text-center text-slate-300 font-black italic">لم يتم العثور على حسابات.</TableCell></TableRow>
                        ) : (
                            filteredUsers.map((user) => (
                                <TableRow key={user.id} className="hover:bg-primary/[0.02] transition-colors h-24 border-b last:border-0 group">
                                    <TableCell className="px-10">
                                        <div className="flex flex-col">
                                            <span className="font-mono text-lg font-black text-[#1e1b4b]">@{user.username}</span>
                                            <span className="text-[9px] text-slate-400 font-mono opacity-60">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-black text-slate-800">{user.employeeFullName || 'غير مرتبط بملف'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("px-4 py-1 rounded-xl font-black text-[10px] border-2", roleColors[user.role])}>
                                            {roleTranslations[user.role]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={user.isActive ? 'default' : 'secondary'} className={cn("px-4 py-1 rounded-xl font-black text-[10px]", user.isActive ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500')}>
                                            {user.isActive ? 'نشط' : 'موقف'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                       {currentUser?.id !== user.id && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl border bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-5 w-5" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" dir="rtl" className="rounded-2xl shadow-2xl border-none p-2 bg-white/95 backdrop-blur-xl">
                                                <DropdownMenuLabel className="font-black px-3 py-2 text-[#1e1b4b]">إدارة الحساب</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => { setSelectedUser(user); setIsFormOpen(true); }} className="gap-2 rounded-xl py-3 font-bold text-[#1e1b4b]">
                                                    <Pencil className="h-4 w-4 text-primary" /> تعديل البيانات
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleToggleActivation(user)} className={cn("gap-2 rounded-xl py-3 font-bold", user.isActive ? "text-orange-600" : "text-green-600")}>
                                                    {user.isActive ? <UserX className="h-4 w-4"/> : <UserCheck className="h-4 w-4"/>}
                                                    {user.isActive ? 'إيقاف الدخول' : 'تفعيل الدخول'}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-red-600 gap-2 rounded-xl py-3 font-bold focus:bg-red-50" onClick={() => handleDeleteUser(user)}>
                                                    <Trash2 className="h-4 w-4" /> حذف الحساب نهائياً
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                       )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        
        {isFormOpen && (
            <UserForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSave={handleSaveUser}
                user={selectedUser}
                employees={employees}
                allUsers={users}
                isSaving={isSaving}
            />
        )}
    </div>
    );
}
