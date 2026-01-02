'use client';

import { useState } from 'react';
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
import { users as initialUsers } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '../ui/badge';
import { UserForm } from './user-form';
import type { User, UserRole } from '@/lib/types';
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

const roleTranslations: Record<UserRole, string> = {
    Admin: 'مدير',
    Engineer: 'مهندس',
    Accountant: 'محاسب',
    Secretary: 'سكرتارية',
    Client: 'عميل',
    HR: 'موارد بشرية'
};

export function UsersTable() {
    const [users, setUsers] = useState(initialUsers);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const handleAddUser = () => {
        setSelectedUser(null);
        setIsFormOpen(true);
    }

    const handleEditUser = (user: User) => {
        setSelectedUser(user);
        setIsFormOpen(true);
    }
    
    const handleSaveUser = (user: User) => {
        if (selectedUser) {
            // In a real app, you would call an API to update the user
            setUsers(users.map(u => u.id === user.id ? user : u));
        } else {
            // In a real app, you would call an API to create the user
            const newUser = { ...user, id: `user-${Date.now()}`, avatarUrl: '' }; // Mock avatar
            setUsers([newUser, ...users]);
        }
        setIsFormOpen(false);
        setSelectedUser(null);
    }

    const handleDeleteClick = (user: User) => {
        setUserToDelete(user);
        setIsAlertOpen(true);
    }
    
    const handleDeleteConfirm = () => {
        if(userToDelete) {
             // In a real app, you would call an API to delete the user
            setUsers(users.filter(u => u.id !== userToDelete.id));
        }
        setIsAlertOpen(false);
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
            <Button onClick={handleAddUser} size="sm" className="gap-1">
                <PlusCircle className="ml-2 h-4 w-4" />
                إضافة مستخدم
            </Button>
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
                {users.map((user) => (
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
                    <TableCell>{roleTranslations[user.role]}</TableCell>
                    <TableCell>
                        <Badge variant={user.isActive ? 'secondary' : 'outline'} className={user.isActive ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                            {user.isActive ? 'فعال' : 'غير فعال'}
                        </Badge>
                    </TableCell>
                    <TableCell>
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
                            <DropdownMenuItem>إعادة تعيين كلمة المرور</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteClick(user)} className="text-destructive focus:text-destructive focus:bg-red-50">
                                إلغاء التنشيط
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
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
                    <AlertDialogTitle>هل أنت متأكد تماماً؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيؤدي هذا الإجراء إلى إلغاء تنشيط حساب المستخدم. لا يزال بإمكانك إعادة تنشيطه لاحقًا.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} className='bg-destructive hover:bg-destructive/90'>
                        نعم، قم بإلغاء التنشيط
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
