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

  var prompt = `أنت خبير مشتريات ومحاسب تكاليف دقيق جداً. قم بتحليل مستند عرض السعر المرفق واستخراج البيانات التالية بدقة متناهية.

الأصناف المطلوبة (RFQ Items):
${input.rfqItems.map(function(item) { return `- المعرف الفريد: "${item.id}", اسم الصنف: "${item.name}"`; }).join('\n')}

المطلوب منك استخراج JSON بالصيغة التالية فقط:
{
  "items": [
    { "rfqItemId": "المعرف الفريد المذكور أعلاه", "unitPrice": 123.45 }
  ],
  "discountAmount": 0.0, 
  "deliveryFees": 0.0,
  "deliveryTimeDays": 0,
  "paymentTerms": "شرح طريقة الدفع المذكورة (مثلاً: 50% نقدي و50% آجل)",
  "summary": "ملخص لما وجدته بالعربية"
}

ملاحظات هامة للتحليل:
1. ابحث عن أي "خصم إجمالي" (Total Discount) في أسفل الفاتورة وضعه في discountAmount.
2. ابحث عن "رسوم توصيل" (Delivery/Shipping) وضعه في deliveryFees.
3. ابحث عن مدة التوريد بالأيام.
4. افهم شروط الدفع جيداً (نقدي، آجل، أو مختلط) واكتبها في paymentTerms.
5. استخرج سعر الوحدة (Unit Price) المجرد لكل صنف مطابق.
6. أجب بتنسيق JSON فقط ولا تضف أي نص شرح خارج الـ JSON.`;

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

  for (var i = 0; i < visionModels.length; i++) {
    var modelName = visionModels[i].name;
    
    try {
      if (i > 0) {
        await new Promise(function(resolve) { setTimeout(resolve, 2000); });
      }

      var url = 'https://generativelanguage.googleapis.com/v1beta/' + modelName + ':generateContent?key=' + apiKey;

      var response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) continue;

      var data = await response.json();
      if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) continue;

      var text = data.candidates[0].content.parts[0].text;
      var cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      return JSON.parse(jsonMatch[0]);

    } catch (error: any) {
      continue;
    }
  }

  throw new Error('فشل التحليل الذكي للمستند. يرجى التأكد من وضوح الصورة أو جودة ملف الـ PDF.');
}