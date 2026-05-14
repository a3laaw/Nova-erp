
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';

const SERVICE_ACCOUNT_PATH = './service-account.json';

/**
 * محرك تعميد المطور الرئيسي:
 * تم تحديثه ليعتمد البريد الرسمي للمالك لضمان أعلى درجات السيادة والرقابة.
 */
async function setupDeveloper() {
  const DEV_EMAIL = 'ALAAWAAHEEB@GMAIL.COM'; // 🛡️ تعميدك كمدير أعلى للمنظومة
  const DEV_PASSWORD = 'Sovereign@2026';

  try {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        throw new Error(`لم يتم العثور على ملف ${SERVICE_ACCOUNT_PATH}. يرجى تحميله من Firebase Console ووضعه في جذر المشروع.`);
    }

    if (getApps().length === 0) {
        const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        initializeApp({
            credential: cert(serviceAccount),
        });
    }

    const auth = getAuth();
    const db = getFirestore();

    console.log('⏳ جاري تأسيس حساب المدير الأعلى للمنظومة...');

    let userRecord;
    try {
        userRecord = await auth.getUserByEmail(DEV_EMAIL);
        console.log('⚠️ الحساب موجود مسبقاً، جاري تحديث الصلاحيات الإدارية...');
        await auth.updateUser(userRecord.uid, {
            password: DEV_PASSWORD,
        });
    } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
            userRecord = await auth.createUser({
                email: DEV_EMAIL,
                password: DEV_PASSWORD,
                displayName: 'Alaa Wahib - Master Admin',
                emailVerified: true,
            });
        } else {
            throw e;
        }
    }

    if (!userRecord) throw new Error("فشل في إنشاء أو جلب المستخدم.");

    // حقن رتبة المطور في التوكن (Custom Claims)
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'Developer',
      isSuperAdmin: true,
    });

    // توثيق المطور في قاعدة البيانات
    await db.collection('developers').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: DEV_EMAIL,
      role: 'Developer',
      fullName: 'Alaa Wahib',
      isActive: true,
      updatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    }, { merge: true });

    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║   ✅ تم تعميدك كمدير للمنظومة بنجاح  ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║ Email: ${DEV_EMAIL}    ║`);
    console.log(`║ Password: ${DEV_PASSWORD}           ║`);
    console.log('╠══════════════════════════════════════╣');
    console.log('║  يمكنك الآن الدخول من الشاشة الرئيسية  ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ فشل التعميد:', error.message);
    process.exit(1);
  }
}

setupDeveloper();
