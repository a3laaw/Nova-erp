import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API الأمان السيادي الموحد (V7.0 - Odoo Auto-Flow).
 * مسؤول عن إنشاء الحسابات سحابياً وتوليد روابط التفعيل آلياً.
 */

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName, uid, action } = await request.json();

    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    let hasServiceAccount = false;

    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        const fileContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
        const sa = JSON.parse(fileContent || '{}');
        if (sa && sa.project_id && sa.private_key) {
            hasServiceAccount = true;
        }
    }

    if (action === 'check') {
        return NextResponse.json({ success: true, status: hasServiceAccount ? 'READY' : 'MANUAL_MODE' });
    }

    if (!hasServiceAccount) {
        return NextResponse.json({ 
            success: false, 
            error: "MISSING_SERVICE_ACCOUNT",
            message: "ملف الأمان (service-account.json) مفقود. النظام في وضع التفعيل اليدوي." 
        });
    }

    if (getApps().length === 0) {
        const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        initializeApp({ credential: cert(sa) });
    }

    const auth = getAuth();
    let userRecord;
    const sanitizedEmail = email?.toLowerCase().trim();

    if (action === 'activate_invite') {
        try {
            // 🛡️ إنشاء المستخدم بكلمة مرور عشوائية (كما في Odoo)
            userRecord = await auth.createUser({
                email: sanitizedEmail,
                password: password || Math.random().toString(36).slice(-12),
                displayName: displayName || 'Nova User',
                emailVerified: true,
            });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') {
                userRecord = await auth.getUserByEmail(sanitizedEmail);
            } else {
                throw e;
            }
        }

        // 🔗 توليد رابط تفعيل (يعمل كدعوة رسمية لتعيين كلمة المرور)
        const inviteLink = await auth.generatePasswordResetLink(sanitizedEmail);

        return NextResponse.json({ 
            success: true, 
            uid: userRecord?.uid,
            inviteLink,
            message: "تم تأسيس الحساب سحابياً بنجاح وتوليد رابط التفعيل." 
        });
    }

    if (action === 'update_full' && uid) {
        userRecord = await auth.updateUser(uid, { 
            email: sanitizedEmail,
            password: password || undefined,
            displayName: displayName
        });
        return NextResponse.json({ success: true, uid: userRecord.uid });
    }

    return NextResponse.json({ success: false, error: "Unknown action" });

  } catch (error: any) {
    console.error("Sovereign Auth API Error:", error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
