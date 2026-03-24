import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * @fileOverview سكربت إعداد حساب المطور الرئيسي (Super User) في مشروع Master.
 */

// ملاحظة: يجب وضع ملف الصلاحيات service-account.json في المجلد الرئيسي قبل التشغيل
const app = initializeApp({
  credential: cert('./service-account.json'),
});
const auth = getAuth(app);
const db = getFirestore(app);

function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '@#$%^&*!';
  const all = upper + lower + numbers + symbols;

  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 0; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function setupDeveloper() {
  const DEV_EMAIL = 'dev@nova-erp.local';
  const DEV_PASSWORD = generateStrongPassword();

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
    console.log('║    ⚠️  احفظ هذه البيانات الآن       ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  Email:    ${DEV_EMAIL}        ║`);
    console.log(`║  Password: ${DEV_PASSWORD}              ║`);
    console.log('╠══════════════════════════════════════╣');
    console.log('║  لن تظهر هذه البيانات مرة أخرى     ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating developer account:', error);
    process.exit(1);
  }
}

setupDeveloper();
