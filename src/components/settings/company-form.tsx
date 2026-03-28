'use client';
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import type { Company, CompanyActivityType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { InlineSearchList } from '../ui/inline-search-list';
import { DateInput } from '../ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { Calendar, FileText } from 'lucide-react';
import { Separator } from '../ui/separator';

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
    activityType: '',
    address: '',
    licenseExpiryDate: undefined,
    adLicenseExpiryDate: undefined,
};

export function CompanyForm({ isOpen, onClose, onSave, company }: CompanyFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const isEditing = !!company;
  const [formData, setFormData] = useState<Partial<Company>>(initialData);

  const { data: activityTypes, loading: activityTypesLoading } = useSubscription<CompanyActivityType>(firestore, 'companyActivityTypes', useMemo(() => [orderBy('name')], []));

  useEffect(() => {
    if (isEditing && company) {
        setFormData({
            name: company.name || '',
            nameEn: company.nameEn || '',
            phone: company.phone || '',
            email: company.email || '',
            crNumber: company.crNumber || '',
            parentCompanyId: company.parentCompanyId || '',
            activityType: company.activityType || '',
            address: company.address || '',
            licenseExpiryDate: toFirestoreDate(company.licenseExpiryDate) || undefined,
            adLicenseExpiryDate: toFirestoreDate(company.adLicenseExpiryDate) || undefined,
        });
    } else {
        setFormData(initialData);
    }
  }, [company, isEditing, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

   const handleSelectChange = (id: keyof Company, value: any) => {
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
  
  const activityTypeOptions = useMemo(() => {
    if (!activityTypes) return [];
    return activityTypes.map(t => ({ value: t.name, label: t.name }));
  }, [activityTypes]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl" dir="rtl">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle>{isEditing ? 'تعديل بيانات المنشأة' : 'إضافة منشأة جديدة'}</DialogTitle>
                <DialogDescription>أدخل البيانات القانونية وتواريخ انتهاء التراخيص للمتابعة الرقابية.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-6 max-h-[75vh] overflow-y-auto px-1 scrollbar-none">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="font-bold">اسم الشركة (بالعربية) *</Label>
                        <Input id="name" value={formData.name} onChange={handleChange} required className="h-11 rounded-xl" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="nameEn" className="font-bold">اسم الشركة (بالإنجليزية)</Label>
                        <Input id="nameEn" value={formData.nameEn} onChange={handleChange} dir="ltr" className="h-11 rounded-xl" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="activityType" className="font-bold">نوع النشاط</Label>
                        <InlineSearchList 
                            value={formData.activityType || ''}
                            onSelect={(v) => handleSelectChange('activityType', v)}
                            options={activityTypeOptions}
                            placeholder={activityTypesLoading ? "تحميل..." : "اختر نوع النشاط..."}
                            disabled={activityTypesLoading}
                            className="h-11"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="crNumber" className="font-bold">رقم السجل التجاري</Label>
                        <Input id="crNumber" value={formData.crNumber} onChange={handleChange} dir="ltr" className="h-11 rounded-xl" />
                    </div>
                </div>

                <Separator />

                <div className="space-y-4 bg-muted/20 p-4 rounded-2xl border-2 border-dashed">
                    <h4 className="text-sm font-black text-primary flex items-center gap-2">
                        <Calendar className="h-4 w-4" /> تواريخ انتهاء التراخيص
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold text-gray-600 flex items-center gap-1">
                                <FileText className="h-3 w-3" /> انتهاء رخصة المنشأة
                            </Label>
                            <DateInput 
                                value={formData.licenseExpiryDate} 
                                onChange={(d) => handleSelectChange('licenseExpiryDate', d)} 
                                className="h-10 bg-white"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold text-gray-600 flex items-center gap-1">
                                <FileText className="h-3 w-3" /> انتهاء ترخيص الإعلان
                            </Label>
                            <DateInput 
                                value={formData.adLicenseExpiryDate} 
                                onChange={(d) => handleSelectChange('adLicenseExpiryDate', d)} 
                                className="h-10 bg-white"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="phone" className="font-bold">رقم الهاتف</Label>
                        <Input id="phone" value={formData.phone} onChange={handleChange} dir="ltr" className="h-11 rounded-xl" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email" className="font-bold">البريد الإلكتروني</Label>
                        <Input id="email" type="email" value={formData.email} onChange={handleChange} dir="ltr" className="h-11 rounded-xl" />
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="address" className="font-bold">العنوان</Label>
                    <Textarea id="address" value={formData.address} onChange={handleChange} rows={2} className="rounded-xl" />
                </div>

                <div className="grid gap-2 p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <Label htmlFor="parentCompanyId" className="font-black text-[10px] uppercase text-primary">معرف الشركة الأم (لربط الفروع)</Label>
                    <Input id="parentCompanyId" value={formData.parentCompanyId || ''} onChange={handleChange} placeholder="انسخ الـ ID هنا..." dir="ltr" className="h-9 font-mono text-xs bg-white" />
                </div>
            </div>
            <DialogFooter className="gap-2 border-t pt-4">
                <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold">إلغاء</Button>
                <Button type="submit" className="rounded-xl font-black px-10 shadow-lg shadow-primary/20">
                    <Save className="ml-2 h-4 w-4" />
                    {isEditing ? 'حفظ التعديلات' : 'إضافة المنشأة'}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}