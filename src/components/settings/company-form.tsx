'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import type { Company } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface CompanyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Company>) => void;
  company: Company | null;
}

const initialData: Partial<Company> = {
    name: '',
    nameEn: '',
    phone: '',
    email: '',
    crNumber: '',
    parentCompanyId: '',
};

export function CompanyForm({ isOpen, onClose, onSave, company }: CompanyFormProps) {
  const { toast } = useToast();
  const isEditing = !!company;
  const [formData, setFormData] = useState(initialData);

  useEffect(() => {
    if (isEditing && company) {
        setFormData({
            name: company.name || '',
            nameEn: company.nameEn || '',
            phone: company.phone || '',
            email: company.email || '',
            crNumber: company.crNumber || '',
            parentCompanyId: company.parentCompanyId || '',
        });
    } else {
        setFormData(initialData);
    }
  }, [company, isEditing, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'اسم الشركة حقل مطلوب.' });
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle>{isEditing ? 'تعديل شركة' : 'إضافة شركة جديدة'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                <div className="grid gap-2">
                    <Label htmlFor="name">اسم الشركة (بالعربية) <span className="text-destructive">*</span></Label>
                    <Input id="name" value={formData.name} onChange={handleChange} required />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="nameEn">اسم الشركة (بالإنجليزية)</Label>
                    <Input id="nameEn" value={formData.nameEn} onChange={handleChange} dir="ltr" />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="parentCompanyId">ID الشركة الأم (اختياري)</Label>
                    <Input id="parentCompanyId" value={formData.parentCompanyId} onChange={handleChange} placeholder="الصقه هنا للربط" dir="ltr" />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="phone">الهاتف</Label>
                    <Input id="phone" value={formData.phone} onChange={handleChange} dir="ltr" />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input id="email" type="email" value={formData.email} onChange={handleChange} dir="ltr" />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="crNumber">رقم السجل التجاري</Label>
                    <Input id="crNumber" value={formData.crNumber} onChange={handleChange} dir="ltr" />
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
                <Button type="submit">{isEditing ? 'حفظ التغييرات' : 'إضافة شركة'}</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
