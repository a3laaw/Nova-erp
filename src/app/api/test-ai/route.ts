import { NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

/**
 * @fileOverview مسار تشخيصي للتحقق من حالة اتصال Vertex AI في منطقة us-central1.
 */
export async function GET() {
  try {
    const response = await ai.generate({
      model: 'vertexai/gemini-1.5-flash',
      prompt: 'Hello, are you active in us-central1?',
    });

    return NextResponse.json({ 
      success: true,
      status: 'Vertex AI is Active',
      region: 'us-central1',
      model: 'gemini-1.5-flash',
      response: response.text,
      help: 'إذا واجهت أي مشاكل، تأكد من تفعيل Vertex AI API في مشروع Google Cloud الخاص بك.'
    });
  } catch (error: any) {
    console.error("Test AI Error:", error);
    return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: 'تأكد من إعداد صلاحيات الخدمة (Service Account) أو ADC بشكل صحيح للوصول إلى Vertex AI.'
    }, { status: 500 });
  }
}
