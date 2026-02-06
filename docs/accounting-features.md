# وحدة المحاسبة المتكاملة: شرح شامل

هذا المستند يوضح جميع المميزات والعمليات في قسم المحاسبة.

### 1. شجرة الحسابات (Chart of Accounts)
- **المصدر:** `src/app/dashboard/accounting/chart-of-accounts/page.tsx`
- **الوصف:** هي أساس النظام المحاسبي. يمكنك إضافة، تعديل، وحذف الحسابات. النظام يأتي مع شجرة حسابات أساسية يمكنك تنزيلها كنقطة بداية.

### 2. قيود اليومية (Journal Entries)
- **المصدر:** `src/app/dashboard/accounting/journal-entries/`
- **الوصف:** يمكنك إنشاء قيود يدوية أو الاعتماد على القيود التلقائية التي ينشئها النظام (مثل عند إنشاء عقد). تتبع القيود دورة عمل (مسودة -> مرحّل).
- **المساعد المحاسبي الذكي:**
    - **المصدر:** `src/app/dashboard/accounting/assistant/page.tsx`
    - **الوصف:** مساعد ذكاء اصطناعي يفهم الأوامر المحاسبية باللغة العربية ويحولها إلى قيود يومية جاهزة للحفظ.

### 3. السندات (Vouchers)
- **سندات القبض:**
    - **شرح مفصل:** `docs/cash-receipts-features.md`
    - **المصدر:** `src/app/dashboard/accounting/cash-receipts/`
    - **الوصف:** إنشاء سندات قبض مع ترقيم تلقائي، ربط بالعقود، وتوليد ذكي لوصف الدفعة.
- **سندات الصرف:**
    - **المصدر:** `src/app/dashboard/accounting/payment-vouchers/`
    - **الوصف:** إنشاء سندات صرف لتسجيل المدفوعات للموردين والموظفين.

### 4. عروض الأسعار والعقود (Quotations & Contracts)
- **المصدر:** `src/app/dashboard/accounting/quotations/` و `src/components/clients/contract-clauses-form.tsx`
- **الوصف:** يمكنك إنشاء عروض أسعار للعملاء. عند قبول عرض السعر، يمكنك تحويله مباشرة إلى عقد مفصل داخل معاملة العميل، مما يضمن ربط البيانات المالية بالعمليات.

### 5. القوائم المالية (IFRS Compliant)
- **قائمة الدخل (Income Statement):**
    - **المصدر:** `src/app/dashboard/accounting/income-statement/page.tsx`
    - **الوصف:** تعرض الإيرادات والمصروفات وصافي الربح، مع فصل "تكلفة الإيرادات" لعرض "مجمل الربح" بشكل واضح.
- **قائمة المركز المالي (Balance Sheet):**
    - **المصدر:** `src/app/dashboard/accounting/balance-sheet/page.tsx`
    - **الوصف:** تعرض الأصول والالتزامات وحقوق الملكية، مع تصنيفها إلى "متداولة" و "غير متداولة" وفقًا للمعايير الدولية.
- **قائمة التدفقات النقدية (Cash Flow Statement):**
    - **المصدر:** `src/app/dashboard/accounting/cash-flow/page.tsx`
    - **الوصف:** تُعد بالطريقة غير المباشرة، حيث تبدأ بصافي الربح وتعدله للوصول إلى صافي التدفق النقدي.
- **قائمة التغير في حقوق الملكية (Statement of Changes in Equity):**
    - **المصدر:** `src/app/dashboard/accounting/equity-statement/page.tsx`
    - **الوصف:** توضح كيف تغيرت حقوق الملاك خلال الفترة، بربط رصيد البداية بصافي الربح للوصول إلى رصيد النهاية.
- **الإيضاحات المتممة (Financial Statement Notes):**
    - **المصدر:** `src/app/dashboard/accounting/financial-statement-notes/page.tsx`
    - **الوصف:** صفحة تحتوي على محرر نصوص لحفظ الشروحات والتفاصيل الإضافية المطلوبة للقوائم المالية.

### 6. التنبؤ المالي (Financial Forecast)
- **المصدر:** `src/app/dashboard/accounting/financial-forecast/page.tsx`
- **الوصف:** أداة ذكاء اصطناعي تحلل بياناتك التاريخية لتقديم توقعات مستقبلية للإيرادات والمصروفات.
