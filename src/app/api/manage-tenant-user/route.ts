import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API الأمان السيادي الموحد (V11.0 - Full Auto Flow).
 * تم تحصينه لضمان الشفافية المطلقة عند فشل الأتمتة بسبب نقص ملفات الأمان.
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
        try {
            const sa = JSON.parse(fileContent || '{}');
            if (sa && sa.project_id && sa.private_key) {
                hasServiceAccount = true;
            }
        } catch (e) {
            console.error("Invalid Service Account JSON");
        }
    }

    // 🛡️ رادار فحص الجاهزية للأدمن
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
        const companyId = `comp-${Math.random().toString(36).substring(2, 9)}`;
        const sanitizedEmail = email?.toLowerCase().trim();
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 7);

        let inviteLink = null;
        let authCreated = false;

        // 1. محاولة إنشاء حساب الأمان (Authentication)
        if (hasServiceAccount) {
            try {
                const auth = getAuth();
                let userRecord;
                try {
                    userRecord = await auth.createUser({
                        email: sanitizedEmail,
                        password: Math.random().toString(36).slice(-12) + 'A1!',
                        displayName: contactName,
                        emailVerified: true,
                    });
                } catch (e: any) {
                    if (e.code === 'auth/email-already-exists') {
                        userRecord = await auth.getUserByEmail(sanitizedEmail);
                    } else { throw e; }
                }
                inviteLink = await auth.generatePasswordResetLink(sanitizedEmail);
                authCreated = true;
            } catch (e: any) {
                console.error("Auth creation failed:", e.message);
            }
        }

        // 2. إنشاء السجلات في قاعدة البيانات (حتى لو فشل الـ Auth، لتمكين الإضافة اليدوية)
        const db = getFirestore();
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

        // 3. الفهرس العالمي
        const globalIndexRef = db.collection('global_users').doc();
        await globalIndexRef.set({
            email: sanitizedEmail,
            username: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
            companyId,
            createdAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({ 
            success: true, 
            authCreated,
            inviteLink,
            message: authCreated ? "تم تأسيس المنشأة آلياً." : "تأسيس جزئي: يرجى إضافة الإيميل يدوياً في Console."
        });
    }

    return NextResponse.json({ success: false, error: "Unknown action" });

  } catch (error: any) {
    console.error("Sovereign Instant Setup Error:", error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
