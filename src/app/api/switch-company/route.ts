
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API سيادي لتبديل الشركة للمطور (Super Admin Switcher).
 * تم تحديثه لضمان إرجاع JSON دائماً ومنع انهيار الخادم عند فقدان ملف الاعتماد.
 */

export async function POST(request: NextRequest) {
  try {
    const { uid, companyId, companyName } = await request.json();

    if (!uid || !companyId) {
      return NextResponse.json({ success: false, error: "Missing parameters" }, { status: 400 });
    }

    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    
    // محاولة تهيئة الـ Admin SDK بأمان
    if (getApps().length === 0) {
        if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
            return NextResponse.json({ 
                success: false, 
                error: "نظام الأمان: ملف الاعتماد مفقود أو تم تطهيره للرفع لـ GitHub. يرجى تزويد الخادم بالمفتاح الأصلي." 
            }, { status: 500 });
        }
        
        try {
            const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
            if (!serviceAccount.project_id) throw new Error("Empty credentials");
            
            initializeApp({
                credential: cert(serviceAccount),
            });
        } catch (initErr) {
            return NextResponse.json({ 
                success: false, 
                error: "فشل تهيئة المحرك السيادي. تأكد من صحة ملف service-account.json." 
            }, { status: 500 });
        }
    }

    const auth = getAuth();
    const db = getFirestore();

    // 1. التأكد من أن المستخدم طالب التبديل هو مطور فعلي في مشروع الماستر
    const devDoc = await db.collection('developers').doc(uid).get();
    if (!devDoc.exists) {
        return NextResponse.json({ success: false, error: "Unauthorized: Access Denied" }, { status: 403 });
    }

    // 2. تعيين الختم السيادي (Custom Claims)
    await auth.setCustomUserClaims(uid, {
      role: 'Developer',
      isSuperAdmin: true,
      currentCompanyId: companyId,
      companyName: companyName
    });

    return NextResponse.json({ 
        success: true, 
        message: `تم منحك صلاحيات الولوج لمنشأة ${companyName} بنجاح.` 
    });

  } catch (error: any) {
    console.error("Switch Company Critical Error:", error);
    return NextResponse.json({ 
        success: false, 
        error: error.message || "حدث خطأ داخلي في الخادم." 
    }, { status: 500 });
  }
}
