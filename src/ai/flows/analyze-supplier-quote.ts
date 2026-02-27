'use server';

const MODELS_TO_TRY = [
  { version: 'v1beta', model: 'gemini-2.0-flash' },
  { version: 'v1',     model: 'gemini-2.0-flash' },
  { version: 'v1beta', model: 'gemini-2.0-flash-lite' },
  { version: 'v1',     model: 'gemini-2.0-flash-lite' },
  { version: 'v1beta', model: 'gemini-1.5-flash-latest' },
  { version: 'v1',     model: 'gemini-1.5-flash-latest' },
  { version: 'v1beta', model: 'gemini-1.5-flash' },
  { version: 'v1',     model: 'gemini-1.5-flash' },
  { version: 'v1beta', model: 'gemini-pro-vision' },
  { version: 'v1',     model: 'gemini-pro-vision' },
];

export async function analyzeSupplierQuote(input: {
  quoteFileDataUri: string;
  rfqItems: { id: string; name: string }[];
}) {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('مفتاح API غير موجود في ملف .env');

  const dataParts = input.quoteFileDataUri.split(',');
  if (dataParts.length < 2) throw new Error('صيغة الصورة غير صالحة');
  const base64Data = dataParts[1];
  const mimeType = dataParts[0].split(':')[1].split(';')[0];

  const prompt = `أنت نظام ذكاء اصطناعي متخصص في تحليل عروض الأسعار والفواتير التجارية. أنت تعمل كمحاسب ومهندس مشتريات خبير بدقة عالية جداً.

المهمة: حلل صورة عرض السعر المرفقة واستخرج جميع البيانات المالية منها.

قائمة الأصناف المطلوب البحث عنها ومطابقتها:
${input.rfqItems.map((item, i) => (i + 1) + '. معرف: "' + item.id + '" ← اسم الصنف: "' + item.name + '"').join('\n')}

التعليمات:
1. اقرأ الصورة بعناية شديدة
2. حدد اسم المورد والتاريخ من أعلى عرض السعر
3. اقرأ كل صف في جدول الأسعار
4. لكل صنف في الصورة ابحث عن أقرب تطابق من القائمة أعلاه
5. استخرج سعر الوحدة (Unit Price) لكل صنف
6. إذا لم تجد مطابقة لصنف تجاهله
7. إذا لم تستطع قراءة سعر بوضوح تجاهله

القواعد:
- الأسعار أرقام فقط بدون عملة
- سعر الوحدة يعني سعر القطعة الواحدة وليس الإجمالي
- التاريخ بصيغة YYYY-MM-DD
- أرجع JSON فقط بدون أي نص أو markdown قبله أو بعده

التنسيق المطلوب بالضبط:
{
  "vendorName": "اسم المورد",
  "date": "2025-01-15",
  "totalAmount": 5000.000,
  "extractedPrices": [
    {
      "rfqItemId": "المعرف من القائمة",
      "itemNameInQuote": "اسم الصنف كما في الصورة",
      "unitPrice": 125.500
    }
  ],
  "notes": "ملاحظات إضافية"
}`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64Data } }
      ]
    }],
    generationConfig: { temperature: 0.1, topP: 0.8, topK: 40, maxOutputTokens: 4096 }
  };

  let lastError: any = null;

  for (const endpoint of MODELS_TO_TRY) {
    const url = 'https://generativelanguage.googleapis.com/' + endpoint.version + '/models/' + endpoint.model + ':generateContent?key=' + apiKey;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 404 || response.status === 400) { lastError = new Error('موديل ' + endpoint.model + ' غير متاح'); continue; }
      if (response.status === 403) throw new Error('مفتاح API غير صالح');
      if (response.status === 429) throw new Error('تم تجاوز حد الاستخدام. انتظر قليلاً');
      if (!response.ok) { lastError = new Error('خطأ ' + response.status); continue; }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) { lastError = new Error('رد فارغ'); continue; }

      let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      try { return JSON.parse(cleaned); } catch {}

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) { try { return JSON.parse(jsonMatch[0]); } catch {} }

      const fixed = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      const fixedMatch = fixed.match(/\{[\s\S]*\}/);
      if (fixedMatch) { try { return JSON.parse(fixedMatch[0]); } catch {} }

      lastError = new Error('فشل تحليل JSON');
      continue;
    } catch (error: any) {
      if (error.message.includes('مفتاح') || error.message.includes('حد')) throw error;
      lastError = error;
      continue;
    }
  }

  throw new Error('فشل التحليل مع جميع الموديلات. آخر خطأ: ' + (lastError?.message || 'غير معروف') + '. تأكد من مفتاح API وجودة الصورة.');
}
