
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * @fileOverview سكربت إعداد حساب المطور الرئيسي (Sovereign Root) في مشروع Master.
 * تم تثبيت كلمة المرور بناءً على رغبة المستخدم لتسهيل الدخول الأول.
 */

// ملاحظة: يجب وضع ملف الصلاحيات service-account.json في المجلد الرئيسي قبل التشغيل
const app = initializeApp({
  credential: cert('./service-account.json'),
});
const auth = getAuth(app);
const db = getFirestore(app);

async function setupDeveloper() {
  const DEV_EMAIL = 'dev@nova-erp.local';
  const DEV_PASSWORD = 'Sovereign@2026'; // الكلمة السيادية المعتمدة

  try {
    // 1. إنشاء المستخدم في Firebase Auth
    const userRecord = await auth.createUser({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
      displayName: 'Nova Developer',
      emailVerified: true,
    });

    // 2. تعيين الصلاحيات المخصصة (Custom Claims)
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'Developer',
      isSuperAdmin: true,
    });

    // 3. إنشاء وثيقة المطور في Firestore بمشروع Master
    await db.collection('developers').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: DEV_EMAIL,
      username: 'developer',
      role: 'Developer',
      fullName: 'Nova Developer',
      isActive: true,
      createdAt: Timestamp.now(),
    });

    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║    ✅ تم إنشاء حساب المطور بنجاح     ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  Email:    ${DEV_EMAIL}        ║`);
    console.log(`║  Password: ${DEV_PASSWORD}           ║`);
    console.log('╠══════════════════════════════════════╣');
    console.log('║  المسار: /developer/login            ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    if (error.code === 'auth/email-already-exists') {
        console.log('⚠️ حساب المطور موجود مسبقاً. تم التحديث فقط.');
        process.exit(0);
    }
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setupDeveloper();
