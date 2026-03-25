
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';

/**
 * @fileOverview سكربت إعداد حساب المطور الرئيسي (Sovereign Root) في مشروع Master.
 */

const SERVICE_ACCOUNT_PATH = './service-account.json';

async function setupDeveloper() {
  const DEV_EMAIL = 'dev@nova-erp.local';
  const DEV_PASSWORD = 'Sovereign@2026';

  try {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        throw new Error(`لم يتم العثور على ملف ${SERVICE_ACCOUNT_PATH}. يرجى تحميله من Firebase Console ووضعه في جذر المشروع.`);
    }

    if (getApps().length === 0) {
        initializeApp({
            credential: cert(SERVICE_ACCOUNT_PATH),
        });
    }

    const auth = getAuth();
    const db = getFirestore();

    console.log('⏳ جاري تأسيس الحساب السيادي...');

    let userRecord;
    try {
        userRecord = await auth.getUserByEmail(DEV_EMAIL);
        console.log('⚠️ الحساب موجود مسبقاً، جاري تحديث الصلاحيات...');
        await auth.updateUser(userRecord.uid, {
            password: DEV_PASSWORD,
        });
    } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
            userRecord = await auth.createUser({
                email: DEV_EMAIL,
                password: DEV_PASSWORD,
                displayName: 'Nova Developer',
                emailVerified: true,
            });
        } else {
            throw e;
        }
    }

    if (!userRecord) throw new Error("فشل في إنشاء أو جلب المستخدم.");

    // تعيين الصلاحيات السيادية
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'Developer',
      isSuperAdmin: true,
    });

    // إنشاء الوثيقة في مشروع الماستر
    await db.collection('developers').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: DEV_EMAIL,
      role: 'Developer',
      fullName: 'Nova Developer',
      isActive: true,
      updatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    }, { merge: true });

    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║    ✅ تم تفعيل الحساب السيادي بنجاح   ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  Email:    ${DEV_EMAIL}        ║`);
    console.log(`║  Password: ${DEV_PASSWORD}           ║`);
    console.log('╠══════════════════════════════════════╣');
    console.log('║  يمكنك الآن الدخول من الشاشة الرئيسية  ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ فشل التأسيس:', error.message);
    process.exit(1);
  }
}

setupDeveloper();
