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
import { Separator } from '@/components/ui/separator';
import { useFirebase } from '@/firebase';
import { collection, doc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getCompanyFirebase } from '@/firebase/multi-tenant';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Building2, Mail, Lock, Info, Database } from 'lucide-react';
import { cleanFirestoreData } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';

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
        apiKey: formData.apiKey.trim(),
        authDomain: formData.authDomain.trim(),
        projectId: formData.projectId.trim(),
        storageBucket: formData.storageBucket.trim(),
        messagingSenderId: formData.messagingSenderId.trim(),
        appId: formData.appId.trim(),
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
          adminEmail: formData.adminEmail.toLowerCase().trim(),
          createdAt: serverTimestamp(),
          createdBy: masterAuth.currentUser?.uid || 'system',
        });

        // 2. إنشاء الفهرس العالمي للمستخدم
        const globalUserRef = doc(collection(masterFirestore, 'global_users'));
        transaction.set(globalUserRef, {
          email: formData.adminEmail.toLowerCase().trim(),
          companyId: companyId,
          role: 'Admin',
        });
      });

      // 3. إنشاء حساب الأدمن في مشروع المالك
      const { auth: tenantAuth, firestore: tenantFirestore } = getCompanyFirebase(firebaseConfig, companyId);
      const userCredential = await createUserWithEmailAndPassword(tenantAuth, formData.adminEmail.toLowerCase().trim(), formData.adminPassword);
      
      const userProfileRef = doc(tenantFirestore, 'users', userCredential.user.uid);
      await setDoc(userProfileRef, cleanFirestoreData({
        uid: userCredential.user.uid,
        username: formData.adminEmail.split('@')[0],
        email: formData.adminEmail.toLowerCase().trim(),
        role: 'Admin',
        isActive: true,
        fullName: 'مدير النظام الأول',
        createdAt: serverTimestamp(),
      }));

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
      <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-0 rounded-[2.5rem] border-none shadow-2xl overflow-hidden" dir="rtl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DialogHeader className="p-8 bg-indigo-50/50 border-b shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                    <Building2 className="h-8 w-8" />
                </div>
                <div>
                    <DialogTitle className="text-2xl font-black text-indigo-950">إضافة شركة مستأجرة جديدة</DialogTitle>
                    <DialogDescription className="font-bold text-indigo-700/60 text-base">أدخل بيانات الربط بـ Firebase Project المستقل للشركة.</DialogDescription>
                </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-8 space-y-10">
                <section className="space-y-6">
                    <h3 className="font-black text-lg text-indigo-600 border-r-4 border-indigo-600 pr-3 flex items-center gap-2">
                        <Mail className="h-5 w-5" /> البيانات الأساسية والحساب الإداري
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="font-black text-gray-700 pr-1">اسم الشركة (بالعربية) *</Label>
                            <Input id="name" value={formData.name} onChange={handleChange} required className="h-12 rounded-2xl border-2" placeholder="شركة الخليج للاستشارات..." />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="adminEmail" className="font-black text-gray-700 pr-1">بريد الأدمن (حساب الدخول الأول) *</Label>
                            <Input id="adminEmail" type="email" value={formData.adminEmail} onChange={handleChange} required dir="ltr" className="h-12 rounded-2xl border-2" placeholder="admin@company.com" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="adminPassword" className="font-black text-gray-700 pr-1">كلمة مرور الأدمن *</Label>
                            <Input id="adminPassword" type="password" value={formData.adminPassword} onChange={handleChange} required className="h-12 rounded-2xl border-2" placeholder="********" />
                        </div>
                    </div>
                </section>

                <Separator className="bg-indigo-100" />

                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-lg text-indigo-600 border-r-4 border-indigo-600 pr-3 flex items-center gap-2">
                            <Database className="h-5 w-5" /> Firebase Config (Tenant Metadata)
                        </h3>
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">الربط السحابي</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-8 rounded-[2rem] border-2 border-dashed">
                        <div className="grid gap-2">
                            <Label htmlFor="apiKey" className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">API Key <Info className="h-3 w-3"/></Label>
                            <Input id="apiKey" value={formData.apiKey} onChange={handleChange} required dir="ltr" className="h-11 rounded-xl bg-white border-none shadow-inner" placeholder="AIzaSy..." />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="projectId" className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">Project ID <Info className="h-3 w-3"/></Label>
                            <Input id="projectId" value={formData.projectId} onChange={handleChange} required dir="ltr" className="h-11 rounded-xl bg-white border-none shadow-inner" placeholder="nova-project-123" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="authDomain" className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">Auth Domain <Info className="h-3 w-3"/></Label>
                            <Input id="authDomain" value={formData.authDomain} onChange={handleChange} required dir="ltr" className="h-11 rounded-xl bg-white border-none shadow-inner" placeholder="...firebaseapp.com" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="appId" className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">App ID <Info className="h-3 w-3"/></Label>
                            <Input id="appId" value={formData.appId} onChange={handleChange} required dir="ltr" className="h-11 rounded-xl bg-white border-none shadow-inner" placeholder="1:828494..." />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="storageBucket" className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">Storage Bucket <Info className="h-3 w-3"/></Label>
                            <Input id="storageBucket" value={formData.storageBucket} onChange={handleChange} required dir="ltr" className="h-11 rounded-xl bg-white border-none shadow-inner" placeholder="...firebasestorage.app" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="messagingSenderId" className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">Messaging Sender ID <Info className="h-3 w-3"/></Label>
                            <Input id="messagingSenderId" value={formData.messagingSenderId} onChange={handleChange} required dir="ltr" className="h-11 rounded-xl bg-white border-none shadow-inner" placeholder="828494..." />
                        </div>
                    </div>
                </section>
            </div>
          </ScrollArea>

          <DialogFooter className="p-8 border-t bg-gray-50 flex gap-3 shrink-0">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-2xl font-bold h-14 px-10">إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="rounded-2xl font-black h-14 px-16 bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl shadow-indigo-200 gap-3 text-xl min-w-[300px]">
                {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                تأسيس بيئة العمل السيادية
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
