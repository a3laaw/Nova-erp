
'use client';

import { useState, useEffect } from 'react';
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
import { collection, doc, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getCompanyFirebase } from '@/firebase/multi-tenant';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Building2, Mail, Lock, Info, Database, DatabaseZap, X, ShieldCheck } from 'lucide-react';
import { cleanFirestoreData, cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import type { Company } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  company?: Company | null;
}

export function CompanyRegistrationForm({ isOpen, onClose, company = null }: Props) {
  const { firestore: masterFirestore, auth: masterAuth } = useFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!company;

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
    measurementId: '',
  });

  useEffect(() => {
    if (isOpen) {
        if (company) {
            setFormData({
                name: company.name || '',
                nameEn: company.nameEn || '',
                adminEmail: company.adminEmail || '',
                adminPassword: '', // Don't show password on edit
                apiKey: company.firebaseConfig.apiKey || '',
                authDomain: company.firebaseConfig.authDomain || '',
                projectId: company.firebaseConfig.projectId || '',
                storageBucket: company.firebaseConfig.storageBucket || '',
                messagingSenderId: company.firebaseConfig.messagingSenderId || '',
                appId: company.firebaseConfig.appId || '',
                measurementId: company.firebaseConfig.measurementId || '',
            });
        } else {
            setFormData({
                name: '', nameEn: '', adminEmail: '', adminPassword: '',
                apiKey: '', authDomain: '', projectId: '', storageBucket: '',
                messagingSenderId: '', appId: '', measurementId: '',
            });
        }
    }
  }, [isOpen, company]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterFirestore || !masterAuth) return;

    setIsSaving(true);
    try {
      const firebaseConfig = {
        apiKey: formData.apiKey.trim(),
        authDomain: formData.authDomain.trim(),
        projectId: formData.projectId.trim(),
        storageBucket: formData.storageBucket.trim(),
        messagingSenderId: formData.messagingSenderId.trim(),
        appId: formData.appId.trim(),
        measurementId: formData.measurementId.trim(),
      };

      if (isEditing && company?.id) {
          // --- عملية التعديل السيادي ---
          const companyRef = doc(masterFirestore, 'companies', company.id);
          await updateDoc(companyRef, cleanFirestoreData({
              name: formData.name,
              nameEn: formData.nameEn,
              firebaseProjectId: formData.projectId,
              firebaseConfig,
              updatedAt: serverTimestamp()
          }));
          toast({ title: 'نجاح التحديث', description: 'تم تحديث بيانات الربط بالشركة بنجاح.' });
      } else {
          // --- عملية التأسيس الجديد ---
          const companyId = `comp_${Math.random().toString(36).substring(2, 9)}`;
          
          await runTransaction(masterFirestore, async (transaction) => {
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

            const globalUserRef = doc(collection(masterFirestore, 'global_users'));
            transaction.set(globalUserRef, {
              email: formData.adminEmail.toLowerCase().trim(),
              companyId: companyId,
              role: 'Admin',
            });
          });

          // إنشاء حساب الأدمن في مشروع المالك
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
      }

      onClose();
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'خطأ سيادي', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col p-0 rounded-[2.5rem] border-none shadow-2xl overflow-hidden glass-effect" dir="rtl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DialogHeader className="p-8 bg-indigo-950/40 border-b border-white/10 shrink-0">
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                        <DatabaseZap className="h-8 w-8" />
                    </div>
                    <div className="text-right">
                        <DialogTitle className="text-2xl font-black text-white">{isEditing ? 'تعديل بيانات المنشأة' : 'تأسيس منشأة هندسية جديدة'}</DialogTitle>
                        <DialogDescription className="font-bold text-indigo-200/60 text-sm">إدارة الربط السحابي ومفاتيح الوصول لمشروع Firebase المستقل.</DialogDescription>
                    </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-white/40 hover:text-white rounded-full"><X className="h-6 w-6"/></Button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-8 space-y-10">
                {/* القسم الأول: الهوية */}
                <section className="space-y-6">
                    <h3 className="font-black text-lg text-indigo-400 border-r-4 border-indigo-500 pr-3 flex items-center gap-2">
                        <Building2 className="h-5 w-5" /> البيانات الأساسية والحساب الإداري
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 p-6 rounded-[2rem] border border-white/10">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="font-black text-indigo-100 pr-1">اسم الشركة (بالعربية) *</Label>
                            <Input id="name" value={formData.name} onChange={handleChange} required className="h-12 rounded-2xl border-white/10 bg-white/5 text-white font-bold" placeholder="شركة آفاق للهندسة..." />
                        </div>
                        {!isEditing && (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="adminEmail" className="font-black text-indigo-100 pr-1">بريد الأدمن الأول *</Label>
                                    <Input id="adminEmail" type="email" value={formData.adminEmail} onChange={handleChange} required dir="ltr" className="h-12 rounded-2xl border-white/10 bg-white/5 text-white font-bold" placeholder="admin@company.com" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="adminPassword" className="font-black text-indigo-100 pr-1">كلمة المرور التأسيسية *</Label>
                                    <Input id="adminPassword" type="password" value={formData.adminPassword} onChange={handleChange} required className="h-12 rounded-2xl border-white/10 bg-white/5 text-white font-bold" placeholder="********" />
                                </div>
                            </>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="nameEn" className="font-black text-indigo-100 pr-1">اسم الشركة (بالإنجليزية)</Label>
                            <Input id="nameEn" value={formData.nameEn} onChange={handleChange} dir="ltr" className="h-12 rounded-2xl border-white/10 bg-white/5 text-white font-bold" placeholder="Afaq Engineering..." />
                        </div>
                    </div>
                </section>

                <Separator className="bg-white/5" />

                {/* القسم الثاني: الربط التقني - الترتيب المعتمد */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-lg text-indigo-400 border-r-4 border-indigo-500 pr-3 flex items-center gap-2">
                            <Database className="h-5 w-5" /> Firebase Configuration (Isolated Project)
                        </h3>
                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30 font-black">ربط سحابي سيادي</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-indigo-950/20 p-8 rounded-[2.5rem] border-2 border-dashed border-white/10">
                        <div className="grid gap-2 md:col-span-2">
                            <Label htmlFor="apiKey" className="text-[10px] font-black uppercase text-indigo-300 tracking-widest flex items-center gap-1">API Key *</Label>
                            <Input id="apiKey" value={formData.apiKey} onChange={handleChange} required dir="ltr" className="h-11 rounded-xl bg-white/5 border-white/10 text-white font-mono text-xs shadow-inner" placeholder="AIzaSy..." />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="authDomain" className="text-[10px] font-black uppercase text-indigo-300 tracking-widest flex items-center gap-1">Auth Domain *</Label>
                            <Input id="authDomain" value={formData.authDomain} onChange={handleChange} required dir="ltr" className="h-11 rounded-xl bg-white/5 border-white/10 text-white font-mono text-xs" placeholder="...firebaseapp.com" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="projectId" className="text-[10px] font-black uppercase text-indigo-300 tracking-widest flex items-center gap-1">Project ID *</Label>
                            <Input id="projectId" value={formData.projectId} onChange={handleChange} required dir="ltr" className="h-11 rounded-xl bg-white/5 border-white/10 text-white font-mono text-xs" placeholder="nova-erp-123" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="storageBucket" className="text-[10px] font-black uppercase text-indigo-300 tracking-widest flex items-center gap-1">Storage Bucket</Label>
                            <Input id="storageBucket" value={formData.storageBucket} onChange={handleChange} dir="ltr" className="h-11 rounded-xl bg-white/5 border-white/10 text-white font-mono text-xs" placeholder="...firebasestorage.app" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="messagingSenderId" className="text-[10px] font-black uppercase text-indigo-300 tracking-widest flex items-center gap-1">Messaging Sender ID</Label>
                            <Input id="messagingSenderId" value={formData.messagingSenderId} onChange={handleChange} dir="ltr" className="h-11 rounded-xl bg-white/5 border-white/10 text-white font-mono text-xs" placeholder="828494..." />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="appId" className="text-[10px] font-black uppercase text-indigo-300 tracking-widest flex items-center gap-1">App ID *</Label>
                            <Input id="appId" value={formData.appId} onChange={handleChange} required dir="ltr" className="h-11 rounded-xl bg-white/5 border-white/10 text-white font-mono text-xs" placeholder="1:828494:web:..." />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="measurementId" className="text-[10px] font-black uppercase text-indigo-300 tracking-widest flex items-center gap-1">Measurement ID</Label>
                            <Input id="measurementId" value={formData.measurementId} onChange={handleChange} dir="ltr" className="h-11 rounded-xl bg-white/5 border-white/10 text-white font-mono text-xs" placeholder="G-XXXXXX..." />
                        </div>
                    </div>
                </section>
            </div>
          </ScrollArea>

          <DialogFooter className="p-8 border-t border-white/10 bg-indigo-950/40 shrink-0 flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-2xl font-bold h-14 px-10 text-white/60 hover:text-white hover:bg-white/5">إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="rounded-2xl font-black h-14 px-16 bg-white text-indigo-950 hover:bg-white/90 shadow-2xl shadow-indigo-500/20 gap-3 text-xl min-w-[300px] border-b-4 border-indigo-200 active:translate-y-1 active:border-b-0 transition-all">
                {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                {isEditing ? 'حفظ التحديثات' : 'تأسيس بيئة العمل السيادية'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
