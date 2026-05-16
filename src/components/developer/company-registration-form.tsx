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
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Save, 
  DatabaseZap, 
  X, 
  Key, 
  Eye,
  EyeOff,
  Sparkles,
  Cloud,
  ShieldCheck,
  CreditCard,
  Users,
  Calendar,
  Zap,
  Lock,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { cleanFirestoreData, cn } from '@/lib/utils';
import type { Company } from '@/lib/types';
import { addDays, addMonths, addYears } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '../ui/date-input';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Switch } from '../ui/switch';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  company?: Company | null;
}

export function CompanyRegistrationForm({ isOpen, onClose, company = null }: Props) {
  const { firestore: masterFirestore } = useFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isEditing = !!company;
  const savingRef = useRef(false);

  const adminUidRef = useRef('');

  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    activityType: 'consulting',
    adminEmail: '',
    adminPassword: '',
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '',
    subscriptionType: 'trial' as 'trial' | 'premium',
    maxUsersLimit: 5,
    trialEndDate: undefined as Date | undefined,
    subscriptionExpiryDate: undefined as Date | undefined,
    isActive: true,
  });

  useEffect(() => {
    if (isOpen && company && masterFirestore) {
        const fetchAdminUid = async () => {
            const q = query(collection(masterFirestore, 'global_users'), where('email', '==', company.adminEmail));
            const snap = await getDocs(q);
            if (!snap.empty) {
                adminUidRef.current = snap.docs[0].data().uid;
            }
        };
        fetchAdminUid();
    }
  }, [isOpen, company, masterFirestore]);

  useEffect(() => {
    if (isOpen) {
        if (company) {
            setFormData({
                name: company.name || '',
                nameEn: company.nameEn || '',
                activityType: (company as any).activity || 'consulting',
                adminEmail: company.adminEmail || '',
                adminPassword: company.adminPassword || '', 
                apiKey: company.firebaseConfig?.apiKey || '',
                authDomain: company.firebaseConfig?.authDomain || '',
                projectId: company.firebaseConfig?.projectId || '',
                storageBucket: company.firebaseConfig?.storageBucket || '',
                messagingSenderId: company.firebaseConfig?.messagingSenderId || '',
                appId: company.firebaseConfig?.appId || '',
                measurementId: company.firebaseConfig?.measurementId || '',
                subscriptionType: company.subscriptionType || 'trial',
                maxUsersLimit: company.maxUsersLimit || 5,
                trialEndDate: company.trialEndDate ? (company.trialEndDate.toDate ? company.trialEndDate.toDate() : new Date(company.trialEndDate.seconds * 1000)) : undefined,
                subscriptionExpiryDate: company.subscriptionExpiryDate ? (company.subscriptionExpiryDate.toDate ? company.subscriptionExpiryDate.toDate() : new Date(company.subscriptionExpiryDate.seconds * 1000)) : undefined,
                isActive: company.isActive ?? true,
            });
        } else {
            const defaultTrialEnd = addDays(new Date(), 7);
            const defaultExpiry = addMonths(new Date(), 1);
            setFormData({
                name: '', nameEn: '', activityType: 'consulting', adminEmail: '', adminPassword: '',
                apiKey: '', authDomain: '', projectId: '', storageBucket: '',
                messagingSenderId: '', appId: '', measurementId: '',
                subscriptionType: 'trial',
                maxUsersLimit: 5,
                trialEndDate: defaultTrialEnd,
                subscriptionExpiryDate: defaultExpiry,
                isActive: true,
            });
        }
    }
  }, [isOpen, company]);

  const generateStrongPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, adminPassword: password }));
  };

  const handleFillMasterConfig = () => {
      setFormData(prev => ({
          ...prev,
          apiKey: "AIzaSyCOreHYZzC4Egia3d7uWUOWKdzPxQ9MrS4",
          authDomain: "nov-erp-1-25549967-c24e5.firebaseapp.com",
          projectId: "nov-erp-1-25549967-c24e5",
          storageBucket: "nov-erp-1-25549967-c24e5.firebasestorage.app",
          messagingSenderId: "71297676078",
          appId: "1:71297676078:web:b956ab00372e6ba237c0bf",
          measurementId: ""
      }));
      toast({ title: '✅ تم جلب بيانات الماستر' });
  };

  const handleQuickAddDate = (type: 'month' | 'year') => {
      const current = formData.subscriptionExpiryDate || new Date();
      const next = type === 'month' ? addMonths(current, 1) : addYears(current, 1);
      setFormData(prev => ({ ...prev, subscriptionExpiryDate: next }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: id === 'maxUsersLimit' ? parseInt(value) || 0 : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterFirestore || savingRef.current) return;

    savingRef.current = true;
    setIsSaving(true);
    try {
      const companyId = isEditing ? company!.id! : `comp-${Math.random().toString(36).substring(2, 9)}`;

      const authResponse = await fetch('/api/manage-tenant-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              email: formData.adminEmail,
              password: formData.adminPassword,
              displayName: formData.name,
              uid: adminUidRef.current,
              companyId: companyId,
              action: isEditing ? 'update_full' : 'create'
          })
      });
      
      const authResult = await authResponse.json();
      if (!authResult.success) throw new Error(authResult.message || authResult.error);

      const firebaseConfig = {
        apiKey: formData.apiKey?.trim() || '',
        authDomain: formData.authDomain?.trim() || '',
        projectId: formData.projectId?.trim() || '',
        storageBucket: formData.storageBucket?.trim() || '',
        messagingSenderId: formData.messagingSenderId?.trim() || '',
        appId: formData.appId?.trim() || '',
        measurementId: formData.measurementId?.trim() || '',
      };

      const batch = writeBatch(masterFirestore);
      const companyRef = doc(masterFirestore, 'companies', companyId);

      batch.set(companyRef, cleanFirestoreData({
          name: formData.name,
          nameEn: formData.nameEn,
          activity: formData.activityType,
          adminEmail: formData.adminEmail.toLowerCase().trim(),
          adminPassword: formData.adminPassword,
          firebaseProjectId: formData.projectId,
          firebaseConfig,
          isActive: formData.isActive,
          subscriptionType: formData.subscriptionType,
          maxUsersLimit: Number(formData.maxUsersLimit) || 5,
          trialEndDate: formData.trialEndDate ? Timestamp.fromDate(formData.trialEndDate) : null,
          subscriptionExpiryDate: formData.subscriptionExpiryDate ? Timestamp.fromDate(formData.subscriptionExpiryDate) : null,
          updatedAt: serverTimestamp(),
          ...(!isEditing && { createdAt: serverTimestamp() })
      }), { merge: true });

      const globalIndexRef = doc(collection(masterFirestore, 'global_users'), authResult.uid);
      batch.set(globalIndexRef, {
          email: formData.adminEmail.toLowerCase().trim(),
          username: formData.adminEmail.split('@')[0],
          companyId: companyId,
          uid: authResult.uid,
          role: 'Admin',
          createdAt: serverTimestamp(),
      });

      const tenantUserRef = doc(masterFirestore, `companies/${companyId}/users`, authResult.uid);
      batch.set(tenantUserRef, {
          id: authResult.uid,
          uid: authResult.uid,
          email: formData.adminEmail.toLowerCase().trim(),
          fullName: formData.name,
          role: 'Admin',
          isActive: true,
          companyId: companyId,
          updatedAt: serverTimestamp(),
          ...(!isEditing && { createdAt: serverTimestamp() })
      }, { merge: true });

      await batch.commit();
      toast({ title: '✅ تم الحفظ والمزامنة السحابية' });
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ سيادي', description: error.message });
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <DialogContent className="max-w-4xl p-0 rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white" dir="rtl">
        <form onSubmit={handleSubmit} className="flex flex-col h-[90vh]">
          <DialogHeader className="p-8 bg-[#1e1b4b] text-white shrink-0 relative overflow-hidden text-right">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl border border-white/20">
                        <DatabaseZap className="h-8 w-8" />
                    </div>
                    <div className="text-right">
                        <DialogTitle className="text-2xl font-black">{isEditing ? 'تعديل بيانات المنشأة' : 'تأسيس منشأة سحابية جديدة'}</DialogTitle>
                        <DialogDescription className="font-bold text-indigo-200 text-sm mt-1">إدارة الربط السحابي، بيانات الدخول، ونظام التراخيص والفوترة.</DialogDescription>
                    </div>
                </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-10 space-y-12">
                {/* 1. الهوية والحساب */}
                <section className="space-y-6">
                    <h3 className="font-black text-xl text-[#1e1b4b] border-r-8 border-indigo-600 pr-4">هوية المنشأة والحساب الإداري</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100">
                        <div className="grid gap-2">
                            <Label className="font-black text-xs pr-1">اسم المنشأة *</Label>
                            <Input id="name" value={formData.name} onChange={handleChange} required className="h-12 rounded-xl border-2" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-black text-xs pr-1">البريد الإداري (Login) *</Label>
                            <Input id="adminEmail" type="email" value={formData.adminEmail} onChange={handleChange} required dir="ltr" className="h-12 rounded-xl border-2" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-black text-xs pr-1">كلمة المرور *</Label>
                            <div className="relative">
                                <Input 
                                    id="adminPassword" 
                                    type={showPassword ? "text" : "password"} 
                                    value={formData.adminPassword} 
                                    onChange={e => setFormData(prev => ({ ...prev, adminPassword: e.target.value }))} 
                                    required 
                                    className="h-12 rounded-xl border-2 pl-12 pr-10" 
                                />
                                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Button type="button" variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 pt-6">
                            <Button type="button" variant="outline" onClick={generateStrongPassword} className="h-11 rounded-xl gap-2 font-bold text-xs">
                                <RefreshCw className="h-3 w-3" /> توليد كلمة مرور قوية
                            </Button>
                        </div>
                    </div>
                </section>

                {/* 2. نظام التراخيص والاشتراك */}
                <section className="space-y-6">
                    <h3 className="font-black text-xl text-purple-700 border-r-8 border-purple-600 pr-4 flex items-center gap-3">
                        <CreditCard className="h-6 w-6 text-purple-600" /> نظام التراخيص والتحصيل المالي
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 rounded-[2.5rem] bg-purple-50/30 border-2 border-purple-100 shadow-inner">
                        <div className="space-y-6">
                            <div className="grid gap-2">
                                <Label className="font-black text-xs pr-1">نوع الخطة (Subscription Plan)</Label>
                                <Select value={formData.subscriptionType} onValueChange={(v: any) => setFormData(p => ({...p, subscriptionType: v}))}>
                                    <SelectTrigger className="h-12 rounded-xl border-2 bg-white font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="trial">نسخة تجريبية (Demo)</SelectItem>
                                        <SelectItem value="premium">نسخة أساسية (Premium)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label className="font-black text-xs pr-1 flex items-center gap-1"><Users className="h-3 w-3"/> حد المستخدمين (Quota Limit)</Label>
                                <Input id="maxUsersLimit" type="number" value={formData.maxUsersLimit} onChange={handleChange} className="h-12 rounded-xl border-2 bg-white font-black text-center text-xl text-purple-700" />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border shadow-sm">
                                <div className="space-y-0.5">
                                    <Label className="font-black text-sm">تنشيط الخدمة للعميل</Label>
                                    <p className="text-[10px] text-muted-foreground font-bold">إلغاء التنشيط يحظر دخول كافة الموظفين فوراً.</p>
                                </div>
                                <Switch checked={formData.isActive} onCheckedChange={v => setFormData(p => ({...p, isActive: v}))} />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="p-6 bg-white rounded-[2rem] border-2 border-dashed border-purple-200">
                                <div className="flex items-center gap-3 mb-4">
                                    <Wallet className="h-5 w-5 text-purple-600" />
                                    <Label className="font-black text-purple-900">إدارة تاريخ الاستحقاق والسداد</Label>
                                </div>
                                
                                <div className="grid gap-4">
                                    <div className="grid gap-1.5">
                                        <Label className="text-[10px] font-black uppercase text-slate-500 mr-1">تاريخ انتهاء الاشتراك القادم *</Label>
                                        <DateInput value={formData.subscriptionExpiryDate} onChange={d => setFormData(p => ({...p, subscriptionExpiryDate: d}))} className="bg-background border-2" />
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAddDate('month')} className="flex-1 h-9 rounded-lg font-bold text-[10px] gap-1">
                                            + شهر إضافي
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => handleQuickAddDate('year')} className="flex-1 h-9 rounded-lg font-bold text-[10px] gap-1 text-primary border-primary/20">
                                            + سنة كاملة
                                        </Button>
                                    </div>
                                    
                                    <Alert className="mt-2 bg-purple-50/50 border-none p-3 rounded-xl">
                                        <Zap className="h-3 w-3 text-purple-600" />
                                        <AlertDescription className="text-[9px] font-bold text-purple-800 leading-tight">
                                            عند تجاوز هذا التاريخ، ستظهر للمستخدم شاشة "درع الحظر المالي" ولن يتمكن من الوصول للبيانات حتى يتم تمديد التاريخ من قبلك.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. الربط السحابي */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-xl text-indigo-600 border-r-8 border-indigo-600 pr-4 flex items-center gap-3">
                            <Cloud className="h-6 w-6 text-indigo-600" /> مصفوفة الربط السحابي (Firebase)
                        </h3>
                        <Button 
                            type="button" 
                            onClick={handleFillMasterConfig}
                            variant="outline" 
                            className="rounded-xl font-black text-xs gap-2 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                        >
                            <Sparkles className="h-4 w-4" /> تعبئة تلقائية ببيانات الماستر
                        </Button>
                    </div>
                    
                    <div className="p-10 rounded-[3rem] border-2 border-dashed border-indigo-200 bg-indigo-50/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-right">
                            <div className="grid gap-3 md:col-span-2">
                                <Label className="text-[10px] font-black uppercase text-black flex items-center gap-2 mr-1">
                                    <Key className="h-3 w-3" /> API KEY
                                </Label>
                                <Input value={formData.apiKey} onChange={e => setActivationConfig(p => ({...p, apiKey: e.target.value}))} dir="ltr" className="h-12 rounded-xl border-2 bg-white font-mono text-xs" placeholder="AIzaSy..." />
                            </div>
                            <div className="grid gap-3">
                                <Label className="text-[10px] font-black uppercase text-black mr-1">PROJECT ID</Label>
                                <Input value={formData.projectId} onChange={e => setActivationConfig(p => ({...p, projectId: e.target.value}))} dir="ltr" className="h-12 rounded-xl border-2 bg-white font-mono text-xs" />
                            </div>
                            <div className="grid gap-3">
                                <Label className="text-[10px] font-black uppercase text-black mr-1">APP ID</Label>
                                <Input value={formData.appId} onChange={e => setActivationConfig(p => ({...p, appId: e.target.value}))} dir="ltr" className="h-12 rounded-xl border-2 bg-white font-mono text-xs" />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
          </ScrollArea>

          <DialogFooter className="p-8 border-t bg-slate-50 shrink-0 flex gap-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="rounded-2xl font-black h-14 px-10 border-2">إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="rounded-2xl font-black h-14 px-20 bg-[#1e1b4b] text-white hover:bg-black shadow-xl gap-4 text-xl min-w-[320px]">
                {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <Zap className="h-6 w-6 text-yellow-400" />}
                {isEditing ? 'حفظ التغييرات السيادية' : 'حفظ ومزامنة الهوية'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
