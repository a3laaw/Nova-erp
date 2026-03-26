
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const SERVICE_ACCOUNT_PATH = './service-account.json';

/**
 * @fileOverview API سيادي لتبديل الشركة للمطور (Super Admin Switcher).
 * يقوم بتحديث الـ Custom Claims للمستخدم ليتمكن من الدخول لأي منشأة.
 */

if (getApps().length === 0 && fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  initializeApp({
    credential: cert(JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { uid, companyId, companyName } = await request.json();

    if (!uid || !companyId) {
      return NextResponse.json({ success: false, error: "Missing parameters" }, { status: 400 });
    }

    const auth = getAuth();
    const db = getFirestore();

    // 1. التأكد من أن المستخدم طالب التبديل هو مطور فعلي في مشروع الماستر
    const devDoc = await db.collection('developers').doc(uid).get();
    if (!devDoc.exists) {
        return NextResponse.json({ success: false, error: "Unauthorized: Access Denied" }, { status: 403 });
    }

    // 2. تعيين الختم السيادي (Custom Claims)
    // سيتم استهلاك هذه المطالبات في الـ AuthContext لتوجيه كافة طلبات الـ Firestore للمسار الصحيح
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
    console.error("Switch Company Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
