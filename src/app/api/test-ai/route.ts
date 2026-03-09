import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview مسار تشخيصي متطور للتحقق من حالة اتصال الذكاء الاصطناعي وتحديد نوع الخلل.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function GET() {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return NextResponse.json({ 
      success: false, 
      error: "Missing API Key",
      solution: "يرجى إضافة GOOGLE_GENAI_API_KEY في إعدادات البيئة (Environment Variables)."
    }, { status: 500 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // فحص بسيط للتحقق من الاتصال
    const result = await model.generateContent("Test connection");
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ 
      success: true,
      status: 'AI Engine is Online',
      model: 'gemini-1.5-flash',
      message: "تم الاتصال بنجاح. المفتاح يعمل والنموذج متاح.",
      aiResponse: text
    });
  } catch (error: any) {
    console.error("AI Diagnostic Error:", error);
    
    let userFriendlyError = "حدث خطأ غير معروف.";
    let solution = "يرجى مراجعة سجلات الخادم.";

    if (error.message?.includes('404')) {
        userFriendlyError = "النموذج غير موجود (404).";
        solution = "تأكد من تفعيل 'Generative Language API' في Google Cloud Console لهذا المشروع تحديداً.";
    } else if (error.message?.includes('403')) {
        userFriendlyError = "تم رفض الوصول (403).";
        solution = "المفتاح غير صالح أو تم تقييد استخدامه. تأكد من إعدادات الفوترة أو قيود المفتاح.";
    } else if (error.message?.includes('429')) {
        userFriendlyError = "تجاوز حد الاستخدام (429).";
        solution = "لقد وصلت للحد الأقصى للطلبات المجانية. انتظر دقيقة أو قم بترقية الحساب.";
    }

    return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: userFriendlyError,
        solution: solution
    }, { status: 500 });
  }
}
