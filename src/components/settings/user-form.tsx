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
import { InlineSearchList } from '@/components/ui/inline-search-list';


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
    // 🛡️ التصفية السيادية: إظهار الموظفين غير المرتبطين بحسابات في هذه المنشأة فقط
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
        setUsernameError('اسم المستخدم هذا مستخدم بالفعل في هذه المنشأة.');
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
        className="sm:max-w-md rounded-3xl" 
        dir="rtl"
        onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]') || target.closest('[data-inline-search-list-options]')) {
                e.preventDefault();
            }
        }}
      >
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle className="font-black text-xl">{isEditing ? 'تعديل مستخدم' : 'إنشاء حساب لموظف'}</DialogTitle>
                <DialogDescription className="font-bold">
                    {isEditing 
                        ? `تعديل حساب المستخدم المرتبط بالموظف في هذه المنشأة.`
                        : 'سيتم إنشاء حساب دخول جديد للموظف المختار ضمن هذه الشركة.'
                    }
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6">
                <div className="grid gap-2">
                    <Label className="font-black text-gray-700">اختيار الموظف من قائمة المنشأة <span className="text-destructive">*</span></Label>
                    <InlineSearchList
                        value={formData.employeeId || ''}
                        onSelect={(v) => handleSelectChange('employeeId', v)}
                        options={currentEmployeeOptions}
                        placeholder="ابحث بالاسم أو الرقم المدني..."
                        disabled={isEditing}
                    />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="username" className="font-black text-gray-700">اسم المستخدم <span className="text-destructive">*</span></Label>
                    <Input 
                        id="username" 
                        value={formData.username} 
                        onChange={handleInputChange} 
                        placeholder="english.letters.only" 
                        dir="ltr" 
                        required 
                        className="h-11 rounded-xl font-bold border-2"
                    />
                    {usernameError && <p className="text-xs text-destructive font-bold">{usernameError}</p>}
                     <p className="text-[10px] text-muted-foreground font-bold">
                        سيتم إنشاء بريد إلكتروني داخلي: <span dir='ltr' className='font-mono text-primary'>{formData.username || '...'}@scoop.local</span>
                     </p>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="password" className="font-black text-gray-700">
                        {isEditing ? 'كلمة المرور الجديدة (اختياري)' : 'كلمة المرور المؤقتة'} <span className={!isEditing ? "text-destructive" : ""}>*</span>
                    </Label>
                    <Input 
                        id="password" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isEditing ? 'اتركه فارغاً لعدم التغيير' : '8 أحرف على الأقل'}
                        required={!isEditing} 
                        className="h-11 rounded-xl font-mono border-2"
                    />
                </div>
                <div className="grid gap-2">
                    <Label className="font-black text-gray-700">الدور والمسؤولية *</Label>
                     <InlineSearchList
                        value={formData.role || ''}
                        onSelect={(v) => handleSelectChange('role', v as UserProfile['role'])}
                        options={roleOptions}
                        placeholder="اختر دور المستخدم..."
                    />
                </div>
                 {!isEditing && (
                    <Alert className="bg-primary/5 border-primary/20 rounded-2xl">
                        <Info className="h-4 w-4 text-primary" />
                        <AlertTitle className="text-xs font-black text-primary">ملاحظة هامة</AlertTitle>
                        <AlertDescription className="text-[10px] font-bold text-slate-600 mt-1">
                            سيتم إنشاء الحساب في حالة "غير مفعل". يجب عليك تفعيله يدوياً من قائمة الإجراءات بعد الحفظ ليتمكن المستخدم من تسجيل الدخول.
                        </AlertDescription>
                    </Alert>
                )}
            </div>
            <DialogFooter className="gap-2 border-t pt-6">
                <Button type="button" variant="outline" onClick={onClose} className="rounded-xl font-bold">إلغاء</Button>
                <Button type="submit" disabled={!!usernameError} className="rounded-xl font-black px-10 shadow-lg">
                    {isEditing ? 'حفظ التعديلات' : 'إنشاء المستخدم الآن'}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
