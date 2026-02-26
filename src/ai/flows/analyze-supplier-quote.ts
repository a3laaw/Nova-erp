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
 * تستخدم المنطق والبرومبت المحاسبي المحدد من قبل المستخدم.
 */
export async function analyzeSupplierQuote(input: { quoteFileDataUri: string, rfqItems: { id: string, name: string }[] }) {
  try {
    const prompt = `أنت محاسب خبير ومحلل بيانات. قم بقراءة الصورة المرفقة واستخرج منها: اسم المورد، التاريخ، إجمالي المبلغ، الضرائب، وقائمة الأصناف. المخرجات يجب أن تكون بصيغة JSON فقط بدون أي نص توضيحي.
    
    الأصناف المطلوب البحث عن أسعارها بالتحديد وربطها بالمعرفات (ID):
    ${input.rfqItems.map(i => `- ${i.name} (المعرف: ${i.id})`).join('\n')}
    
    تنسيق JSON المطلوب بدقة:
    {
      "extractedPrices": [
        { "rfqItemId": "المعرف هنا", "unitPrice": 150.5 }
      ],
      "vendorName": "اسم المورد المستخرج",
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
    
    // استخراج JSON من النص (في حال أضاف الموديل نصاً زائداً بالخطأ)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("لم يتم العثور على بيانات JSON صالحة في استجابة الذكاء الاصطناعي.");
    
    const parsedData = JSON.parse(jsonMatch[0]);
    return parsedData;

  } catch (e: any) {
    console.error("Vertex AI Error:", e);
    throw new Error("فشل تحليل المستند. يرجى التأكد من وضوح الصورة أو إدخال البيانات يدوياً.");
  }
}
