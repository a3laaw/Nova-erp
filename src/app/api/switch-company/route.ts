import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API سيادي لتبديل الشركة للمطور.
 * تم تحديثه لضمان إرجاع JSON دائماً ومنع انهيار الواجهة في وضع المحاكاة.
 */

export async function POST(request: NextRequest) {
  try {
    const { uid, companyId, companyName } = await request.json();

    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    let useSimulation = false;

    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        useSimulation = true;
    } else {
        const fileContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
        const sa = JSON.parse(fileContent || '{}');
        if (!sa || Object.keys(sa).length === 0 || !sa.project_id) {
            useSimulation = true;
        }
    }

    // 🛡️ بروتوكول التجاوز السيادي: إرجاع JSON ناجح لتمكين تجربة المستخدم
    if (useSimulation) {
        return NextResponse.json({ 
            success: true, 
            simulated: true,
            message: `تقمص محاكى نشط لـ ${companyName} (وضع الحماية السيادي).` 
        });
    }

    if (getApps().length === 0) {
        const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        initializeApp({ credential: cert(sa) });
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
        message: `تم تفعيل السيادة على منشأة ${companyName} بنجاح.` 
    });

  } catch (error: any) {
    // 🛡️ حماية نهائية: إرجاع JSON حتى في حالة الخطأ
    return NextResponse.json({ 
        success: false, 
        error: error.message || "Internal Sovereign Error" 
    }, { status: 200 }); // إرجاع 200 لضمان معالجة الرسالة في الواجهة
  }
}
