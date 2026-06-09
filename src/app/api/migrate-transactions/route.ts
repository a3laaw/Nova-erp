import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/admin';

export async function POST(request: Request) {
  // IMPORTANT: This is a temporary, one-time-use endpoint.
  // It should be deleted after the migration is complete.

  const { secret } = await request.json();
  if (secret !== 'nova-data-unification') {
    return NextResponse.json({ error: 'Unauthorized: Invalid secret key.' }, { status: 401 });
  }

  const firestore = getFirebaseAdmin().firestore();

  try {
    console.log('--- Starting Transaction Unification Process ---');

    const rootClientsSnapshot = await firestore.collection('clients').get();
    if (rootClientsSnapshot.empty) {
      return NextResponse.json({ message: 'No legacy clients found. Migration is likely not needed or already complete.' });
    }

    console.log(`Found ${rootClientsSnapshot.docs.length} legacy client records to process.`);

    const allBatches: FirebaseFirestore.WriteBatch[] = [];
    let currentBatch = firestore.batch();
    let operationsInBatch = 0;
    let migratedCount = 0;

    for (const clientDoc of rootClientsSnapshot.docs) {
      const clientId = clientDoc.id;
      const clientData = clientDoc.data();
      const companyId = clientData.companyId;

      if (!companyId) {
        console.warn(`- Skipping client ${clientId}: Missing 'companyId'. Cannot migrate transactions securely.`);
        continue;
      }

      const nestedTransactionsSnapshot = await clientDoc.ref.collection('transactions').get();

      if (nestedTransactionsSnapshot.empty) {
        continue; // No nested transactions for this client.
      }

      console.log(`  > Found ${nestedTransactionsSnapshot.docs.length} transactions for client ${clientId}. Preparing to migrate.`);

      for (const transactionDoc of nestedTransactionsSnapshot.docs) {
        // Firestore batches are limited to 500 operations. We do 2 per loop (set + delete).
        if (operationsInBatch >= 498) {
          allBatches.push(currentBatch);
          currentBatch = firestore.batch();
          operationsInBatch = 0;
          console.log('  > Batch limit reached. Starting a new batch.');
        }

        const transactionId = transactionDoc.id;
        const transactionData = transactionDoc.data();

        // Define the reference for the new document in the root 'transactions' collection
        const newTransactionRef = firestore.collection('transactions').doc(transactionId);
        
        // Prepare the new data, ensuring critical linking fields are present
        const newDocData = {
          ...transactionData,
          clientId: clientId,   // Link back to the client
          companyId: companyId, // Essential for security rules
        };

        // Add 'set' and 'delete' operations to the batch
        currentBatch.set(newTransactionRef, newDocData);
        currentBatch.delete(transactionDoc.ref);
        
        operationsInBatch += 2;
        migratedCount++;
      }
    }
    
    // Add the last batch if it has any operations
    if (operationsInBatch > 0) {
        allBatches.push(currentBatch);
    }

    if (migratedCount > 0) {
      console.log(`--- Committing ${allBatches.length} batches for a total of ${migratedCount} transactions... ---`);
      await Promise.all(allBatches.map(batch => batch.commit()));
      const message = `Migration successful! Unified ${migratedCount} transactions into the new data structure.`;
      console.log(message);
      return NextResponse.json({ message });
    } else {
      const message = 'Migration check complete. No transactions required migration.';
      console.log(message);
      return NextResponse.json({ message });
    }

  } catch (error) {
    console.error('--- MIGRATION FAILED ---', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'The migration process failed.', details: errorMessage }, { status: 500 });
  }
}
