import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API سيادي لإدارة حسابات المستخدمين عابرة المنشآت.
 * تم تحديثه ليكون صريحاً جداً بشأن حالة ملف الأمان المفقود.
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

    // 🛡️ إذا لم يتوفر ملف الأمان، نرفض العملية ونطلب التفعيل اليدوي بدلاً من المحاكاة الصامتة
    if (!hasServiceAccount) {
        return NextResponse.json({ 
            success: false, 
            error: "MISSING_SERVICE_ACCOUNT",
            message: "ملف الأمان السيادي (service-account.json) مفقود أو فارغ. يرجى إنشاء الحساب يدوياً في Firebase Console." 
        });
    }

    if (getApps().length === 0) {
        const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        initializeApp({ credential: cert(sa) });
    }

    const auth = getAuth();
    let userRecord;
    const sanitizedEmail = email?.toLowerCase().trim();

    if (action === 'create') {
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
    } else if (action === 'update_full' && uid) {
        const updateData: any = {};
        if (sanitizedEmail) updateData.email = sanitizedEmail;
        if (password) updateData.password = password;
        if (displayName) updateData.displayName = displayName;
        
        userRecord = await auth.updateUser(uid, updateData);
    }

    return NextResponse.json({ 
        success: true, 
        uid: userRecord?.uid,
        message: "تمت مزامنة بيانات الهوية السيادية بنجاح." 
    });

  } catch (error: any) {
    console.error("Manage User API Error:", error);
    return NextResponse.json({ 
        success: false, 
        error: error.message 
    });
  }
}
