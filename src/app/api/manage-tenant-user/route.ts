import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API إدارة المنشآت وحسابات المستخدمين (V21.0).
 * تم تحصين هذا المسار ليفحص محتوى ملف الأمان بدقة قبل استخدامه.
 */

const MASTER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCOreHYZzC4Egia3d7uWUOWKdzPxQ9MrS4",
  authDomain: "nov-erp-1-25549967-c24e5.firebaseapp.com",
  projectId: "nov-erp-1-25549967-c24e5",
  storageBucket: "nov-erp-1-25549967-c24e5.firebasestorage.app",
  messagingSenderId: "71297676078",
  appId: "1:71297676078:web:b956ab00372e6ba237c0bf"
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
        action, email, username, companyName, contactName, phone, 
        activity, employeeCountRange, password, requestId 
    } = body;

    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    
    // 1. فحص وجود الملف
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        return NextResponse.json({ 
            success: false, 
            error: "FILE_NOT_FOUND",
            message: "ملف الأمان (service-account.json) غير موجود في مجلد المشروع."
        });
    }

    // 2. فحص محتوى الملف (هل هو JSON صالح؟)
    let sa;
    try {
        const saContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
        sa = JSON.parse(saContent);
    } catch (parseError) {
        return NextResponse.json({ 
            success: false, 
            error: "JSON_PARSE_ERROR",
            message: "ملف service-account.json يحتوي على أخطاء في الصيغة (مثل التعليقات //). يرجى مسح محتوى الملف ولصق بيانات المفتاح الحقيقي كـ JSON نظيف فقط."
        });
    }

    if (!sa.private_key || sa.private_key.includes("ضع_هنا")) {
        return NextResponse.json({ 
            success: false, 
            error: "INVALID_CONFIG",
            message: "ملف service-account.json موجود ولكنه لا يحتوي على مفتاح خاص صالح. يرجى لصق بيانات المفتاح التي حملتها من Firebase Console داخل الملف."
        });
    }

    // 3. تهيئة تطبيق Firebase Admin
    if (getApps().length === 0) {
        initializeApp({ credential: cert(sa) });
    }

    const db = getFirestore();
    const auth = getAuth();

    // --- تفعيل منشأة جديدة ---
    if (action === 'instant_setup') {
        const companyId = `comp-${Math.random().toString(36).substring(2, 9)}`;
        const sanitizedEmail = email?.toLowerCase().trim();
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);

        // أ. إنشاء الحساب في نظام Authentication
        let userRecord;
        try {
            userRecord = await auth.createUser({
                email: sanitizedEmail,
                password: password,
                displayName: contactName,
                emailVerified: true,
            });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') {
                userRecord = await auth.getUserByEmail(sanitizedEmail);
            } else { throw e; }
        }

        // ب. تعيين الأدوار (Claims)
        await auth.setCustomUserClaims(userRecord.uid, {
            companyId: companyId,
            role: 'Admin'
        });

        // ج. تأسيس وثيقة الشركة
        const companyRef = db.collection('companies').doc(companyId);
        await companyRef.set({
            id: companyId,
            name: companyName,
            activity: activity || 'general',
            employeeCountRange: employeeCountRange || '1-5',
            adminEmail: sanitizedEmail,
            isActive: true,
            subscriptionType: 'trial',
            trialEndDate: Timestamp.fromDate(trialEndDate),
            maxUsersLimit: 5,
            firebaseConfig: MASTER_FIREBASE_CONFIG,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        // د. إنشاء ملف المستخدم الإداري داخل المنشأة
        const tenantUserRef = db.collection('companies').doc(companyId).collection('users').doc(userRecord.uid);
        await tenantUserRef.set({
            uid: userRecord.uid,
            email: sanitizedEmail,
            fullName: contactName,
            username: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
            role: 'Admin',
            isActive: true,
            createdAt: FieldValue.serverTimestamp()
        });

        // هـ. تحديث الفهرس العالمي للدخول
        const globalIndexRef = db.collection('global_users').doc();
        await globalIndexRef.set({
            email: sanitizedEmail,
            username: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
            companyId,
            uid: userRecord.uid,
            createdAt: FieldValue.serverTimestamp()
        });

        // و. تحديث حالة الطلب
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
            uid: userRecord.uid,
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
