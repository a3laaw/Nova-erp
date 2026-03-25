
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase } from '@/firebase';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { getCompanyFirebase } from '@/firebase/multi-tenant';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Building2, Key, Mail, Lock } from 'lucide-react';
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
          createdBy: masterAuth.currentUser?.uid,
        });

        // 2. إنشاء الفهرس العالمي للمستخدم
        const globalUserRef = doc(collection(masterFirestore, 'global_users'));
        transaction.set(globalUserRef, {
          email: formData.adminEmail.toLowerCase().trim(),
          companyId: companyId,
          role: 'Admin',
        });
      });

      // 3. إنشاء حساب الأدمن في مشروع المالك (Tenant Project)
      // نستخدم تهيئة مؤقتة
      const { auth: tenantAuth, firestore: tenantFirestore } = getCompanyFirebase(firebaseConfig, companyId);
      
      const userCredential = await createUserWithEmailAndPassword(tenantAuth, formData.adminEmail, formData.adminPassword);
      
      // 4. إنشاء UserProfile في Firestore الخاص بالشركة
      const userProfileRef = doc(tenantFirestore, 'users', userCredential.user.uid);
      await setDoc(userProfileRef, {
        uid: userCredential.user.uid,
        username: 'admin',
        email: formData.adminEmail,
        role: 'Admin',
        isActive: true,
        fullName: 'مدير النظام الأول',
        createdAt: serverTimestamp(),
      });

      // تسجيل الخروج من تطبيق الشركة المؤقت للعودة لجلسة المطور
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                    <Building2 className="h-6 w-6" />
                </div>
                <div>
                    <DialogTitle>إضافة شركة مستأجرة جديدة</DialogTitle>
                    <DialogDescription>أدخل بيانات الربط بـ Firebase Project المستقل للشركة.</DialogDescription>
                </div>
            </div>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            <section className="space-y-4">
                <h3 className="font-black text-sm text-indigo-600 border-r-4 border-indigo-600 pr-2">البيانات الأساسية</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">اسم الشركة (عربي)</Label>
                        <Input id="name" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="adminEmail">بريد الأدمن الأول</Label>
                        <Input id="adminEmail" type="email" value={formData.adminEmail} onChange={handleChange} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="adminPassword">كلمة مرور الأدمن</Label>
                        <Input id="adminPassword" type="password" value={formData.adminPassword} onChange={handleChange} required />
                    </div>
                </div>
            </section>

            <Separator />

            <section className="space-y-4">
                <h3 className="font-black text-sm text-indigo-600 border-r-4 border-indigo-600 pr-2">Firebase Config (Client Project)</h3>
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-2xl">
                    <div className="grid gap-2">
                        <Label htmlFor="apiKey">API Key</Label>
                        <Input id="apiKey" value={formData.apiKey} onChange={handleChange} required dir="ltr" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="projectId">Project ID</Label>
                        <Input id="projectId" value={formData.projectId} onChange={handleChange} required dir="ltr" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="authDomain">Auth Domain</Label>
                        <Input id="authDomain" value={formData.authDomain} onChange={handleChange} required dir="ltr" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="appId">App ID</Label>
                        <Input id="appId" value={formData.appId} onChange={handleChange} required dir="ltr" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="storageBucket">Storage Bucket</Label>
                        <Input id="storageBucket" value={formData.storageBucket} onChange={handleChange} required dir="ltr" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="messagingSenderId">Messaging Sender ID</Label>
                        <Input id="messagingSenderId" value={formData.messagingSenderId} onChange={handleChange} required dir="ltr" />
                    </div>
                </div>
            </section>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
                {isSaving ? <Loader2 className="animate-spin ml-2 h-4 w-4" /> : <Save className="ml-2 h-4 w-4" />}
                تأسيس بيئة العمل
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
import { setDoc as firestoreSetDoc } from 'firebase/firestore';
