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
import type { UserProfile, Employee } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Info } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { InlineSearchList } from '../ui/inline-search-list';


interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Partial<UserProfile>) => void;
  user: UserProfile | null;
  employees: Employee[];
  allUsers: UserProfile[];
}

const roleOptions: { value: UserProfile['role']; label: string }[] = [
    { value: 'Admin', label: 'مدير' },
    { value: 'Engineer', label: 'مهندس' },
    { value: 'Accountant', label: 'محاسب' },
    { value: 'Secretary', label: 'سكرتارية' },
    { value: 'HR', label: 'موارد بشرية' },
];

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

  const availableEmployees = useMemo(() => {
    const linkedEmployeeIds = new Set(allUsers.map(u => u.employeeId));
    if (isEditing && user?.employeeId) {
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
        setPassword('');
    } else {
        setFormData(initialFormData);
        setPassword('');
    }
  }, [user, isEditing, isOpen]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (id === 'username') {
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
        dataToSave.passwordHash = password;
      }
      
      onSave(dataToSave);
  }
  
  const currentEmployeeOptions = useMemo(() => {
    const baseOptions = availableEmployees.map(e => ({ value: e.id!, label: e.fullName, searchKey: e.civilId }));
    if (isEditing && user) {
        const linkedEmployee = employees.find(e => e.id === user.employeeId);
        if (linkedEmployee && !baseOptions.some(o => o.value === linkedEmployee.id)) {
            return [{ value: linkedEmployee.id!, label: linkedEmployee.fullName, searchKey: linkedEmployee.civilId }, ...baseOptions];
        }
    }
    return baseOptions;
  }, [isEditing, user, employees, availableEmployees]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md" 
        dir="rtl"
        onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]') || target.closest('[data-inline-search-list-options]')) {
                e.preventDefault();
            }
        }}
        onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]') || target.closest('[data-inline-search-list-options]')) {
                e.preventDefault();
            }
        }}
      >
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
                    <Label>اختيار الموظف <span className="text-destructive">*</span></Label>
                    <InlineSearchList
                        value={formData.employeeId || ''}
                        onSelect={(v) => handleSelectChange('employeeId', v)}
                        options={currentEmployeeOptions}
                        placeholder="ابحث بالاسم أو الرقم المدني..."
                        disabled={isEditing}
                    />
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
                    <Label>الدور <span className="text-destructive">*</span></Label>
                     <InlineSearchList
                        value={formData.role || ''}
                        onSelect={(v) => handleSelectChange('role', v as UserProfile['role'])}
                        options={roleOptions}
                        placeholder="اختر دور المستخدم..."
                    />
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
