import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview مسار تشخيصي مبسط للتحقق من حالة اتصال الذكاء الاصطناعي.
 * تم تجريده من أي نصوص قد تسبب مشاكل ByteString أثناء البناء.
 */

const getApiKey = () => process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function GET() {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return NextResponse.json({ 
      success: false, 
      error: "Missing API Key"
    }, { status: 500 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // فحص بسيط للتحقق من الاتصال بنص لاتيني صرف
    const result = await model.generateContent("AI status check");
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ 
      success: true,
      status: 'AI Engine is Online',
      model: 'gemini-2.0-flash',
      aiResponse: text
    });
  } catch (error: any) {
    console.error("AI Diagnostic Error:", error);
    
    return NextResponse.json({ 
        success: false, 
        error: "AI Connection Failed",
        details: error.message
    }, { status: 500 });
  }
}
