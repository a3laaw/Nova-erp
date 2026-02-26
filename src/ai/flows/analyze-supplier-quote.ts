'use server';
/**
 * @fileOverview محرك تحليل صور عروض الأسعار باستخدام Vertex AI و Gemini 1.5 Flash.
 */

import { VertexAI } from '@google-cloud/vertexai';
import { z } from 'zod';

const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const location = 'us-central1';

// إعداد Vertex AI مباشرة لضمان أقصى درجات الاستقرار
const vertex_ai = new VertexAI({ project: project!, location: location });
const model = vertex_ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * وظيفة تحليل عرض السعر (Invoice/Quotation Processing)
 * تستخدم المنطق والمطالبات المحاسبية المتقدمة لاستخراج البيانات بدقة.
 */
export async function analyzeSupplierQuote(input: { quoteFileDataUri: string, rfqItems: { id: string, name: string }[] }) {
  try {
    const prompt = `أنت خبير تحليل مستندات محاسبية عالمي. مهمتك هي قراءة عرض السعر المرفق أياً كان تنسيقه أو ترتيب الجداول فيه واستخراج البيانات المالية بدقة.

القيم المطلوب استخراجها:
1. المورد: ابحث عن أي اسم شركة أو شعار (Logo) في أعلى الصفحة أو في الترويسة.
2. الأصناف: ابحث عن أي جدول أو قائمة تحتوي على (كميات وأسعار) واستخرج سعر الوحدة لكل صنف.
3. القيم المالية: ابحث عن القيمة الكبرى المكتوب بجانبها (إجمالي، صافي، Total، Net) واستخرجها كإجمالي المبلغ.

القاعدة الذهبية للمطابقة:
- إذا وجدت المسميات تختلف (مثلاً: 'البيان' أو 'الوصف' بدل 'الصنف')، فافهم المقصود وقم بتصنيفه بشكل صحيح.
- قم بمطابقة الأصناف الموجودة في المستند مع القائمة المطلوبة أدناه وارجع السعر لكل معرف (ID).

الأصناف المطلوب تسعيرها وربطها بالمعرفات:
${input.rfqItems.map(i => `- ${i.name} (المعرف: ${i.id})`).join('\n')}

المخرجات يجب أن تكون بصيغة JSON فقط بهذا التنسيق الدقيق:
{
  "extractedPrices": [
    { "rfqItemId": "المعرف هنا", "unitPrice": 150.5 }
  ],
  "vendorName": "اسم المورد",
  "date": "YYYY-MM-DD",
  "totalAmount": 0,
  "tax": 0
}`;

    // تحويل الصورة من Data URI إلى بيانات ثنائية (Base64)
    const [header, b64Data] = input.quoteFileDataUri.split(';base64,');
    const mimeType = header.split(':')[1];

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { data: b64Data, mimeType: mimeType } }
        ]
      }]
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // استخراج JSON من النص (تنظيف الرد من أي نصوص زائدة)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("لم يتم العثور على بيانات JSON صالحة في استجابة الذكاء الاصطناعي.");
    
    const parsedData = JSON.parse(jsonMatch[0]);
    return parsedData;

  } catch (e: any) {
    console.error("Vertex AI Error:", e);
    throw new Error("فشل تحليل المستند. يرجى التأكد من وضوح الصورة أو إدخال البيانات يدوياً.");
  }
}
