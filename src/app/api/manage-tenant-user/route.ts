import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * محرك إدارة المنشآت الموحد - نسخة توحيد القطبية (V27.0)
 * تم إلغاء الاعتماد على env في السيرفر والاعتماد كلياً على ملف المفتاح لمنع التضارب.
 */

function getAdminApp() {
  if (getApps().length === 0) {
    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        throw new Error("MISSING_FILE");
    }

    try {
        const fileContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
        const serviceAccount = JSON.parse(fileContent);
        
        if (!serviceAccount.private_key || !serviceAccount.project_id) {
            throw new Error("INVALID_JSON_STRUCTURE");
        }

        // 🛡️ معالج المفاتيح الذكي: تصحيح الأسطر الجديدة لضمان قبول تنسيق PEM
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

        // التأسيس السيادي المباشر باستخدام بيانات الملف حصراً لمنع تضارب الـ Project ID
        return initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id // توحيد القطبية هنا
        });
    } catch (e: any) {
        console.error("Critical: Failed to initialize Firebase Admin:", e.message);
        throw e;
    }
  }
  return getApp();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, companyName, contactName, activity, password, requestId } = body;

    const app = getAdminApp();
    const db = (await import('firebase-admin/firestore')).getFirestore(app);
    const auth = getAuth(app);

    if (action === 'instant_setup') {
        const companyId = `comp-${Math.random().toString(36).substring(2, 9)}`;
        const sanitizedEmail = email?.toLowerCase().trim();
        
        // 1. إنشاء حساب المالك في نظام الأمان (Authentication)
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

        // 2. حقن هوية المنشأة داخل الحساب (Custom Claims)
        await auth.setCustomUserClaims(userRecord.uid, {
            companyId: companyId,
            role: 'Admin'
        });

        const now = (await import('firebase-admin/firestore')).FieldValue.serverTimestamp();

        // 3. تأسيس سجل المنشأة
        await db.collection('companies').doc(companyId).set({
            id: companyId,
            name: companyName || 'منشأة جديدة',
            activity: activity || 'consulting',
            adminEmail: sanitizedEmail,
            isActive: true,
            createdAt: now,
            updatedAt: now,
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
            createdAt: now
        });

        // 5. تحديث الفهرس العالمي (Global Index)
        await db.collection('global_users').doc(userRecord.uid).set({
            email: sanitizedEmail,
            username: sanitizedEmail.split('@')[0],
            companyId: companyId,
            uid: userRecord.uid,
            role: 'Admin',
            createdAt: now
        });

        // 6. تحديث حالة الطلب الأصلي
        if (requestId) {
            const requestRef = db.collection('company_requests').doc(requestId);
            await requestRef.update({
                status: 'activated',
                activatedAt: now,
                companyId: companyId
            });
        }

        return NextResponse.json({ 
            success: true, 
            message: "تم التفعيل بنجاح تام.",
            companyId: companyId
        });
    }

    return NextResponse.json({ success: false, error: "ACTION_NOT_FOUND" });

  } catch (error: any) {
    console.error("Activation Engine Error:", error);
    
    let userMessage = error.message;
    if (error.message?.includes('insufficient permission')) {
        userMessage = "خطأ في صلاحيات المفتاح: تأكد من أن حساب الخدمة في Console لديه دور (Firebase Admin).";
    }

    return NextResponse.json({ 
        success: false, 
        error: error.code || "ACTIVATION_FAILED",
        message: userMessage
    }, { status: 500 });
  }
}
