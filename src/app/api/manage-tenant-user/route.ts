import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import path from 'path';

/**
 * 🛡️ محرك إدارة المنشآت الموحد (Sovereign IAM Engine V6.0):
 * تم تحديثه ليدعم إنشاء الحسابات باستخدام "اسم المستخدم" فقط وربطه بالمنشأة آلياً.
 * يضمن تخزين الـ username في كافة السجلات لسهولة البحث عند الدخول.
 */

function getAdminApp() {
  if (getApps().length === 0) {
    let serviceAccount;
    const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (envServiceAccount) {
        try { serviceAccount = JSON.parse(envServiceAccount); } catch (e) { console.error("Invalid Service Account JSON"); }
    }
    if (!serviceAccount) {
        const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'service-account.json');
        if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
            serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
        }
    }
    if (!serviceAccount) throw new Error("CRITICAL_SECURITY_ERROR: Missing Configuration.");
    
    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n').replace(/"/g, '').trim();
    }

    return initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
  }
  return getApp();
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing Sovereign Token' }, { status: 401 });
    }

    const app = getAdminApp();
    const adminAuth = getAuth(app);
    const db = getFirestore(app);
    
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
        decodedToken = await adminAuth.verifyIdToken(token);
    } catch (e) {
        return NextResponse.json({ error: 'Unauthorized: Invalid Token' }, { status: 401 });
    }

    const body = await request.json();
    const { action, email, password, displayName, companyId, username, role, employeeId } = body;

    const isDeveloper = decodedToken.role === 'Developer' || decodedToken.isSuperAdmin;
    const isAdminOfTargetCompany = decodedToken.role === 'Admin' && decodedToken.companyId === companyId;

    if (!isDeveloper && !isAdminOfTargetCompany) {
        return NextResponse.json({ error: 'Forbidden: Insufficient Authority to manage this tenant' }, { status: 403 });
    }

    if (action === 'create_tenant_user') {
        const sanitizedUsername = username.toLowerCase().trim();
        const technicalEmail = email || `${sanitizedUsername}@${companyId}.nova`;

        let userRecord;
        try {
            userRecord = await adminAuth.createUser({ 
                email: technicalEmail, 
                password, 
                displayName: displayName || username
            });
        } catch (e: any) {
            if (e.code === 'auth/email-already-exists') {
                userRecord = await adminAuth.getUserByEmail(technicalEmail);
            } else {
                throw e;
            }
        }

        // 2. حقن ادعاءات المنشأة (Custom Claims)
        await adminAuth.setCustomUserClaims(userRecord.uid, { 
            companyId, 
            role: role || 'User',
            username: sanitizedUsername 
        });

        // 3. التوثيق في الفهرس العالمي (Global User Index)
        await db.collection('global_users').doc(userRecord.uid).set({
            email: technicalEmail,
            username: sanitizedUsername,
            companyId,
            role: role || 'User',
            createdAt: FieldValue.serverTimestamp()
        }, { merge: true });

        // 4. حفظ الملف الشخصي داخل مسار المنشأة المعزول
        await db.collection('companies').doc(companyId).collection('users').doc(userRecord.uid).set({
            id: userRecord.uid,
            uid: userRecord.uid,
            email: technicalEmail,
            username: sanitizedUsername,
            fullName: displayName || username,
            role: role || 'User',
            employeeId: employeeId || null,
            isActive: true,
            companyId,
            createdAt: FieldValue.serverTimestamp()
        }, { merge: true });

        return NextResponse.json({ success: true, uid: userRecord.uid });
    }

    return NextResponse.json({ success: false, error: "ACTION_NOT_FOUND" });
  } catch (error: any) {
    console.error("IAM SOVEREIGN ENGINE ERROR:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
