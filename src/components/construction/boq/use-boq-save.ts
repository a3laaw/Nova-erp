
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  collection,
  doc,
  runTransaction,
  writeBatch,
  serverTimestamp,
  getDoc,
  getDocs,
  query,
  updateDoc,
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { cleanFirestoreData } from '@/lib/utils';
import { boqFormSchema, type BoqFormValues } from './boq-form';
import type { Boq, BoqItem } from '@/lib/types';

export const generateStableId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

const MAX_BATCH_OPS = 490;

function processItemsHierarchy(items: BoqFormValues['items']): {
  finalItems: (BoqFormValues['items'][number] & {
    itemNumber: string;
    order: number;
  })[];
  totalValue: number;
} {
  const finalItems: any[] = [];
  const childMap = new Map<string | null, BoqFormValues['items']>();
  
  items.forEach((item) => {
    const key = item.parentId ?? null;
    if (!childMap.has(key)) childMap.set(key, []);
    childMap.get(key)!.push(item);
  });

  const processNode = (parentId: string | null, parentNumber: string, level: number) => {
    const children = childMap.get(parentId) || [];
    children.forEach((item, index) => {
      const itemNumber = parentNumber ? `${parentNumber}.${index + 1}` : `${index + 1}`;
      finalItems.push({ ...item, itemNumber, level, order: index });
      processNode(item.uid, itemNumber, level + 1);
    });
  };

  processNode(null, '', 0);

  const totalValue = finalItems.reduce((sum, item) => {
    if (item.isHeader) return sum;
    return sum + (Number(item.quantity) || 0) * (Number(item.sellingUnitPrice) || 0);
  }, 0);

  return { finalItems, totalValue };
}

async function commitInChunks(
  firestore: any,
  operations: Array<(batch: ReturnType<typeof writeBatch>) => void>
) {
  for (let i = 0; i < operations.length; i += MAX_BATCH_OPS) {
    const chunk = operations.slice(i, i + MAX_BATCH_OPS);
    const batch = writeBatch(firestore);
    chunk.forEach((op) => op(batch));
    await batch.commit();
  }
}

interface UseBoqSaveOptions {
  mode: 'create' | 'edit';
  boqId?: string;
}

export function useBoqSave({ mode, boqId }: UseBoqSaveOptions) {
  const { firestore } = useFirebase();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(mode === 'edit');

  const originalItemIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const savingRef = useRef(false);

  const form = useForm<BoqFormValues>({
    resolver: zodResolver(boqFormSchema),
    defaultValues: {
      name: '',
      clientName: '',
      status: 'تقديري',
      items: [],
    },
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !firestore || !boqId) return;
    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const boqRef = doc(firestore, 'boqs', boqId);
        const itemsRef = collection(firestore, `boqs/${boqId}/items`);

        const [boqSnap, itemsSnap] = await Promise.all([
          getDoc(boqRef),
          getDocs(query(itemsRef)),
        ]);

        if (cancelled) return;

        if (!boqSnap.exists()) {
          toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على جدول الكميات.' });
          router.push('/dashboard/construction/boq');
          return;
        }

        const boqData = boqSnap.data() as Boq;
        const boqItems = itemsSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as BoqItem);

        originalItemIdsRef.current = new Set(boqItems.map((i) => i.id!));

        const sortedItems = [...boqItems].sort((a, b) =>
          (a.itemNumber || '').localeCompare(b.itemNumber || '', undefined, { numeric: true })
        );

        form.reset({
          name: boqData.name,
          clientName: boqData.clientName || '',
          status: boqData.status,
          items: sortedItems.map((item) => ({
            uid: item.id!,
            description: item.description || '',
            unit: item.unit || '',
            quantity: item.quantity ?? 0,
            sellingUnitPrice: item.sellingUnitPrice ?? 0,
            parentId: item.parentId ?? null,
            level: item.level ?? 0,
            isHeader: item.isHeader ?? false,
            itemId: item.itemId || '',
            notes: item.notes || '',
            itemNumber: item.itemNumber || '',
          })),
        });
      } catch (e) {
        if (!cancelled) {
          toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحميل بيانات جدول الكميات.' });
        }
      } finally {
        if (!cancelled && mountedRef.current) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [mode, firestore, boqId, router, toast, form]);

  const onSubmit = async (data: BoqFormValues) => {
    if (!firestore || !currentUser || savingRef.current) return;
    
    savingRef.current = true;
    setIsSaving(true);

    try {
      const { finalItems, totalValue } = processItemsHierarchy(data.items);
      let targetBoqId = boqId;

      if (mode === 'create') {
        const clientId = searchParams.get('clientId');
        const transactionId = searchParams.get('transactionId');

        await runTransaction(firestore, async (transaction) => {
          const counterRef = doc(firestore, 'counters', 'boqs');
          const counterDoc = await transaction.get(counterRef);
          const currentYear = new Date().getFullYear();
          let nextNumber = 1;
          if (counterDoc.exists()) {
            const counts = counterDoc.data()?.counts || {};
            nextNumber = (counts[currentYear] || 0) + 1;
          }

          const boqNumber = `BOQ-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
          const boqRef = doc(collection(firestore, 'boqs'));
          targetBoqId = boqRef.id;

          const boqData = {
            boqNumber,
            name: data.name,
            status: data.status,
            clientName: data.clientName || null,
            totalValue,
            itemCount: finalItems.length,
            createdBy: currentUser.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            clientId: clientId || null,
            transactionId: transactionId || null,
          };

          transaction.set(boqRef, boqData);
          transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });

          if (clientId && transactionId) {
            const transactionRef = doc(firestore, `clients/${clientId}/transactions/${transactionId}`);
            transaction.update(transactionRef, { boqId: targetBoqId });
          }
        });
      } else {
        const boqRef = doc(firestore, 'boqs', boqId!);
        await updateDoc(boqRef, {
          name: data.name,
          clientName: data.clientName || null,
          status: data.status,
          totalValue,
          itemCount: finalItems.length,
          updatedAt: serverTimestamp(),
        });
      }

      const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
      
      if (mode === 'edit') {
        const currentUids = new Set(finalItems.map(i => i.uid));
        originalItemIdsRef.current.forEach(oldId => {
          if (!currentUids.has(oldId)) {
            operations.push((batch) => {
              batch.delete(doc(firestore, `boqs/${targetBoqId}/items`, oldId));
            });
          }
        });
      }

      finalItems.forEach((item) => {
        operations.push((batch) => {
          const { uid, ...itemData } = item;
          const itemRef = doc(firestore, `boqs/${targetBoqId}/items`, uid);
          batch.set(itemRef, cleanFirestoreData(itemData));
        });
      });

      await commitInChunks(firestore, operations);
      toast({ title: 'نجاح', description: 'تم حفظ جدول الكميات بنجاح.' });
      router.push(`/dashboard/construction/boq/${targetBoqId}`);
    } catch (error: any) {
      console.error(`❌ Save failed:`, error);
      toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: error.message || 'حدث خطأ غير متوقع.' });
      if (mountedRef.current) {
          setIsSaving(false);
          savingRef.current = false;
      }
    }
  };

  return {
    form,
    isSaving,
    isLoading: isLoading || authLoading,
    onSubmit,
    onClose: () => mode === 'edit' ? router.push(`/dashboard/construction/boq/${boqId}`) : router.back(),
  };
}
