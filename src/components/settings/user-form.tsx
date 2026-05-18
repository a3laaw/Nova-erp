'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { UserPlus, Sparkles, ShieldCheck, User } from 'lucide-react';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Partial<UserProfile> & { newPassword?: string }) => void;
  user: UserProfile | null;
  employees: Employee[];
  allUsers: UserProfile[];
  isSaving: boolean;
}

const roleOptions = [
    { value: 'Admin', label: 'مدير نظام' },
    { value: 'Engineer', label: 'مهندس تنفيذ' },
    { value: 'Accountant', label: 'محاسب مالي' },
    { value: 'Secretary', label: 'سكرتارية' },
    { value: 'HR', label: 'موارد بشرية' },
];

/**
 * نموذج تأسيس حساب موظف (Username-Centric V4.0):
 * تم حذف خانة البريد الإلكتروني نهائياً والاعتماد على اسم المستخدم فقط للدخول.
 */
export function UserForm({ isOpen, onClose, onSave, user, employees, allUsers, isSaving }: UserFormProps) {
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
    if (isOpen) {
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
    }
  }, [user, isEditing, isOpen]);
  
  const handleUsernameChange = (val: string) => {
    // تطهير اسم المستخدم ليكون صالحاً كمعرف دخول فريد
    const sanitized = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    setFormData(prev => ({ ...prev, username: sanitized }));
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.employeeId || !formData.username) {
          toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى اختيار الموظف وتحديد اسم المستخدم.' });
          return;
      }
      
      const tenantId = currentAdmin?.currentCompanyId;
      // توليد المعرف التقني في الخلفية (مخفي عن المستخدم)
      const internalEmail = `${formData.username}@${tenantId}.nova`;
      
      const dataToSave: any = { 
          ...formData, 
          email: internalEmail,
          fullName: employees.find(e => e.id === formData.employeeId)?.fullName
      };

      if (password) {
          dataToSave.newPassword = password;
      }
      
      onSave(dataToSave);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && onClose()}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] shadow-2xl border-none p-0 overflow-hidden" dir="rtl">
        <form onSubmit={handleSubmit} autoComplete="off">
            {/* درع منع الملء التلقائي */}
            <input type="text" name="prevent_autofill" style={{ display: 'none' }} tabIndex={-1} />
            <input type="password" name="prevent_autofill_pwd" style={{ display: 'none' }} tabIndex={-1} />

            <DialogHeader className="p-8 bg-primary/5 border-b">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                        <UserPlus className="h-6 w-6"/>
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-black text-[#1e1b4b]">
                            {isEditing ? 'تعديل حساب الدخول' : 'تأسيس حساب موظف'}
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">إدارة هوية الدخول للموظف في المنشأة</DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <div className="p-8 space-y-6">
                <div className="grid gap-2">
                    <Label className="font-black text-gray-700 pr-1 flex items-center gap-2">
                        <ShieldCheck className="h-3 w-3 text-primary"/> الموظف المستهدف *
                    </Label>
                    <InlineSearchList
                        value={formData.employeeId || ''}
                        onSelect={(v) => setFormData(prev => ({ ...prev, employeeId: v }))}
                        options={availableEmployees.map(e => ({ value: e.id!, label: e.fullName }))}
                        placeholder="اختر موظفاً من القائمة..."
                        disabled={isEditing || isSaving}
                    />
                </div>

                 <div className="grid gap-2">
                    <Label htmlFor="username" className="font-black text-gray-700 pr-1">اسم المستخدم المختار (User) *</Label>
                    <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-30" />
                        <Input 
                            id="username" 
                            value={formData.username} 
                            onChange={e => handleUsernameChange(e.target.value)}
                            placeholder="ali.ahmed" 
                            dir="ltr" 
                            required 
                            autoComplete="new-username"
                            disabled={isSaving}
                            className="h-12 rounded-xl font-black text-primary border-2 pr-10 text-center text-lg"
                        />
                    </div>
                    <p className="text-[9px] font-bold text-muted-foreground text-center">هذا هو الاسم الذي سيستخدمه الموظف للدخول بدلاً من الإيميل.</p>
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
                        autoComplete="new-password"
                        disabled={isSaving}
                        className="h-12 rounded-xl font-mono border-2 text-center text-lg"
                    />
                </div>

                <div className="grid gap-2">
                    <Label className="font-black text-gray-700 pr-1">الدور والصلاحيات الممنوحة *</Label>
                     <InlineSearchList
                        value={formData.role || ''}
                        onSelect={(v) => setFormData(prev => ({ ...prev, role: v as any }))}
                        options={roleOptions}
                        placeholder="حدد دور الموظف..."
                        disabled={isSaving}
                    />
                </div>
            </div>

            <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                <Button type="submit" disabled={isSaving || (!isEditing && !password)} className="rounded-xl font-black px-12 h-12 shadow-xl shadow-primary/30">
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Sparkles className="ml-2 h-4 w-4" />}
                    {isEditing ? 'حفظ التعديلات' : 'تفعيل الحساب فوراً'}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
