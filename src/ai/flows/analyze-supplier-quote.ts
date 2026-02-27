'use server';

export async function analyzeSupplierQuote(input: {
  quoteFileDataUri: string;
  rfqItems: { id: string; name: string }[];
}) {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('مفتاح API غير موجود في ملف .env');

  const parts = input.quoteFileDataUri.split(';base64,');
  if (parts.length !== 2) throw new Error('تنسيق الملف غير صالح.');
  const mimeType = parts[0].split(':')[1];
  const base64Data = parts[1];

  const prompt = 'أنت خبير مشتريات ومحاسب تكاليف دقيق جداً. قم بتحليل مستند عرض السعر المرفق واستخراج أسعار الوحدات (Unit Price) للأصناف المطلوبة التالية.\n\nالأصناف المطلوبة (RFQ Items):\n' + input.rfqItems.map(function(item) { return '- المعرف الفريد: "' + item.id + '", اسم الصنف: "' + item.name + '"'; }).join('\n') + '\n\nالمطلوب منك:\n1. ابحث في المستند عن كل صنف يطابق أو يشابه في المعنى الأصناف المذكورة أعلاه.\n2. استخرج سعر الوحدة (Unit Price) المجرد (رقم فقط).\n3. إذا كان السعر بعملة أخرى حوله للدينار الكويتي إن أمكن أو ضعه كما هو.\n4. أجب بتنسيق JSON فقط ولا تضف أي نص شرح خارج الـ JSON.\n\nالتنسيق المطلوب (JSON):\n{\n  "items": [\n    { "rfqItemId": "المعرف الفريد المذكور أعلاه", "unitPrice": 123.45 }\n  ],\n  "summary": "ملخص لما وجدته بالعربية"\n}';

  var requestBody = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: base64Data } },
        { text: prompt }
      ]
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
    ]
  };

  var urls = [
    { name: 'gemini-2.5-flash-preview-05-20 v1beta', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=' + apiKey },
    { name: 'gemini-2.0-flash-001 v1beta', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=' + apiKey },
    { name: 'gemini-2.0-flash-001 v1', url: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-001:generateContent?key=' + apiKey },
    { name: 'gemini-2.0-flash-lite-001 v1beta', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001:generateContent?key=' + apiKey },
    { name: 'gemini-2.0-flash-lite-001 v1', url: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite-001:generateContent?key=' + apiKey },
    { name: 'gemini-1.5-flash-002 v1beta', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=' + apiKey },
    { name: 'gemini-1.5-flash-002 v1', url: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-002:generateContent?key=' + apiKey }
  ];

  var allErrors: string[] = [];

  for (var i = 0; i < urls.length; i++) {
    var entry = urls[i];
    try {
      if (i > 0) {
        await new Promise(function(resolve) { setTimeout(resolve, 3000); });
      }

      var response = await fetch(entry.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        var errorText = '';
        try {
          var errJson = await response.json();
          errorText = errJson.error ? errJson.error.message : JSON.stringify(errJson);
        } catch(e2) {
          errorText = response.statusText;
        }
        allErrors.push(entry.name + ' => HTTP ' + response.status + ': ' + errorText);
        if (response.status === 429) {
          await new Promise(function(resolve) { setTimeout(resolve, 5000); });
        }
        continue;
      }

      var data = await response.json();

      if (!data || !data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0] || !data.candidates[0].content.parts[0].text) {
        allErrors.push(entry.name + ' => رد فارغ: ' + JSON.stringify(data).substring(0, 300));
        continue;
      }

      var text = data.candidates[0].content.parts[0].text;
      var cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        allErrors.push(entry.name + ' => الرد ليس JSON: ' + cleaned.substring(0, 300));
        continue;
      }

      try {
        return JSON.parse(jsonMatch[0]);
      } catch(e3) {
        var fixed = jsonMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        try {
          return JSON.parse(fixed);
        } catch(e4) {
          allErrors.push(entry.name + ' => JSON غير صالح: ' + jsonMatch[0].substring(0, 300));
          continue;
        }
      }

    } catch (error: any) {
      allErrors.push(entry.name + ' => خطأ: ' + (error.message || 'غير معروف'));
      continue;
    }
  }

  throw new Error('فشل التحليل مع جميع الموديلات.\n\nتفاصيل الأخطاء:\n' + allErrors.join('\n'));
}