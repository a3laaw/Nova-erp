'use server';

export async function analyzeSupplierQuote(input: {
  quoteFileDataUri: string;
  rfqItems: { id: string; name: string }[];
}) {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('مفتاح API غير موجود في ملف .env');

  var listUrl = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey;
  var listResponse = await fetch(listUrl);
  
  if (!listResponse.ok) {
    throw new Error('مفتاح API غير صالح. الرجاء إنشاء مفتاح جديد من https://aistudio.google.com/apikey');
  }

  var listData = await listResponse.json();
  var allModels = listData.models || [];
  
  var visionModels = allModels.filter(function(m: any) {
    var name = (m.name || '').toLowerCase();
    var methods = m.supportedGenerationMethods || [];
    var supportsGenerate = methods.indexOf('generateContent') >= 0;
    var isGemini = name.indexOf('gemini') >= 0;
    var isNotEmbedding = name.indexOf('embedding') < 0;
    var isNotAqa = name.indexOf('aqa') < 0;
    return supportsGenerate && isGemini && isNotEmbedding && isNotAqa;
  });

  if (visionModels.length === 0) {
    var modelNames = allModels.map(function(m: any) { return m.name; }).join('\n');
    throw new Error('لا توجد موديلات Gemini متاحة لمفتاحك.\n\nالموديلات الموجودة:\n' + modelNames);
  }

  var parts = input.quoteFileDataUri.split(';base64,');
  if (parts.length !== 2) throw new Error('تنسيق الملف غير صالح.');
  var mimeType = parts[0].split(':')[1];
  var base64Data = parts[1];

  var prompt = 'أنت خبير مشتريات ومحاسب تكاليف دقيق جداً. قم بتحليل مستند عرض السعر المرفق واستخراج أسعار الوحدات (Unit Price) للأصناف المطلوبة التالية.\n\nالأصناف المطلوبة (RFQ Items):\n' + input.rfqItems.map(function(item) { return '- المعرف الفريد: "' + item.id + '", اسم الصنف: "' + item.name + '"'; }).join('\n') + '\n\nالمطلوب منك:\n1. ابحث في المستند عن كل صنف يطابق أو يشابه في المعنى الأصناف المذكورة أعلاه.\n2. استخرج سعر الوحدة (Unit Price) المجرد (رقم فقط).\n3. أجب بتنسيق JSON فقط ولا تضف أي نص شرح خارج الـ JSON.\n\nالتنسيق المطلوب (JSON):\n{\n  "items": [\n    { "rfqItemId": "المعرف الفريد المذكور أعلاه", "unitPrice": 123.45 }\n  ],\n  "summary": "ملخص لما وجدته بالعربية"\n}';

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

  var allErrors: string[] = [];
  allErrors.push('الموديلات المتاحة لمفتاحك (' + visionModels.length + '):');
  visionModels.forEach(function(m: any) { allErrors.push('  - ' + m.name); });
  allErrors.push('---');

  for (var i = 0; i < visionModels.length; i++) {
    var modelName = visionModels[i].name;
    
    try {
      if (i > 0) {
        await new Promise(function(resolve) { setTimeout(resolve, 3000); });
      }

      var url = 'https://generativelanguage.googleapis.com/v1beta/' + modelName + ':generateContent?key=' + apiKey;

      allErrors.push('محاولة ' + (i + 1) + ': ' + modelName + '...');

      var response = await fetch(url, {
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
        allErrors.push('  فشل HTTP ' + response.status + ': ' + errorText.substring(0, 200));
        if (response.status === 429) {
          await new Promise(function(resolve) { setTimeout(resolve, 5000); });
        }
        continue;
      }

      var data = await response.json();

      if (!data || !data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0] || !data.candidates[0].content.parts[0].text) {
        allErrors.push('  رد فارغ: ' + JSON.stringify(data).substring(0, 200));
        continue;
      }

      var text = data.candidates[0].content.parts[0].text;
      var cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        allErrors.push('  الرد ليس JSON: ' + cleaned.substring(0, 200));
        continue;
      }

      try {
        return JSON.parse(jsonMatch[0]);
      } catch(e3) {
        var fixed = jsonMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        try {
          return JSON.parse(fixed);
        } catch(e4) {
          allErrors.push('  JSON غير صالح');
          continue;
        }
      }

    } catch (error: any) {
      allErrors.push('  خطأ: ' + (error.message || 'غير معروف'));
      continue;
    }
  }

  throw new Error('فشل التحليل.\n\n' + allErrors.join('\n'));
}