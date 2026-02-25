'use client';

import { Loader2 } from 'lucide-react';
import { BoqForm } from '@/components/construction/boq/boq-form';
import { useBoqSave } from '@/components/construction/boq/use-boq-save';

export default function NewBoqPage() {
  const { form, isSaving, isLoading, onSubmit, onClose } = useBoqSave({
    mode: 'create',
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium animate-pulse">
          جاري تهيئة المحرر...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <BoqForm
        onClose={onClose}
        isSaving={isSaving}
        isEditing={false}
        control={form.control}
        register={form.register}
        setValue={form.setValue}
        watch={form.watch}
        errors={form.formState.errors}
      />
    </form>
  );
}
