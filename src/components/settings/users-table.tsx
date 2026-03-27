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
import { MoreHorizontal, PlusCircle, UserCircle, ShieldCheck, ArrowRight, Search, Pencil, Trash2, Lock, UserX, UserCheck } from 'lucide-react';
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
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, query, orderBy, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '../ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

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
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [users, setUsers] = useState<UserWithEmployee[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [userToToggle, setUserToToggle] = useState<UserWithEmployee | null>(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

    const fetchEmployees = useCallback(async () => {
        if (!firestore) return [];
        try {
            const employeesSnapshot = await getDocs(query(collection(firestore, 'employees'), orderBy('fullName')));
            const employeesList = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            setEmployees(employeesList);
            return employeesList;
        } catch (error) {
            return [];
        }
    }, [firestore]);
    

    const fetchUsersAndEmployees = useCallback(async () => {
        if (!firestore) return;
        setLoading(true);
        try {
            const fetchedEmployees = await fetchEmployees();
            const usersSnapshot = await getDocs(query(collection(firestore, 'users'), orderBy('createdAt', 'desc')));
            const usersList = usersSnapshot.docs.map(doc => {
                const userData = { id: doc.id, ...doc.data() } as UserProfile;
                const employee = fetchedEmployees.find(e => e.id === userData.employeeId);
                return {
                    ...userData,
                    employeeFullName: employee?.fullName,
                    employeeCivilId: employee?.civilId,
                };
            });
            setUsers(usersList);
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ في جلب المستخدمين' });
        } finally {
            setLoading(false);
        }
    }, [firestore, toast, fetchEmployees]);

    useEffect(() => {
        if (firestore && (currentUser?.role === 'Admin' || currentUser?.role === 'Developer')) {
            fetchUsersAndEmployees();
        } else {
            setLoading(false);
        }
    }, [firestore, currentUser, fetchUsersAndEmployees]);

    const filteredUsers = useMemo(() => {
        if (!searchQuery) return users;
        const lower = searchQuery.toLowerCase();
        return users.filter(u => 
            u.username.toLowerCase().includes(lower) || 
            u.employeeFullName?.toLowerCase().includes(lower)
        );
    }, [users, searchQuery]);

    const handleSaveUser = async (userData: Partial<UserProfile>) => {
        if (!firestore || !currentUser) return;
        try {
            const usernameQuery = query(collection(firestore, 'users'), where('username', '==', userData.username));
            const querySnapshot = await getDocs(usernameQuery);
            if (!querySnapshot.empty && (!selectedUser || querySnapshot.docs[0].id !== selectedUser.id)) {
                 toast({ variant: 'destructive', title: 'خطأ', description: 'اسم المستخدم مكرر.' });
                 return;
            }

            if (selectedUser) { 
                await updateDoc(doc(firestore, 'users', selectedUser.id!), userData);
                toast({ title: 'نجاح التحديث', description: 'تم تحديث بيانات الحساب.' });
            } else { 
                await addDoc(collection(firestore, 'users'), {
                    ...userData,
                    email: `${userData.username}@scoop.local`,
                    isActive: false, 
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                });
                toast({ title: 'تم الإنشاء', description: 'تم إنشاء الحساب، يرجى تفعيله من قائمة الإجراءات.' });
            }
            setIsFormOpen(false);
            fetchUsersAndEmployees();
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
        }
    };
    
    const handleToggleActivationConfirm = async () => {
        if (!userToToggle || !firestore) return;
        const newStatus = !userToToggle.isActive;
        try {
            await updateDoc(doc(firestore, 'users', userToToggle.id!), { 
                isActive: newStatus,
                ...(newStatus && !userToToggle.activatedAt && { activatedAt: serverTimestamp() })
            });
            toast({ title: 'نجاح الإجراء', description: `تم ${newStatus ? 'تفعيل' : 'إلغاء تفعيل'} الحساب بنجاح.` });
            fetchUsersAndEmployees();
        } finally {
            setIsAlertOpen(false);
            setUserToToggle(null);
        }
    };

    const handleEditUser = (user: UserProfile) => {
        setSelectedUser(user);
        setIsFormOpen(true);
    };

    const handleToggleActivationClick = (user: UserWithEmployee) => {
        setUserToToggle(user);
        setIsAlertOpen(true);
    };

    return (
    <div className="space-y-8" dir="rtl">
        <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-blue-50 dark:from-card dark:to-card">
            <CardHeader className="pb-8 px-8 border-b">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-600 shadow-inner">
                            <ShieldCheck className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black text-blue-900">إدارة حسابات المستخدمين</CardTitle>
                            <CardDescription className="text-base font-medium">تحكم في صلاحيات دخول الموظفين وتفعيل حساباتهم في النظام.</CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => router.back()} variant="ghost" className="rounded-xl font-bold gap-2 text-blue-700 hover:bg-blue-50">
                            <ArrowRight className="h-4 w-4" /> العودة
                        </Button>
                        <Button onClick={() => { setSelectedUser(null); setIsFormOpen(true); }} className="h-11 px-8 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-blue-100 bg-blue-600 hover:bg-blue-700">
                            <PlusCircle className="h-5 w-5" /> إضافة مستخدم جديد
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
                        placeholder="بحث بالاسم أو اسم المستخدم..."
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
                            <TableHead className="px-10 font-black text-gray-800">حساب الدخول</TableHead>
                            <TableHead className="font-black text-gray-800">الموظف المرتبط</TableHead>
                            <TableHead className="font-black text-gray-800">الدور والمسؤولية</TableHead>
                            <TableHead className="font-black text-gray-800">حالة الحساب</TableHead>
                            <TableHead className="w-[100px] text-center"><span className="sr-only">الإجراءات</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={5} className="px-10 py-6"><Skeleton className="h-10 w-full rounded-2xl" /></TableCell></TableRow>
                            ))
                        ) : filteredUsers.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="h-64 text-center text-muted-foreground italic font-bold">لا يوجد مستخدمون مطابقون حالياً.</TableCell></TableRow>
                        ) : (
                            filteredUsers.map((user) => (
                                <TableRow key={user.id} className="hover:bg-primary/5 transition-colors h-24 border-b last:border-0 group">
                                    <TableCell className="px-10">
                                        <div className="flex flex-col">
                                            <span className="font-mono text-lg font-black text-primary">@{user.username}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <UserCircle className="h-8 w-8 text-gray-300" />
                                            <div className="flex flex-col">
                                                <span className="font-black text-gray-800">{user.employeeFullName || 'غير مرتبط بملف'}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground">{user.employeeCivilId}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("px-4 py-1 rounded-xl font-black text-[10px] border-2", roleColors[user.role])}>
                                            {roleTranslations[user.role]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={user.isActive ? 'default' : 'secondary'} className={cn("px-4 py-1 rounded-xl font-black text-[10px]", user.isActive ? 'bg-green-600' : 'bg-gray-200 text-gray-600')}>
                                            {user.isActive ? 'حساب نشط' : 'غير مفعّل'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                       {currentUser?.id !== user.id && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl border bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-5 w-5" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" dir="rtl" className="rounded-2xl shadow-2xl border-none p-2">
                                                <DropdownMenuLabel className="font-black px-3 py-2">خيارات الحساب</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleEditUser(user)} className="gap-2 rounded-xl py-3 font-bold">
                                                    <Pencil className="h-4 w-4 text-primary" /> تعديل البيانات
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleToggleActivationClick(user)} className={cn("gap-2 rounded-xl py-3 font-bold", user.isActive ? "text-orange-600" : "text-green-600")}>
                                                    {user.isActive ? <UserX className="h-4 w-4"/> : <UserCheck className="h-4 w-4"/>}
                                                    {user.isActive ? 'إيقاف الحساب مؤقتاً' : 'تفعيل الحساب الآن'}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive gap-2 rounded-xl py-3 font-bold focus:bg-red-50">
                                                    <Lock className="h-4 w-4" /> إعادة تعيين كلمة المرور
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
            />
        )}

        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl">
                <AlertDialogHeader>
                    <div className={cn("p-4 rounded-3xl w-fit mb-4 shadow-inner", userToToggle?.isActive ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600")}>
                        {userToToggle?.isActive ? <UserX className="h-10 w-10"/> : <UserCheck className="h-10 w-10"/>}
                    </div>
                    <AlertDialogTitle className="text-2xl font-black">
                        {userToToggle?.isActive ? 'تأكيد إيقاف الحساب؟' : 'تأكيد تفعيل الحساب؟'}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed">
                        هل أنت متأكد من تغيير حالة حساب المستخدم <strong>@{userToToggle?.username}</strong>؟ 
                        <br/>
                        {userToToggle?.isActive ? 'لن يتمكن الموظف من الدخول للنظام بعد هذا الإجراء.' : 'سيتمكن الموظف من تسجيل الدخول فوراً بالصلاحيات المحددة.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleToggleActivationConfirm} className={cn("rounded-xl font-black h-12 px-12 shadow-lg", userToToggle?.isActive ? "bg-orange-600 hover:bg-orange-700 shadow-orange-100" : "bg-green-600 hover:bg-green-700 shadow-green-100")}>
                        نعم، قم بالإجراء
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
    );
}