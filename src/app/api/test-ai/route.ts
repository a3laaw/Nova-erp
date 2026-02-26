import { NextResponse } from 'next/server';

/**
 * @fileOverview مسار تشخيصي للتحقق من حالة مفتاح الـ API والكوتا المتاحة.
 */
export async function GET() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ 
      error: 'API Key is missing from environment variables.',
      checked: ['GOOGLE_GENAI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY']
    });
  }

  try {
    // محاولة جلب قائمة الموديلات المتاحة لهذا المفتاح
    // هذا الطلب لا يستهلك كوتا توليد النصوص ويؤكد إذا كان المفتاح صالحاً ومرتبطاً بـ Billing
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.error) {
      return NextResponse.json({ 
        status: 'API Key Error',
        message: data.error.message,
        code: data.error.code,
        details: 'تأكد من تفعيل Generative Language API في Google Cloud Console.'
      });
    }

    // البحث عن الموديلات المستقرة (Version 002)
    const stableModel = (data.models || []).find((m: any) => m.name.includes('gemini-1.5-flash-002'));

    return NextResponse.json({ 
      success: true,
      apiKeyPrefix: apiKey.substring(0, 10) + '...',
      modelsCount: data.models?.length || 0,
      stableModelFound: !!stableModel,
      recommendedModel: stableModel?.name || 'gemini-1.5-pro-002',
      billingStatus: 'Active (Models listed successfully)',
      help: 'إذا استمر خطأ 429، يرجى التحقق من Quotas & Limits في Cloud Console للموديل gemini-1.5-flash-002.'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
