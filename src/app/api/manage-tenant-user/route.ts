
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';

const SERVICE_ACCOUNT_PATH = './service-account.json';

/**
 * @fileOverview API سيادي لإدارة حسابات المستخدمين في Firebase Auth.
 * تم تحديثه ليدعم "الترميم" (Repair) في حال وجود الحساب مسبقاً ببيانات خاطئة.
 */

if (getApps().length === 0 && fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  initializeApp({
    credential: cert(JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName, action } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Missing parameters" }, { status: 400 });
    }

    const auth = getAuth();
    let userRecord;
    const sanitizedEmail = email.toLowerCase().trim();

    if (action === 'create' || action === 'repair') {
        try {
            // محاولة إنشاء مستخدم جديد
            userRecord = await auth.createUser({
                email: sanitizedEmail,
                password: password,
                displayName: displayName || 'Nova User',
                emailVerified: true,
            });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') {
                // إذا كان موجوداً، نقوم بتحديث كلمة المرور لضمان المطابقة مع ما يراه المطور
                userRecord = await auth.getUserByEmail(sanitizedEmail);
                await auth.updateUser(userRecord.uid, { 
                    password: password,
                    displayName: displayName || userRecord.displayName
                });
            } else {
                throw e;
            }
        }
    } else if (action === 'update_password') {
        userRecord = await auth.getUserByEmail(sanitizedEmail);
        await auth.updateUser(userRecord.uid, { password: password });
    }

    return NextResponse.json({ 
        success: true, 
        uid: userRecord?.uid,
        message: "تمت مزامنة الحساب مع خادم الأمان بنجاح." 
    });

  } catch (error: any) {
    console.error("Manage Tenant User Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
