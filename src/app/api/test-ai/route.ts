
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview مسار تشخيصي محدث للتحقق من حالة اتصال الذكاء الاصطناعي.
 * يستخدم المكتبة الرسمية المباشرة لضمان استقرار الفحص.
 * ملاحظة للمدير: تأكد من تفعيل "Vertex AI API" في Google Cloud Console.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function GET() {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return NextResponse.json({ 
      success: false, 
      error: "API Key missing",
      details: "يرجى التأكد من إضافة GOOGLE_GENAI_API_KEY في ملف الـ .env"
    }, { status: 500 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // نستخدم فلاش 1.5 لسرعة الفحص وتوفير التكلفة
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent("Hello, are you active and ready to process ERP commands?");
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ 
      success: true,
      status: 'AI Engine is Active',
      engine: 'Google Generative AI (Direct SDK)',
      model: 'gemini-1.5-flash',
      aiResponse: text,
      setupTip: 'إذا كنت تستخدم بيئة Vertex AI في الإنتاج، تأكد من تفعيل Vertex AI API من Google Cloud Console.'
    });
  } catch (error: any) {
    console.error("Test AI Diagnostic Error:", error);
    return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: 'تأكد من صلاحية مفتاح الـ API وتفعيل الخدمات اللازمة في كونسول جوجل.'
    }, { status: 500 });
  }
}
