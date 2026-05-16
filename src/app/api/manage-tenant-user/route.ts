import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * محرك إدارة المنشآت الموحد (V74.0):
 * تم تحصينه لضمان إنشاء ملف المستخدم داخل المنشأة (Tenant Profile) فور التأسيس.
 */

function getAdminApp() {
  if (getApps().length === 0) {
    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        throw new Error("MISSING_SERVICE_ACCOUNT_FILE");
    }

    try {
        const fileContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
        const serviceAccount = JSON.parse(fileContent);
        
        if (!serviceAccount.private_key || !serviceAccount.project_id) {
            throw new Error("INVALID_SERVICE_ACCOUNT_JSON");
        }

        serviceAccount.private_key = serviceAccount.private_key
            .replace(/\\n/g, '\n')
            .replace(/"/g, '')
            .trim();

        return initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id
        });
    } catch (e: any) {
        console.error("Critical: Admin Init Failed:", e.message);
        throw e;
    }
  }
  return getApp();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, password, displayName, companyId, uid, companyName, contactName, activity, requestId, firebaseConfig } = body;

    const app = getAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    const sanitizedEmail = email?.toLowerCase().trim();

    // 1. إجراء التأسيس الجديد (Create Identity)
    if (action === 'create') {
        let userRecord;
        try {
            userRecord = await auth.createUser({
                email: sanitizedEmail,
                password: password,
                displayName: displayName,
            });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') {
                userRecord = await auth.getUserByEmail(sanitizedEmail);
            } else { throw e; }
        }

        if (companyId) {
            await auth.setCustomUserClaims(userRecord.uid, {
                companyId: companyId,
                role: 'Admin'
            });

            // ⚡ تحديث الفهرس العالمي
            await db.collection('global_users').doc(userRecord.uid).set({
                email: sanitizedEmail,
                companyId: companyId,
                role: 'Admin',
                createdAt: FieldValue.serverTimestamp()
            });

            // 🛡️ إنشاء ملف المستخدم داخل المنشأة لضمان استقرار الدخول
            await db.collection('companies').doc(companyId).collection('users').doc(userRecord.uid).set({
                id: userRecord.uid,
                uid: userRecord.uid,
                email: sanitizedEmail,
                fullName: displayName || contactName || 'Admin',
                role: 'Admin',
                isActive: true,
                companyId: companyId,
                createdAt: FieldValue.serverTimestamp()
            }, { merge: true });
        }

        return NextResponse.json({ success: true, uid: userRecord.uid });
    }

    // 2. إجراء التحديث الكامل
    if (action === 'update_full') {
        if (!uid) throw new Error("UID_REQUIRED");
        
        const updateParams: any = {
            email: sanitizedEmail,
            displayName: displayName
        };
        if (password) updateParams.password = password;

        await auth.updateUser(uid, updateParams);

        if (companyId) {
            await auth.setCustomUserClaims(uid, {
                companyId: companyId,
                role: 'Admin'
            });

            await db.collection('global_users').doc(uid).set({
                email: sanitizedEmail,
                companyId: companyId,
                role: 'Admin',
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });

            // تحديث ملف المنشأة
            await db.collection('companies').doc(companyId).collection('users').doc(uid).set({
                email: sanitizedEmail,
                fullName: displayName,
                role: 'Admin',
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
        }

        return NextResponse.json({ success: true, uid });
    }

    // 3. الإجراء الفوري (Instant Setup)
    if (action === 'instant_setup') {
        const generatedCompanyId = companyId || `comp-${Math.random().toString(36).substring(2, 9)}`;
        
        let userRecord;
        try {
            userRecord = await auth.createUser({
                email: sanitizedEmail,
                password: password,
                displayName: contactName,
            });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') {
                userRecord = await auth.getUserByEmail(sanitizedEmail);
            } else { throw e; }
        }

        await auth.setCustomUserClaims(userRecord.uid, {
            companyId: generatedCompanyId,
            role: 'Admin'
        });

        // 1. الفهرس العالمي
        await db.collection('global_users').doc(userRecord.uid).set({
            email: sanitizedEmail,
            companyId: generatedCompanyId,
            role: 'Admin',
            createdAt: FieldValue.serverTimestamp()
        });

        // 2. سجل الشركة
        await db.collection('companies').doc(generatedCompanyId).set({
            id: generatedCompanyId,
            name: companyName || 'منشأة جديدة',
            activity: activity || 'consulting',
            adminEmail: sanitizedEmail,
            firebaseConfig: firebaseConfig || {},
            isActive: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            maxUsersLimit: 5,
            subscriptionType: 'trial',
            subscriptionExpiryDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
        });

        // 3. 🛡️ ملف المستخدم داخل المنشأة (الحلقة المفقودة)
        await db.collection('companies').doc(generatedCompanyId).collection('users').doc(userRecord.uid).set({
            id: userRecord.uid,
            uid: userRecord.uid,
            email: sanitizedEmail,
            fullName: contactName || 'Admin',
            role: 'Admin',
            isActive: true,
            companyId: generatedCompanyId,
            createdAt: FieldValue.serverTimestamp()
        });

        if (requestId) {
            await db.collection('company_requests').doc(requestId).update({
                status: 'activated',
                activatedAt: FieldValue.serverTimestamp(),
                companyId: generatedCompanyId
            });
        }

        return NextResponse.json({ 
            success: true, 
            message: "تم التأسيس الفوري بنجاح.",
            companyId: generatedCompanyId,
            uid: userRecord.uid
        });
    }

    return NextResponse.json({ success: false, error: "ACTION_NOT_FOUND" });

  } catch (error: any) {
    console.error("IAM PERMISSION ERROR:", error);
    return NextResponse.json({ 
        success: false, 
        error: "INTERNAL_ERROR",
        message: error.message
    }, { status: 500 });
  }
}