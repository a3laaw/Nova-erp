'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { useFirebase } from '@/firebase';
import { collection, doc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getCompanyFirebase } from '@/firebase/multi-tenant';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Building2, Mail, Lock } from 'lucide-react';
import { cleanFirestoreData } from '@/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CompanyRegistrationForm({ isOpen, onClose }: Props) {
  const { firestore: masterFirestore, auth: masterAuth } = useFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    adminEmail: '',
    adminPassword: '',
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterFirestore || !masterAuth) return;

    setIsSaving(true);
    try {
      const companyId = `comp_${Math.random().toString(36).substring(2, 9)}`;
      const firebaseConfig = {
        apiKey: formData.apiKey,
        authDomain: formData.authDomain,
        projectId: formData.projectId,
        storageBucket: formData.storageBucket,
        messagingSenderId: formData.messagingSenderId,
        appId: formData.appId,
      };

      await runTransaction(masterFirestore, async (transaction) => {
        // 1. إنشاء وثيقة الشركة في مشروع الماستر
        const companyRef = doc(masterFirestore, 'companies', companyId);
        transaction.set(companyRef, {
          name: formData.name,
          nameEn: formData.nameEn,
          firebaseProjectId: formData.projectId,
          firebaseConfig,
          isActive: true,
          adminEmail: formData.adminEmail,
          createdAt: serverTimestamp(),
          createdBy: masterAuth.currentUser?.uid || 'system',
        });

        // 2. إنشاء الفهرس العالمي للمستخدم ليتمكن من الدخول من البوابة الموحدة
        const globalUserRef = doc(collection(masterFirestore, 'global_users'));
        transaction.set(globalUserRef, {
          email: formData.adminEmail.toLowerCase().trim(),
          companyId: companyId,
          role: 'Admin',
        });
      });

      // 3. إنشاء حساب الأدمن في مشروع المالك (Tenant Project)
      const { auth: tenantAuth, firestore: tenantFirestore } = getCompanyFirebase(firebaseConfig, companyId);
      
      const userCredential = await createUserWithEmailAndPassword(tenantAuth, formData.adminEmail, formData.adminPassword);
      
      // 4. إنشاء UserProfile في Firestore الخاص بالشركة لربط الصلاحيات
      const userProfileRef = doc(tenantFirestore, 'users', userCredential.user.uid);
      await setDoc(userProfileRef, cleanFirestoreData({
        uid: userCredential.user.uid,
        username: formData.adminEmail.split('@')[0],
        email: formData.adminEmail,
        role: 'Admin',
        isActive: true,
        fullName: 'مدير النظام الأول',
        createdAt: serverTimestamp(),
      }));

      // تسجيل الخروج من تطبيق الشركة المؤقت للعودة لجلسة المطور (حماية السيادة)
      await signOut(tenantAuth);

      toast({ title: 'نجاح التأسيس', description: 'تم إنشاء بيئة العمل وحساب الأدمن بنجاح.' });
      onClose();
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'فشل التأسيس', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl" dir="rtl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-4 border-b bg-indigo-50/50">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                    <Building2 className="h-6 w-6" />
                </div>
                <div>
                    <DialogTitle className="text-xl font-black text-indigo-950">إضافة شركة مستأجرة جديدة</DialogTitle>
                    <DialogDescription className="font-bold text-indigo-700/60">أدخل بيانات الربط بـ Firebase Project المستقل للشركة.</DialogDescription>
                </div>
            </div>
          </DialogHeader>

          <div className="grid gap-8 py-8 px-2">
            <section className="space-y-4">
                <h3 className="font-black text-sm text-indigo-600 border-r-4 border-indigo-600 pr-2">البيانات الأساسية والحساب الإداري</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="font-black text-gray-700 pr-1">اسم الشركة (بالعربية) *</Label>
                        <Input id="name" value={formData.name} onChange={handleChange} required className="h-11 rounded-xl border-2" placeholder="شركة الخليج للاستشارات..." />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="adminEmail" className="font-black text-gray-700 pr-1">بريد الأدمن (حساب الدخول الأول) *</Label>
                        <Input id="adminEmail" type="email" value={formData.adminEmail} onChange={handleChange} required dir="ltr" className="h-11 rounded-xl border-2" placeholder="admin@company.com" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="adminPassword" className="font-black text-gray-700 pr-1">كلمة مرور الأدمن *</Label>
                        <Input id="adminPassword" type="password" value={formData.adminPassword} onChange={handleChange} required className="h-11 rounded-xl border-2" placeholder="********" />
                    </div>
                </div>
            </section>

            <Separator className="bg-indigo-100" />

            <section className="space-y-4">
                <h3 className="font-black text-sm text-indigo-600 border-r-4 border-indigo-600 pr-2">Firebase Config (Client Infrastructure)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-3xl border-2 border-dashed">
                    <div className="grid gap-2">
                        <Label htmlFor="apiKey" className="text-[10px] font-black uppercase text-muted-foreground">API Key</Label>
                        <Input id="apiKey" value={formData.apiKey} onChange={handleChange} required dir="ltr" className="h-10 rounded-xl bg-white border-none shadow-sm" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="projectId" className="text-[10px] font-black uppercase text-muted-foreground">Project ID</Label>
                        <Input id="projectId" value={formData.projectId} onChange={handleChange} required dir="ltr" className="h-10 rounded-xl bg-white border-none shadow-sm" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="authDomain" className="text-[10px] font-black uppercase text-muted-foreground">Auth Domain</Label>
                        <Input id="authDomain" value={formData.authDomain} onChange={handleChange} required dir="ltr" className="h-10 rounded-xl bg-white border-none shadow-sm" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="appId" className="text-[10px] font-black uppercase text-muted-foreground">App ID</Label>
                        <Input id="appId" value={formData.appId} onChange={handleChange} required dir="ltr" className="h-10 rounded-xl bg-white border-none shadow-sm" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="storageBucket" className="text-[10px] font-black uppercase text-muted-foreground">Storage Bucket</Label>
                        <Input id="storageBucket" value={formData.storageBucket} onChange={handleChange} required dir="ltr" className="h-10 rounded-xl bg-white border-none shadow-sm" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="messagingSenderId" className="text-[10px] font-black uppercase text-muted-foreground">Messaging Sender ID</Label>
                        <Input id="messagingSenderId" value={formData.messagingSenderId} onChange={handleChange} required dir="ltr" className="h-10 rounded-xl bg-white border-none shadow-sm" />
                    </div>
                </div>
            </section>
          </div>

          <DialogFooter className="p-6 border-t bg-gray-50 flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="rounded-xl font-black h-12 px-12 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200 gap-2">
                {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                تأسيس بيئة العمل السيادية
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
