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
import { useFirebase } from '@/firebase';
import { doc, writeBatch, serverTimestamp, getDocs, query, where, Timestamp, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, DatabaseZap, X, ShieldCheck, CreditCard, Users, RefreshCw } from 'lucide-react';
import { cleanFirestoreData } from '@/lib/utils';
import type { Company } from '@/lib/types';
import { addDays, addMonths } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '../ui/date-input';
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
  const isEditing = !!company;
  const savingRef = useRef(false);

  const [formData, setFormData] = useState({
    name: '',
    adminEmail: '',
    adminPassword: '',
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    subscriptionType: 'trial' as 'trial' | 'premium',
    maxUsersLimit: 5,
    trialEndDate: undefined as Date | undefined,
    subscriptionExpiryDate: undefined as Date | undefined,
    isActive: true,
  });

  useEffect(() => {
    if (isOpen) {
        if (company) {
            setFormData({
                name: company.name || '',
                adminEmail: company.adminEmail || '',
                adminPassword: '', 
                apiKey: company.firebaseConfig?.apiKey || '',
                authDomain: company.firebaseConfig?.authDomain || '',
                projectId: company.firebaseConfig?.projectId || '',
                storageBucket: company.firebaseConfig?.storageBucket || '',
                messagingSenderId: company.firebaseConfig?.messagingSenderId || '',
                appId: company.firebaseConfig?.appId || '',
                subscriptionType: company.subscriptionType || 'trial',
                maxUsersLimit: company.maxUsersLimit || 5,
                trialEndDate: company.trialEndDate ? (company.trialEndDate.toDate ? company.trialEndDate.toDate() : new Date(company.trialEndDate.seconds * 1000)) : undefined,
                subscriptionExpiryDate: company.subscriptionExpiryDate ? (company.subscriptionExpiryDate.toDate ? company.subscriptionExpiryDate.toDate() : new Date(company.subscriptionExpiryDate.seconds * 1000)) : undefined,
                isActive: company.isActive ?? true,
            });
        } else {
            setFormData({
                name: '', adminEmail: '', adminPassword: '',
                apiKey: '', authDomain: '', projectId: '', storageBucket: '',
                messagingSenderId: '', appId: '', 
                subscriptionType: 'trial', maxUsersLimit: 5,
                trialEndDate: addDays(new Date(), 7),
                subscriptionExpiryDate: addMonths(new Date(), 1),
                isActive: true,
            });
        }
    }
  }, [isOpen, company]);

  const handleFillMasterConfig = () => {
      setFormData(prev => ({
          ...prev,
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterFirestore || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const companyId = isEditing ? company!.id! : `comp-${Math.random().toString(36).substring(2, 9)}`;
      const batch = writeBatch(masterFirestore);
      const companyRef = doc(masterFirestore, 'companies', companyId);

      batch.set(companyRef, cleanFirestoreData({
          name: formData.name,
          adminEmail: formData.adminEmail.toLowerCase().trim(),
          firebaseConfig: {
              apiKey: formData.apiKey,
              authDomain: formData.authDomain,
              projectId: formData.projectId,
              storageBucket: formData.storageBucket,
              messagingSenderId: formData.messagingSenderId,
              appId: formData.appId
          },
          isActive: formData.isActive,
          subscriptionType: formData.subscriptionType,
          maxUsersLimit: Number(formData.maxUsersLimit),
          trialEndDate: formData.trialEndDate ? Timestamp.fromDate(formData.trialEndDate) : null,
          subscriptionExpiryDate: formData.subscriptionExpiryDate ? Timestamp.fromDate(formData.subscriptionExpiryDate) : null,
          updatedAt: serverTimestamp(),
          ...(!isEditing && { createdAt: serverTimestamp() })
      }), { merge: true });

      await batch.commit();
      toast({ title: '✅ تم حفظ بيانات المنشأة' });
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: error.message });
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white" dir="rtl">
        <form onSubmit={handleSubmit} className="flex flex-col h-[85vh]">
          <DialogHeader className="p-8 bg-slate-900 text-white shrink-0 text-right">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl text-white"><DatabaseZap className="h-8 w-8" /></div>
                    <DialogTitle className="text-2xl font-black">إعدادات المنشأة السحابية</DialogTitle>
                </div>
          </DialogHeader>
          <ScrollArea className="flex-1 p-10">
                <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="grid gap-2"><Label>اسم المنشأة *</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                        <div className="grid gap-2"><Label>البريد الإداري *</Label><Input value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} required dir="ltr" /></div>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center"><h3 className="font-black text-indigo-600">إعدادات الربط السحابي (Firebase)</h3><Button type="button" variant="outline" size="sm" onClick={handleFillMasterConfig}>استخدام إعدادات الماستر</Button></div>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border-2 border-dashed">
                        <div className="grid gap-2"><Label>API Key</Label><Input value={formData.apiKey} onChange={e => setFormData({...formData, apiKey: e.target.value})} dir="ltr" /></div>
                        <div className="grid gap-2"><Label>Project ID</Label><Input value={formData.projectId} onChange={e => setFormData({...formData, projectId: e.target.value})} dir="ltr" /></div>
                    </div>
                </div>
          </ScrollArea>
          <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="h-12 px-12 rounded-xl font-black">{isSaving ? <Loader2 className="animate-spin"/> : <Save/>} حفظ التغييرات</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
