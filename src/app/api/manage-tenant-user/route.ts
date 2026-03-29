
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';

const SERVICE_ACCOUNT_PATH = './service-account.json';

/**
 * @fileOverview API سيادي لإدارة حسابات المستخدمين في Firebase Auth.
 * يسمح للمطور بإنشاء وتحديث كلمات مرور المستخدمين دون الحاجة للـ Client SDK.
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

    if (action === 'create') {
        try {
            userRecord = await auth.createUser({
                email: email.toLowerCase().trim(),
                password: password,
                displayName: displayName || 'Nova User',
                emailVerified: true,
            });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') {
                userRecord = await auth.getUserByEmail(email.toLowerCase().trim());
                // تحديث كلمة المرور في حال كان موجوداً مسبقاً لمزامنته
                await auth.updateUser(userRecord.uid, { password: password });
            } else {
                throw e;
            }
        }
    } else if (action === 'update_password') {
        userRecord = await auth.getUserByEmail(email.toLowerCase().trim());
        await auth.updateUser(userRecord.uid, { password: password });
    }

    return NextResponse.json({ 
        success: true, 
        uid: userRecord?.uid,
        message: "تمت معالجة الحساب في خادم الأمان بنجاح." 
    });

  } catch (error: any) {
    console.error("Manage Tenant User Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
