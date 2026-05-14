import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * API إدارة المنشآت الموحد.
 * تم إصلاح تداخل المكتبات (FieldValue Error) وتحصين البيانات من الـ undefined.
 */

function getAdminApp() {
  const currentProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (getApps().length === 0) {
    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    
    let serviceAccount = null;
    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        try {
            const fileContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
            const parsed = JSON.parse(fileContent);
            if (parsed.private_key) {
                serviceAccount = parsed;
            }
        } catch (e) {
            console.warn("Invalid service-account.json format");
        }
    }

    if (serviceAccount) {
        return initializeApp({
            credential: cert(serviceAccount),
            projectId: currentProjectId
        });
    } else {
        return initializeApp({
            projectId: currentProjectId,
        });
    }
  }
  return getApp();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, companyName, contactName, activity, password, requestId } = body;

    const app = getAdminApp();
    const db = getAdminFirestore(app);
    const auth = getAuth(app);

    if (action === 'instant_setup') {
        const companyId = `comp-${Math.random().toString(36).substring(2, 9)}`;
        const sanitizedEmail = email?.toLowerCase().trim();
        
        // 1. إنشاء حساب المالك في Auth
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

        // 2. حقن الهوية داخل الحساب (Custom Claims)
        await auth.setCustomUserClaims(userRecord.uid, {
            companyId: companyId,
            role: 'Admin'
        });

        // 3. بناء سجل الشركة (تحصين الحقول واستخدام ServerTimestamp الصحيح)
        await db.collection('companies').doc(companyId).set({
            id: companyId,
            name: companyName || 'منشأة جديدة',
            activity: activity || 'consulting',
            adminEmail: sanitizedEmail,
            isActive: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            maxUsersLimit: 5,
            subscriptionType: 'trial'
        });

        // 4. إنشاء ملف المستخدم الداخلي للشركة
        await db.collection('companies').doc(companyId).collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: sanitizedEmail,
            fullName: contactName || 'المالك',
            username: sanitizedEmail.split('@')[0],
            role: 'Admin',
            isActive: true,
            companyId: companyId,
            createdAt: FieldValue.serverTimestamp()
        });

        // 5. فهرس العبور الموحد (Global Index)
        await db.collection('global_users').doc(userRecord.uid).set({
            email: sanitizedEmail,
            username: sanitizedEmail.split('@')[0],
            companyId: companyId,
            uid: userRecord.uid,
            role: 'Admin',
            createdAt: FieldValue.serverTimestamp()
        });

        // 6. تحديث حالة الطلب الأصلي
        if (requestId) {
            const requestRef = db.collection('company_requests').doc(requestId);
            await requestRef.update({
                status: 'activated',
                activatedAt: FieldValue.serverTimestamp(),
                companyId: companyId
            });
        }

        return NextResponse.json({ 
            success: true, 
            message: "تم التأسيس بنجاح.",
            companyId: companyId
        });
    }

    return NextResponse.json({ success: false, error: "UNKNOWN_ACTION" });

  } catch (error: any) {
    console.error("API Activation Error:", error);
    return NextResponse.json({ 
        success: false, 
        error: "SERVER_ERROR",
        message: error.message 
    }, { status: 500 });
  }
}
