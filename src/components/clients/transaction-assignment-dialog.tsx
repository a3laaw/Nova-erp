
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { UserCheck, Loader2, Save, Send, ShieldCheck } from 'lucide-react';
import type { Employee, ClientTransaction } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transaction: ClientTransaction;
  clientName: string;
}

/**
 * محرك تحويل المعاملات السيادي (Transaction Transfer Engine V94.0):
 * يسمح بتغيير المهندس المسؤول وإرسال تنبيهات فورية وتوثيق الإجراء.
 */
export function TransactionAssignmentDialog({ isOpen, onClose, transaction, clientName }: Props) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [selectedEngineerId, setSelectedEngineerId] = useState(transaction.assignedEngineerId || '');
    const [isSaving, setIsSaving] = useState(false);
    const tenantId = currentUser?.currentCompanyId;

    const { data: engineers, loading: engLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);

    const engineerOptions = useMemo(() => 
        engineers.map(e => ({ value: e.id!, label: e.fullName }))
    , [engineers]);

    const handleTransfer = async () => {
        if (!firestore || !tenantId || !selectedEngineerId) return;
        setIsSaving(true);
        try {
            const txPath = getTenantPath(`clients/${transaction.clientId}/transactions/${transaction.id}`, tenantId);
            const engineer = engineers.find(e => e.id === selectedEngineerId);

            // 1. تحديث المعاملة
            await updateDoc(doc(firestore, txPath!), {
                assignedEngineerId: selectedEngineerId,
                updatedAt: serverTimestamp()
            });

            // 2. توثيق السجل التاريخي (History & Timeline)
            const logContent = `قام ${currentUser?.fullName} بتحويل مسؤولية المعاملة إلى المهندس: ${engineer?.fullName}.`;
            
            const timelinePath = getTenantPath(`clients/${transaction.clientId}/transactions/${transaction.id}/timelineEvents`, tenantId);
            const historyPath = getTenantPath(`clients/${transaction.clientId}/history`, tenantId);

            await addDoc(collection(firestore, timelinePath!), {
                type: 'log',
                content: logContent,
                userId: currentUser?.id,
                userName: currentUser?.fullName,
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            await addDoc(collection(firestore, historyPath!), {
                type: 'log',
                content: `[${transaction.transactionType}] ${logContent}`,
                userId: currentUser?.id,
                userName: currentUser?.fullName,
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            // 3. إرسال إشعار فوري للمهندس المستلم
            const targetUserId = await findUserIdByEmployeeId(firestore, selectedEngineerId, tenantId);
            if (targetUserId) {
                await createNotification(firestore, {
                    userId: targetUserId,
                    title: '📂 تم تحويل معاملة إليك',
                    body: `حول إليك ${currentUser?.fullName} المعاملة "${transaction.transactionType}" للعميل ${clientName}.`,
                    link: `/dashboard/clients/${transaction.clientId}/transactions/${transaction.id}`
                }, tenantId);
            }

            toast({ title: '✅ تم تحويل المسار الفني بنجاح' });
            onClose();
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إتمام عملية التحويل.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
                <DialogHeader className="p-8 bg-primary/5 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                            <UserCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black text-[#1e1b4b]">تحويل مسؤولية المعاملة</DialogTitle>
                            <DialogDescription className="font-bold text-slate-500">سيتم إشعار المهندس المستلم فوراً وتعديل صلاحيات الرؤية.</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 space-y-6">
                    <div className="p-5 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <Label className="text-[10px] font-black text-slate-400 uppercase pr-1 block mb-1">المعاملة الحالية:</Label>
                        <p className="font-black text-lg text-primary">{transaction.transactionType}</p>
                    </div>

                    <div className="grid gap-3">
                        <Label className="font-black text-slate-700 pr-2">اختر المهندس المستلم *</Label>
                        <InlineSearchList 
                            value={selectedEngineerId}
                            onSelect={setSelectedEngineerId}
                            options={engineerOptions}
                            placeholder={engLoading ? "جاري جلب القائمة..." : "ابحث عن مهندس..."}
                        />
                    </div>

                    <Alert className="bg-blue-50 border-blue-100 rounded-2xl">
                        <ShieldCheck className="h-5 w-5 text-blue-600" />
                        <AlertTitle className="text-blue-900 font-black">أثر التحويل:</AlertTitle>
                        <AlertDescription className="text-blue-800 text-xs font-bold leading-relaxed">
                            هذه المعاملة ستختفي من لوحات تحكم المهندسين الآخرين وستظهر حصراً لهذا المهندس (وللأقسام الإدارية والرقابية).
                        </AlertDescription>
                    </Alert>
                </div>

                <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                    <Button onClick={handleTransfer} disabled={isSaving || !selectedEngineerId} className="flex-1 h-12 rounded-xl font-black text-lg shadow-xl shadow-primary/30 gap-2">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5"/> : <Send className="h-4 w-4 rotate-180" />}
                        تأكيد التحويل
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
