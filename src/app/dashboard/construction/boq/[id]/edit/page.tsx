'use client';

import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { BoqForm } from '@/components/construction/boq/boq-form';
import { useBoqSave } from '@/components/construction/boq/use-boq-save';

/**
 * صفحة تعديل جدول الكميات:
 * تتبنى النمط الزجاجي اللؤلؤي وتوفر البيئة المناسبة لمُحرر المقايسة.
 */
export default function EditBoqPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { form, isSaving, isLoading, onSubmit, onClose } = useBoqSave({
    mode: 'edit',
    boqId: id,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-6" dir="rtl">
        <div className="relative">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 animate-pulse border-4 border-primary/20" />
            <Loader2 className="h-8 w-8 animate-spin text-primary absolute inset-0 m-auto" />
        </div>
        <div className="text-center space-y-2">
            <p className="text-xl font-black text-[#1e1b4b] tracking-tight">جاري استرجاع بيانات المقايسة...</p>
            <p className="text-sm text-muted-foreground font-bold">نقوم بتحليل الهيكل الشجري وربط الأسعار المرجعية.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700">
        <BoqForm
            onClose={onClose}
            isSaving={isSaving}
            isEditing={true}
            control={form.control}
            register={form.register}
            setValue={form.setValue}
            watch={form.watch}
            errors={form.formState.errors}
            handleSubmit={form.handleSubmit}
            onSubmit={onSubmit}
        />
    </div>
  );
}
