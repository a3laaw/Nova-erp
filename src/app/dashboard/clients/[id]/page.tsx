
'use client';
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ClientProfileLayout } from './_components/client-profile-layout';


function ClientProfilePage() {
    const params = useParams();
    const clientId = params.id as string;

    return (
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center p-20"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
           <ClientProfileLayout clientId={clientId} />
        </Suspense>
    );
}

export default ClientProfilePage;

