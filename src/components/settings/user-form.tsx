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
import { Info, Sparkles, UserPlus } from 'lucide-react';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Partial<UserProfile>) => void;
  user: UserProfile | null;
  employees: Employee[];
  allUsers: UserProfile[];
}

const roleOptions = [
    { value: 'Admin', label: 'مدير نظام' },
    { value: 'Engineer', label: 'مهندس تنفيذ' },
    { value: 'Accountant', label: 'محاسب مالي' },
    { value: 'Secretary', label: 'سكرتارية' },
    { value: 'HR', label: 'موارد بشرية' },
];

export function UserForm({ isOpen, onClose, onSave, user, employees, allUsers }: UserFormProps) {
  const { toast } = useToast();
  const { user: currentAdmin } = useAuth();
  const isEditing = !!user;

  const [formData, setFormData] = useState<Partial<UserProfile>>({
    employeeId: '',
    username: '',
    role: 'Engineer',
  });
  const [password, setPassword] = useState('');

  const availableEmployees = useMemo(() => {
    const linkedEmployeeIds = new Set(allUsers.map(u => u.employeeId));
    if (isEditing && user?.employeeId) linkedEmployeeIds.delete(user.employeeId);
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
    } else {
        setFormData({ employeeId: '', username: '', role: 'Engineer' });
    }
    setPassword('');
  }, [user, isEditing, isOpen]);
  
  const handleUsernameChange = (val: string) => {
    // تنظيف اسم المستخدم (حروف إنجليزية وأرقام فقط)
    const sanitized = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    setFormData(prev => ({ ...prev, username: sanitized }));
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      if (!formData.employeeId) {
          toast({ variant: 'destructive', title: 'خطأ', description: 'يجب اختيار موظف لربط الحساب.' });
          return;
      }
      if (!formData.username) {
          toast({ variant: 'destructive', title: 'خطأ', description: 'اسم المستخدم مطلوب.' });
          return;
      }
      
      // 🛡️ إنشاء المعرف الفريد للـ SaaS خلف الكواليس
      // ali @ company_id . nova
      const tenantId = currentAdmin?.currentCompanyId;
      const internalEmail = `${formData.username}@${tenantId}.nova`;
      
      const dataToSave = { 
          ...formData, 
          email: internalEmail,
          passwordHash: password 
      };
      
      onSave(dataToSave);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-[2rem] shadow-2xl border-none p-0 overflow-hidden" dir="rtl">
        <form onSubmit={handleSubmit}>
            <DialogHeader className="p-8 bg-primary/5 border-b">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary"><UserPlus className="h-6 w-6"/></div>
                    <div>
                        <DialogTitle className="text-xl font-black">{isEditing ? 'تعديل بيانات الدخول' : 'تأسيس حساب موظف'}</DialogTitle>
                        <DialogDescription className="text-xs font-bold">إدارة صلاحيات الدخول السيادية للموظف في المنشأة.</DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <div className="p-8 space-y-6">
                <div className="grid gap-2">
                    <Label className="font-black text-gray-700 pr-1">الموظف المعني *</Label>
                    <InlineSearchList
                        value={formData.employeeId || ''}
                        onSelect={(v) => setFormData(prev => ({ ...prev, employeeId: v }))}
                        options={availableEmployees.map(e => ({ value: e.id!, label: e.fullName }))}
                        placeholder="اختر موظفاً من القائمة..."
                        disabled={isEditing}
                    />
                </div>

                 <div className="grid gap-2">
                    <Label htmlFor="username" className="font-black text-gray-700 pr-1">اسم المستخدم (Username) *</Label>
                    <div className="relative">
                        <Input 
                            id="username" 
                            value={formData.username} 
                            onChange={e => handleUsernameChange(e.target.value)}
                            placeholder="ali.ahmed" 
                            dir="ltr" 
                            required 
                            className="h-12 rounded-xl font-black text-primary border-2 pl-12"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground opacity-40">.nova</div>
                    </div>
                    <p className="text-[9px] text-muted-foreground font-bold pr-1">سيستخدم الموظف هذا الاسم فقط لتسجيل الدخول دون الحاجة لكتابة دومين.</p>
                </div>

                 <div className="grid gap-2">
                    <Label htmlFor="password" className="font-black text-gray-700 pr-1">
                        {isEditing ? 'تغيير كلمة المرور (اختياري)' : 'كلمة المرور التأسيسية *'}
                    </Label>
                    <Input 
                        id="password" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="8 أحرف على الأقل..."
                        required={!isEditing} 
                        className="h-12 rounded-xl font-mono border-2"
                    />
                </div>

                <div className="grid gap-2">
                    <Label className="font-black text-gray-700 pr-1">الدور والصلاحيات *</Label>
                     <InlineSearchList
                        value={formData.role || ''}
                        onSelect={(v) => setFormData(prev => ({ ...prev, role: v as any }))}
                        options={roleOptions}
                        placeholder="حدد دور الموظف..."
                    />
                </div>

                <Alert className="bg-primary/5 border-primary/20 rounded-2xl">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-[10px] font-black uppercase text-primary">SaaS Identity Shield</AlertTitle>
                    <AlertDescription className="text-[9px] font-bold text-slate-600">
                        سيتم عزل هذا الحساب برمجياً؛ لا يمكن للموظف رؤية أي بيانات خارج نطاق منشأتك المعتمدة.
                    </AlertDescription>
                </Alert>
            </div>

            <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
                <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                <Button type="submit" className="rounded-xl font-black px-12 h-12 shadow-xl shadow-primary/20">
                    {isEditing ? 'تحديث الحساب' : 'تفعيل الحساب الآن'}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
