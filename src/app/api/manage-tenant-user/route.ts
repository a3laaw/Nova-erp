import { NextRequest, NextResponse } from 'next/request';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase/admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API الأمان السيادي الموحد (V12.0 - Fully Automated Activation Flow).
 * تم تحصينه لدعم تفعيل طلبات الديمو وإنشاء الـ Tenants والمستخدمين آلياً.
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
    const { action, email, username, companyName, contactName, phone, activity, employeeCountRange, password, requestId } = body;

    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    let hasServiceAccount = false;

    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        const fileContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
        try {
            const sa = JSON.parse(fileContent || '{}');
            if (sa && sa.project_id && sa.private_key) {
                hasServiceAccount = true;
            }
        } catch (e) {
            console.error("Invalid Service Account JSON");
        }
    }

    if (action === 'check') {
        return NextResponse.json({ 
            success: true, 
            status: hasServiceAccount ? 'READY' : 'MANUAL_MODE',
            projectId: MASTER_FIREBASE_CONFIG.projectId
        });
    }

    if (getApps().length === 0 && hasServiceAccount) {
        const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        initializeApp({ credential: cert(sa) });
    }

    if (action === 'instant_setup') {
        if (!hasServiceAccount) throw new Error("محرك الأتمتة غير مفعل. يرجى رفع ملف الأمان أولاً.");

        const auth = getAuth();
        const db = getFirestore();
        const companyId = `comp-${Math.random().toString(36).substring(2, 9)}`;
        const sanitizedEmail = email?.toLowerCase().trim();
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);

        // 1. إنشاء حساب المالك سحابياً
        let userRecord;
        try {
            userRecord = await auth.createUser({
                email: sanitizedEmail,
                password: password || Math.random().toString(36).slice(-12) + 'A1!',
                displayName: contactName,
                emailVerified: true,
            });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') {
                userRecord = await auth.getUserByEmail(sanitizedEmail);
            } else { throw e; }
        }

        // 2. تعيين الصلاحيات الماستر للمنشأة (Tenant ID)
        await auth.setCustomUserClaims(userRecord.uid, {
            companyId: companyId,
            role: 'Admin'
        });

        // 3. إنشاء وثيقة المنشأة السيادية
        const companyRef = db.collection('companies').doc(companyId);
        await companyRef.set({
            id: companyId,
            name: companyName,
            activity: activity || 'general',
            employeeCountRange: employeeCountRange || '1-5',
            adminEmail: sanitizedEmail,
            contactPhone: phone,
            isActive: true,
            subscriptionType: 'trial',
            trialEndDate: Timestamp.fromDate(trialEndDate),
            maxUsersLimit: 5,
            firebaseConfig: MASTER_FIREBASE_CONFIG,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        // 4. إنشاء ملف المستخدم داخل المنشأة (The Owner Profile)
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

        // 5. تسجيل الهوية في الفهرس العالمي للدخول السريع
        const globalIndexRef = db.collection('global_users').doc();
        await globalIndexRef.set({
            email: sanitizedEmail,
            username: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
            companyId,
            uid: userRecord.uid,
            createdAt: FieldValue.serverTimestamp()
        });

        // 6. تحديث طلب الديمو الأصلي
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
            message: "تم تأسيس المنشأة وتفعيل حساب المالك آلياً بنجاح."
        });
    }

    return NextResponse.json({ success: false, error: "Unknown action" });

  } catch (error: any) {
    console.error("Sovereign Instant Setup Error:", error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
