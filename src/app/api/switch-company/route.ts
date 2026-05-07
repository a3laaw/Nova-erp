
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import path from 'path';

/**
 * @fileOverview API سيادي لتبديل الشركة للمطور.
 * تم تحديثه للسماح بالنجاح الصوري عند تفريغ الملف لمنع الانهيار الأحمر في الواجهة.
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

    // 🛡️ منع الانهيار: نُعيد نجاحاً في وضع المحاكاة إذا كان الملف مفرغاً
    if (useSimulation) {
        return NextResponse.json({ 
            success: true, 
            simulated: true,
            message: `محاكاة التقمص لـ ${companyName} نشطة (للتفعيل الحقيقي يرجى وضع المفتاح يدوياً).` 
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
        message: `تم منحك صلاحيات الولوج لمنشأة ${companyName} بنجاح.` 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
