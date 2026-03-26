
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
import { Loader2, Save, Building2, Mail, Lock, Info, Database, DatabaseZap, X, ShieldCheck, Key, Globe, Cloud } from 'lucide-react';
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

          // محاولة إنشاء الحساب في المشروع المستهدف (إذا لم يكن موجوداً)
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
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 rounded-[3rem] border-none shadow-[0_50px_100px_rgba(0,0,0,0.6)] overflow-hidden glass-effect" dir="rtl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DialogHeader className="p-10 bg-indigo-950/60 border-b border-white/10 shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center justify-between w-full relative z-10">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-indigo-600 rounded-[2rem] text-white shadow-2xl shadow-indigo-500/40 border-2 border-white/20">
                        <DatabaseZap className="h-10 w-10" />
                    </div>
                    <div className="text-right">
                        <DialogTitle className="text-3xl font-black text-white tracking-tight">{isEditing ? 'تعديل سيادة المنشأة' : 'تأسيس منشأة سحابية جديدة'}</DialogTitle>
                        <DialogDescription className="font-black text-indigo-300/80 text-base mt-1">إدارة الربط السحابي ومفاتيح الوصول الحيوية.</DialogDescription>
                    </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-white/40 hover:text-white rounded-full bg-white/5 hover:bg-white/10 h-12 w-12"><X className="h-6 w-6"/></Button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-10 space-y-12">
                {/* القسم الأول: الهوية */}
                <section className="space-y-8">
                    <h3 className="font-black text-xl text-indigo-400 border-r-8 border-indigo-500 pr-4 flex items-center gap-3">
                        <Building2 className="h-6 w-6" /> هويـة المنشأة والحسـاب الإداري
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white/5 p-8 rounded-[2.5rem] border border-white/10 shadow-inner">
                        <div className="grid gap-3">
                            <Label htmlFor="name" className="font-black text-white text-sm pr-1">اسم المنشأة (بالعربية) *</Label>
                            <Input id="name" value={formData.name} onChange={handleChange} required className="h-12 rounded-2xl border-white/20 bg-white/5 text-white font-black text-lg placeholder:text-white/10" placeholder="مثال: شركة آفاق للهندسة" />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="nameEn" className="font-black text-white text-sm pr-1">اسم المنشأة (بالإنجليزية)</Label>
                            <Input id="nameEn" value={formData.nameEn} onChange={handleChange} dir="ltr" className="h-12 rounded-2xl border-white/20 bg-white/5 text-white font-black text-lg placeholder:text-white/10" placeholder="Afaq Engineering" />
                        </div>
                        {!isEditing && (
                            <>
                                <div className="grid gap-3">
                                    <Label htmlFor="adminEmail" className="font-black text-white text-sm pr-1 flex items-center gap-2"><Mail className="h-3 w-3 text-indigo-400"/> بريد المدير العام *</Label>
                                    <Input id="adminEmail" type="email" value={formData.adminEmail} onChange={handleChange} required dir="ltr" className="h-12 rounded-2xl border-white/20 bg-white/5 text-white font-black text-lg" placeholder="admin@company.com" />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="adminPassword" className="font-black text-white text-sm pr-1 flex items-center gap-2"><Lock className="h-3 w-3 text-indigo-400"/> كلمة المرور التأسيسية *</Label>
                                    <Input id="adminPassword" type="password" value={formData.adminPassword} onChange={handleChange} required className="h-12 rounded-2xl border-white/20 bg-white/5 text-white font-black text-lg" placeholder="********" />
                                </div>
                            </>
                        )}
                    </div>
                </section>

                <Separator className="bg-white/5 h-0.5" />

                {/* القسم الثاني: الربط التقني - الترتيب المعتمد */}
                <section className="space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-xl text-indigo-400 border-r-8 border-indigo-500 pr-4 flex items-center gap-3">
                            <Cloud className="h-6 w-6" /> مصفوفة الربط السحابي (Firebase Config)
                        </h3>
                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/40 font-black px-4 py-1 rounded-full uppercase tracking-widest text-[10px]">Isolated Core</Badge>
                    </div>
                    
                    <div className="bg-indigo-950/40 p-10 rounded-[3rem] border-2 border-dashed border-white/10 shadow-2xl relative group/config">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            <div className="grid gap-3 md:col-span-2">
                                <Label htmlFor="apiKey" className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <Key className="h-3 w-3" /> API Key *
                                </Label>
                                <Input id="apiKey" value={formData.apiKey} onChange={handleChange} required dir="ltr" className="h-12 rounded-2xl bg-white/5 border-white/10 text-white font-mono text-xs shadow-inner focus:bg-white/10 transition-all" placeholder="AIzaSy..." />
                            </div>
                            <div className="grid gap-3">
                                <Label htmlFor="authDomain" className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <Globe className="h-3 w-3" /> Auth Domain *
                                </Label>
                                <Input id="authDomain" value={formData.authDomain} onChange={handleChange} required dir="ltr" className="h-12 rounded-2xl bg-white/5 border-white/10 text-white font-mono text-xs focus:bg-white/10 transition-all" placeholder="...firebaseapp.com" />
                            </div>
                            <div className="grid gap-3">
                                <Label htmlFor="projectId" className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <Database className="h-3 w-3" /> Project ID *
                                </Label>
                                <Input id="projectId" value={formData.projectId} onChange={handleChange} required dir="ltr" className="h-12 rounded-2xl bg-white/5 border-white/10 text-white font-mono text-xs focus:bg-white/10 transition-all" placeholder="company-prj-123" />
                            </div>
                            <div className="grid gap-3">
                                <Label htmlFor="storageBucket" className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <Cloud className="h-3 w-3" /> Storage Bucket
                                </Label>
                                <Input id="storageBucket" value={formData.storageBucket} onChange={handleChange} dir="ltr" className="h-12 rounded-2xl bg-white/5 border-white/10 text-white font-mono text-xs focus:bg-white/10 transition-all" placeholder="...firebasestorage.app" />
                            </div>
                            <div className="grid gap-3">
                                <Label htmlFor="messagingSenderId" className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <ShieldCheck className="h-3 w-3" /> Messaging Sender ID
                                </Label>
                                <Input id="messagingSenderId" value={formData.messagingSenderId} onChange={handleChange} dir="ltr" className="h-12 rounded-2xl bg-white/5 border-white/10 text-white font-mono text-xs focus:bg-white/10 transition-all" placeholder="828494..." />
                            </div>
                            <div className="grid gap-3">
                                <Label htmlFor="appId" className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <LayoutGrid className="h-3 w-3" /> App ID *
                                </Label>
                                <Input id="appId" value={formData.appId} onChange={handleChange} required dir="ltr" className="h-12 rounded-2xl bg-white/5 border-white/10 text-white font-mono text-xs focus:bg-white/10 transition-all" placeholder="1:828494:web:..." />
                            </div>
                            <div className="grid gap-3">
                                <Label htmlFor="measurementId" className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] flex items-center gap-2 mr-1">
                                    <Info className="h-3 w-3" /> Measurement ID
                                </Label>
                                <Input id="measurementId" value={formData.measurementId} onChange={handleChange} dir="ltr" className="h-12 rounded-2xl bg-white/5 border-white/10 text-white font-mono text-xs focus:bg-white/10 transition-all" placeholder="G-XXXXXX" />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
          </ScrollArea>

          <DialogFooter className="p-10 border-t border-white/10 bg-indigo-950/60 shrink-0 flex gap-4">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-2xl font-black h-16 px-12 text-white/40 hover:text-white hover:bg-white/5 text-lg">إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="rounded-2xl font-black h-16 px-20 bg-white text-indigo-950 hover:bg-indigo-50 shadow-[0_20px_50px_rgba(255,255,255,0.2)] gap-4 text-2xl min-w-[380px] border-b-8 border-indigo-200 active:translate-y-1 active:border-b-0 transition-all">
                {isSaving ? <Loader2 className="animate-spin h-8 w-8" /> : <ShieldCheck className="h-8 w-8" />}
                {isEditing ? 'حفظ التحديثات السيادية' : 'تأسيس بيئة العمل السحابية'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
