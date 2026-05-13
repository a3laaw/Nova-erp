import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API الأمان السيادي الموحد (V10.0 - Full Auto Flow).
 * مسؤول عن التأسيس الفوري للمنشآت وحقن المصفوفة السحابية آلياً.
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
    const { action, email, username, companyName, contactName, phone, activity, employeeCountRange } = body;

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
            message: "ملف الأمان (service-account.json) مفقود. يرجى رفعه لتفعيل الأتمتة الفورية." 
        });
    }

    if (getApps().length === 0) {
        const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        initializeApp({ credential: cert(sa) });
    }

    const auth = getAuth();
    const db = getFirestore();
    const sanitizedEmail = email?.toLowerCase().trim();

    if (action === 'instant_setup') {
        const companyId = `comp-${Math.random().toString(36).substring(2, 9)}`;
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);

        // 1. إنشاء حساب الأمان (Firebase Auth)
        let userRecord;
        try {
            userRecord = await auth.createUser({
                email: sanitizedEmail,
                password: Math.random().toString(36).slice(-12) + 'A1!', // كلمة مرور عشوائية للتفعيل
                displayName: contactName,
                emailVerified: true,
            });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') {
                userRecord = await auth.getUserByEmail(sanitizedEmail);
            } else { throw e; }
        }

        // 2. توليد رابط التفعيل (Password Reset)
        const inviteLink = await auth.generatePasswordResetLink(sanitizedEmail);

        // 3. إنشاء سجل المنشأة في Firestore
        const companyRef = db.collection('companies').doc(companyId);
        await companyRef.set({
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

        // 4. إنشاء ملف الموظف الإداري داخل الشركة
        const tenantUserRef = db.collection('companies').doc(companyId).collection('users').doc(userRecord.uid);
        await tenantUserRef.set({
            id: userRecord.uid,
            uid: userRecord.uid,
            fullName: contactName,
            email: sanitizedEmail,
            username: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
            role: 'Admin',
            isActive: true,
            companyId: companyId,
            createdAt: FieldValue.serverTimestamp(),
        });

        // 5. زرع الهوية في الفهرس العالمي
        const globalIndexRef = db.collection('global_users').doc();
        await globalIndexRef.set({
            email: sanitizedEmail,
            username: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
            companyId,
            uid: userRecord.uid,
            createdAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({ 
            success: true, 
            inviteLink,
            message: "تم تأسيس المنشأة وتفعيل النظام آلياً." 
        });
    }

    return NextResponse.json({ success: false, error: "Unknown action" });

  } catch (error: any) {
    console.error("Sovereign Instant Setup Error:", error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
