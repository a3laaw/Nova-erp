import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API إدارة المنشآت الموحد.
 * تم تحصينه ليعتمد كلياً على المشروع الحالي النشط لمنع خطأ NOT_FOUND.
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
        // خيار الطوارئ: التهيئة بدون مفتاح أمان (لأغراض القراءة فقط)
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
    const db = getFirestore(app);
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

        // 2. حقن الهوية داخل الحساب
        await auth.setCustomUserClaims(userRecord.uid, {
            companyId: companyId,
            role: 'Admin'
        });

        // 3. بناء سجل الشركة في قاعدة البيانات
        await db.collection('companies').doc(companyId).set({
            id: companyId,
            name: companyName,
            activity,
            adminEmail: sanitizedEmail,
            isActive: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        // 4. إنشاء ملف المستخدم الداخلي
        await db.collection('companies').doc(companyId).collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: sanitizedEmail,
            fullName: contactName,
            username: sanitizedEmail.split('@')[0],
            role: 'Admin',
            isActive: true,
            createdAt: FieldValue.serverTimestamp()
        });

        // 5. تحديث حالة الطلب (نفس المشروع المستهدف)
        if (requestId) {
            const requestRef = db.collection('company_requests').doc(requestId);
            const requestSnap = await requestRef.get();
            
            if (requestSnap.exists) {
                await requestRef.update({
                    status: 'activated',
                    activatedAt: FieldValue.serverTimestamp(),
                    companyId: companyId
                });
            } else {
                return NextResponse.json({ 
                    success: false, 
                    error: "REQUEST_NOT_FOUND",
                    message: "تم إنشاء الشركة ولكن لم نجد الطلب الأصلي لتحديث حالته." 
                });
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: "تم تأسيس المنشأة وتفعيل حساب المالك بنجاح."
        });
    }

    return NextResponse.json({ success: false, error: "UNKNOWN_ACTION" });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ 
        success: false, 
        error: "SERVER_ERROR",
        message: error.message 
    }, { status: 500 });
  }
}
