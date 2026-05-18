import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * 🛡️ محرك إدارة المنشآت الموحد (V119.0):
 * تم تحصينه أمنياً لفحص التوكن السيادي ومنع العبور غير المصرح.
 */

function getAdminApp() {
  if (getApps().length === 0) {
    let serviceAccount;
    const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (envServiceAccount) {
        try { serviceAccount = JSON.parse(envServiceAccount); } catch (e) { console.error("Invalid Service Account JSON"); }
    }
    if (!serviceAccount) {
        const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
        if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
            serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        }
    }
    if (!serviceAccount) throw new Error("CRITICAL_SECURITY_ERROR: Missing Configuration.");
    
    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n').replace(/"/g, '').trim();
    }

    return initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
  }
  return getApp();
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const app = getAdminApp();
    const adminAuth = getAuth(app);
    const db = getFirestore(app);
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // 🛡️ صمام الأمان: المطور فقط أو السوبر أدمن يمكنهم مخاطبة هذا المسار
    if (decodedToken.role !== 'Developer' && !decodedToken.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden Authority' }, { status: 403 });
    }

    const body = await request.json();
    const { action, email, password, displayName, companyId, uid, companyName, contactName, activity, requestId, firebaseConfig } = body;
    const sanitizedEmail = email?.toLowerCase().trim();

    if (action === 'create') {
        let userRecord;
        try {
            userRecord = await adminAuth.createUser({ email: sanitizedEmail, password, displayName });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') userRecord = await adminAuth.getUserByEmail(sanitizedEmail);
            else throw e;
        }

        if (companyId) {
            await adminAuth.setCustomUserClaims(userRecord.uid, { companyId, role: 'Admin' });
            await db.collection('global_users').doc(userRecord.uid).set({
                email: sanitizedEmail, companyId, role: 'Admin', createdAt: FieldValue.serverTimestamp()
            });
            await db.collection('companies').doc(companyId).collection('users').doc(userRecord.uid).set({
                id: userRecord.uid, uid: userRecord.uid, email: sanitizedEmail, fullName: displayName || 'Admin',
                role: 'Admin', isActive: true, companyId, createdAt: FieldValue.serverTimestamp()
            }, { merge: true });
        }
        return NextResponse.json({ success: true, uid: userRecord.uid });
    }

    if (action === 'instant_setup') {
        const genId = companyId || `comp-${Math.random().toString(36).substring(2, 9)}`;
        let userRecord;
        try {
            userRecord = await adminAuth.createUser({ email: sanitizedEmail, password, displayName: contactName });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') userRecord = await adminAuth.getUserByEmail(sanitizedEmail);
            else throw e;
        }

        await adminAuth.setCustomUserClaims(userRecord.uid, { companyId: genId, role: 'Admin' });
        await db.collection('global_users').doc(userRecord.uid).set({ email: sanitizedEmail, companyId: genId, role: 'Admin', createdAt: FieldValue.serverTimestamp() });
        await db.collection('companies').doc(genId).set({
            id: genId, name: companyName, activity: activity || 'consulting', adminEmail: sanitizedEmail,
            firebaseConfig: firebaseConfig || {}, isActive: true, createdAt: FieldValue.serverTimestamp(),
            maxUsersLimit: 5, subscriptionType: 'trial'
        });
        await db.collection('companies').doc(genId).collection('users').doc(userRecord.uid).set({
            id: userRecord.uid, uid: userRecord.uid, email: sanitizedEmail, fullName: contactName,
            role: 'Admin', isActive: true, companyId: genId, createdAt: FieldValue.serverTimestamp()
        });

        if (requestId) {
            await db.collection('company_requests').doc(requestId).update({ status: 'activated', activatedAt: FieldValue.serverTimestamp(), companyId: genId });
        }
        return NextResponse.json({ success: true, companyId: genId, uid: userRecord.uid });
    }

    return NextResponse.json({ success: false, error: "ACTION_NOT_FOUND" });
  } catch (error: any) {
    console.error("IAM ERROR:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
