'use client';

import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { BoqForm } from '@/components/construction/boq/boq-form';
import { useBoqSave } from '@/components/construction/boq/use-boq-save';

export default function EditBoqPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { form, isSaving, isLoading, onSubmit, onClose } = useBoqSave({
    mode: 'edit',
    boqId: id,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium animate-pulse">
          جاري تحميل البيانات وتحليل الهيكل...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <BoqForm
        onClose={onClose}
        isSaving={isSaving}
        isEditing={true}
        control={form.control}
        register={form.register}
        setValue={form.setValue}
        watch={form.watch}
        errors={form.formState.errors}
      />
    </form>
  );
}
