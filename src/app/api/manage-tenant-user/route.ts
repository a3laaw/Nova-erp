import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

/**
 * @fileOverview API إدارة المنشآت وحسابات المستخدمين (V22.0 - Environment Variables)
 */

const MASTER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCOreHYZzC4Egia3d7uWUOWKdzPxQ9MrS4",
  authDomain: "nov-erp-1-25549967-c24e5.firebaseapp.com",
  projectId: "nov-erp-1-25549967-c24e5",
  storageBucket: "nov-erp-1-25549967-c24e5.firebasestorage.app",
  messagingSenderId: "71297676078",
  appId: "1:71297676078:web:b956ab00372e6ba237c0bf"
};

// تهيئة Firebase Admin باستخدام Environment Variables
let adminApp: any;

function getAdminApp() {
  if (getApps().length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  }
  return adminApp;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
        action, email, username, companyName, contactName, phone, 
        activity, employeeCountRange, password, requestId 
    } = body;

    // تهيئة Firebase Admin
    getAdminApp();
    const db = getFirestore();
    const auth = getAuth();

    // --- تفعيل منشأة جديدة ---
    if (action === 'instant_setup') {
        const companyId = `comp-${Math.random().toString(36).substring(2, 9)}`;
        const sanitizedEmail = email?.toLowerCase().trim();
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);

        // أ. إنشاء الحساب في Authentication
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

        // ب. تعيين الأدوار
        await auth.setCustomUserClaims(userRecord.uid, {
            companyId: companyId,
            role: 'Admin'
        });

        // ج. إنشاء الشركة
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

        // د. إنشاء ملف المستخدم
        const tenantUserRef = db.collection('companies').doc(companyId).collection('users').doc(userRecord.uid);
        await tenantUserRef.set({
            uid: userRecord.uid,
            email: sanitizedEmail,
            fullName: contactName,
            username: username?.toLowerCase().replace(/[^a-z0-9]/g, '') || '',
            role: 'Admin',
            isActive: true,
            createdAt: FieldValue.serverTimestamp()
        });

        // هـ. تحديث الفهرس
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