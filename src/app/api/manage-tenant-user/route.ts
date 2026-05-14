import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API الإدارة والتحكم في المنشآت (V19.0 - Stability Core).
 * تم تحصينه لمنع انهيار السيرفر بسبب ملفات الأمان الفارغة أو غير الصالحة.
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

    // 🛡️ فحص صحة وصلاحية ملف الأمان قبل محاولة الاتصال بـ Google
    if (action === 'instant_setup') {
        if (!hasServiceAccount) {
            return NextResponse.json({ 
                success: false, 
                error: "MISSING_CONFIG",
                message: "⚠️ تنبيه إداري: ملف الأمان (service-account.json) مفقود من جذر المشروع."
            }, { status: 200 });
        }
        
        try {
            const saContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
            const sa = JSON.parse(saContent);
            
            // التحقق من أن الملف ليس فارغاً ويحتوي على المفاتيح الأساسية
            if (!sa.project_id || !sa.private_key) {
                return NextResponse.json({ 
                    success: false, 
                    error: "INVALID_CONFIG",
                    message: "⚠️ تنبيه: ملف الأمان موجود ولكنه غير صالح أو فارغ. يرجى تحميل ملف JSON الصحيح من Firebase Console."
                }, { status: 200 });
            }
            
            // تهيئة التطبيق إذا لم يكن مهيئاً
            if (getApps().length === 0) {
                initializeApp({ credential: cert(sa) });
            }
        } catch (e) {
            return NextResponse.json({ 
                success: false, 
                error: "CONFIG_READ_ERROR",
                message: "⚠️ خطأ في قراءة ملف الأمان. تأكد من رفعه بشكل صحيح كملف JSON."
            }, { status: 200 });
        }
    }

    // --- 1. التفعيل والاحتضان السحابي ---
    if (action === 'instant_setup') {
        const db = getFirestore();
        const auth = getAuth();
        const companyId = `comp-${Math.random().toString(36).substring(2, 9)}`;
        const sanitizedEmail = email?.toLowerCase().trim();
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);

        // أ. إنشاء حساب المالك في Authentication
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

        // ب. تعيين صلاحيات المدير
        await auth.setCustomUserClaims(userRecord.uid, {
            companyId: companyId,
            role: 'Admin'
        });

        // ج. إنشاء وثيقة المنشأة وحقن الإعدادات
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

        // د. إنشاء ملف المالك داخل مستخدمي المنشأة
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

        // هـ. تسجيل الهوية في الفهرس الموحد للعبور بالاسم
        const globalIndexRef = db.collection('global_users').doc();
        await globalIndexRef.set({
            email: sanitizedEmail,
            username: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
            companyId,
            uid: userRecord.uid,
            createdAt: FieldValue.serverTimestamp()
        });

        // و. تحديث طلب الانضمام
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
            message: "تم تأسيس وتفعيل المنشأة بنجاح."
        });
    }

    return NextResponse.json({ success: false, error: "ACTION_NOT_RECOGNIZED" });

  } catch (error: any) {
    console.error("Master API Error:", error);
    return NextResponse.json({ 
        success: false, 
        error: error.message || "Internal Server Error" 
    }, { status: 500 });
  }
}
