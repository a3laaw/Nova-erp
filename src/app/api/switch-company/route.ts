
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API سيادي لتبديل الشركة للمطور (Super Admin Switcher).
 * تم تحصينه ليعيد أخطاء JSON واضحة ويمنع انهيار الواجهة.
 */

export async function POST(request: NextRequest) {
  try {
    const { uid, companyId, companyName } = await request.json();

    if (!uid || !companyId) {
      return NextResponse.json({ success: false, error: "Missing parameters" }, { status: 400 });
    }

    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        return NextResponse.json({ 
            success: false, 
            error: "فشل تهيئة المحرك. ملف الحساب (service-account.json) غير موجود." 
        }, { status: 500 });
    }

    let serviceAccount;
    try {
        const fileContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
        serviceAccount = JSON.parse(fileContent);
        
        if (!serviceAccount || Object.keys(serviceAccount).length === 0 || !serviceAccount.project_id) {
            return NextResponse.json({ 
                success: false, 
                error: "محرك التقمص متوقف. يرجى تزويد ملف الحساب بالمفاتيح الأصلية يدوياً وتفريغها عند الرفع لـ GitHub." 
            }, { status: 500 });
        }
    } catch (parseErr) {
        return NextResponse.json({ 
            success: false, 
            error: "خطأ في قراءة ملف الاعتماد. تأكد من صحة تنسيق الـ JSON." 
        }, { status: 500 });
    }

    if (getApps().length === 0) {
        initializeApp({
            credential: cert(serviceAccount),
        });
    }

    const auth = getAuth();

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
    return NextResponse.json({ 
        success: false, 
        error: error.message || "حدث خطأ داخلي في الخادم السيادي." 
    }, { status: 500 });
  }
}
