import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API إدارة المنشآت وحسابات المستخدمين.
 * تم تحصينه ليعتمد كلياً على المتغيرات الحقيقية للمشروع الحالي.
 */

let adminApp: any;

function getAdminApp() {
  if (getApps().length === 0) {
    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    
    let serviceAccount = null;
    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        try {
            const fileContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
            const parsed = JSON.parse(fileContent);
            if (parsed.private_key && !parsed.private_key.includes("ضع_هنا")) {
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
        // خيار احتياطي باستخدام المتغيرات الموجودة في .env.local
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
            // تهيئة افتراضية للمشروع الحالي لضمان عدم الانهيار عند غياب المفاتيح
            adminApp = initializeApp({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-8039389980-3d2d0",
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
        
        // 1. التحقق من صلاحية الاتصال بـ Auth (نظام Google)
        try {
            await auth.listUsers(1); 
        } catch (e: any) {
            return NextResponse.json({ 
                success: false, 
                error: "INVALID_CONFIG",
                message: "ملف الأمان service-account.json غير موجود أو غير صالح. يرجى لصق بيانات المفتاح الخاص فيه أولاً."
            });
        }

        // 2. إنشاء حساب المالك في Auth
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

        // 3. حقن الهوية داخل الحساب
        await auth.setCustomUserClaims(userRecord.uid, {
            companyId: companyId,
            role: 'Admin'
        });

        // 4. بناء سجل الشركة في قاعدة البيانات
        await db.collection('companies').doc(companyId).set({
            id: companyId,
            name: companyName,
            activity,
            adminEmail: sanitizedEmail,
            isActive: true,
            createdAt: FieldValue.serverTimestamp(),
        });

        // 5. إنشاء ملف المستخدم الداخلي المعزول
        await db.collection('companies').doc(companyId).collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: sanitizedEmail,
            fullName: contactName,
            username: username || sanitizedEmail.split('@')[0],
            role: 'Admin',
            isActive: true,
            createdAt: FieldValue.serverTimestamp()
        });

        // 6. تحديث حالة الطلب
        if (requestId) {
            const requestRef = db.collection('company_requests').doc(requestId);
            const requestSnap = await requestRef.get();
            
            if (requestSnap.exists) {
                await requestRef.update({
                    status: 'activated',
                    activatedAt: FieldValue.serverTimestamp(),
                    companyId: companyId
                });
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
