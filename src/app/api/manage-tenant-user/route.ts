import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API إدارة المنشآت وحسابات المستخدمين (V21.0 - Identity Sync)
 * تم حذف كافة القيم الصلبة لضمان التزامن مع المشروع الحالي.
 */

// تهيئة Firebase Admin باستخدام ملف الأمان أو متغيرات البيئة
let adminApp: any;

function getAdminApp() {
  if (getApps().length === 0) {
    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    
    // التحقق من وجود مفتاح حقيقي داخل ملف الأمان
    let serviceAccount = null;
    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        try {
            const fileContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
            const parsed = JSON.parse(fileContent);
            if (parsed.private_key && parsed.private_key !== "ضع_هنا_محتوى_الملف_الحقيقي") {
                serviceAccount = parsed;
            }
        } catch (e) {
            console.warn("Invalid JSON in service-account.json");
        }
    }

    if (serviceAccount) {
        adminApp = initializeApp({
            credential: cert(serviceAccount),
        });
    } else {
        // خيار احتياطي باستخدام متغيرات البيئة (للكلاود)
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        if (privateKey) {
            adminApp = initializeApp({
                credential: cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey,
                }),
            });
        } else {
            // تهيئة افتراضية للمشروع المحلي (تسمح لبعض العمليات بالعمل)
            adminApp = initializeApp({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "nova-erp-project",
            });
        }
    }
  }
  return adminApp;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
        action, email, username, companyName, contactName, 
        activity, employeeCountRange, password, requestId 
    } = body;

    getAdminApp();
    const db = getFirestore();
    const auth = getAuth();

    if (action === 'instant_setup') {
        const companyId = `comp-${Math.random().toString(36).substring(2, 9)}`;
        const sanitizedEmail = email?.toLowerCase().trim();
        
        // 1. فحص وجود ملف الأمان قبل محاولة الاتصال بـ Auth (منع الخطأ 500)
        try {
            await auth.listUsers(1); 
        } catch (e: any) {
            return NextResponse.json({ 
                success: false, 
                error: "INVALID_CONFIG",
                message: "ملف الأمان service-account.json غير صالح أو غير موجود. يرجى رفعه لتتمكن من إنشاء حسابات الملاك آلياً."
            });
        }

        // 2. إنشاء حساب المالك
        let userRecord;
        try {
            userRecord = await auth.createUser({
                email: sanitizedEmail,
                password: password,
                displayName: contactName,
            });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') {
                userRecord = await auth.getUserByEmail(sanitizedEmail);
            } else { throw e; }
        }

        await auth.setCustomUserClaims(userRecord.uid, {
            companyId: companyId,
            role: 'Admin'
        });

        // 3. بناء إعدادات Firebase للمنشأة الجديدة (ديناميكياً من البيئة الحالية)
        const currentConfig = {
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };

        // 4. إنشاء سجل الشركة
        await db.collection('companies').doc(companyId).set({
            id: companyId,
            name: companyName,
            activity,
            adminEmail: sanitizedEmail,
            isActive: true,
            firebaseConfig: currentConfig,
            createdAt: FieldValue.serverTimestamp(),
        });

        // 5. إنشاء ملف المستخدم الداخلي
        await db.collection('companies').doc(companyId).collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: sanitizedEmail,
            fullName: contactName,
            username: username || sanitizedEmail.split('@')[0],
            role: 'Admin',
            isActive: true,
            createdAt: FieldValue.serverTimestamp()
        });

        // 6. تحديث طلب الانضمام (مع معالجة الخطأ NOT_FOUND)
        if (requestId) {
            const requestRef = db.collection('company_requests').doc(requestId);
            const requestSnap = await requestRef.get();
            
            if (requestSnap.exists) {
                await requestRef.update({
                    status: 'activated',
                    activatedAt: FieldValue.serverTimestamp(),
                    companyId: companyId
                });
            } else {
                console.warn(`Request document ${requestId} not found on server, but company was created.`);
            }
        }

        return NextResponse.json({ 
            success: true, 
            uid: userRecord.uid,
            message: "تم تأسيس المنشأة وتفعيل حساب المالك بنجاح."
        });
    }

    return NextResponse.json({ success: false, error: "UNKNOWN_ACTION" });

  } catch (error: any) {
    console.error("Critical API Error:", error);
    return NextResponse.json({ 
        success: false, 
        error: "SERVER_ERROR",
        message: error.message 
    }, { status: 500 });
  }
}
