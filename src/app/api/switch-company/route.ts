import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API سيادي لتبديل الشركة للمطور (V15.0).
 * تم تحصينه لمنع خطأ الـ Token في حال غياب ملف الأمان.
 */

export async function POST(request: NextRequest) {
  try {
    const { uid, companyId, companyName } = await request.json();

    const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
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
    return NextResponse.json({ 
        success: false, 
        error: error.message || "Internal Sovereign Error" 
    }, { status: 200 }); 
  }
}
