'use client';

import { useState, useEffect, useRef } from 'react';
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
import { collection, doc, runTransaction, serverTimestamp, setDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getCompanyFirebase } from '@/firebase/multi-tenant';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Save, 
  Building2, 
  Mail, 
  Lock, 
  Database, 
  DatabaseZap, 
  X, 
  ShieldCheck, 
  Key, 
  Globe, 
  Cloud,
  LayoutGrid 
} from 'lucide-react';
import { cleanFirestoreData, cn } from '@/lib/utils';
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
  const savingRef = useRef(false);

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
                adminPassword: '', 
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
    if (!masterFirestore || !masterAuth || savingRef.current) return;

    savingRef.current = true;
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
          const companyRef = doc(masterFirestore, 'companies', company.id);
          await updateDoc(companyRef, cleanFirestoreData({
              name: formData.name,
              nameEn: formData.nameEn,
              firebaseProjectId: formData.projectId,
              firebaseConfig,
              updatedAt: serverTimestamp()
          }));
          toast({ title: 'نجاح التحديث', description: 'تم تحديث بيانات الربط بالمنشأة.' });
      } else {
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

          try {
            const { auth: tenantAuth, firestore: tenantFirestore } = getCompanyFirebase(firebaseConfig, companyId);
            const userCredential = await createUserWithEmailAndPassword(tenantAuth, formData.adminEmail.toLowerCase().trim(), formData.adminPassword);
            
            const userProfileRef = doc(tenantFirestore, 'users', userCredential.user.uid);
            await setDoc(userProfileRef, cleanFirestoreData({
                uid: userCredential.user.uid,
                username: formData.adminEmail.split('@')[0],
                email: formData.adminEmail.toLowerCase().trim(),
                role: 'Admin',
                isActive: true,
                fullName: 'المدير العام (الأدمن)',
                createdAt: serverTimestamp(),
            }));
            await signOut(tenantAuth);
          } catch (tenantErr: any) {
              if (tenantErr.code === 'auth/email-already-in-use') {
                  console.log("Admin account already exists in target project, skipping auth creation.");
              } else { throw tenantErr; }
          }

          toast({ title: 'نجاح التأسيس', description: 'تم ربط المنشأة وتأسيس بيئة العمل بنجاح.' });
      }

      onClose();
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'فشل التأسيس', description: error.message });
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <DialogContent className="max-w-4xl p-0 rounded-[2.5rem] border-none shadow-[0_50px_100px_rgba(0,0,0,0.4)] overflow-hidden bg-white" dir="rtl">
        <form onSubmit={handleSubmit} className="flex flex-col h-[90vh]">
          {/* Header */}
          <DialogHeader className="p-8 bg-[#1e1b4b] text-white shrink-0 relative overflow-hidden text-right">
            <div className="flex items-center justify-between w-full relative z-10">
                <div className="flex items-center gap-6">
                    <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl border border-white/20">
                        <DatabaseZap className="h-8 w-8" />
                    </div>
                    <div className="text-right">
                        <DialogTitle className="text-2xl font-black text-white tracking-tight">{isEditing ? 'تعديل سيادة المنشأة' : 'تأسيس منشأة سحابية جديدة'}</DialogTitle>
                        <DialogDescription className="font-bold text-indigo-200 text-sm mt-1">إدارة الربط السحابي ومفاتيح الوصول الحيوية.</DialogDescription>
                    </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-white/60 hover:text-white rounded-full bg-white/10 h-10 w-10"><X className="h-5 w-5"/></Button>
            </div>
          </DialogHeader>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-10 space-y-12 bg-white scrollbar-thin scrollbar-thumb-slate-200">
                {/* Section 1 */}
                <section className="space-y-6">
                    <h3 className="font-black text-xl text-[#1e1b4b] border-r-8 border-indigo-600 pr-4 flex items-center gap-3">
                        <Building2 className="h-6 w-6 text-indigo-600" /> هويـة المنشأة والحسـاب الإداري
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100 shadow-inner">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="font-black text-[#1e1b4b] text-sm pr-1">اسم المنشأة (بالعربية) *</Label>
                            <Input id="name" value={formData.name} onChange={handleChange} required className="h-12 rounded-xl border-2 border-slate-200 bg-white text-[#1e1b4b] font-black text-lg focus:border-indigo-600 focus:ring-0 transition-all" placeholder="مثال: شركة آفاق للهندسة" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="nameEn" className="font-black text-[#1e1b4b] text-sm pr-1">اسم المنشأة (بالإنجليزية)</Label>
                            <Input id="nameEn" value={formData.nameEn} onChange={handleChange} dir="ltr" className="h-12 rounded-xl border-2 border-slate-200 bg-white text-[#1e1b4b] font-black text-lg focus:border-indigo-600 focus:ring-0 transition-all" placeholder="Afaq Engineering" />
                        </div>
                        {!isEditing && (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="adminEmail" className="font-black text-[#1e1b4b] text-sm pr-1 flex items-center gap-2"><Mail className="h-3 w-3 text-indigo-600"/> بريد المدير العام *</Label>
                                    <Input id="adminEmail" type="email" value={formData.adminEmail} onChange={handleChange} required dir="ltr" className="h-12 rounded-xl border-2 border-slate-200 bg-white text-[#1e1b4b] font-bold" placeholder="admin@company.com" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="adminPassword" className="font-black text-[#1e1b4b] text-sm pr-1 flex items-center gap-2"><Lock className="h-3 w-3 text-indigo-600"/> كلمة المرور التأسيسية *</Label>
                                    <Input id="adminPassword" type="password" value={formData.adminPassword} onChange={handleChange} required className="h-12 rounded-xl border-2 border-slate-200 bg-white text-[#1e1b4b] font-bold" placeholder="********" />
                                </div>
                            </>
                        )}
                    </div>
                </section>

                <Separator className="bg-slate-100 h-0.5" />

                {/* Section 2 - Firebase Config */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-xl text-[#1e1b4b] border-r-8 border-indigo-600 pr-4 flex items-center gap-3">
                            <Cloud className="h-6 w-6 text-indigo-600" /> مصفوفة الربط السحابي (Firebase Config)
                        </h3>
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-black px-4 py-1 rounded-full uppercase tracking-widest text-[10px]">Isolated Infrastructure</Badge>
                    </div>
                    
                    <div className="p-10 rounded-[3rem] border-2 border-dashed border-indigo-200 bg-indigo-50/30 shadow-inner">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-right">
                            {/* Ordered according to user request */}
                            <div className="grid gap-2 md:col-span-2">
                                <Label htmlFor="apiKey" className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <Key className="h-3 w-3" /> API KEY *
                                </Label>
                                <Input id="apiKey" value={formData.apiKey} onChange={handleChange} required dir="ltr" className="h-12 rounded-xl border-2 border-indigo-100 bg-white text-[#1e1b4b] font-mono text-xs focus:border-indigo-600 transition-all shadow-sm" placeholder="AIzaSy..." />
                            </div>
                            
                            <div className="grid gap-2">
                                <Label htmlFor="authDomain" className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <Globe className="h-3 w-3" /> AUTH DOMAIN *
                                </Label>
                                <Input id="authDomain" value={formData.authDomain} onChange={handleChange} required dir="ltr" className="h-12 rounded-xl border-2 border-indigo-100 bg-white text-[#1e1b4b] font-mono text-xs focus:border-indigo-600 transition-all shadow-sm" placeholder="...firebaseapp.com" />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="projectId" className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <Database className="h-3 w-3" /> PROJECT ID *
                                </Label>
                                <Input id="projectId" value={formData.projectId} onChange={handleChange} required dir="ltr" className="h-12 rounded-xl border-2 border-indigo-100 bg-white text-[#1e1b4b] font-mono text-xs focus:border-indigo-600 transition-all shadow-sm" placeholder="company-prj-123" />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="storageBucket" className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <Cloud className="h-3 w-3" /> STORAGE BUCKET
                                </Label>
                                <Input id="storageBucket" value={formData.storageBucket} onChange={handleChange} dir="ltr" className="h-12 rounded-xl border-2 border-indigo-100 bg-white text-[#1e1b4b] font-mono text-xs focus:border-indigo-600 transition-all shadow-sm" placeholder="...firebasestorage.app" />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="messagingSenderId" className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <ShieldCheck className="h-3 w-3" /> MESSAGING SENDER ID
                                </Label>
                                <Input id="messagingSenderId" value={formData.messagingSenderId} onChange={handleChange} dir="ltr" className="h-12 rounded-xl border-2 border-indigo-100 bg-white text-[#1e1b4b] font-mono text-xs focus:border-indigo-600 transition-all shadow-sm" placeholder="828494..." />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="appId" className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <LayoutGrid className="h-3 w-3" /> APP ID *
                                </Label>
                                <Input id="appId" value={formData.appId} onChange={handleChange} required dir="ltr" className="h-12 rounded-xl border-2 border-indigo-100 bg-white text-[#1e1b4b] font-mono text-xs focus:border-indigo-600 transition-all shadow-sm" placeholder="1:828494:web:..." />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="measurementId" className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <Target className="h-3 w-3" /> MEASUREMENT ID
                                </Label>
                                <Input id="measurementId" value={formData.measurementId} onChange={handleChange} dir="ltr" className="h-12 rounded-xl border-2 border-indigo-100 bg-white text-[#1e1b4b] font-mono text-xs focus:border-indigo-600 transition-all shadow-sm" placeholder="G-XXXXXX" />
                            </div>
                        </div>
                    </div>
                </section>
          </div>

          {/* Footer */}
          <DialogFooter className="p-8 border-t bg-slate-50 shrink-0 flex gap-4">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-2xl font-black h-14 px-10 text-slate-500 hover:bg-slate-200">إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="rounded-2xl font-black h-14 px-20 bg-[#1e1b4b] text-white hover:bg-black shadow-xl gap-4 text-xl min-w-[320px] transition-all">
                {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                {isEditing ? 'حفظ التحديثات السيادية' : 'تأسيس بيئة العمل السحابية'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
