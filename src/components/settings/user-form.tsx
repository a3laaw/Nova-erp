'use client';

import { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import type { UserProfile, UserRole } from '@/lib/types';

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: Partial<UserProfile>, password?: string) => void;
  user?: UserProfile | null;
}

const roles: UserRole[] = ['Admin', 'Engineer', 'Accountant', 'Secretary', 'HR'];
const roleTranslations: Record<UserRole, string> = {
    Admin: 'مدير',
    Engineer: 'مهندس',
    Accountant: 'محاسب',
    Secretary: 'سكرتارية',
    HR: 'موارد بشرية'
};


export function UserForm({ isOpen, onClose, onSave, user }: UserFormProps) {
  const isEditing = !!user;
  const [formData, setFormData] = useState<Partial<UserProfile>>({
      fullName: '',
      username: '',
      role: 'Engineer',
      isActive: true,
  });
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isEditing && user) {
        setFormData({
            id: user.id,
            fullName: user.fullName,
            username: user.username,
            role: user.role,
            isActive: user.isActive,
        });
    } else {
        setFormData({
            fullName: '',
            username: '',
            role: 'Engineer',
            isActive: true,
        });
    }
    setPassword('');
  }, [user, isEditing, isOpen]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  }

  const handleRoleChange = (value: UserRole) => {
      setFormData(prev => ({ ...prev, role: value}));
  }

  const handleStatusChange = (checked: boolean) => {
      setFormData(prev => ({ ...prev, isActive: checked}));
  }

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      // Basic validation
      if (!formData.fullName || !formData.username || !formData.role) {
          alert('الرجاء تعبئة كل الحقول المطلوبة.');
          return;
      }
      if (!isEditing && !password) {
          alert('كلمة المرور مطلوبة للمستخدمين الجدد.');
          return;
      }
      onSave(formData, password);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
            <DialogTitle>{isEditing ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</DialogTitle>
            <DialogDescription>
                {isEditing ? 'تعديل تفاصيل المستخدم الحالي.' : 'إضافة مستخدم جديد للنظام.'}
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fullName" className="text-right">
                الاسم الكامل
                </Label>
                <Input id="fullName" value={formData.fullName} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="username" className="text-right">
                اسم المستخدم
                </Label>
                <Input id="username" value={formData.username} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">
                كلمة المرور
                </Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEditing ? 'اتركه فارغاً لعدم التغيير' : '********'} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">
                الدور
                </Label>
                <Select dir="rtl" value={formData.role} onValueChange={handleRoleChange}>
                    <SelectTrigger id="role" className="col-span-3">
                        <SelectValue placeholder="اختر دوراً..." />
                    </SelectTrigger>
                    <SelectContent>
                        {roles.map(role => (
                            <SelectItem key={role} value={role}>{roleTranslations[role]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isActive" className="text-right">
                الحالة
                </Label>
                <div className='flex items-center gap-2 col-span-3'>
                    <Switch id="isActive" checked={formData.isActive} onCheckedChange={handleStatusChange} />
                    <span className='text-sm text-muted-foreground'>
                        {formData.isActive ? 'فعال' : 'غير فعال'}
                    </span>
                </div>
              </div>
            </div>
            <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit">{isEditing ? 'حفظ التغييرات' : 'إنشاء مستخدم'}</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
