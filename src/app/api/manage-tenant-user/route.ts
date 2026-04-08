import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API سيادي لإدارة حسابات المستخدمين في Firebase Auth.
 * تم تحصينه للتعامل مع ملفات الاعتماد المفقودة بسبب حماية GitHub.
 */

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName, action } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Missing parameters" }, { status: 400 });
    }

    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');

    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        return NextResponse.json({ 
            success: false, 
            error: "نظام الأمان: ملف الاعتماد مفقود." 
        }, { status: 500 });
    }

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        if (!serviceAccount.project_id) throw new Error("Empty credentials");
    } catch (e) {
        return NextResponse.json({ 
            success: false, 
            error: "فشل تهيئة المحرك السيادي. ملف الاعتماد مفرغ لحماية GitHub." 
        }, { status: 500 });
    }

    if (getApps().length === 0) {
        initializeApp({
            credential: cert(serviceAccount),
        });
    }

    const auth = getAuth();
    let userRecord;
    const sanitizedEmail = email.toLowerCase().trim();

    if (action === 'create' || action === 'repair') {
        try {
            userRecord = await auth.createUser({
                email: sanitizedEmail,
                password: password,
                displayName: displayName || 'Nova User',
                emailVerified: true,
            });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') {
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
