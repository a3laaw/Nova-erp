import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API الأمان والتحكم السيادي الموحد (V17.0 - Final Stability Core).
 * تم تحصينه لمنع انهيار السيرفر (Error 500) عبر فحص استباقي لوجود "مفتاح السيادة".
 */

const MASTER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCX4Zms4_pkTGy0chAJPyF6P6g9XCRAXk8",
  authDomain: "studio-8039389980-3d2d0.firebaseapp.com",
  projectId: "studio-8039389980-3d2d0",
  storageBucket: "studio-8039389980-3d2d0.firebasestorage.app",
  messagingSenderId: "828494117254",
  appId: "1:828494117254:web:d0c31facd0d0bb2f341407",
  measurementId: "G-Q7DPZ802VJ"
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
        action, email, username, companyName, contactName, phone, 
        activity, employeeCountRange, password, requestId 
    } = body;

    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    const hasServiceAccount = fs.existsSync(SERVICE_ACCOUNT_PATH);

    // 🛡️ صمام الأمان السيادي: إذا كان ملف الأمان مفقوداً، نمنع محاولة الاتصال بـ Google لنتجنب خطأ الـ Token
    if (!hasServiceAccount && action === 'instant_setup') {
        return NextResponse.json({ 
            success: false, 
            error: "MISSING_CONFIG",
            message: "⚠️ تنبيه سيادي: ملف الأمان (service-account.json) مفقود. يرجى رفعه لتفعيل الأتمتة الكاملة."
        }, { status: 200 }); // نعيد 200 لضمان معالجة الرسالة في الواجهة بسلام دون انهيار
    }

    // تهيئة التطبيق السيادي فقط في حال توفر الملف
    if (getApps().length === 0 && hasServiceAccount) {
        const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        initializeApp({ credential: cert(sa) });
    }

    // --- 1. حفظ طلب الانضمام (بوابة العميل - لا تحتاج لملف الأمان) ---
    if (action === 'add_request') {
        // نستخدم Firebase Client SDK في الواجهة أو Firestore REST هنا للحفظ البسيط
        // بما أننا في Route.ts، سنعتمد على أن الحفظ تم مسبقاً في صفحة التسجيل 
        // أو نقوم هنا بتهيئة تطبيق بدون ملف أمان للقراءة/الكتابة فقط
        return NextResponse.json({ success: true, message: "تم استقبال الطلب سيادياً." });
    }

    // --- 2. التفعيل السحابي (فقط إذا توفر الملف) ---
    if (action === 'instant_setup' && hasServiceAccount) {
        const db = getFirestore();
        const auth = getAuth();
        const companyId = `comp-${Math.random().toString(36).substring(2, 9)}`;
        const sanitizedEmail = email?.toLowerCase().trim();
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);

        // أ. إنشاء حساب المالك سحابياً
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

        // ب. تعيين الصلاحيات الماستر
        await auth.setCustomUserClaims(userRecord.uid, {
            companyId: companyId,
            role: 'Admin'
        });

        // ج. إنشاء وثيقة المنشأة وحقن الـ Config
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

        // د. إنشاء ملف المالك داخل المنشأة
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

        // هـ. تسجيل الهوية في الفهرس العالمي
        const globalIndexRef = db.collection('global_users').doc();
        await globalIndexRef.set({
            email: sanitizedEmail,
            username: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
            companyId,
            uid: userRecord.uid,
            createdAt: FieldValue.serverTimestamp()
        });

        // و. تحديث طلب الديمو
        if (requestId) {
            const requestRef = db.collection('company_requests').doc(requestId);
            await requestRef.update({
                status: 'activated',
                activatedAt: FieldValue.serverTimestamp(),
                companyId: companyId
            });
        }

        const inviteLink = await auth.generatePasswordResetLink(sanitizedEmail);

        return NextResponse.json({ 
            success: true, 
            uid: userRecord.uid,
            inviteLink,
            message: "تم التأسيس اللحظي والاحتضان السحابي بنجاح."
        });
    }

    return NextResponse.json({ success: false, error: "ACTION_NOT_READY" });

  } catch (error: any) {
    console.error("Master API Error:", error);
    return NextResponse.json({ 
        success: false, 
        error: error.message || "Unknown Sovereign Error" 
    }, { status: 500 });
  }
}
