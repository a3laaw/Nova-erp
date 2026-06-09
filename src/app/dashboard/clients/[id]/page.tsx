'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, collection, query, getDocs, writeBatch, serverTimestamp, 
         updateDoc, deleteDoc, addDoc, where, orderBy, getDoc, 
         runTransaction, limit, deleteField } from 'firebase/firestore';

// 📌 استيراد المكونات
import { ClientHistoryTimeline } from '@/components/clients/client-history-timeline';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import { TransactionAssignmentDialog } from '@/components/clients/transaction-assignment-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Printer, Phone, User, Badge, MapPin, PlusCircle, ShieldCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// 📌 الأنواع
import type { Client, ClientTransaction, Employee, Quotation, Account } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: any }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-2 text-sm text-black">
            <div className="flex-shrink-0 pt-1 text-muted-foreground">{icon}</div>
            <div>
                <p className="font-bold text-muted-foreground">{label}</p>
                <div className="text-foreground font-black">{value}</div>
            </div>
        </div>
    );
}

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  // 📌 استخراج معرف العميل من الـ URL
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const tenantId = currentUser?.currentCompanyId;

  // 📌 حالات الواجهة
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [assignmentTx, setAssignmentTx] = useState<ClientTransaction | null>(null);
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
  const [transactionToDelete, setTransactionToDelete] = useState<ClientTransaction | null>(null);
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const [transactionToCancel, setTransactionToCancel] = useState<ClientTransaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 📌 مسار العميل في Firestore
  const clientPath = useMemo(() => 
    id && tenantId ? getTenantPath(`clients/${id}`, tenantId) : null, 
  [id, tenantId]);

  // 🔄 جلب بيانات العميل
  const { data: clientData, loading: clientLoading } = useSubscription<Client>(firestore, clientPath);
  const client = useMemo(() => 
    (clientData && clientData.length > 0) ? clientData[0] : null, 
  [clientData]);

  // 🔐 صلاحيات العرض (Admin, Accountant, HR, Secretary, Developer)
  const isPrivileged = useMemo(() => 
    ['Admin', 'Accountant', 'HR', 'Secretary', 'Developer'].includes(currentUser?.role || '')
  , [currentUser?.role]);

  // 📌 جلب المعاملات من مكانين:
  // 1) nested: clients/{id}/transactions
  const { data: nestedTransactions, loading: nestedLoading } = useSubscription<ClientTransaction>(
      firestore, 
      `clients/${id}/transactions`,
      [] 
  );

  // 2) flat: transactions collection
  const flatTxQuery = useMemo(() => {
    const base = [where('clientId', '==', id)];
    if (!isPrivileged && currentUser?.employeeId) {
        base.push(where('assignedEngineerId', '==', currentUser.employeeId));
    }
    return base;
  }, [id, isPrivileged, currentUser?.employeeId]);

  const { data: flatTransactions, loading: flatLoading } = useSubscription<ClientTransaction>(
      firestore, 
      'transactions', 
      flatTxQuery
  );

  // 📌 دمج المعاملات وإزالة التكرارات
  const transactions = useMemo(() => {
    const all = [...nestedTransactions, ...flatTransactions];
    const seen = new Set();
    return all.filter(tx => {
        if (seen.has(tx.id)) return false;
        seen.add(tx.id);
        return true;
    }).sort((a, b) => 
        (toFirestoreDate(b.createdAt)?.getTime() || 0) - 
        (toFirestoreDate(a.createdAt)?.getTime() || 0)
    );
  }, [nestedTransactions, flatTransactions]);

  // 📌 جلب عروض الأسعار
  const qQuery = useMemo(() => [where('clientId', '==', id)], [id]);
  const { data: quotations, loading: quotationsLoading } = useSubscription<Quotation>(
      firestore, 'quotations', qQuery
  );
  
  // 📌 جلب قائمة الموظفين (المهندسين)
  useEffect(() => {
    if (!firestore || !tenantId) return;
    const empPath = getTenantPath('employees', tenantId);
    getDocs(query(collection(firestore, empPath!), where('status', '==', 'active'))).then(snap => {
        const newMap = new Map<string, string>();
        snap.forEach(doc => newMap.set(doc.id, doc.data().fullName));
        setEmployeesMap(newMap);
    });
  }, [firestore, tenantId]);

  // ═══════════════════════════════════════════════════════════════
  //                    العمليات المحاسبية والمالية
  // ═══════════════════════════════════════════════════════════════

  // ❌ حذف عرض سعر
  const handleConfirmDeleteQuotation = async () => {
    if (!quotationToDelete || !firestore || !tenantId) return;
    setIsProcessing(true);
    try {
        const qPath = getTenantPath(`quotations/${quotationToDelete.id}`, tenantId);
        await deleteDoc(doc(firestore, qPath!));
        
        // 📝 تسجيل في سجل العميل
        const historyPath = getTenantPath(`clients/${id}/history`, tenantId);
        await addDoc(collection(firestore, historyPath!), {
            type: 'log',
            content: `قام ${currentUser?.fullName} بحذف عرض السعر رقم "${quotationToDelete.quotationNumber}" نهائياً.`,
            createdAt: serverTimestamp(),
            userId: currentUser?.id,
            userName: currentUser?.fullName,
            userAvatar: currentUser?.avatarUrl,
            companyId: tenantId
        });
        toast({ title: '✅ تم حذف عرض السعر' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
    } finally {
        setIsProcessing(false);
        setQuotationToDelete(null);
    }
  };

  // ❌ حذف معاملة
  const handleConfirmDeleteTransaction = async () => {
    if (!transactionToDelete || !firestore || !tenantId) return;
    setIsProcessing(true);
    try {
        let txPath = getTenantPath(`transactions/${transactionToDelete.id}`, tenantId)!;
        const checkSnap = await getDoc(doc(firestore, txPath));
        if (!checkSnap.exists()) {
            txPath = getTenantPath(`clients/${id}/transactions/${transactionToDelete.id}`, tenantId)!;
        }

        await deleteDoc(doc(firestore, txPath));
        
        // 📝 تسجيل في سجل العميل
        const historyPath = getTenantPath(`clients/${id}/history`, tenantId);
        await addDoc(collection(firestore, historyPath!), {
            type: 'log',
            content: `قام ${currentUser?.fullName} بحذف المعاملة رقم "${transactionToDelete.transactionNumber}" نهائياً.`,
            createdAt: serverTimestamp(),
            userId: currentUser?.id,
            userName: currentUser?.fullName,
            userAvatar: currentUser?.avatarUrl,
            companyId: tenantId
        });
        toast({ title: '✅ تم حذف المعاملة' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
    } finally {
        setIsProcessing(false);
        setTransactionToDelete(null);
    }
  };

  // 🚫 فسخ العقد المالي + ترصيد عكسي
  const handleConfirmCancelContract = async () => {
    if (!firestore || !tenantId || !transactionToCancel?.id || !id || !currentUser) return;
    setIsProcessing(true);
    
    let finalTxPath = getTenantPath(`transactions/${transactionToCancel.id}`, tenantId)!;
    try {
        // 🔍 البحث عن المسار الصحيح
        const checkRef = doc(firestore, finalTxPath);
        const snap = await getDoc(checkRef);
        if (!snap.exists()) {
            finalTxPath = getTenantPath(`clients/${id}/transactions/${transactionToCancel.id}`, tenantId)!;
        }

        await runTransaction(firestore, async (transaction_fs) => {
            const currentYear = new Date().getFullYear();
            
            // 📊 حساب المبالغ المحصلة
            const receiptsPath = getTenantPath('cashReceipts', tenantId);
            const receiptsSnap = await getDocs(query(collection(firestore, receiptsPath!), 
                where('projectId', '==', transactionToCancel.id)));
            const totalCollected = receiptsSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
            
            const originalTotal = transactionToCancel.contract?.totalAmount || 0;
            const amountToReverse = Math.max(0, originalTotal - totalCollected);

            // 🔍 البحث عن الحسابات في شجرة الحسابات
            const coaPath = getTenantPath('chartOfAccounts', tenantId)!;
            const revenueAccSnap = await getDocs(query(collection(firestore, coaPath), 
                where('code', '==', '4101'), limit(1)));
            const clientAccSnap = await getDocs(query(collection(firestore, coaPath), 
                where('name', '==', client?.nameAr), where('parentCode', '==', '1102'), limit(1)));

            // 📝 إنشاء قيد عكسي
            if (amountToReverse > 0 && !revenueAccSnap.empty && !clientAccSnap.empty) {
                const revenueAccountId = revenueAccSnap.docs[0].id;
                const clientAccountId = clientAccSnap.docs[0].id;

                const jeCounterRef = doc(firestore, getTenantPath('counters/journalEntries', tenantId)!);
                const jeCounterDoc = await transaction_fs.get(jeCounterRef);
                const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                
                transaction_fs.update(jeCounterRef, { [`counts.${currentYear}`]: nextJeNum }, { merge: true });
                
                const newJeRef = doc(collection(firestore, getTenantPath('journalEntries', tenantId)!));

                // ⚠️ القيد العكسي لإغلاق المديونية
                transaction_fs.set(newJeRef, cleanFirestoreData({
                    entryNumber: `REV-${currentYear}-${nextJeNum.toString().padStart(4, '0')}`,
                    date: serverTimestamp(),
                    narration: `ترصيد عكسي لفسخ العقد رقم ${transactionToCancel.transactionNumber} - ${client?.nameAr}`,
                    status: 'posted',
                    clientId: id,
                    lines: [
                        { accountId: clientAccountId, debit: 0, credit: amountToReverse, description: 'ترحيل من عقد ملغي' },
                        { accountId: revenueAccountId, debit: amountToReverse, credit: 0, description: 'ترحيل من عقد ملغي' }
                    ],
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                    companyId: tenantId
                }));
            }

            // ❌ تحديث حالة المعاملة
            transaction_fs.update(doc(firestore, finalTxPath), {
                status: 'cancelled',
                cancelledAt: serverTimestamp(),
                cancelledBy: currentUser.id,
                cancelledReason: 'فسخ تعاقدي'
            });

            // 📝 سجل فسخ العقد
            const historyPath = getTenantPath(`clients/${id}/history`, tenantId);
            transaction_fs.set(doc(collection(firestore, historyPath)), {
                type: 'log',
                content: `قام ${currentUser.fullName} بفسخ العقد المالي للمعاملة رقم ${transactionToCancel.transactionNumber}.`,
                createdAt: serverTimestamp(),
                userId: currentUser.id,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                companyId: tenantId
            });
        });

        toast({ title: '✅ تم فسخ العقد وإجراء الترصيد العكسي' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في فسخ العقد' });
    } finally {
        setIsProcessing(false);
        setTransactionToCancel(null);
    }
  };

  // 🔒 تجميد / إعادة تفعيل المعاملة
  const handleToggleFreeze = async (tx: ClientTransaction) => {
    if (!firestore || !tenantId || !tx.id) return;
    setIsProcessing(true);
    try {
        const newStatus = tx.status === 'on-hold' ? 'in-progress' : 'on-hold';
        const actions = { 'on-hold': 'تجميد', 'in-progress': 'إعادة تفعيل' };
        
        let txPath = getTenantPath(`transactions/${tx.id}`, tenantId)!;
        const snap = await getDoc(doc(firestore, txPath));
        if (!snap.exists()) txPath = getTenantPath(`clients/${id}/transactions/${tx.id}`, tenantId)!;
        
        await updateDoc(doc(firestore, txPath), { status: newStatus });
        
        const historyPath = getTenantPath(`clients/${id}/history`, tenantId);
        await addDoc(collection(firestore, historyPath!), {
            type: 'log',
            content: `قام ${currentUser?.fullName} بـ${actions[newStatus]} المعاملة رقم "${tx.transactionNumber}".`,
            createdAt: serverTimestamp(),
            userId: currentUser?.id,
            userName: currentUser?.fullName,
            userAvatar: currentUser?.avatarUrl,
            companyId: tenantId
        });
        
        toast({ title: `✅ تم ${actions[newStatus]}` });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ' });
    } finally {
        setIsProcessing(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  //                         واجهة العرض
  // ═══════════════════════════════════════════════════════════════

  if (clientLoading) {
    return <div>جاري التحميل...</div>;
  }

  if (!client) {
    return <div>العميل غير موجود</div>;
  }

  return (
    <div className="space-y-6">
      
      {/* ──────────────────────────── معلومات العميل ──────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{client.nameAr}</CardTitle>
              <CardDescription>رقم الملف: {client.fileNumber}</CardDescription>
            </div>
            <div className="flex gap-2">
              {/* ✏️ تعديل */}
              <Link href={`/dashboard/clients/${id}/edit`}>
                <Button variant="outline"><Pencil /> تعديل</Button>
              </Link>
              {/* 🖨️ كشف الحساب */}
              <Link href={`/dashboard/clients/${id}/statement`}>
                <Button variant="outline"><Printer /> كشف حساب</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoRow icon={<Phone />} label="الجوال" value={client.mobile} />
            <InfoRow icon={<User />} label="المهندس المسؤول" 
                     value={employeesMap.get(client.engineerId) || client.engineerId} />
            <InfoRow icon={<Badge />} label="الحالة" value={client.status} />
            {/* 📍 العنوان */}
            {client.address && (
              <InfoRow icon={<MapPin />} label="العنوان" 
                       value={`${client.address.area || ''} - ${client.address.street || ''}`} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ──────────────────────────── التبويبات ──────────────────────────── */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">المعاملات ({transactions.length})</TabsTrigger>
          <TabsTrigger value="quotations">عروض الأسعار ({quotations?.length || 0})</TabsTrigger>
        </TabsList>

        {/* 📋 قائمة المعاملات */}
        <TabsContent value="transactions">
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle /> إضافة معاملة جديدة
          </Button>
          
          {transactions.map(tx => {
            const hasSignedContract = !!tx.contract?.clauses?.length;
            return (
              <Card key={tx.id} className="mb-4">
                {/* ... عرض المعاملة ... */}
              </Card>
            );
          })}
        </TabsContent>

        {/* 📄 عروض الأسعار */}
        <TabsContent value="quotations">
          {/* ... عرض عروض الأسعار ... */}
        </TabsContent>
      </Tabs>

      {/* ──────────────────────────── سجل التغييرات ──────────────────────────── */}
      <ClientHistoryTimeline clientId={id} />

      {/* ──────────────────────────── الحوارات ──────────────────────────── */}
      {isFormOpen && <ClientTransactionForm 
          isOpen={isFormOpen} 
          onClose={() => setIsFormOpen(false)} 
          clientId={id} 
          clientName={client.nameAr} 
      />}
      
      {assignmentTx && <TransactionAssignmentDialog 
          isOpen={!!assignmentTx} 
          onClose={() => setAssignmentTx(null)} 
          transaction={assignmentTx} 
          clientName={client.nameAr} 
      />}

      {/* 🚫 حوار فسخ العقد */}
      <AlertDialog open={!!transactionToCancel} onOpenChange={() => setTransactionToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد فسخ العقد والترصيد العكسي؟</AlertDialogTitle>
            <AlertDialogDescription>
              <Alert>
                <ShieldCheck />
                <AlertTitle>الإجراء المحاسبي الآلي:</AlertTitle>
                <AlertDescription>
                  سيقوم النظام آلياً بتوليد قيد عكسي لإغلاق مديونية العميل المتبقية وإلغاء استحقاق الإيرادات.
                </AlertDescription>
              </Alert>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancelContract}>
              نعم، فسخ وتسوية
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
