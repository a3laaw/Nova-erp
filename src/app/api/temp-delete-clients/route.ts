import { NextResponse } from 'next/server';
import { firestore } from '@/firebase/server-init';
import { getTenantPath } from '@/lib/utils';

// A temporary and secure API route to perform a one-time deletion of 'new' clients.
export async function POST() {
    // Hardcoded Tenant ID for this specific, one-time operation.
    const tenantId = 'E869iP8sE09sA5bepVpM'; 
    const clientsPath = getTenantPath('clients', tenantId);

    if (!clientsPath) {
        return NextResponse.json({ error: 'Could not determine clients path.' }, { status: 500 });
    }

    try {
        const clientsRef = firestore.collection(clientsPath);
        // Find all clients with the status 'new'
        const snapshot = await clientsRef.where('status', '==', 'new').get();

        if (snapshot.empty) {
            return NextResponse.json({ message: 'No clients with status "new" found to delete.' }, { status: 200 });
        }

        // Use a batch to delete all found clients efficiently.
        const batch = firestore.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        return NextResponse.json({ message: `Deletion Complete. ${snapshot.size} clients have been successfully deleted.` }, { status: 200 });

    } catch (error) {
        console.error('Error deleting clients via API route:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return NextResponse.json({ error: 'Failed to delete clients.', details: errorMessage }, { status: 500 });
    }
}
