
'use client';

import { useState, useEffect } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '../ui/badge';
import { UserForm } from './user-form';
import type { UserProfile, UserRole } from '@/lib/types';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc, serverTimestamp, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

const roleTranslations: Record<UserRole, string> = {
    Admin: 'مدير',
    Engineer: 'مهندس',
    Accountant: 'محاسب',
    Secretary: 'سكرتارية',
    HR: 'موارد بشرية',
    Client: 'عميل'
};

export function UsersTable() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [userToDeactivate, setUserToDeactivate] = useState<UserProfile | null>(null);
    const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

    const fetchUsers = async () => {
        if (!firestore) return;
        setLoading(true);
        try {
            const usersCollection = collection(firestore, 'users');
            const q = query(usersCollection, orderBy('createdAt', 'desc'));
            const usersSnapshot = await getDocs(q);
            const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
            setUsers(usersList);
        } catch (error) {
            console.error("Error fetching users: ", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة المستخدمين.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [firestore]);


    const handleAddUser = () => {
        setSelectedUser(null);
        setIsFormOpen(true);
    }

    const handleEditUser = (user: UserProfile) => {
        setSelectedUser(user);
        setIsFormOpen(true);
    }
    
    const handleSaveUser = async (userData: Partial<UserProfile>) => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'قاعدة البيانات غير متصلة.' });
            return;
        }

        try {
            if (selectedUser) { 
                const userRef = doc(firestore, 'users', selectedUser.id!);
                await updateDoc(userRef, {
                    fullName: userData.fullName,
                    username: userData.username,
                    email: userData.email,
                    role: userData.role,
                    isActive: userData.isActive,
                });
                toast({ title: 'نجاح', description: 'تم تحديث بيانات المستخدم.' });
            } else { 
                 await addDoc(collection(firestore, 'users'), {
                    ...userData,
                    createdAt: serverTimestamp(),
                 });
                toast({ title: 'نجاح', description: 'تم إنشاء المستخدم الجديد.' });
            }
            fetchUsers(); // Re-fetch users to get the latest data
        } catch (error) {
             console.error("Error saving user:", error);
             toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ المستخدم.' });
        }
        
        setIsFormOpen(false);
        setSelectedUser(null);
    }

    const handleDeactivateClick = (user: UserProfile) => {
        setUserToDeactivate(user);
        setIsAlertOpen(true);
    }

    const handleDeleteClick = (user: UserProfile) => {
        setUserToDelete(user);
        setIsDeleteAlertOpen(true);
    }
    
    const handleDeactivateConfirm = async () => {
        if (userToDeactivate && firestore) {
            try {
                const userRef = doc(firestore, 'users', userToDeactivate.id!);
                await updateDoc(userRef, { isActive: !userToDeactivate.isActive });
                toast({ title: 'نجاح', description: `تم ${userToDeactivate.isActive ? 'إلغاء تنشيط' : 'إعادة تنشيط'} المستخدم.` });
                fetchUsers();
            } catch (error) {
                 console.error("Error changing user status:", error);
                 toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تغيير حالة المستخدم.' });
            }
        }
        setIsAlertOpen(false);
        setUserToDeactivate(null);
    }

    const handleDeleteConfirm = async () => {
        if (userToDelete && firestore) {
            try {
                await deleteDoc(doc(firestore, 'users', userToDelete.id!));
                toast({ title: 'نجاح', description: 'تم حذف المستخدم نهائياً.' });
                fetchUsers();
            } catch (error) {
                 console.error("Error deleting user:", error);
                 toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف المستخدم.' });
            }
        }
        setIsDeleteAlertOpen(false);
        setUserToDelete(null);
    }


  return (
    <>
        <div className="flex items-center justify-between mb-4" dir="rtl">
            <div>
                <h3 className='text-lg font-medium'>إدارة المستخدمين</h3>
                <p className='text-sm text-muted-foreground'>
                    إنشاء وتعديل وإدارة حسابات الموظفين وأدوارهم.
                </p>
            </div>
            {currentUser?.role === 'Admin' && <Button onClick={handleAddUser} size="sm" className="gap-1">
                <PlusCircle className="ml-2 h-4 w-4" />
                إضافة مستخدم
            </Button>}
        </div>
        <div className='border rounded-lg' dir="rtl">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>المستخدم</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>
                    <span className="sr-only">الإجراءات</span>
                </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading && <TableRow><TableCell colSpan={4} className="text-center">جاري تحميل المستخدمين...</TableCell></TableRow>}
                {!loading && users.map((user) => (
                    <TableRow key={user.id}>
                    <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={user.avatarUrl} alt={user.fullName} />
                                <AvatarFallback>{user.fullName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="grid text-sm">
                                <span className="font-semibold text-foreground">{user.fullName}</span>
                                <span className="text-muted-foreground">@{user.username}</span>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell>{user.role ? roleTranslations[user.role] : 'غير محدد'}</TableCell>
                    <TableCell>
                        <Badge variant={user.isActive ? 'secondary' : 'outline'} className={user.isActive ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                            {user.isActive ? 'فعال' : 'غير فعال'}
                        </Badge>
                    </TableCell>
                    <TableCell>
                       {currentUser?.role === 'Admin' && currentUser.uid !== user.id && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                aria-haspopup="true"
                                size="icon"
                                variant="ghost"
                                >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEditUser(user)}>تعديل</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeactivateClick(user)}>
                                    {user.isActive ? 'إلغاء التنشيط' : 'إعادة التنشيط'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDeleteClick(user)} className="text-destructive focus:text-destructive focus:bg-red-50">
                                    حذف نهائي
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                       )}
                    </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            </Table>
        </div>
        
        {isFormOpen && <UserForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSave={handleSaveUser} user={selectedUser} />}

        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيؤدي هذا الإجراء إلى {userToDeactivate?.isActive ? 'إلغاء تنشيط' : 'إعادة تنشيط'} حساب المستخدم.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeactivateConfirm}>
                        نعم، قم بالإجراء
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>تحذير: حذف نهائي!</AlertDialogTitle>
                    <AlertDialogDescription>
                        هل أنت متأكد من حذف المستخدم "{userToDelete?.fullName}"؟ لا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} className='bg-destructive hover:bg-destructive/90'>
                        نعم، أحذف المستخدم
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
