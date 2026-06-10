'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import {
    collection, query, where, orderBy, onSnapshot,
    doc, writeBatch, serverTimestamp, updateDoc, addDoc, getDoc, runTransaction
} from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';
import type { Transaction } from '@/lib/types';
import { Loader2, FolderSymlink, AlertCircle, MoreHorizontal, FileText, Pencil, Trash2, Ban, FolderLock, FolderOpen, FileSignature, Calculator } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const getStatusVariant = (status: string) => {
    switch (status) {
        case 'new': return 'secondary';
        case 'in-progress': return 'default';
        case 'completed': return 'success';
        case 'cancelled': return 'destructive';
        case 'on-hold': return 'warning';
        default: return 'outline';
    }
};

export function ClientTransactionsList({ clientId }: { clientId: string }) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [transactionToCancel, setTransactionToCancel] = useState<Transaction | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const tenantId = currentUser?.currentCompanyId;

    useEffect(() => {
        if (!firestore || !tenantId || !clientId) return;
        setLoading(true);

        // ✅ PATTERN: Combine nested and flat queries with deduplication
        const nestedPath = getTenantPath(`clients/${clientId}/transactions`, tenantId);
        const flatPath = getTenantPath('transactions', tenantId);

        const qNested = query(collection(firestore, nestedPath!));
        const qFlat = query(collection(firestore, flatPath!), where('clientId', '==', clientId));

        const unsubNested = onSnapshot(qNested, (snap) => updateTransactions(snap, 'nested'));
        const unsubFlat = onSnapshot(qFlat, (snap) => updateTransactions(snap, 'flat'));

        const allTransactions: { [key: string]: Transaction } = {};
        let nestedDone = false, flatDone = false;

        const updateTransactions = (snapshot: any, type: 'nested' | 'flat') => {
            snapshot.docs.forEach((doc: any) => {
                allTransactions[doc.id] = { id: doc.id, ...doc.data() } as Transaction;
            });

            if (type === 'nested') nestedDone = true;
            if (type === 'flat') flatDone = true;

            // Combine, sort, and set state
            const combined = Object.values(allTransactions).sort((a, b) => 
                (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
            );
            setTransactions(combined);

            // Set loading to false only after first fetch of both
            if(nestedDone && flatDone && loading) {
                setLoading(false);
            }
        };

        return () => {
            unsubNested();
            unsubFlat();
        };

    }, [firestore, tenantId, clientId]);

    const findTxPath = async (txId: string) => {
        if (!firestore || !tenantId || !clientId) return null;
        let path = getTenantPath(`transactions/${txId}`, tenantId);
        const docSnap = await getDoc(doc(firestore, path!));
        if (docSnap.exists()) return path;
        
        path = getTenantPath(`clients/${clientId}/transactions/${txId}`, tenantId);
        const nestedDocSnap = await getDoc(doc(firestore, path!));
        if (nestedDocSnap.exists()) return path;

        return null;
    }

    const handleDelete = async () => {
        if (!transactionToDelete || !firestore || !tenantId || !currentUser) return;
        setIsProcessing(true);

        try {
            const batch = writeBatch(firestore);
            const txPath = await findTxPath(transactionToDelete.id!)
            if (!txPath) throw new Error("Transaction document not found.");

            batch.delete(doc(firestore, txPath));

            const historyRef = doc(collection(firestore, getTenantPath(`clients/${clientId}/history`, tenantId)!));
            batch.set(historyRef, {
                type: 'log',
                content: `قام ${currentUser.fullName} بحذف المعاملة رقم "${transactionToDelete.transactionNumber}".`,
                createdAt: serverTimestamp(), userId: currentUser.id, userName: currentUser.fullName
            });

            await batch.commit();
            toast({ title: "نجاح", description: "تم حذف المعاملة بنجاح." });
        } catch (err: any) { 
            toast({ variant: 'destructive', title: "خطأ", description: err.message || "فشل حذف المعاملة." });
        } finally {
            setTransactionToDelete(null);
            setIsProcessing(false);
        }
    };

    const handleToggleFreeze = async (tx: Transaction) => {
        if (!firestore || !tenantId || !tx.id || !currentUser) return;
        setIsProcessing(true);
        try {
            const newStatus = tx.status === 'on-hold' ? (tx.previousStatus || 'in-progress') : 'on-hold';
            const actions = { 'on-hold': 'تجميد', 'in-progress': 'إعادة تفعيل' };

            const txPath = await findTxPath(tx.id!)
            if (!txPath) throw new Error("Transaction document not found.");

            const batch = writeBatch(firestore);
            const dataToUpdate: any = { status: newStatus };
            if(newStatus === 'on-hold') dataToUpdate.previousStatus = tx.status;

            batch.update(doc(firestore, txPath), dataToUpdate);

            const historyRef = doc(collection(firestore, getTenantPath(`clients/${clientId}/history`, tenantId)!));
            batch.set(historyRef, {
                type: 'log',
                content: `قام ${currentUser.fullName} بـ${actions[newStatus as keyof typeof actions] || newStatus} المعاملة رقم "${tx.transactionNumber}".`,
                createdAt: serverTimestamp(), userId: currentUser.id, userName: currentUser.fullName
            });

            await batch.commit();
            toast({ title: `✅ تم ${actions[newStatus as keyof typeof actions] || newStatus}` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: e.message });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelContract = async () => {
        // This is a complex operation, for now, we just set the status to cancelled
        if (!transactionToCancel || !firestore || !tenantId || !currentUser) return;
        setIsProcessing(true);
        try {
            const txPath = await findTxPath(transactionToCancel.id!)
            if (!txPath) throw new Error("Transaction document not found.");
            
            const batch = writeBatch(firestore);
            batch.update(doc(firestore, txPath), { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: currentUser.id });
            
            const historyRef = doc(collection(firestore, getTenantPath(`clients/${clientId}/history`, tenantId)!));
            batch.set(historyRef, {
                type: 'log',
                content: `قام ${currentUser.fullName} بفسخ وإلغاء العقد للمعاملة رقم "${transactionToCancel.transactionNumber}".`,
                createdAt: serverTimestamp(), userId: currentUser.id, userName: currentUser.fullName
            });

            await batch.commit();
            toast({ title: '✅ تم إلغاء العقد' });
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: e.message });
        } finally {
            setTransactionToCancel(null);
            setIsProcessing(false);
        }
    }


    if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-lg mr-4">جاري تحميل المعاملات...</p></div>;
    if (error) return <div className="p-8 text-center text-red-600 font-bold bg-red-50 rounded-xl flex items-center justify-center"><AlertCircle className="h-6 w-6 ml-2"/> {error}</div>;
    if (transactions.length === 0) return (
        <div className="p-8 text-center text-gray-500 border-2 border-dashed rounded-lg">
            <FolderSymlink className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium">لم يتم العثور على معاملات</h3>
            <p className="mt-1 text-sm text-gray-500">لم يتم تسجيل أي معاملات لهذا العميل حتى الآن.</p>
        </div>
    );

    return (
        <>
            <div className="overflow-hidden rounded-xl border">
                <table className="min-w-full divide-y divide-gray-200" dir="rtl">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider">رقم المعاملة</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider">نوع المعاملة</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider">الحالة</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider">تاريخ الإنشاء</th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-black text-gray-500 uppercase tracking-wider">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {transactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500" dir="ltr">{tx.transactionNumber}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{tx.subServiceName || tx.transactionType}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <Badge variant={getStatusVariant(tx.status)}>{tx.status}</Badge>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono" dir="ltr">
                                    {tx.createdAt?.toDate().toLocaleDateString('en-GB')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" dir="rtl">
                                            <DropdownMenuLabel>الإجراءات السريعة</DropdownMenuLabel>
                                            <DropdownMenuItem onSelect={() => router.push(`/dashboard/transactions/${tx.id}`)}>
                                                <FileText className="ml-2 h-4 w-4" /><span>عرض التفاصيل</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => router.push(`/dashboard/transactions/${tx.id}/edit`)}>
                                                <Pencil className="ml-2 h-4 w-4" /><span>تعديل</span>
                                            </DropdownMenuItem>
                                            
                                            <DropdownMenuSeparator />

                                            <DropdownMenuItem onSelect={() => router.push(`/dashboard/accounting/quotations/new?clientId=${clientId}&transactionId=${tx.id}`)}>
                                                <Calculator className="ml-2 h-4 w-4" /><span>إصدار عرض سعر</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => router.push(`/dashboard/contracts/new?clientId=${clientId}&transactionId=${tx.id}`)}>
                                                <FileSignature className="ml-2 h-4 w-4" /><span>توقيع عقد مباشر</span>
                                            </DropdownMenuItem>
                                            
                                            <DropdownMenuSeparator />

                                            <DropdownMenuItem onSelect={() => handleToggleFreeze(tx)} disabled={isProcessing}>
                                                {tx.status === 'on-hold' ? 
                                                    <><FolderOpen className="ml-2 h-4 w-4 text-green-600" /><span>إعادة تفعيل</span></> : 
                                                    <><FolderLock className="ml-2 h-4 w-4 text-orange-600" /><span>تجميد المعاملة</span></>}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setTransactionToCancel(tx)} className="text-orange-600 focus:text-orange-700">
                                                <Ban className="ml-2 h-4 w-4" /><span>فسخ وإلغاء العقد</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setTransactionToDelete(tx)} className="text-red-600 focus:text-red-700">
                                                <Trash2 className="ml-2 h-4 w-4" /><span>حذف نهائي</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Dialogs */}
            <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
                 <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
                        <AlertDialogDescription>هذا الإجراء سيحذف المعاملة نهائياً. لا يمكن التراجع عن هذا الأمر.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isProcessing} className="bg-red-600 hover:bg-red-700">نعم، قم بالحذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={!!transactionToCancel} onOpenChange={(open) => !open && setTransactionToCancel(null)}>
                 <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد فسخ العقد؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم تغيير حالة المعاملة إلى "ملغاة". هل تريد المتابعة؟</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelContract} disabled={isProcessing} className="bg-orange-600 hover:bg-orange-700">نعم، قم بالفسخ</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}