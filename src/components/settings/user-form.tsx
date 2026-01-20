'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UserProfile, Employee } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';


interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Partial<UserProfile>) => void;
  user: UserProfile | null;
  employees: Employee[];
  allUsers: UserProfile[];
}

const roles: UserProfile['role'][] = ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'];
const roleTranslations: Record<UserProfile['role'], string> = {
    Admin: 'مدير',
    Engineer: 'مهندس',
    Accountant: 'محاسب',
    Secretary: 'سكرتارية',
    HR: 'موارد بشرية',
};

const initialFormData: Partial<UserProfile> = {
    employeeId: '',
    username: '',
    passwordHash: '',
    role: 'Engineer',
};


export function UserForm({ isOpen, onClose, onSave, user, employees, allUsers }: UserFormProps) {
  const { toast } = useToast();
  const isEditing = !!user;

  const [formData, setFormData] = useState<Partial<UserProfile>>(initialFormData);
  const [password, setPassword] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Filter out employees who are already linked to a user account
  const availableEmployees = useMemo(() => {
    const linkedEmployeeIds = new Set(allUsers.map(u => u.employeeId));
    if (isEditing && user?.employeeId) {
        // If editing, allow the currently linked employee to be in the list
        linkedEmployeeIds.delete(user.employeeId);
    }
    return employees.filter(e => !linkedEmployeeIds.has(e.id));
  }, [employees, allUsers, user, isEditing]);


  useEffect(() => {
    if (user && isEditing) {
        setFormData({
            id: user.id,
            employeeId: user.employeeId,
            username: user.username,
            role: user.role,
        });
        setPassword(''); // Don't show password
    } else {
        setFormData(initialFormData);
        setPassword('');
    }
  }, [user, isEditing, isOpen]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (id === 'username') {
        // Basic username policy
        const sanitizedValue = value.toLowerCase().replace(/[^a-z0-9._]/g, '');
        setFormData(prev => ({ ...prev, [id]: sanitizedValue }));
        checkUsername(sanitizedValue);
    } else {
       setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  const checkUsername = useCallback((username: string) => {
    if (!username) {
        setUsernameError(null);
        return;
    }
    const isTaken = allUsers.some(u => u.username === username && u.id !== user?.id);
    if (isTaken) {
        setUsernameError('اسم المستخدم هذا مستخدم بالفعل.');
    } else {
        setUsernameError(null);
    }
  }, [allUsers, user]);


  const handleSelectChange = (id: keyof UserProfile, value: any) => {
      setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      // --- Validation ---
      if (!formData.employeeId) {
          toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار موظف لربط الحساب به.' });
          return;
      }
      if (!formData.username || usernameError) {
          toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إدخال اسم مستخدم صالح وغير مكرر.' });
          return;
      }
       if (!isEditing && (!password || password.length < 8)) {
          toast({ variant: 'destructive', title: 'خطأ', description: 'كلمة المرور مطلوبة ويجب أن لا تقل عن 8 أحرف.' });
          return;
      }
       if (isEditing && password && password.length < 8) {
          toast({ variant: 'destructive', title: 'خطأ', description: 'كلمة المرور الجديدة يجب أن لا تقل عن 8 أحرف.' });
          return;
      }
      
      const dataToSave = { ...formData };
      if (password) {
        // In a real app, this would trigger a Firebase Function to hash the password.
        // For this demo, we store it as is, but name the field passwordHash to show intent.
        dataToSave.passwordHash = password;
      }
      
      onSave(dataToSave);
  }
  
  const currentEmployeeSelection = useMemo(() => {
    if (isEditing && user) {
        const linkedEmployee = employees.find(e => e.id === user.employeeId);
        if (linkedEmployee) return [linkedEmployee, ...availableEmployees];
    }
    return availableEmployees;
  }, [isEditing, user, employees, availableEmployees]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle>{isEditing ? 'تعديل مستخدم' : 'إنشاء حساب لموظف'}</DialogTitle>
                <DialogDescription>
                    {isEditing 
                        ? `تعديل حساب المستخدم المرتبط بالموظف.`
                        : 'سيتم إنشاء حساب دخول جديد للموظف المختار. سيكون الحساب غير مفعل افتراضيًا.'
                    }
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="employeeId">اختيار الموظف <span className="text-destructive">*</span></Label>
                    <Select dir="rtl" value={formData.employeeId} onValueChange={(v) => handleSelectChange('employeeId', v)} disabled={isEditing}>
                        <SelectTrigger>
                            <SelectValue placeholder="اختر موظفًا..." />
                        </SelectTrigger>
                        <SelectContent>
                            {currentEmployeeSelection.map(emp => (
                                <SelectItem key={emp.id} value={emp.id!}>{`${emp.fullName} (${emp.civilId})`}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="username">اسم المستخدم <span className="text-destructive">*</span></Label>
                    <Input 
                        id="username" 
                        value={formData.username} 
                        onChange={handleInputChange} 
                        placeholder="english.letters.only" 
                        dir="ltr" 
                        required 
                    />
                    {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
                     <p className="text-xs text-muted-foreground">
                        سيتم إنشاء بريد إلكتروني داخلي: <span dir='ltr' className='font-mono'>{formData.username || '...'}@scoop.local</span>
                     </p>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="password">
                        {isEditing ? 'كلمة المرور الجديدة (اختياري)' : 'كلمة المرور المؤقتة'} <span className={!isEditing ? "text-destructive" : ""}>*</span>
                    </Label>
                    <Input 
                        id="password" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isEditing ? 'اتركه فارغًا لعدم التغيير' : '8 أحرف على الأقل'}
                        required={!isEditing} 
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="role">الدور <span className="text-destructive">*</span></Label>
                    <Select dir="rtl" value={formData.role} onValueChange={(v) => handleSelectChange('role', v as UserProfile['role'])}>
                        <SelectTrigger id="role">
                            <SelectValue placeholder="اختر دور المستخدم..." />
                        </SelectTrigger>
                        <SelectContent>
                            {roles.map(role => (
                                <SelectItem key={role} value={role}>{roleTranslations[role]}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 {!isEditing && (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>ملاحظة هامة</AlertTitle>
                        <AlertDescription>
                            سيتم إنشاء الحساب في حالة "غير مفعل". يجب عليك تفعيله يدويًا من قائمة الإجراءات بعد الحفظ ليتمكن المستخدم من تسجيل الدخول.
                        </AlertDescription>
                    </Alert>
                )}
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
                <Button type="submit" disabled={!!usernameError}>{isEditing ? 'حفظ التغييرات' : 'إنشاء مستخدم'}</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
