'use client';

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
import type { User, UserRole } from '@/lib/types';

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
}

const roles: UserRole[] = ['Admin', 'Engineer', 'Accountant', 'Secretary', 'Client'];


export function UserForm({ isOpen, onClose, user }: UserFormProps) {
  const isEditing = !!user;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
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
            <Input id="fullName" defaultValue={user?.fullName} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              اسم المستخدم
            </Label>
            <Input id="username" defaultValue={user?.username} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              البريد الإلكتروني
            </Label>
            <Input id="email" type="email" defaultValue={user?.email} className="col-span-3" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password">
              كلمة المرور
            </Label>
            <Input id="password" type="password" placeholder={isEditing ? 'اتركه فارغاً لعدم التغيير' : '********'} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              الدور
            </Label>
             <Select dir="rtl" defaultValue={user?.role}>
                <SelectTrigger id="role" className="col-span-3">
                    <SelectValue placeholder="اختر دوراً..." />
                </SelectTrigger>
                <SelectContent>
                    {roles.map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="isActive" className="text-right">
              الحالة
            </Label>
            <Switch id="isActive" defaultChecked={user?.isActive ?? true} />
            <span className='col-span-2 text-sm text-muted-foreground'>
                {user?.isActive ?? true ? 'فعال' : 'غير فعال'}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="submit">{isEditing ? 'حفظ التغييرات' : 'إنشاء مستخدم'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
