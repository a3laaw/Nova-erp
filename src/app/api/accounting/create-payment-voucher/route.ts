import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';
import { numberToArabicWords, cleanFirestoreData, formatCurrency } from '@/lib/utils';

// ================= FORTRESS INITIALIZATION =================
function getAdminApp() {
    if (getApps().length === 0) {
        let serviceAccount;
        const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (envServiceAccount) {
            try { serviceAccount = JSON.parse(envServiceAccount); } catch (e) { console.error("Invalid Service Account JSON from env"); }
        }
        if (!serviceAccount) {
            const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
            if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
                serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
            }
        }
        if (!serviceAccount) throw new Error("CRITICAL_SECURITY_ERROR: Missing Firebase Service Account Configuration.");
        
        return initializeApp({ credential: cert(serviceAccount) });
    }
    return getApp();
}
// =========================================================

// 🛡️ Define roles with permission to create accounting entries
const PERMITTED_ROLES = ['Admin', 'مدير عام', 'محاسب', 'General Manager', 'Accountant', 'Developer'];

export async function POST(request: NextRequest) {
    try {
        const app = getAdminApp();
        const adminAuth = getAuth(app);
        const db = getFirestore(app);

        // 1. AUTHENTICATION & AUTHORIZATION
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Missing Token' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        if (!decodedToken.role || !PERMITTED_ROLES.includes(decodedToken.role)) {
            return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions.' }, { status: 403 });
        }

        // 2. DATA VALIDATION (basic)
        const body = await request.json();
        const { companyId, voucherData, searchParams } = body;

        if (!companyId || !voucherData) {
            return NextResponse.json({ success: false, error: 'Bad Request: Missing required data.' }, { status: 400 });
        }

        if (decodedToken.companyId !== companyId) {
            return NextResponse.json({ success: false, error: 'Forbidden: Cross-tenant operation denied.' }, { status: 403 });
        }

        let newVoucherId = '';

        // 3. SECURE TRANSACTION
        await db.runTransaction(async (transaction) => {
            const currentYear = new Date().getFullYear();

            // Get Accounts info
            const [debitAccSnap, creditAccSnap] = await Promise.all([
                transaction.get(db.doc(`chartOfAccounts/${voucherData.debitAccountId}`)),
                voucherData.creditAccountId ? transaction.get(db.doc(`chartOfAccounts/${voucherData.creditAccountId}`)) : Promise.resolve(null)
            ]);

            if (!debitAccSnap.exists || (voucherData.creditAccountId && !creditAccSnap?.exists)) {
                throw new Error("Invalid account ID provided.");
            }
            const debitAccount = debitAccSnap.data();
            const creditAccount = creditAccSnap?.data();

            // Generate Voucher Number
            const pvCounterRef = db.doc(`companies/${companyId}/counters/paymentVouchers`);
            const pvCounterDoc = await transaction.get(pvCounterRef);
            const pvNextNumber = ((pvCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
            const newVoucherNumber = `PV-${currentYear}-${String(pvNextNumber).padStart(4, '0')}`;

            // Prepare Voucher Data
            const newVoucherRef = db.collection(`companies/${companyId}/paymentVouchers`).doc();
            newVoucherId = newVoucherRef.id;

            const amountInWords = numberToArabicWords(Number(voucherData.amount));
            const finalVoucherData = {
                ...voucherData,
                paymentDate: Timestamp.fromDate(new Date(voucherData.paymentDate)),
                voucherNumber: newVoucherNumber, voucherSequence: pvNextNumber, voucherYear: currentYear,
                amountInWords,
                debitAccountName: debitAccount?.name,
                creditAccountName: creditAccount?.name || '',
                status: 'draft',
                createdAt: FieldValue.serverTimestamp(),
                createdBy: { id: decodedToken.uid, name: decodedToken.name },
                companyId: companyId,
            };

            // Generate Journal Entry
            const jeCounterRef = db.doc(`companies/${companyId}/counters/journalEntries`);
            const jeCounterDoc = await transaction.get(jeCounterRef);
            const jeNextNumber = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
            const newJeNumber = `JV-${currentYear}-${String(jeNextNumber).padStart(4, '0')}`;

            const newJournalEntryRef = db.collection(`companies/${companyId}/journalEntries`).doc();
            finalVoucherData.journalEntryId = newJournalEntryRef.id; // Link voucher to JE

            const journalEntryData = {
                entryNumber: newJeNumber, date: finalVoucherData.paymentDate,
                narration: `${voucherData.description} (سند صرف رقم ${newVoucherNumber})`,
                totalDebit: voucherData.amount, totalCredit: voucherData.amount,
                status: 'draft',
                lines: [
                    { accountId: voucherData.debitAccountId, accountName: debitAccount?.name, debit: voucherData.amount, credit: 0 },
                    { accountId: voucherData.creditAccountId, accountName: creditAccount?.name, debit: 0, credit: voucherData.amount }
                ],
                createdAt: FieldValue.serverTimestamp(),
                createdBy: { id: decodedToken.uid, name: decodedToken.name },
                companyId: companyId,
                relatedVoucher: { type: 'PaymentVoucher', id: newVoucherId, number: newVoucherNumber }
            };

            // Commit to transaction
            transaction.set(newVoucherRef, cleanFirestoreData(finalVoucherData));
            transaction.set(newJournalEntryRef, cleanFirestoreData(journalEntryData));
            transaction.set(pvCounterRef, { counts: { [currentYear]: pvNextNumber } }, { merge: true });
            transaction.set(jeCounterRef, { counts: { [currentYear]: jeNextNumber } }, { merge: true });
        });

        // 4. POST-TRANSACTION LOGIC (e.g. residency update)
        if (searchParams?.source === 'residency_renewal') {
            const { employeeId, newExpiryDate: newExpiryDateISO } = searchParams;
            if (employeeId && newExpiryDateISO) {
                const employeeRef = db.doc(`companies/${companyId}/employees/${employeeId}`);
                const employeeSnap = await employeeRef.get();
                if (employeeSnap.exists()) {
                    const batch = db.batch();
                    const newExpiryDate = new Date(newExpiryDateISO);
                    batch.update(employeeRef, { residencyExpiry: newExpiryDate });

                    const auditLogRef = db.collection(`companies/${companyId}/employees/${employeeId}/auditLogs`).doc();
                    const logData = {
                        changeType: 'ResidencyUpdate',
                        field: 'residencyExpiry',
                        oldValue: employeeSnap.data()?.residencyExpiry || null,
                        newValue: newExpiryDate,
                        effectiveDate: FieldValue.serverTimestamp(),
                        changedBy: { id: decodedToken.uid, name: decodedToken.name },
                        notes: `تجديد الإقامة عبر سند الصرف. التكلفة: ${formatCurrency(Number(voucherData.amount))}`,
                    };
                    batch.set(auditLogRef, logData);
                    await batch.commit();
                }
            }
        }

        return NextResponse.json({ success: true, message: 'Voucher created successfully', voucherId: newVoucherId });

    } catch (error: any) {
        console.error("Create Payment Voucher Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
