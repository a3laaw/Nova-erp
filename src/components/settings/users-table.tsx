'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
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
import { collection, doc, addDoc, updateDoc, serverTimestamp, getDocs, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '../ui/skeleton';

const roleTranslations: Record<UserProfile['role'], string> = {
    Admin: 'مدير',
    Engineer: 'مهندس',
    Accountant: 'محاسب',
    Secretary: 'سكرتارية',
    HR: 'موارد بشرية',
};

// Represents a user joined with their employee data
interface UserWithEmployee extends UserProfile {
    employeeFullName?: string;
    employeeCivilId?: string;
}

export function UsersTable() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [users, setUsers] = useState<UserWithEmployee[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
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
            console.error("Error fetching employees:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة الموظفين.' });
            return [];
        }
    }, [firestore, toast]);
    

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
            console.error("Error fetching users: ", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة المستخدمين.' });
        } finally {
            setLoading(false);
        }
    }, [firestore, toast, fetchEmployees]);

    useEffect(() => {
        if (firestore && currentUser?.role === 'Admin') {
            fetchUsersAndEmployees();
        } else {
            setLoading(false);
        }
    }, [firestore, currentUser, fetchUsersAndEmployees]);

    const handleAddUser = () => {
        setSelectedUser(null);
        setIsFormOpen(true);
    };

    const handleEditUser = (user: UserProfile) => {
        setSelectedUser(user);
        setIsFormOpen(true);
    };
    
    const handleSaveUser = async (userData: Partial<UserProfile>) => {
        if (!firestore || !currentUser) return;
        
        try {
            // 1. Check for username uniqueness
            const usernameQuery = query(collection(firestore, 'users'), where('username', '==', userData.username));
            const querySnapshot = await getDocs(usernameQuery);
            if (!querySnapshot.empty && (!selectedUser || querySnapshot.docs[0].id !== selectedUser.id)) {
                 toast({ variant: 'destructive', title: 'خطأ', description: 'اسم المستخدم هذا مستخدم بالفعل.' });
                 return;
            }

            if (selectedUser) { // Editing existing user
                const userRef = doc(firestore, 'users', selectedUser.id!);
                const { id, createdAt, createdBy, ...updateData } = userData; // Prevent overwriting creation data
                await updateDoc(userRef, updateData);
                toast({ title: 'نجاح', description: 'تم تحديث بيانات المستخدم.' });
            } else { // Creating new user
                await addDoc(collection(firestore, 'users'), {
                    ...userData,
                    email: `${userData.username}@bmec-kw.local`,
                    isActive: false, // Always created as inactive
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                });
                toast({ 
                    title: 'نجاح!', 
                    description: `تم إنشاء المستخدم "${userData.username}" وهو غير فعال. قم بتفعيله من القائمة.`
                });
            }
            setIsFormOpen(false);
            fetchUsersAndEmployees();
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'فشل حفظ بيانات المستخدم.' });
        }
    };
    
    const handleToggleActivationClick = (user: UserWithEmployee) => {
        setUserToToggle(user);
        setIsAlertOpen(true);
    };

    const handleToggleActivationConfirm = async () => {
        if (!userToToggle || !firestore) return;

        const newStatus = !userToToggle.isActive;
        try {
            const userRef = doc(firestore, 'users', userToToggle.id!);
            await updateDoc(userRef, { 
                isActive: newStatus,
                ...(newStatus && !userToToggle.activatedAt && { activatedAt: serverTimestamp() })
            });
            toast({ title: 'نجاح', description: `تم ${newStatus ? 'تفعيل' : 'إلغاء تفعيل'} المستخدم.` });
            fetchUsersAndEmployees();
        } catch (error) {
            console.error("Error toggling user status:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تغيير حالة المستخدم.' });
        } finally {
            setIsAlertOpen(false);
            setUserToToggle(null);
        }
    };

    return (
    <>
        <div className="flex items-center justify-between mb-4" dir="rtl">
            <div>
                <h3 className='text-lg font-medium'>إدارة المستخدمين</h3>
                <p className='text-sm text-muted-foreground'>
                    إنشاء وتعديل حسابات دخول الموظفين وأدوارهم.
                </p>
            </div>
            <Button onClick={handleAddUser} size="sm" className="gap-1">
                <PlusCircle className="ml-2 h-4 w-4" />
                إضافة مستخدم
            </Button>
        </div>
        <div className='border rounded-lg' dir="rtl">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>اسم المستخدم</TableHead>
                        <TableHead>الاسم الكامل (الموظف)</TableHead>
                        <TableHead>الدور</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                            </TableRow>
                        ))
                    ) : (
                        users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-mono text-sm">@{user.username}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{user.employeeFullName || <span className="text-muted-foreground">غير مرتبط</span>}</div>
                                    <div className="text-xs text-muted-foreground">{user.employeeCivilId}</div>
                                </TableCell>
                                <TableCell>{user.role ? roleTranslations[user.role] : 'غير محدد'}</TableCell>
                                <TableCell>
                                    <Badge variant={user.isActive ? 'default' : 'secondary'} className={user.isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}>
                                        {user.isActive ? 'مفعل' : 'غير مفعل'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                   {currentUser?.id !== user.id && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">فتح القائمة</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" dir="rtl">
                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleEditUser(user)}>تعديل</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleToggleActivationClick(user)}>
                                                {user.isActive ? 'إلغاء التفعيل' : 'تفعيل الحساب'}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                   )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                    {!loading && users.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">لا يوجد مستخدمون لعرضهم. قم بإنشاء مستخدم جديد.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
        
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
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيؤدي هذا الإجراء إلى {userToToggle?.isActive ? 'إلغاء تفعيل' : 'تفعيل'} حساب المستخدم 
                        <span className="font-bold"> "{userToToggle?.username}"</span>.
                        {userToToggle?.isActive ? ' لن يتمكن من تسجيل الدخول.' : ' سيتمكن من تسجيل الدخول فوراً.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleToggleActivationConfirm}>
                        نعم، قم بالإجراء
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
    );
}
