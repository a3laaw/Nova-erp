import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * محرك إدارة المنشآت الموحد - نسخة التشخيص الرقابي المتقدم (V35.0)
 * تم تحصين معالجة المفتاح الخاص وتوضيح رسالة صلاحيات IAM.
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
  let serviceAccountEmail = "Unknown";
  try {
    const body = await request.json();
    const { action, email, companyName, contactName, activity, password, requestId } = body;

    const app = getAdminApp();
    
    const saPath = path.join(process.cwd(), 'service-account.json');
    const saData = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    serviceAccountEmail = saData.client_email;

    const db = getFirestore(app);
    const auth = getAuth(app);

    if (action === 'instant_setup') {
        const companyId = `comp-${Math.random().toString(36).substring(2, 9)}`;
        const sanitizedEmail = email?.toLowerCase().trim();
        
        // 1. إنشاء حساب المالك في Firebase Auth
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

        // 2. حقن الصلاحيات (Claims)
        await auth.setCustomUserClaims(userRecord.uid, {
            companyId: companyId,
            role: 'Admin'
        });

        // 3. تأسيس سجل المنشأة
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

        // 5. تحديث الفهرس العالمي (Global Index)
        await db.collection('global_users').doc(userRecord.uid).set({
            email: sanitizedEmail,
            username: sanitizedEmail.split('@')[0],
            companyId: companyId,
            uid: userRecord.uid,
            role: 'Admin',
            createdAt: FieldValue.serverTimestamp()
        });

        // 6. تحديث حالة الطلب
        if (requestId) {
            const reqRef = db.collection('company_requests').doc(requestId);
            await reqRef.update({
                status: 'activated',
                activatedAt: FieldValue.serverTimestamp(),
                companyId: companyId
            });
        }

        return NextResponse.json({ 
            success: true, 
            message: "تم تفعيل المنشأة بنجاح.",
            companyId: companyId
        });
    }

    return NextResponse.json({ success: false, error: "ACTION_NOT_FOUND" });

  } catch (error: any) {
    console.error("IAM PERMISSION ERROR:", error);
    
    let userMessage = error.message;
    // التحقق من خطأ الصلاحيات 7 (PERMISSION_DENIED)
    if (error.message?.includes('insufficient permission') || error.code === 7 || error.status === 403) {
        userMessage = `⚠️ خطأ في صلاحيات Google IAM: يرجى الذهاب لـ Google Cloud Console وإعطاء صلاحية (Firebase Admin) لهذا البريد حصراً: [ ${serviceAccountEmail} ]`;
    }

    return NextResponse.json({ 
        success: false, 
        error: "IAM_AUTH_FAILED",
        message: userMessage,
        targetEmail: serviceAccountEmail
    }, { status: 500 });
  }
}
