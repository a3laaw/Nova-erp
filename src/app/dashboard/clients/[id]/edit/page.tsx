
'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ClientFormWrapper } from './_components/client-form-wrapper';

function EditClientPage() {
  return (
    <Suspense fallback={<div className="p-20 flex justify-center items-center w-full h-full"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>}>
      <ClientFormWrapper />
    </Suspense>
  );
}

export default EditClientPage;
