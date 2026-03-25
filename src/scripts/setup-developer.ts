
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * @fileOverview سكربت إعداد حساب المطور الرئيسي (Sovereign Root) في مشروع Master.
 * ملاحظة: يجب وضع ملف الصلاحيات service-account.json في المجلد الرئيسي قبل التشغيل.
 */

// تهيئة Firebase Admin
// تأكد من وجود ملف service-account.json في جذر المشروع
const app = initializeApp({
  credential: cert('./service-account.json'),
});
const auth = getAuth(app);
const db = getFirestore(app);

async function setupDeveloper() {
  const DEV_EMAIL = 'dev@nova-erp.local';
  const DEV_PASSWORD = 'Sovereign@2026'; // الكلمة السيادية الثابتة

  try {
    console.log('⏳ جاري تأسيس الحساب السيادي...');

    let userRecord;
    try {
        userRecord = await auth.getUserByEmail(DEV_EMAIL);
        console.log('⚠️ الحساب موجود مسبقاً، جاري تحديث كلمة المرور والصلاحيات...');
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

    // 2. تعيين الصلاحيات المخصصة (Custom Claims)
    // هذه هي المفاتيح التي تفتح أبواب Firestore Rules
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'Developer',
      isSuperAdmin: true,
    });

    // 3. إنشاء/تحديث وثيقة المطور في Firestore بمشروع Master
    await db.collection('developers').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: DEV_EMAIL,
      username: 'developer',
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
    console.log('║  يمكنك الآن الدخول من الصفحة الرئيسية  ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ فشل التأسيس:', error.message);
    process.exit(1);
  }
}

setupDeveloper();
