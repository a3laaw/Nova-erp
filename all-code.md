# نظرة شاملة على أكواد النظام

هذا المستند يحتوي على الكود الكامل لجميع الملفات في المشروع، بالإضافة إلى ملفات الشرح والتوثيق. تم تجميعه لتوفير مرجع شامل يمكنك استخدامه لمراجعة الأكواد أو فهم العلاقات بين أجزاء النظام المختلفة.

## هيكل النظام

يعتمد النظام على مجموعة من التقنيات الحديثة لبناء واجهات المستخدم والتعامل مع العمليات الخلفية والذكاء الاصطناعي:

*   **Next.js & React:** لبناء واجهة المستخدم وتوفير تجربة سريعة وسلسة.
*   **Firebase:** كقاعدة بيانات (Firestore) ولإدارة المستخدمين (Authentication).
*   **Genkit (AI):** لإضافة القدرات الذكية مثل "المساعد المحاسبي" و "المساعد الذكي للنظام".
*   **ShadCN UI & TailwindCSS:** لتوفير مكونات واجهة مستخدم جميلة ومتجاوبة.
*   **TypeScript:** لضمان جودة الكود وتقليل الأخطاء.

## شرح العلاقات بين الأجزاء

1.  **العملاء والمعاملات:** العميل هو المحور الرئيسي. كل خدمة (مثل "تصميم بلدية") تعتبر "معاملة" تابعة للعميل. كل معاملة لها عقدها ومراحل عملها الخاصة.
2.  **المحاسبة والعقود:** عند إنشاء عقد، يتم تسجيل قيد محاسبي تلقائي لإثبات المديونية. وعند تسجيل سندات القبض، يتم تحديث سجلات المشروع والعميل تلقائيًا.
3.  **المواعيد وسير العمل:** عند تحديث مرحلة عمل في تفاصيل الزيارة، يتم تحديث حالة المعاملة المرتبطة بها، وقد يؤدي ذلك إلى تفعيل دفعة مالية مستحقة في العقد.
4.  **الموارد البشرية والرواتب:** يتم إنشاء مسيرات الرواتب بناءً على بيانات الحضور والغياب، وعند تأكيد الدفع، يتم إنشاء قيد محاسبي تلقائي لإثبات المصروف.
5.  **الذكاء الاصطناعي:**
    *   **المساعد المحاسبي:** يفهم الأوامر باللغة العربية ويحولها إلى قيود يومية منظمة.
    *   **المساعد الذكي للنظام:** يجيب على أسئلتك حول كيفية استخدام النظام، ويمكنه البحث عن بيانات حية (مثل مديونية عميل) أو توجيهك إلى الصفحات الصحيحة.

---
## File: `.env`
```

```

---
## File: `README.md`
```md
# Firebase Studio
whoami
This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

```

---
## File: `apphosting.yaml`
```yaml
# Settings to manage and configure a Firebase App Hosting backend.
# https://firebase.google.com/docs/app-hosting/configure

runConfig:
  cpu: 4
  memoryMiB: 8192
  maxInstances: 2
  minInstances: 0
  concurrency: 80

```

---
## File: `components.json`
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}

```

---
## File: `docs/accounting-features.md`
```md
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
    - **الوصف:** مساعد ذكاء اصطناعي يفهم الأوامر المحاسبية باللغة العربية (الفصحى واللهجات العامية المختلفة) ويحولها إلى قيود يومية جاهزة للحفظ.

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

### 5. التسويات البنكية
- **التسوية البنكية القياسية:**
    - **المصدر:** `src/app/dashboard/accounting/bank-reconciliation/page.tsx`
    - **الوصف:** مطابقة كشف حساب البنك العادي (حركة مقابل حركة) مع قيود النظام، مع مساعدة من الذكاء الاصطناعي لاقتراح المطابقات.
- **تسوية شركات الوساطة:**
    - **المصدر:** `src/app/dashboard/accounting/intermediary-reconciliation/page.tsx`
    - **الوصف:** مخصصة لتسوية الدفعات المجمعة من بوابات الدفع (مثل ماي فاتورة). تقوم بمطابقة إيداع بنكي واحد مع عدة فواتير عملاء، مع حساب عمولة الوسيط وإنشاء قيد التسوية تلقائيًا.

### 6. القوائم المالية (IFRS Compliant)
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

### 7. التنبؤ المالي (Financial Forecast)
- **المصدر:** `src/app/dashboard/accounting/financial-forecast/page.tsx`
- **الوصف:** أداة تعتمد على بيانات العقود والمصاريف الثابتة لتقديم توقعات مستقبلية للإيرادات والمصروفات.

```

---
## File: `docs/appointment-details-features.md`
```md
# صفحة تفاصيل الزيارة: شرح شامل للإجراءات

بناءً على طلبك، هذا شرح مفصل لجميع الإجراءات والعمليات التي يمكنك القيام بها من داخل صفحة "تفاصيل الزيارة"، والتي تعتبر مركز التحكم لكل موعد.

---

### 1. ربط الزيارة بمعاملة (للمواعيد غير المرتبطة)

*   **الحالة:** عندما تقوم بحجز موعد لعميل مسجل دون تحديد معاملة معينة.
*   **الإجراء:** ستظهر لك قائمة بجميع "المعاملات الداخلية" الخاصة بهذا العميل. يمكنك اختيار المعاملة الصحيحة (مثل "تصميم بلدية") وربط الزيارة بها.
*   **الفائدة:** هذا الربط ضروري لتتمكن من تحديث مراحل سير العمل الخاصة بالمعاملة بشكل صحيح.

### 2. تحديث مرحلة العمل (الإجراء الأساسي)

هذا هو الإجراء الأهم في صفحة الزيارة، وهو إلزامي لإغلاق الزيارة.

*   **الحالة:** بعد ربط الزيارة بمعاملة، أو إذا كانت مرتبطة بالفعل.
*   **الإجراء:**
    1.  ستظهر لك قائمة منسدلة تحتوي على "مراحل العمل" المتاحة في سير عمل المعاملة.
    2.  اختر المرحلة التي وصل إليها العميل أو التي تم إنجازها خلال هذه الزيارة.
*   **المنطق الذكي:**
    *   **تحديث تلقائي:** بمجرد اختيارك للمرحلة، يقوم النظام تلقائيًا بتحديث حالة سير عمل المعاملة.
    *   **تفعيل الدفعات:** إذا كان إكمال هذه المرحلة مرتبطًا باستحقاق دفعة مالية في العقد، سيقوم النظام تلقائيًا بتغيير حالة الدفعة من "غير مستحقة" إلى "مستحقة".
    *   **توثيق فوري:** يتم تسجيل هذا الإجراء فورًا في "سجل أحداث المعاملة" وفي "سجل تغييرات العميل" لضمان الشفافية الكاملة.
*   **صلاحية التعديل (للمدير فقط):** إذا تم اختيار مرحلة بالخطأ، يمكن للمدير فقط تعديلها. يقوم النظام تلقائيًا بالتراجع عن كل الإجراءات المرتبطة بالمرحلة الخاطئة (مثل حالة الدفعة).

### 3. تسجيل "تعديل" على مرحلة حالية

*   **الحالة:** إذا كانت المرحلة الحالية للمعاملة (قيد التنفيذ) هي من النوع الذي يقبل تسجيل تعديلات (مثل مرحلة "تعديلات المالك").
*   **الإجراء:** سيظهر لك زر خاص "تسجيل تعديل جديد". عند الضغط عليه، يقوم النظام بالآتي:
    1.  زيادة عداد "التعديلات" لهذه المرحلة في سجل المعاملة.
    2.  توثيق هذا الإجراء في سجل الأحداث.
*   **الفائدة:** تساعد هذه الميزة في تتبع عدد مرات طلب التعديلات من قبل العميل على مرحلة معينة، مما يوفر رؤى حول كفاءة العمل.

### 4. كتابة ملخص الزيارة (محضر الاجتماع)

*   **الحالة:** بعد أن تقوم بتحديث مرحلة العمل للزيارة.
*   **الإجراء:** سيظهر لك مربع نص لكتابة ملخص لما دار في الزيارة، النقاط التي تم الاتفاق عليها، والمهام المطلوبة للمتابعة.
*   **التكامل:**
    *   يتم حفظ هذا الملخص مع بيانات الزيارة.
    *   الأهم من ذلك، يتم إضافته **كتعليق تلقائي** في "التايم لاين" الخاص بالمعاملة، ليطلع عليه جميع المهندسين المعنيين.

### 5. التعامل مع العملاء المحتملين (غير المسجلين)

*   **الحالة:** عندما يكون الموعد لعميل غير مسجل (تم إدخال اسمه ورقم جواله يدويًا).
*   **الإجراء:**
    1.  **إنشاء ملف:** سيظهر لك زر "إنشاء ملف عميل". بالضغط عليه، سيتم نقلك إلى شاشة عميل جديد مع تعبئة الاسم والجوال تلقائيًا.
    2.  **الربط التلقائي:** بمجرد إنشاء الملف، سيقوم النظام تلقائيًا بربط هذا الموعد وجميع المواعيد المستقبلية التي تحمل نفس رقم الجوال بملف العميل الجديد.

### 6. إغلاق الزيارة

*   **الحالة:** لا يمكنك إغلاق الزيارة والعودة للتقويم إلا **بعد** تحديث مرحلة العمل أو **تسجيل تعديل**.
*   **الإجراء:** بمجرد القيام بأحد الإجراءين أعلاه، سيتم تفعيل زر "إغلاق الزيارة"، ويمكنك العودة للتقويم لمتابعة عملك. هذا يضمن عدم ترك أي زيارة بدون توثيق الإجراء الذي تم فيها.

    
```

---
## File: `docs/appointments-features.md`
```md
# نظام المواعيد الذكي: شرح شامل للمميزات

بناءً على طلبك، إليك شرح مفصل ومبسط لجميع المميزات التي قمنا بتطويرها في نظام إدارة المواعيد، والذي تم تصميمه ليكون دقيقًا، ذكيًا، وسهل الاستخدام.

---

### 1. نظام تقويم مزدوج ومتخصص

تم فصل المواعيد إلى قسمين رئيسيين لتنظيم العمل ومنع التداخل:

*   **جدول القسم المعماري:** مخصص حصريًا لزيارات العملاء مع مهندسي القسم المعماري. يتم عرضه كشبكة زمنية تُظهر حجوزات كل مهندس على حدة.
*   **جدول حجوزات القاعات:** مخصص لحجز قاعات الاجتماعات لمواعيد الأقسام الهندسية الأخرى (كهرباء، إنشائي، إلخ). يتم عرضه كشبكة زمنية تُظهر حجوزات كل قاعة على حدة.

### 2. منطق حجز ذكي لمنع التعارض (Real-time Conflict Detection)

أهم ميزة في النظام هي قدرته على منع الأخطاء البشرية عند حجز المواعيد. قبل حفظ أي موعد جديد أو تعديل، يقوم النظام بالتحقق الفوري من وجود أي تعارض في:

*   **وقت المهندس:** لا يمكن حجز موعدين لنفس المهندس في نفس الفترة الزمنية، حتى لو كان أحدهما في جدول القسم المعماري والآخر في جدول حجوزات القاعات.
*   **وقت العميل:** لا يمكن حجز موعدين لنفس العميل في نفس الفترة.
*   **وقت القاعة:** لا يمكن حجز نفس قاعة الاجتماعات في نفس الوقت.

في حال وجود أي تعارض، يرفض النظام الحفظ ويعرض رسالة تنبيه واضحة.

### 3. نظام تلوين ديناميكي لزيارات القسم المعماري

لتسهيل متابعة حالة العميل بلمحة بصر، تم تصميم نظام ألوان ذكي لمواعيد القسم المعماري:

*   **اللون الأصفر:** يُخصص دائمًا **للموعد الأقدم زمنيًا** للعميل، مما يدل على أنها الزيارة الأولى.
*   **اللون الأخضر:** يُخصص لأي زيارة تالية (الثانية، الثالثة، إلخ) **طالما أن العميل لم يوقع العقد بعد**.
*   **اللون الأزرق:** بمجرد توقيع العقد، تتحول جميع الزيارات التالية للزيارة الأولى إلى اللون الأزرق تلقائيًا.

### 4. عداد الزيارات التلقائي

بجانب اسم العميل في كل موعد معماري، يعرض النظام تلقائيًا رقم الزيارة (مثال: "الزيارة رقم 3"). هذا الرقم ليس ثابتًا، بل هو ديناميكي وذكي.

### 5. نظام تصحيح ذاتي للبيانات

هذه هي الميزة الأكثر قوة. عند **إلغاء أي موعد**، يقوم النظام تلقائيًا بالآتي:

1.  **تغيير الحالة:** يقوم النظام بتغيير حالة الموعد إلى "ملغي" بدلاً من حذفه نهائياً، مما يحافظ على السجل التاريخي.
2.  **إعادة الترقيم:** يعيد ترقيم جميع الزيارات **غير الملغاة** المتبقية للعميل بشكل صحيح. فإذا قمت بإلغاء الزيارة رقم 2، ستصبح الزيارة رقم 3 هي الزيارة رقم 2 الجديدة.
3.  **إعادة التلوين:** بناءً على الترقيم الجديد، يعيد النظام تلوين جميع المواعيد لتعكس الحالة الصحيحة (الموعد الأقدم يصبح أصفر، والبقية أخضر أو أزرق).

هذا يضمن أن البيانات المعروضة دقيقة وموثوقة بنسبة 100% في جميع الأوقات.

### 6. تخصيص كامل لأوقات الدوام

*   **مرونة كاملة:** من صفحة الإعدادات، يمكنك تحديد أوقات الدوام المختلفة لكل من القسم المعماري والقاعات العامة.
*   **إدارة العطلات:** يمكنك تحديد أيام العطلة الأسبوعية، وحتى تحديد يوم نصف دوام مع وقت انصراف مبكر.
*   **فترة راحة:** يمكنك إضافة فترة راحة (Buffer) بالدقائق بين المواعيد لتجنب التداخل وضمان سلاسة العمل.

### 7. تصميم متجاوب لجميع الأجهزة

تم تصميم واجهة المواعيد لتعمل بسلاسة على جميع الأجهزة، بما في ذلك:

*   شاشات الكمبيوتر المكتبية الكبيرة.
*   الأجهزة اللوحية (آيباد، وغيرها).
*   الهواتف الذكية.

تتكيف الجداول والنوافذ تلقائيًا مع حجم الشاشة لضمان تجربة استخدام سهلة ومريحة في أي مكان.

### 8. طباعة الجداول اليومية

يمكنك بسهولة طباعة جدول المواعيد اليومي لأي من القسمين (المعماري أو حجوزات القاعات) بتنسيق PDF واضح ومناسب للمشاركة أو الأرشفة.
```

---
## File: `docs/backend.json`
```json
{
  "entities": {
    "CompanyBranding": {
      "title": "Company Branding",
      "description": "Stores the company's branding information for letterheads and general UI.",
      "type": "object",
      "properties": {
        "company_name": {
          "type": "string",
          "description": "The full name of the company."
        },
        "address": {
          "type": "string",
          "description": "The company's contact address."
        },
        "phone": {
          "type": "string",
          "description": "The company's contact phone number."
        },
        "email": {
          "type": "string",
          "format": "email",
          "description": "The company's contact email address."
        },
        "tax_number": {
            "type": "string",
            "description": "The company's tax identification number."
        },
        "letterhead_text": {
          "type": "string",
          "description": "Additional text to display on the letterhead."
        },
        "logo_url": {
            "type": "string",
            "format": "uri",
            "description": "URL to the company's logo."
        },
        "letterhead_image_url": {
            "type": "string",
            "format": "uri",
            "description": "URL to the company's full letterhead image."
        },
        "footer_image_url": {
            "type": "string",
            "format": "uri",
            "description": "URL to the company's footer image."
        },
        "watermark_image_url": {
            "type": "string",
            "format": "uri",
            "description": "URL to a watermark image for printable documents."
        },
        "system_background_url": {
            "type": "string",
            "format": "uri",
            "description": "URL for the background image of the system pages."
        },
        "financial_statement_notes": {
            "type": "string",
            "description": "The full text content for the notes to the financial statements."
        },
        "work_hours": {
            "type": "object",
            "description": "Defines the company's working hours, holidays, and appointment settings.",
            "properties": {
                "general": {
                    "type": "object",
                    "description": "General working hours for meeting rooms and other departments.",
                    "properties": {
                        "morning_start_time": { "type": "string", "description": "e.g., '08:00'" },
                        "morning_end_time": { "type": "string", "description": "e.g., '12:00'" },
                        "evening_start_time": { "type": "string", "description": "e.g., '13:00'" },
                        "evening_end_time": { "type": "string", "description": "e.g., '17:00'" },
                        "appointment_slot_duration": { "type": "number", "description": "Duration in minutes, e.g., 30" },
                        "appointment_buffer_time": { "type": "number", "description": "Break time in minutes between appointments." }
                    }
                },
                "architectural": {
                    "type": "object",
                    "description": "Specific working hours for the architectural department.",
                    "properties": {
                        "morning_start_time": { "type": "string" },
                        "morning_end_time": { "type": "string" },
                        "evening_start_time": { "type": "string" },
                        "evening_end_time": { "type": "string" },
                        "appointment_slot_duration": { "type": "number" },
                        "appointment_buffer_time": { "type": "number", "description": "Break time in minutes between appointments." }
                    }
                },
                "ramadan": {
                    "type": "object",
                    "description": "Defines special working hours for the month of Ramadan.",
                    "properties": {
                        "is_enabled": { "type": "boolean", "description": "Enable/disable special Ramadan timings." },
                        "start_date": { "type": "string", "format": "date", "description": "Start date of Ramadan for the current year." },
                        "end_date": { "type": "string", "format": "date", "description": "End date of Ramadan for the current year." },
                        "start_time": { "type": "string", "description": "e.g., '09:30'" },
                        "end_time": { "type": "string", "description": "e.g., '15:30'" },
                        "appointment_slot_duration": { "type": "number" },
                        "appointment_buffer_time": { "type": "number" }
                    }
                },
                "holidays": {
                    "type": "array",
                    "description": "Weekly holidays.",
                    "items": { "type": "string", "enum": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] }
                },
                "half_day": {
                    "type": "object",
                    "description": "Defines a weekly half-day.",
                    "properties": {
                        "day": { "type": "string", "enum": ["", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] },
                        "type": { "type": "string", "enum": ["morning_only", "custom_end_time"] },
                        "end_time": { "type": "string", "description": "e.g., '13:00'" }
                    }
                }
            }
        },
        "payment_methods": {
            "type": "array",
            "description": "Configurable payment methods and their associated fees.",
            "items": {
                "type": "object",
                "properties": {
                    "id": { "type": "string" },
                    "name": { "type": "string" },
                    "type": { "type": "string", "enum": ["percentage", "fixed"] },
                    "value": { "type": "number" },
                    "expenseAccountId": { "type": "string" },
                    "expenseAccountName": { "type": "string" }
                },
                "required": ["id", "name", "type", "value", "expenseAccountId"]
            }
        }
      },
      "required": ["company_name"]
    },
    "Company": {
        "title": "Company",
        "description": "Represents a company profile in a multi-company setup.",
        "type": "object",
        "properties": {
            "name": { "type": "string" },
            "nameEn": { "type": "string" },
            "address": { "type": "string" },
            "phone": { "type": "string" },
            "email": { "type": "string", "format": "email" },
            "crNumber": { "type": "string", "description": "Commercial Registration Number" },
            "logoUrl": { "type": "string", "format": "uri" },
            "parentCompanyId": { "type": "string", "description": "The ID of the parent company, if this is a subsidiary." },
            "activityType": { "type": "string", "description": "The business activity type of the company." }
        },
        "required": ["name"]
    },
     "CompanyActivityType": {
        "title": "Company Activity Type",
        "description": "Defines a type of business activity a company can have.",
        "type": "object",
        "properties": {
            "name": { "type": "string" },
            "order": { "type": "number" }
        },
        "required": ["name"]
    },
    "UserProfile": {
      "title": "User Profile",
      "description": "Represents a user's login account in the system.",
      "type": "object",
      "properties": {
        "uid": {
          "type": "string",
          "description": "The unique user ID from Firebase Authentication."
        },
        "username": {
          "type": "string",
          "description": "The user's unique username for login."
        },
        "email": {
          "type": "string",
          "format": "email",
          "description": "Auto-generated internal email address (e.g., username@scoop.local)."
        },
        "passwordHash": {
          "type": "string",
          "description": "The securely hashed password for the user. Hashing should be done server-side."
        },
        "employeeId": {
          "type": "string",
          "description": "A reference to the corresponding document ID in the 'employees' collection."
        },
        "role": {
          "type": "string",
          "description": "The user's role in the system.",
          "enum": ["Admin", "Secretary", "Accountant", "Engineer", "HR"]
        },
        "isActive": {
          "type": "boolean",
          "description": "Whether the user's account is active and can log in."
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "description": "The timestamp when the user account was created."
        },
        "activatedAt": {
          "type": "string",
          "format": "date-time",
          "description": "The timestamp when the user account was last activated."
        },
        "createdBy": {
            "type": "string",
            "description": "The user ID of the admin who created this account."
        }
      },
      "required": [
        "username",
        "email",
        "passwordHash",
        "employeeId",
        "role",
        "isActive",
        "createdAt",
        "createdBy"
      ]
    },
    "Client": {
      "title": "Client",
      "description": "Represents a client of the consultancy.",
      "type": "object",
      "properties": {
        "fileId": {
          "type": "string",
          "description": "The client's file ID, in the format 'sequence/year' (e.g., '1/2024')."
        },
        "fileNumber": {
          "type": "number",
          "description": "The sequential part of the client's file ID for a given year."
        },
        "fileYear": {
          "type": "number",
          "description": "The year of the client's file ID."
        },
        "nameAr": {
            "type": "string",
            "description": "The full name of the client in Arabic."
        },
        "nameEn": {
            "type": "string",
            "description": "The full name of the client in English."
        },
        "mobile": {
          "type": "string",
          "description": "The client's mobile phone number."
        },
        "civilId": {
            "type": "string",
            "description": "The client's Civil ID number."
        },
        "plotNumber": {
            "type": "string",
            "description": "The client's plot number for contracts."
        },
        "address": {
            "type": "object",
            "description": "The client's address.",
            "properties": {
                "governorate": { "type": "string" },
                "area": { "type": "string" },
                "block": { "type": "string" },
                "street": { "type": "string" },
                "houseNumber": { "type": "string" }
            }
        },
        "status": {
          "type": "string",
          "description": "The current status of the client's file.",
          "enum": [
            "new",
            "contracted",
            "cancelled",
            "reContracted"
          ]
        },
        "transactionCounter": {
            "type": "number",
            "description": "A counter for the number of transactions created for this client, used to generate sequential transaction numbers."
        },
        "assignedEngineer": {
          "type": "string",
          "description": "The ID of the engineer assigned to this client."
        },
        "createdAt": {
          "type": "string",
          "format": "date-time",
          "description": "The timestamp when the client was created."
        },
        "isActive": {
          "type": "boolean",
          "description": "Whether the client is active."
        }
      },
      "required": [
        "fileId",
        "fileNumber",
        "fileYear",
        "nameAr",
        "mobile",
        "status",
        "createdAt",
        "isActive"
      ]
    },
    "ClientTransaction": {
        "title": "Client Transaction",
        "description": "Represents an internal service or transaction for a client, like a design submission.",
        "type": "object",
        "properties": {
            "transactionNumber": {
              "type": "string",
              "description": "A unique, human-readable, sequential transaction number for the client (e.g., CL123-TX01)."
            },
            "clientId": { "type": "string", "description": "The ID of the client this transaction belongs to." },
            "transactionType": { "type": "string", "description": "The type of transaction, e.g., 'Municipality Design', 'Electricity Design'." },
            "description": { "type": "string", "description": "A brief description of the transaction." },
            "departmentId": { "type": "string", "description": "The ID of the primary department for this transaction." },
            "transactionTypeId": { "type": "string", "description": "The ID of the transaction type." },
            "status": {
                "type": "string",
                "description": "The current status of the transaction.",
                "enum": ["new", "in-progress", "completed", "submitted", "on-hold"]
            },
            "assignedEngineerId": { "type": "string", "description": "The ID of the primary engineer assigned to this transaction." },
            "createdAt": { "type": "string", "format": "date-time" },
            "updatedAt": { "type": "string", "format": "date-time" },
            "stages": {
                "type": "array",
                "description": "The lifecycle stages of the transaction.",
                "items": { "$ref": "#/entities/TransactionStage" }
            },
            "contract": {
                "type": "object",
                "description": "Stores the customized contract clauses and total amount for this specific transaction.",
                "properties": {
                    "clauses": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": { "type": "string" },
                                "name": { "type": "string" },
                                "amount": { "type": "number" },
                                "status": { "type": "string", "enum": ["مدفوعة", "مستحقة", "غير مستحقة"] },
                                "percentage": { "type": "number", "description": "The original percentage value if the financial type was 'percentage'."}
                            },
                            "required": ["id", "name", "amount", "status"]
                        }
                    },
                    "termsAndConditions": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": { "id": { "type": "string" }, "text": { "type": "string" } },
                        "required": ["id", "text"]
                      }
                    },
                    "openClauses": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": { "id": { "type": "string" }, "text": { "type": "string" } },
                        "required": ["id", "text"]
                      }
                    },
                    "totalAmount": { "type": "number" },
                    "financialsType": { "type": "string", "enum": ["fixed", "percentage"] }
                },
                "required": ["clauses", "totalAmount"]
            },
            "boqItemCount": {
                "type": "number",
                "description": "A summary field holding the total number of items in the BOQ subcollection."
            },
            "boqTotalValue": {
                "type": "number",
                "description": "A summary field holding the total planned value of the BOQ subcollection."
            }
        },
        "required": ["transactionNumber", "clientId", "transactionType", "status", "createdAt"]
    },
    "TransactionAssignment": {
        "title": "Transaction Assignment",
        "description": "Represents an assignment or forwarding of a transaction to a specific department and engineer.",
        "type": "object",
        "properties": {
            "transactionId": {
                "type": "string",
                "description": "The ID of the parent ClientTransaction."
            },
            "clientId": {
                "type": "string",
                "description": "The ID of the client."
            },
            "departmentId": { "type": "string" },
            "departmentName": { "type": "string" },
            "engineerId": { "type": "string" },
            "notes": { "type": "string" },
            "status": {
                "type": "string",
                "enum": ["pending", "in-progress", "completed"]
            },
            "createdAt": {
                "type": "string",
                "format": "date-time"
            },
            "createdBy": {
                "type": "string",
                "description": "The ID of the user who created the assignment."
            }
        },
        "required": [
            "transactionId",
            "clientId",
            "departmentId",
            "departmentName",
            "status",
            "createdAt",
            "createdBy"
        ]
    },
    "TransactionTimelineEvent": {
      "title": "Transaction Timeline Event",
      "description": "Represents a single event (comment or log) in a transaction's history.",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [ "comment", "log" ],
          "description": "The type of event."
        },
        "content": {
          "type": "string",
          "description": "The content of the comment or the description of the log."
        },
        "userId": {
          "type": "string",
          "description": "The ID of the user who created the event."
        },
        "userName": {
          "type": "string",
          "description": "The name of the user who created the event."
        },
        "userAvatar": {
          "type": "string",
          "format": "uri",
          "description": "URL to the user's avatar image."
        },
        "createdAt": {
          "type": "string",
          "format": "date-time"
        }
      },
      "required": [ "type", "content", "userId", "userName", "createdAt" ]
    },
    "TransactionStage": {
      "title": "Transaction Stage",
      "description": "Tracks the progress of a single stage within a client transaction's lifecycle. It is linked to a reference WorkStage via stageId.",
      "type": "object",
      "properties": {
        "stageId": { "type": "string", "description": "The ID of the reference WorkStage document from the department's workStages subcollection." },
        "name": { "type": "string", "description": "Name of the stage, stored for convenience. The name in the reference data is the source of truth." },
        "order": { "type": "number", "description": "The display and logical order of the stage, copied from the template." },
        "status": {
          "type": "string",
          "enum": ["pending", "in-progress", "completed", "skipped", "awaiting-review"],
          "description": "The current status of the stage."
        },
        "allowedRoles": {
            "type": "array",
            "description": "The job titles responsible for this stage, copied from the WorkStage template.",
            "items": { "type": "string" }
        },
        "stageType": {
          "type": "string",
          "enum": ["sequential", "parallel"],
          "description": "'sequential' for main workflow steps, 'parallel' for service stages like modifications that can run alongside."
        },
        "nextStageIds": {
            "type": "array",
            "description": "A list of possible next stage IDs to transition to from this stage.",
            "items": { "type": "string" }
        },
        "allowedDuringStages": {
            "type": "array",
            "description": "For parallel stages only. A list of sequential stage IDs during which this parallel stage can be initiated.",
            "items": { "type": "string" }
        },
        "trackingType": {
          "type": "string",
          "enum": ["duration", "occurrence", "none"],
          "description": "The tracking type of the stage, copied from the template."
        },
        "expectedDurationDays": {
            "type": ["number", "null"],
            "description": "The expected duration in days for this stage (if trackingType is 'duration')."
        },
        "maxOccurrences": {
            "type": ["number", "null"],
            "description": "The maximum number of times this stage can occur (if trackingType is 'occurrence')."
        },
        "allowManualCompletion": {
            "type": "boolean",
            "description": "If true, allows manually completing an 'occurrence' stage before reaching its max count."
        },
        "modificationCount": {
            "type": ["number", "null"],
            "description": "How many times a modification has been recorded for this stage."
        },
        "startDate": { "type": ["string", "null"], "format": "date-time", "description": "When the stage started." },
        "endDate": { "type": ["string", "null"], "format": "date-time", "description": "When the stage was completed." },
        "expectedEndDate": { "type": ["string", "null"], "format": "date-time", "description": "The expected completion date for countdowns." },
        "notes": { "type": ["string", "null"], "description": "Notes specific to this stage." },
        "completedCount": { "type": ["number", "null"], "description": "How many times this stage has been completed (if trackingType is 'occurrence')."}
      },
      "required": ["stageId", "name", "status"]
    },
    "Counter": {
      "title": "Counter",
      "description": "Stores sequential counters for various entities.",
      "type": "object",
      "properties": {
        "counts": {
          "type": "object",
          "description": "A map of keys (e.g., years) to their current count."
        }
      }
    },
    "Employee": {
      "title": "Employee",
      "description": "Represents an employee in the company.",
      "properties": {
        "employeeNumber": { "type": "string", "description": "The unique identifying number for the employee." },
        "fullName": { "type": "string", "description": "Employee's name in Arabic." },
        "nameEn": { "type": "string", "description": "Employee's name in English." },
        "dob": { "type": "string", "format": "date", "description": "Date of birth." },
        "gender": { "type": "string", "enum": ["male", "female"] },
        "civilId": { "type": "string" },
        "nationality": { "type": "string", "description": "The employee's nationality." },
        "residencyExpiry": { "type": "string", "format": "date" },
        "contractExpiry": { "type": "string", "format": "date" },
        "mobile": { "type": "string" },
        "emergencyContact": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "jobTitle": { "type": "string" },
        "position": { "type": "string", "enum": ["head", "employee", "assistant", "contractor"] },
        "workStartTime": { "type": "string", "description": "The official start time for the employee's shift (e.g., '08:00')." },
        "workEndTime": { "type": "string", "description": "The official end time for the employee's shift (e.g., '17:00')." },
        "salaryPaymentType": { "type": "string", "enum": ["cash", "cheque", "transfer"] },
        "bankName": { "type": "string" },
        "accountNumber": { "type": "string" },
        "iban": { "type": "string" },
        "profilePicture": { "type": "string", "format": "uri" },
        "hireDate": { "type": "string", "format": "date-time" },
        "noticeStartDate": { "type": ["string", "null"], "format": "date-time", "description": "Date when resignation/termination notice was given." },
        "terminationDate": { "type": ["string", "null"], "format": "date-time" },
        "terminationReason": { "type": "string", "enum": ["resignation", "termination", "probation", null] },
        "contractType": { "type": "string", "enum": ["permanent", "temporary", "piece-rate", "percentage", "part-time", "special"] },
        "contractPercentage": { "type": "number", "description": "The percentage of contract value for commission-based employees." },
        "pieceRateMode": {
          "type": "string",
          "enum": ["salary_with_target", "per_piece"],
          "description": "For piece-rate contracts, defines if it's a fixed salary with a target, or purely per piece."
        },
        "targetDescription": {
            "type": "number",
            "description": "For salary-with-target contracts, this defines the numerical monthly/weekly target."
        },
        "pieceRate": {
            "type": "number",
            "description": "The price per piece for 'per_piece' contract types."
        },
        "department": { "type": "string" },
        "basicSalary": { "type": "number" },
        "housingAllowance": { "type": "number" },
        "transportAllowance": { "type": "number" },
        "status": { "type": "string", "enum": ["active", "on-leave", "terminated"] },
        "lastVacationAccrualDate": { "type": "string", "format": "date-time" },
        "annualLeaveAccrued": { "type": "number" },
        "annualLeaveUsed": { "type": "number" },
        "carriedLeaveDays": { "type": "number" },
        "sickLeaveUsed": { "type": "number" },
        "emergencyLeaveUsed": { "type": "number" },
        "maxEmergencyLeave": { "type": "number" },
        "lastLeaveResetDate": { "type": "string", "format": "date-time" },
        "annualLeaveBalance": { "type": "number", "description": "Calculated current annual leave balance." },
        "createdAt": { "type": "string", "format": "date-time" }
      },
      "required": [
        "employeeNumber",
        "fullName",
        "nameEn",
        "civilId",
        "mobile",
        "department",
        "jobTitle",
        "hireDate",
        "contractType",
        "basicSalary",
        "status"
      ]
    },
    "LeaveRequest": {
        "title": "Leave Request",
        "description": "Represents a leave request submitted by an employee.",
        "type": "object",
        "properties": {
            "employeeId": { "type": "string", "description": "ID of the employee requesting leave." },
            "employeeName": { "type": "string", "description": "Full name of the employee." },
            "leaveType": { "type": "string", "enum": ["Annual", "Sick", "Emergency", "Unpaid"] },
            "startDate": { "type": "string", "format": "date-time" },
            "endDate": { "type": "string", "format": "date-time" },
            "days": { "type": "number", "description": "Total number of leave days." },
            "workingDays": { "type": "number", "description": "Total number of calculated working days." },
            "notes": { "type": "string", "description": "Reason or notes for the leave." },
            "attachmentUrl": { "type": "string", "format": "uri", "description": "URL to a medical report or other document." },
            "status": { "type": "string", "enum": ["pending", "approved", "rejected"], "description": "The current status of the leave request." },
            "createdAt": { "type": "string", "format": "date-time" },
            "approvedBy": { "type": "string", "description": "UID of the user who approved/rejected the request." },
            "approvedAt": { "type": "string", "format": "date-time" },
            "rejectionReason": { "type": "string", "description": "Reason for rejecting the leave request." },
            "isBackFromLeave": { "type": "boolean", "description": "Indicates if the employee has returned from this specific leave." },
            "actualReturnDate": { "type": "string", "format": "date-time", "description": "The actual date the employee returned to work." },
            "passportReceived": { "type": "boolean", "description": "Indicates if the employee's passport has been received for the leave." },
            "isSalaryPaid": { "type": "boolean", "description": "Indicates if the salary for this leave has been processed." }
        },
        "required": ["employeeId", "employeeName", "leaveType", "startDate", "endDate", "days", "status", "createdAt"]
    },
    "PermissionRequest": {
      "title": "Permission Request",
      "description": "Represents a permission request from an employee for late arrival or early departure.",
      "type": "object",
      "properties": {
        "employeeId": { "type": "string", "description": "ID of the employee requesting permission." },
        "employeeName": { "type": "string", "description": "Full name of the employee." },
        "date": { "type": "string", "format": "date-time", "description": "The date for which the permission is requested." },
        "type": { "type": "string", "enum": ["late_arrival", "early_departure"], "description": "The type of permission request." },
        "reason": { "type": "string", "description": "The reason for the request." },
        "status": { "type": "string", "enum": ["pending", "approved", "rejected"], "description": "The current status of the request." },
        "createdAt": { "type": "string", "format": "date-time" },
        "approvedBy": { "type": "string", "description": "UID of the user who approved/rejected the request." },
        "approvedAt": { "type": "string", "format": "date-time" },
        "rejectionReason": { "type": "string", "description": "Reason for rejecting the request." }
      },
      "required": ["employeeId", "employeeName", "date", "type", "reason", "status", "createdAt"]
    },
    "Holiday": {
        "title": "Holiday",
        "description": "Represents an official public holiday.",
        "type": "object",
        "properties": {
            "name": { "type": "string", "description": "The name of the holiday." },
            "date": { "type": "string", "format": "date", "description": "The date of the holiday." }
        },
        "required": ["name", "date"]
    },
    "AuditLog": {
        "title": "Audit Log",
        "description": "Records changes made to employee data for historical tracking.",
        "type": "object",
        "properties": {
            "changeType": { "type": "string", "enum": ["Creation", "SalaryChange", "JobChange", "DataUpdate", "StatusChange", "ResidencyUpdate"] },
            "field": { "type": "string", "description": "The name of the field that was changed." },
            "oldValue": { "description": "The value of the field before the change." },
            "newValue": { "description": "The value of the field after the change." },
            "effectiveDate": { "type": "string", "format": "date-time", "description": "The date when this change becomes effective." },
            "changedBy": { "type": "string", "description": "The ID of the user who made the change." },
            "notes": { "type": "string", "description": "Additional notes about the change." }
        },
        "required": ["changeType", "field", "newValue", "effectiveDate", "changedBy"]
    },
    "MonthlyAttendance": {
      "title": "Monthly Attendance",
      "description": "An employee's attendance records and summary for a specific month.",
      "type": "object",
      "properties": {
        "employeeId": { "type": "string" },
        "year": { "type": "number" },
        "month": { "type": "number" },
        "records": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "date": { "type": "string", "format": "date" },
              "checkIn1": { "type": ["string", "null"] },
              "checkOut1": { "type": ["string", "null"] },
              "checkIn2": { "type": ["string", "null"] },
              "checkOut2": { "type": ["string", "null"] },
              "totalHours": { "type": ["number", "null"] },
              "status": { "type": "string", "enum": ["present", "absent", "late", "leave"] }
            },
            "required": ["date", "status"]
          }
        },
        "summary": {
          "type": "object",
          "properties": {
            "totalDays": { "type": "number" },
            "presentDays": { "type": "number" },
            "absentDays": { "type": "number" },
            "lateDays": { "type": "number" },
            "leaveDays": { "type": "number" }
          },
          "required": ["presentDays", "absentDays", "lateDays", "leaveDays"]
        }
      },
      "required": ["employeeId", "year", "month", "records", "summary"]
    },
    "Payslip": {
      "title": "Payslip",
      "description": "An employee's payslip for a specific month.",
      "type": "object",
      "properties": {
        "employeeId": { "type": "string" },
        "employeeName": { "type": "string" },
        "year": { "type": "number" },
        "month": { "type": "number" },
        "attendanceId": { "type": "string", "description": "Reference to the attendance document ID." },
        "type": { "type": "string", "enum": ["Monthly", "Leave"], "description": "The type of payslip, either a regular monthly salary or a leave salary payout." },
        "leaveRequestId": { "type": "string", "description": "If type is 'Leave', this links to the LeaveRequest document." },
        "salaryPaymentType": { "type": "string", "enum": ["cash", "cheque", "transfer"] },
        "earnings": {
          "type": "object",
          "properties": {
            "basicSalary": { "type": "number" },
            "housingAllowance": { "type": "number" },
            "transportAllowance": { "type": "number" },
            "commission": { "type": "number", "description": "Commission earned in the period." }
          },
           "required": ["basicSalary"]
        },
        "deductions": {
          "type": "object",
          "properties": {
            "absenceDeduction": { "type": "number" },
            "otherDeductions": { "type": "number" }
          }
        },
        "netSalary": { "type": "number" },
        "status": { "type": "string", "enum": ["draft", "processed", "paid"] },
        "createdAt": { "type": "string", "format": "date-time" },
        "notes": { "type": "string", "description": "Auto-generated notes, e.g., regarding leave." }
      },
      "required": ["employeeId", "year", "month", "earnings", "netSalary", "status", "createdAt"]
    },
    "Notification": {
      "title": "Notification",
      "description": "Represents a notification for a user about an event in the system.",
      "type": "object",
      "properties": {
        "userId": { "type": "string", "description": "The ID of the user to whom the notification is sent." },
        "title": { "type": "string", "description": "A short, bolded title for the notification." },
        "body": { "type": "string", "description": "The main content of the notification message." },
        "link": { "type": "string", "description": "The URL the user will be redirected to upon clicking the notification." },
        "isRead": { "type": "boolean", "description": "Whether the user has read the notification." },
        "createdAt": { "type": "string", "format": "date-time" }
      },
      "required": ["userId", "title", "body", "link", "isRead", "createdAt"]
    },
    "Department": {
      "title": "Department",
      "description": "Represents a department in the company.",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The name of the department."
        },
        "order": {
            "type": "number",
            "description": "The display order."
        },
        "activityTypes": {
            "type": "array",
            "description": "The business activities this department belongs to.",
            "items": {
                "type": "string"
            }
        }
      },
      "required": ["name"]
    },
    "Job": {
      "title": "Job",
      "description": "Represents a job title within a department.",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The name of the job."
        },
        "order": {
            "type": "number",
            "description": "The display order."
        }
      },
      "required": ["name"]
    },
    "Governorate": {
      "title": "Governorate",
      "description": "Represents a governorate in the country.",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The name of the governorate."
        },
        "order": {
            "type": "number",
            "description": "The display order."
        }
      },
      "required": ["name"]
    },
    "Area": {
      "title": "Area",
      "description": "Represents an area within a governorate.",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The name of the area."
        },
        "order": {
            "type": "number",
            "description": "The display order."
        }
      },
      "required": ["name"]
    },
    "TransactionType": {
      "title": "Transaction Type",
      "description": "Represents a type of internal client transaction and links it to the departments involved.",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "The name of the transaction type (e.g., 'Municipality Design')."
        },
        "activityType": {
            "type": "string",
            "description": "The business activity this transaction type belongs to."
        },
        "departmentIds": {
            "type": "array",
            "description": "A list of department IDs involved in this transaction type.",
            "items": { "type": "string" }
        },
        "order": {
          "type": "number",
          "description": "The display and logical order of the type."
        }
      },
      "required": ["name", "activityType"]
    },
    "WorkStage": {
      "title": "Work Stage",
      "description": "Represents a standard work stage that can be associated with a department. Defines a step in a workflow.",
      "type": "object",
      "properties": {
        "name": { "type": "string", "description": "The name of the work stage." },
        "order": { "type": "number", "description": "The display and logical order of the stage." },
        "stageType": {
          "type": "string",
          "enum": ["sequential", "parallel"],
          "description": "'sequential' for main workflow steps, 'parallel' for service stages like modifications that can run alongside."
        },
        "allowedRoles": { "type": "array", "description": "A list of job titles responsible for this stage.", "items": { "type": "string" } },
        "nextStageIds": { "type": "array", "description": "A list of possible next stage IDs to transition to from this stage.", "items": { "type": "string" } },
        "allowedDuringStages": { "type": "array", "description": "For parallel stages only. A list of sequential stage IDs during which this parallel stage can be initiated.", "items": { "type": "string" } },
        "trackingType": { "type": "string", "enum": ["duration", "occurrence", "none"], "description": "How to track progress: by time, occurrences, or as a single event." },
        "enableModificationTracking": { "type": "boolean", "description": "If true, allows a modification counter to be incremented for this stage." },
        "expectedDurationDays": { "type": ["number", "null"], "description": "The expected duration in days for this stage (if trackingType is 'duration')." },
        "maxOccurrences": { "type": ["number", "null"], "description": "The maximum number of times this stage can occur (if trackingType is 'occurrence')." },
        "allowManualCompletion": { "type": "boolean", "description": "If true, allows manually completing an 'occurrence' stage before reaching its max count." }
      },
      "required": ["name", "order", "stageType", "trackingType"]
    },
    "Appointment": {
      "title": "Appointment",
      "description": "Represents a scheduled meeting or visit.",
      "type": "object",
      "properties": {
        "clientId": {
          "type": "string",
          "description": "The ID of the client for this appointment. Can be null for a new prospect."
        },
        "clientName": {
            "type": "string",
            "description": "The name of the client, especially if not yet a registered client."
        },
        "clientMobile": {
            "type": "string",
            "description": "The mobile number of the client, especially if not yet a registered client."
        },
        "engineerId": {
          "type": "string",
          "description": "The ID of the employee attending the appointment."
        },
        "meetingRoom": {
          "type": "string",
          "description": "The name of the meeting room, if applicable (for non-architectural appointments)."
        },
        "department": {
          "type": "string",
          "description": "The department associated with the appointment, used for color-coding.",
          "enum": ["الكهرباء", "الصحي", "الإنشائي", "المعماري", "أخرى"]
        },
        "title": {
          "type": "string",
          "description": "The purpose or title of the appointment."
        },
        "notes": {
          "type": "string",
          "description": "Additional notes about the appointment."
        },
        "type": {
          "type": "string",
          "description": "Distinguishes between architectural appointments and room bookings.",
          "enum": ["architectural", "room"]
        },
        "status": {
            "type": "string",
            "description": "The current status of the appointment, especially for cancellation tracking.",
            "enum": ["scheduled", "cancelled"]
        },
        "appointmentDate": {
          "type": "string",
          "format": "date-time",
          "description": "The start date and time of the appointment."
        },
        "endDate": {
          "type": "string",
          "format": "date-time",
          "description": "The end date and time of the appointment."
        },
        "createdAt": {
          "type": "string",
          "format": "date-time"
        },
        "transactionId": {
          "type": "string",
          "description": "The ID of the client transaction this appointment is related to."
        },
        "workStageUpdated": {
            "type": "boolean",
            "description": "Indicates if the work stage has been updated for this visit."
        },
        "workStageProgressId": {
            "type": "string",
            "description": "Reference to the document in work_stages_progress."
        },
        "visitCount": {
            "type": "number",
            "description": "The sequential visit number for this client's architectural appointments."
        },
        "color": {
            "type": "string",
            "description": "Hex color code for calendar display based on visit status."
        }
      },
      "required": ["engineerId", "title", "appointmentDate", "createdAt", "type"]
    },
    "WorkStageProgress": {
        "title": "Work Stage Progress",
        "description": "Logs the selection of a work stage for a specific architectural visit.",
        "type": "object",
        "properties": {
            "transactionId": { "type": "string", "description": "The ID of the client transaction this visit is related to." },
            "visitId": { "type": "string", "description": "The ID of the architectural visit document." },
            "stageId": { "type": "string", "description": "The ID of the selected work stage." },
            "stageName": { "type": "string", "description": "The name of the selected work stage." },
            "selectedBy": { "type": "string", "description": "The ID of the employee who updated the stage." },
            "selectedAt": { "type": "string", "format": "date-time" }
        },
        "required": ["visitId", "stageId", "stageName", "selectedBy", "selectedAt"]
    },
    "Contract": {
      "title": "Contract",
      "description": "Represents a fully dynamic, user-generated contract.",
      "type": "object",
      "properties": {
        "clientId": { "type": "string" },
        "clientName": { "type": "string" },
        "companySnapshot": { "type": "object", "description": "A snapshot of company data at time of creation." },
        "title": { "type": "string" },
        "contractDate": { "type": "string", "format": "date-time" },
        "scopeOfWork": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": { "id": { "type": "string" }, "title": { "type": "string" }, "description": { "type": "string" } },
            "required": ["id", "title"]
          }
        },
        "termsAndConditions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": { "id": { "type": "string" }, "text": { "type": "string" } },
            "required": ["id", "text"]
          }
        },
        "financials": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["fixed", "percentage"] },
            "totalAmount": { "type": "number" },
            "discount": { "type": "number" },
            "milestones": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": { "type": "string" },
                  "name": { "type": "string" },
                  "condition": { "type": "string" },
                  "value": { "type": "number" }
                },
                "required": ["id", "name", "value"]
              }
            }
          }
        },
        "openClauses": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": { "id": { "type": "string" }, "text": { "type": "string" } },
            "required": ["id", "text"]
          }
        },
        "createdAt": { "type": "string", "format": "date-time" },
        "createdBy": { "type": "string" }
      },
      "required": ["clientId", "title", "contractDate", "createdAt"]
    },
    "ContractTemplate": {
      "title": "Contract Template",
      "description": "A reusable template for generating contracts.",
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "templateType": {
          "type": "string",
          "description": "The type of the contract, e.g., Consulting or Execution.",
          "enum": ["Consulting", "Execution"]
        },
        "description": { "type": "string" },
        "transactionTypes": { "type": "array", "items": { "type": "string" } },
        "scopeOfWork": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": { "id": { "type": "string" }, "title": { "type": "string" }, "description": { "type": "string" } },
            "required": ["id", "title"]
          }
        },
        "termsAndConditions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": { "id": { "type": "string" }, "text": { "type": "string" } },
            "required": ["id", "text"]
          }
        },
        "financials": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["fixed", "percentage"] },
            "totalAmount": { "type": "number" },
            "discount": { "type": "number" },
            "milestones": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": { "type": "string" },
                  "name": { "type": "string" },
                  "condition": { "type": "string" },
                  "value": { "type": "number" }
                },
                "required": ["id", "name", "value"]
              }
            }
          }
        },
        "openClauses": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": { "id": { "type": "string" }, "text": { "type": "string" } },
            "required": ["id", "text"]
          }
        }
      },
      "required": ["title"]
    },
    "Account": {
        "title": "Account",
        "description": "An account in the Chart of Accounts.",
        "type": "object",
        "properties": {
            "code": { "type": "string" },
            "name": { "type": "string" },
            "type": { "type": "string", "enum": ["asset", "liability", "equity", "income", "expense"] },
            "statement": { "type": "string", "enum": ["Balance Sheet", "Income Statement"] },
            "balanceType": { "type": "string", "enum": ["Debit", "Credit"] },
            "level": { "type": "number", "description": "The hierarchy level of the account." },
            "description": { "type": "string" },
            "isPayable": { "type": "boolean" },
            "parentCode": { "type": ["string", "null"] }
        },
        "required": ["name", "code", "type", "level", "isPayable", "statement", "balanceType"]
    },
    "JournalEntryLine": {
      "title": "Journal Entry Line",
      "description": "A single line in a journal entry, representing a debit or credit to an account.",
      "type": "object",
      "properties": {
        "accountId": {
          "type": "string",
          "description": "The ID of the account from the chart of accounts."
        },
        "accountName": {
          "type": "string",
          "description": "The name of the account."
        },
        "debit": {
          "type": "number",
          "description": "The debit amount."
        },
        "credit": {
          "type": "number",
          "description": "The credit amount."
        },
        "notes": {
          "type": "string",
          "description": "Optional notes for this line."
        },
        "clientId": {
            "type": "string",
            "description": "The ID of the client related to this line."
        },
        "transactionId": {
            "type": "string",
            "description": "The ID of the client transaction related to this line."
        },
        "auto_profit_center": {
          "type": "string",
          "description": "Auto-tagged client/project ID for profit analysis."
        },
        "auto_resource_id": {
            "type": "string",
            "description": "Auto-tagged employee ID for resource analysis."
        },
        "auto_dept_id": {
            "type": "string",
            "description": "Auto-tagged department ID for departmental analysis."
        }
      },
      "required": ["accountId", "accountName", "debit", "credit"]
    },
    "JournalEntry": {
      "title": "Journal Entry",
      "description": "Represents a general journal entry with multiple debit/credit lines.",
      "type": "object",
      "properties": {
        "entryNumber": {
          "type": "string",
          "description": "A sequential number for the journal entry (e.g., JV-2024-0001)."
        },
        "date": {
          "type": "string",
          "format": "date-time",
          "description": "The date of the journal entry."
        },
        "narration": {
          "type": "string",
          "description": "A general description or narration for the entry."
        },
        "reference": {
          "type": "string",
          "description": "An optional external reference number."
        },
        "linkedReceiptId": {
          "type": "string",
          "description": "The ID of the cash receipt that triggered this entry, if any."
        },
        "totalDebit": {
          "type": "number",
          "description": "The total of all debit lines, for validation."
        },
        "totalCredit": {
          "type": "number",
          "description": "The total of all credit lines, for validation."
        },
        "status": {
            "type": "string",
            "enum": ["draft", "posted"],
            "description": "The status of the journal entry."
        },
        "reconciliationStatus": {
            "type": "string",
            "enum": ["unreconciled", "reconciled", "pending"],
            "description": "The bank reconciliation status of the entry."
        },
        "reconciliationInfo": {
            "type": "object",
            "description": "Details about the reconciliation.",
            "properties": {
                "reconciledAt": { "type": "string", "format": "date-time" },
                "reconciledBy": { "type": "string" },
                "bankTransactionId": { "type": "string" },
                "reconciliationEntryId": { "type": "string" }
            }
        },
        "lines": {
          "type": "array",
          "items": {
            "$ref": "#/entities/JournalEntryLine"
          }
        },
        "clientId": {
            "type": "string",
            "description": "The ID of the client related to this entry."
        },
        "transactionId": {
            "type": "string",
            "description": "The ID of the client transaction related to this entry."
        },
        "createdAt": {
          "type": "string",
          "format": "date-time"
        },
        "createdBy": {
          "type": "string",
          "description": "The ID of the user who created the entry."
        }
      },
      "required": ["entryNumber", "date", "narration", "totalDebit", "totalCredit", "status", "lines", "createdAt"]
    },
    "PaymentVoucher": {
      "title": "Payment Voucher",
      "description": "Represents a payment voucher for disbursing funds.",
      "type": "object",
      "properties": {
        "voucherNumber": { "type": "string" },
        "voucherSequence": { "type": "number" },
        "voucherYear": { "type": "number" },
        "payeeName": { "type": "string" },
        "payeeType": { "type": "string", "enum": ["vendor", "employee", "other"] },
        "employeeId": { "type": "string", "description": "Link to employee if payeeType is employee, for residency renewal etc." },
        "renewalExpiryDate": { "type": "string", "format": "date-time", "description": "New expiry date if this is for residency renewal." },
        "amount": { "type": "number" },
        "amountInWords": { "type": "string" },
        "paymentDate": { "type": "string", "format": "date-time" },
        "paymentMethod": { "type": "string", "enum": ["Cash", "Cheque", "Bank Transfer", "EmployeeCustody"] },
        "description": { "type": "string" },
        "reference": { "type": "string", "description": "e.g., Cheque number or transfer reference" },
        "debitAccountId": { "type": "string" },
        "debitAccountName": { "type": "string" },
        "creditAccountId": { "type": "string" },
        "creditAccountName": { "type": "string" },
        "status": { "type": "string", "enum": ["draft", "paid", "cancelled"] },
        "journalEntryId": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" },
        "clientId": { "type": "string", "description": "Client ID if this payment is for a project"},
        "transactionId": { "type": "string", "description": "Transaction ID if this payment is for a project"}
      },
      "required": ["voucherNumber", "payeeName", "amount", "paymentDate", "paymentMethod", "debitAccountId", "creditAccountId", "status"]
    },
    "CashReceipt": {
      "title": "Cash Receipt",
      "description": "Represents a cash receipt voucher.",
      "type": "object",
      "properties": {
        "voucherNumber": { "type": "string" },
        "voucherSequence": { "type": "number" },
        "voucherYear": { "type": "number" },
        "clientId": { "type": "string" },
        "clientNameAr": { "type": "string" },
        "clientNameEn": { "type": "string" },
        "projectId": { "type": "string" },
        "projectNameAr": { "type": "string" },
        "amount": { "type": "number" },
        "amountInWords": { "type": "string" },
        "receiptDate": { "type": "string", "format": "date-time" },
        "paymentMethod": { "type": "string", "description": "The name of the payment method used, from settings." },
        "bankFeeAmount": { "type": "number", "description": "The calculated bank fee for this transaction, if any." },
        "netAmount": { "type": "number", "description": "The net amount received after deducting bank fees (amount - bankFeeAmount)." },
        "description": { "type": "string" },
        "reference": { "type": "string" },
        "journalEntryId": {
            "type": "string",
            "description": "The ID of the journal entry automatically created for this receipt."
        },
        "createdAt": { "type": "string", "format": "date-time" }
      },
      "required": ["voucherNumber", "clientId", "amount", "receiptDate", "paymentMethod"]
    },
    "Quotation": {
      "title": "Quotation",
      "description": "Represents a price quotation provided to a client.",
      "type": "object",
      "properties": {
        "quotationNumber": { "type": "string" },
        "quotationSequence": { "type": "number" },
        "quotationYear": { "type": "number" },
        "clientId": { "type": "string" },
        "clientName": { "type": "string" },
        "date": { "type": "string", "format": "date-time" },
        "validUntil": { "type": "string", "format": "date-time" },
        "subject": { "type": "string" },
        "departmentId": { "type": "string", "description": "The ID of the department this quotation is for." },
        "transactionTypeId": { "type": "string", "description": "The ID of the transaction type this quotation is for." },
        "templateDescription": { "type": "string" },
        "scopeOfWork": { "type": "array", "items": { "$ref": "#/entities/ContractScopeItem" } },
        "termsAndConditions": { "type": "array", "items": { "$ref": "#/entities/ContractTerm" } },
        "openClauses": { "type": "array", "items": { "$ref": "#/entities/ContractTerm" } },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "description": { "type": "string" },
              "quantity": { "type": "number" },
              "unitPrice": { "type": "number" },
              "total": { "type": "number" },
              "condition": { "type": "string", "description": "The condition for this item to be due, often linked to a work stage."}
            },
            "required": ["description", "quantity", "unitPrice", "total"]
          }
        },
        "totalAmount": { "type": "number" },
        "notes": { "type": "string" },
        "status": { "type": "string", "enum": ["draft", "sent", "accepted", "rejected", "expired"] },
        "createdAt": { "type": "string", "format": "date-time" },
        "createdBy": { "type": "string" },
        "transactionId": { "type": "string", "description": "The ID of the transaction this quotation was converted to."}
      },
      "required": ["quotationNumber", "clientId", "date", "subject", "items", "totalAmount", "status", "createdAt"]
    },
    "Vendor": {
      "title": "Vendor",
      "description": "Represents a supplier or vendor.",
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "contactPerson": { "type": "string" },
        "phone": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "address": { "type": "string" }
      },
      "required": ["name"]
    },
    "PurchaseOrder": {
      "title": "Purchase Order",
      "description": "Represents a purchase order for materials or services.",
      "type": "object",
      "properties": {
        "poNumber": { "type": "string", "description": "Sequential PO number." },
        "orderDate": { "type": "string", "format": "date-time" },
        "vendorId": { "type": "string" },
        "vendorName": { "type": "string" },
        "supplierQuotationId": { "type": "string" },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "internalItemId": { "type": "string" },
              "itemName": { "type": "string" },
              "quantity": { "type": "number" },
              "unitPrice": { "type": "number" },
              "total": { "type": "number" }
            },
            "required": ["internalItemId", "itemName", "quantity", "unitPrice", "total"]
          }
        },
        "totalAmount": { "type": "number" },
        "paymentTerms": { "type": "string" },
        "notes": { "type": "string" },
        "status": {
          "type": "string",
          "enum": ["draft", "approved", "partially_received", "received", "cancelled"]
        }
      },
      "required": ["poNumber", "orderDate", "vendorId", "items", "totalAmount", "status"]
    },
    "ResidencyRenewal": {
      "title": "Residency Renewal",
      "description": "Tracks the financial transaction for an employee's residency renewal.",
      "type": "object",
      "properties": {
        "employeeId": { "type": "string" },
        "renewalDate": { "type": "string", "format": "date-time" },
        "newExpiryDate": { "type": "string", "format": "date" },
        "cost": { "type": "number" },
        "paymentVoucherId": { "type": "string" },
        "monthlyAmortizationAmount": { "type": "number" },
        "amortizationStatus": { "type": "string", "enum": ["in-progress", "completed"]},
        "lastAmortizationDate": { "type": "string", "format": "date-time" }
      },
      "required": ["employeeId", "renewalDate", "newExpiryDate", "cost", "paymentVoucherId"]
    },
    "Warehouse": {
      "title": "Warehouse",
      "description": "Represents a storage location for inventory.",
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "location": { "type": "string" },
        "isDefault": { "type": "boolean" }
      },
      "required": ["name"]
    },
    "ItemCategory": {
      "title": "Item Category",
      "description": "A category for inventory items.",
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "parentCategoryId": { "type": "string", "description": "The ID of the parent category, null for root categories." },
        "order": { "type": "number", "description": "The display order." }
      },
      "required": ["name"]
    },
    "Item": {
      "title": "Inventory Item",
      "description": "An item in the inventory.",
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "description": { "type": "string" },
        "sku": { "type": "string" },
        "categoryId": { "type": "string" },
        "itemType": { 
          "type": "string", 
          "enum": ["product", "service"], 
          "description": "'product' for physical goods (storable or consumable), 'service' for non-physical items." 
        },
        "inventoryTracked": {
            "type": "boolean",
            "description": "If true, the quantity of this product will be tracked (storable). If false, it's a consumable."
        },
        "unitOfMeasure": { "type": "string" },
        "costPrice": { "type": "number" },
        "sellingPrice": { "type": "number" },
        "reorderLevel": { "type": "number" },
        "expiryTracked": { "type": "boolean", "description": "If true, this item requires expiry date tracking." },
        "createdAt": { "type": "string", "format": "date-time" }
      },
      "required": ["name", "sku", "categoryId", "itemType", "unitOfMeasure"]
    },
    "SupplierItem": {
        "title": "Supplier Item",
        "description": "Maps a supplier's specific item code and name to an internal inventory item.",
        "type": "object",
        "properties": {
            "supplierId": { "type": "string" },
            "internalItemId": { "type": "string" },
            "supplierSku": { "type": "string", "description": "The SKU or item code used by the supplier." },
            "supplierItemName": { "type": "string", "description": "The name of the item as it appears on the supplier's documents." }
        },
        "required": ["supplierId", "internalItemId", "supplierSku"]
    },
    "RequestForQuotation": {
        "title": "Request for Quotation",
        "description": "A request sent to vendors for pricing on specific items.",
        "type": "object",
        "properties": {
            "rfqNumber": { "type": "string" },
            "date": { "type": "string", "format": "date-time" },
            "status": { "type": "string", "enum": ["draft", "sent", "closed", "cancelled"] },
            "vendorIds": { "type": "array", "items": { "type": "string" } },
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": { "type": "string" },
                        "internalItemId": { "type": "string" },
                        "itemName": { "type": "string" },
                        "quantity": { "type": "number" }
                    },
                    "required": ["internalItemId", "itemName", "quantity"]
                }
            },
            "createdAt": { "type": "string", "format": "date-time" }
        },
        "required": ["rfqNumber", "date", "status", "items"]
    },
    "SupplierQuotation": {
        "title": "Supplier Quotation",
        "description": "A quotation received from a supplier in response to an RFQ.",
        "type": "object",
        "properties": {
            "rfqId": { "type": "string" },
            "vendorId": { "type": "string" },
            "quotationReference": { "type": "string" },
            "date": { "type": "string", "format": "date-time" },
            "deliveryTimeDays": { "type": "number" },
            "paymentTerms": { "type": "string" },
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "rfqItemId": { "type": "string" },
                        "unitPrice": { "type": "number" }
                    },
                    "required": ["rfqItemId", "unitPrice"]
                }
            },
             "createdAt": { "type": "string", "format": "date-time" }
        },
        "required": ["rfqId", "vendorId", "date"]
    },
    "GoodsReceiptNote": {
        "title": "Goods Receipt Note",
        "description": "A document to record the receipt of items into a warehouse.",
        "type": "object",
        "properties": {
            "grnNumber": { "type": "string" },
            "purchaseOrderId": { "type": "string" },
            "warehouseId": { "type": "string" },
            "date": { "type": "string", "format": "date-time" },
            "itemsReceived": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "internalItemId": { "type": "string" },
                        "quantityReceived": { "type": "number" },
                        "batchNumber": { "type": "string" },
                        "expiryDate": { "type": "string", "format": "date" }
                    },
                    "required": ["internalItemId", "quantityReceived"]
                }
            }
        },
        "required": ["grnNumber", "purchaseOrderId", "warehouseId", "date", "itemsReceived"]
    },
    "InventoryAdjustment": {
        "title": "Inventory Adjustment",
        "description": "Represents stock adjustments like opening balances, damages, etc.",
        "type": "object",
        "properties": {
            "adjustmentNumber": { "type": "string" },
            "date": { "type": "string", "format": "date-time" },
            "type": { "type": "string", "enum": ["opening_balance", "damage", "theft", "other"] },
            "notes": { "type": "string" },
            "journalEntryId": { "type": "string" },
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "itemId": { "type": "string" },
                        "itemName": { "type": "string" },
                        "quantity": { "type": "number" },
                        "unitCost": { "type": "number" },
                        "totalCost": { "type": "number" },
                        "expiryDate": { "type": "string", "format": "date" }
                    },
                    "required": ["itemId", "itemName", "quantity", "unitCost", "totalCost"]
                }
            }
        },
        "required": ["adjustmentNumber", "date", "type", "items"]
    },
    "BoqItem": {
      "title": "Bill of Quantities Item",
      "description": "A single line item in a Bill of Quantities.",
      "type": "object",
      "properties": {
        "itemId": { "type": "string", "description": "Reference to the master BoqReferenceItem ID." },
        "itemNumber": { "type": "string", "description": "The hierarchical item number (e.g., '1.1', '1.2.1')." },
        "description": { "type": "string" },
        "unit": { "type": "string" },
        "quantity": { "type": "number" },
        "sellingUnitPrice": { "type": "number", "description": "The unit price presented to the client." },
        "notes": { "type": "string", "description": "Specific notes for this line item." },
        "isHeader": { "type": "boolean", "description": "True if this item is a non-calculable header or category title." },
        "parentId": { "type": ["string", "null"], "description": "The ID of the parent BoqItem in the same collection, for creating a hierarchy." },
        "level": { "type": "number", "description": "The indentation level for hierarchical display." },
        "costUnitPrice": { "type": "number", "description": "The estimated unit cost for the company." },
        "margin": { "type": "number", "description": "The profit margin percentage for this item." },
        "executedQuantity": { "type": "number" },
        "actualCost": { "type": "number" },
        "deviation": { "type": "number" },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      },
      "required": ["itemNumber", "description"]
    },
     "Boq": {
      "title": "Bill of Quantities",
      "description": "A standalone Bill of Quantities document, can be linked to a project or quotation.",
      "type": "object",
      "properties": {
        "boqNumber": { "type": "string" },
        "name": { "type": "string" },
        "status": { "type": "string", "enum": ["تقديري", "تعاقدي", "منفذ"] },
        "clientId": { "type": "string", "description": "Optional link to a registered client" },
        "clientName": { "type": "string", "description": "Stored client name for display (can be a prospective client)" },
        "transactionId": { "type": "string", "description": "Optional link to a transaction" },
        "totalValue": { "type": "number" },
        "itemCount": { "type": "number" },
        "createdAt": { "type": "string", "format": "date-time" }
      },
      "required": ["boqNumber", "name", "status"]
    },
    "BoqReferenceItem": {
      "title": "BOQ Reference Item",
      "description": "A master list of frequently used Bill of Quantities entries.",
      "type": "object",
      "properties": {
        "name": { "type": "string", "description": "The common name or description of the BOQ item." },
        "unit": { "type": "string", "description": "The default unit of measure for this item (e.g., m3, m2, item)." },
        "isHeader": { "type": "boolean", "description": "True if this item is a non-calculable header or category title." },
        "transactionTypeIds": {
            "type": "array",
            "description": "Links to the specific transaction types this item is relevant to.",
            "items": { "type": "string" }
        },
        "subcontractorTypeIds": {
            "type": "array",
            "description": "Links to the types of subcontractors related to this item.",
            "items": { "type": "string" }
        },
        "activityTypeIds": {
            "type": "array",
            "description": "Links to the business activities this item is relevant to.",
            "items": { "type": "string" }
        },
        "order": { "type": "number", "description": "The display order of the item in lists." },
        "parentBoqReferenceItemId": {
            "type": "string",
            "description": "The ID of the parent BOQ reference item, for creating a hierarchy."
        }
      },
      "required": ["name"]
    },
    "SubcontractorType": {
        "title": "Subcontractor Type",
        "description": "Defines a type or category for subcontractors (e.g., Electrical, Plumbing).",
        "type": "object",
        "properties": {
            "name": { "type": "string" },
            "order": { "type": "number" }
        },
        "required": ["name"]
    },
    "SubcontractorSpecialization": {
        "title": "Subcontractor Specialization",
        "description": "Defines a specific specialization within a Subcontractor Type (e.g., High Voltage within Electrical).",
        "type": "object",
        "properties": {
            "name": { "type": "string" },
            "order": { "type": "number" }
        },
        "required": ["name"]
    }
  },
  "auth": {
    "providers": [
      "anonymous"
    ]
  },
  "firestore": {
    "/company_settings/{settingsId}": {
      "schema": { "$ref": "#/entities/CompanyBranding" },
      "description": "Stores the main company branding and letterhead information. Expects a single document with a known ID like 'main'."
    },
    "/companies/{companyId}": {
        "schema": { "$ref": "#/entities/Company" },
        "description": "Stores company profiles for multi-company support."
    },
    "/companyActivityTypes/{typeId}": {
        "schema": { "$ref": "#/entities/CompanyActivityType" },
        "description": "Stores the different types of company business activities."
    },
    "/subcontractorTypes/{typeId}": {
      "schema": { "$ref": "#/entities/SubcontractorType"},
      "description": "Stores the main categories of subcontractors."
    },
    "/subcontractorTypes/{typeId}/specializations/{specializationId}": {
        "schema": { "$ref": "#/entities/SubcontractorSpecialization" },
        "description": "Stores specializations within a subcontractor type."
    },
    "/users/{userId}": {
      "schema": {
        "$ref": "#/entities/UserProfile"
      },
      "description": "Stores user login accounts, linked to employees."
    },
    "/clients/{clientId}": {
      "schema": {
        "$ref": "#/entities/Client"
      },
      "description": "Stores information about the company's clients."
    },
    "/clients/{clientId}/transactions/{transactionId}": {
        "schema": {
            "$ref": "#/entities/ClientTransaction"
        },
        "description": "Stores internal transactions/services for a specific client."
    },
    "/clients/{clientId}/transactions/{transactionId}/boq/{boqItemId}": {
        "schema": { "$ref": "#/entities/BoqItem" },
        "description": "Stores the Bill of Quantities for a specific transaction."
    },
    "/boqs/{boqId}": {
      "schema": { "$ref": "#/entities/Boq" },
      "description": "Stores all standalone Bill of Quantities documents."
    },
    "/boqs/{boqId}/items/{itemId}": {
      "schema": { "$ref": "#/entities/BoqItem" },
      "description": "Stores the individual line items for a BOQ."
    },
    "/boqReferenceItems/{itemId}": {
      "schema": { "$ref": "#/entities/BoqReferenceItem" },
      "description": "Stores a master list of reusable Bill of Quantities items."
    },
    "/transaction_assignments/{assignmentId}": {
        "schema": {
            "$ref": "#/entities/TransactionAssignment"
        },
        "description": "Stores individual assignments of a transaction to different departments."
    },
    "/clients/{clientId}/transactions/{transactionId}/timelineEvents/{eventId}": {
      "schema": {
        "$ref": "#/entities/TransactionTimelineEvent"
      },
      "description": "Stores the chronological history and comments for a specific transaction."
    },
    "/clients/{clientId}/history/{eventId}": {
      "schema": {
        "$ref": "#/entities/TransactionTimelineEvent"
      },
      "description": "Stores the audit history and important events for a client file."
    },
    "/counters/{counterId}": {
      "schema": {
        "$ref": "#/entities/Counter"
      },
      "description": "Stores shared counters. e.g., counterId = 'clientFiles'."
    },
    "/employees/{employeeId}": {
        "schema": { "$ref": "#/entities/Employee" },
        "description": "Stores HR information about company employees."
    },
    "/employees/{employeeId}/auditLogs/{logId}": {
        "schema": { "$ref": "#/entities/AuditLog" },
        "description": "Stores the historical audit trail of changes for a specific employee."
    },
    "/leaveRequests/{leaveRequestId}": {
        "schema": { "$ref": "#/entities/LeaveRequest" },
        "description": "Stores all employee leave requests."
    },
    "/permissionRequests/{permissionId}": {
        "schema": { "$ref": "#/entities/PermissionRequest" },
        "description": "Stores all employee permission requests for late arrival or early departure."
    },
    "/holidays/{holidayId}": {
        "schema": { "$ref": "#/entities/Holiday" },
        "description": "Stores all official public holidays."
    },
    "/attendance/{attendanceId}": {
      "schema": { "$ref": "#/entities/MonthlyAttendance" },
      "description": "Stores monthly attendance sheets for employees. The ID is a composite of year-month-employeeId."
    },
    "/payroll/{payslipId}": {
      "schema": { "$ref": "#/entities/Payslip" },
      "description": "Stores generated monthly payslips for employees. The ID is a composite of year-month-employeeId."
    },
    "/notifications/{notificationId}": {
      "schema": {
        "$ref": "#/entities/Notification"
      },
      "description": "Stores notifications for all users."
    },
    "/departments/{departmentId}": {
      "schema": { "$ref": "#/entities/Department" },
      "description": "Stores company departments."
    },
    "/departments/{departmentId}/jobs/{jobId}": {
        "schema": { "$ref": "#/entities/Job" },
        "description": "Stores job titles for a specific department."
    },
    "/departments/{departmentId}/workStages/{workStageId}": {
        "schema": { "$ref": "#/entities/WorkStage" },
        "description": "Stores standard work stages for a specific department."
    },
    "/governorates/{governorateId}": {
      "schema": { "$ref": "#/entities/Governorate" },
      "description": "Stores country governorates."
    },
    "/governorates/{governorateId}/areas/{areaId}": {
        "schema": { "$ref": "#/entities/Area" },
        "description": "Stores areas for a specific governorate."
    },
    "/transactionTypes/{transactionTypeId}": {
      "schema": { "$ref": "#/entities/TransactionType" },
      "description": "Stores the types of internal client transactions, linking them to one or more departments."
    },
    "/appointments/{appointmentId}": {
      "schema": {
        "$ref": "#/entities/Appointment"
      },
      "description": "Stores all scheduled appointments."
    },
    "/work_stages_progress/{progressId}": {
        "schema": {
            "$ref": "#/entities/WorkStageProgress"
        },
        "description": "Stores logs of work stage updates from architectural visits."
    },
    "/contracts/{contractId}": {
      "schema": {
        "$ref": "#/entities/Contract"
      },
      "description": "Stores dynamically generated contracts."
    },
    "/contractTemplates/{templateId}": {
      "schema": {
        "$ref": "#/entities/ContractTemplate"
      },
      "description": "Stores reusable contract templates for various transaction types."
    },
    "/chartOfAccounts/{accountId}": {
        "schema": {
            "$ref": "#/entities/Account"
        },
        "description": "Stores the company's chart of accounts."
    },
    "/journalEntries/{journalEntryId}": {
      "schema": {
        "$ref": "#/entities/JournalEntry"
      },
      "description": "Stores general journal entries created manually or by other processes."
    },
    "/paymentVouchers/{voucherId}": {
      "schema": { "$ref": "#/entities/PaymentVoucher" },
      "description": "Stores all payment vouchers issued by the company."
    },
    "/cashReceipts/{receiptId}": {
      "schema": { "$ref": "#/entities/CashReceipt" },
      "description": "Stores all cash receipt vouchers received by the company."
    },
    "/quotations/{quotationId}": {
      "schema": {
        "$ref": "#/entities/Quotation"
      },
      "description": "Stores all quotations sent to clients."
    },
    "/vendors/{vendorId}": {
      "schema": {
        "$ref": "#/entities/Vendor"
      },
      "description": "Stores information about suppliers and vendors."
    },
    "/purchaseOrders/{poId}": {
      "schema": {
        "$ref": "#/entities/PurchaseOrder"
      },
      "description": "Stores all purchase orders issued to vendors."
    },
    "/residencyRenewals/{renewalId}": {
        "schema": {
            "$ref": "#/entities/ResidencyRenewal"
        },
        "description": "Stores financial records for employee residency renewals."
    },
    "/items/{itemId}": {
        "schema": { "$ref": "#/entities/Item" },
        "description": "Stores all inventory items."
    },
    "/warehouses/{warehouseId}": {
        "schema": { "$ref": "#/entities/Warehouse" },
        "description": "Stores all warehouses and storage locations."
    },
    "/itemCategories/{categoryId}": {
        "schema": { "$ref": "#/entities/ItemCategory" },
        "description": "Stores inventory item categories in a hierarchical structure."
    },
    "/supplierItems/{supplierItemId}": {
        "schema": { "$ref": "#/entities/SupplierItem" },
        "description": "Maps supplier-specific item codes to internal item codes."
    },
    "/rfqs/{rfqId}": {
      "schema": { "$ref": "#/entities/RequestForQuotation" },
      "description": "Stores all Requests for Quotation sent to vendors."
    },
    "/supplierQuotations/{quotationId}": {
        "schema": { "$ref": "#/entities/SupplierQuotation" },
        "description": "Stores quotations received from suppliers."
    },
    "/grns/{grnId}": {
        "schema": { "$ref": "#/entities/GoodsReceiptNote" },
        "description": "Stores all Goods Receipt Notes for incoming inventory."
    },
    "/inventoryAdjustments/{adjustmentId}": {
      "schema": { "$ref": "#/entities/InventoryAdjustment" },
      "description": "Stores stock adjustments like opening balances, damages, etc."
    },
    "/projects/{projectId}": {
      "schema": { "$ref": "#/entities/ConstructionProject" },
      "description": "Stores all construction projects."
    },
    "/subcontractors/{subcontractorId}": {
        "schema": { "$ref": "#/entities/Subcontractor" },
        "description": "Stores information about all subcontractors."
    }
  }
}
```

---
## File: `docs/cash-receipts-features.md`
```md
# وحدة سندات القبض: شرح شامل للمميزات

بناءً على طلبك، إليك شرح مفصل ومبسط لجميع المميزات التي قمنا بتطويرها في وحدة "سندات القبض"، والتي تم تصميمها لتكون مرنة، ذكية، ومتكاملة تمامًا مع بقية أقسام النظام.

---

### 1. إنشاء سند قبض ذكي

تم تصميم شاشة "سند قبض جديد" لتكون أكثر من مجرد أداة لإدخال البيانات، بل مساعد ذكي يسرّع عملك ويمنع الأخطاء.

*   **الترقيم التلقائي:** لا داعي للقلق بشأن أرقام السندات. يقوم النظام تلقائيًا بإنشاء رقم سند فريد ومتسلسل لكل سنة (مثال: `CRV-2024-0001`).

*   **الربط المباشر بالعملاء والعقود:**
    *   بمجرد اختيار العميل من القائمة، يقوم النظام فورًا بجلب قائمة "العقود" أو "المشاريع" الخاصة بهذا العميل.
    *   يمكنك اختيار ربط سند القبض بعقد معين.

*   **توليد ذكي لوصف الدفعة (أهم ميزة):**
    *   عندما تختار عقدًا معينًا وتدخل المبلغ المستلم، يقوم النظام **بتحليل بنود الدفعات في العقد تلقائيًا**.
    *   يقوم بإنشاء وصف مفصل يوضح أي الدفعات يتم سدادها بهذا المبلغ (سواء كان سدادًا كاملًا أو جزئيًا).
    *   **مثال:** إذا أدخلت مبلغ 700 دينار، وكان هناك دفعة مستحقة بقيمة 500 وأخرى بقيمة 1000، سيكتب النظام تلقائيًا في الوصف:
        > سداد كامل للدفعة "الأولى" بقيمة 500 د.ك
        > سداد جزئي من الدفعة "الثانية" بقيمة 200 د.ك

*   **تحويل المبلغ إلى نص عربي (تفقيط):** يقوم النظام تلقائيًا بتحويل المبلغ المدخل بالأرقام إلى نص مكتوب باللغة العربية (مثال: "فقط سبعمائة دينار كويتي لا غير").

### 2. تكامل فوري مع إدارة المشاريع

لا يعمل قسم المحاسبة بمعزل عن الأقسام الهندسية. لذلك، تم ربط سندات القبض مباشرة بسير عمل المشاريع.

*   **توثيق فوري في سجل المعاملة:**
    *   عند حفظ سند قبض مرتبط بمشروع معين، يقوم النظام تلقائيًا بإضافة **تعليق** في "التايم لاين" الخاص بهذه المعاملة.
    *   يحتوي التعليق على رقم السند وتفاصيل الدفعة، مما يضمن أن المهندس المسؤول عن المشروع على دراية تامة بالوضع المالي للمشروع لحظة بلحظة.

*   **إشعارات تلقائية للمهندسين:**
    *   في نفس اللحظة، يرسل النظام **إشعارًا (Notification)** للمهندس المسؤول عن المشروع، يخطره بأنه تم تسجيل دفعة مالية جديدة، مع رابط مباشر للمعاملة.

### 3. سهولة العرض والطباعة

*   **تصميم احترافي جاهز للطباعة:** عند عرض أي سند قبض، يتم تقديمه في تصميم أنيق وواضح، يتضمن شعار وبيانات شركتك، ومُعد خصيصًا للطباعة الرسمية.

*   **تصدير PDF:** يمكنك بسهولة طباعة السند أو تصديره كملف PDF لتسليمه للعميل أو لأغراض الأرشفة.

### 4. إدارة شاملة ومرنة

*   **قائمة مركزية:** توفر لك صفحة "سندات القبض" قائمة بجميع السندات التي تم إنشاؤها، مع إمكانية البحث والفلترة السريعة.

*   **تعديل وحذف:** يمكنك بسهولة تعديل بيانات أي سند قبض أو حذفه بالكامل إذا لزم الأمر.
```

---
## File: `docs/database-schema.md`
```md
# مخطط قاعدة البيانات المقترح لوحدة المشتريات والمخازن

هذا المستند يقترح تصميم جداول قاعدة البيانات بصيغة SQL لتوضيح الهيكل والعلاقات.

### 1. جدول الأصناف الرئيسية (Items)

يحتوي على جميع الأصناف الداخلية في نظامك.

```sql
CREATE TABLE Items (
    ItemID INT PRIMARY KEY AUTO_INCREMENT,
    InternalSKU VARCHAR(50) UNIQUE NOT NULL, -- الكود الداخلي
    NameAR VARCHAR(255) NOT NULL,
    NameEN VARCHAR(255),
    Description TEXT,
    UnitOfMeasure VARCHAR(50), -- (قطعة, كرتون, كيلو, متر)
    CategoryID INT,
    CostPrice DECIMAL(10, 3), -- متوسط سعر التكلفة
    SellingPrice DECIMAL(10, 3),
    ReorderLevel INT, -- حد إعادة الطلب
    ExpiryTracked BOOLEAN DEFAULT FALSE, -- هل يتطلب تتبع صلاحية؟
    -- FOREIGN KEY (CategoryID) REFERENCES ItemCategories(CategoryID)
);
```

### 2. جدول الموردين (Suppliers)

```sql
CREATE TABLE Suppliers (
    SupplierID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(255) NOT NULL,
    ContactPerson VARCHAR(100),
    Email VARCHAR(100),
    Phone VARCHAR(50),
    Rating INT DEFAULT 3, -- تقييم من 1 إلى 5
    PaymentTerms VARCHAR(255) -- شروط الدفع الافتراضية
);
```

### 3. جدول ربط أصناف الموردين (SupplierItems)

هذا هو الجدول المحوري لربط أكواد أصناف الموردين بأكوادك الداخلية.

```sql
CREATE TABLE SupplierItems (
    SupplierItemID INT PRIMARY KEY AUTO_INCREMENT,
    SupplierID INT NOT NULL,
    ItemID INT NOT NULL,
    SupplierSKU VARCHAR(100) NOT NULL, -- كود الصنف عند المورد
    SupplierItemName VARCHAR(255), -- اسم الصنف عند المورد
    LastPrice DECIMAL(10, 3), -- آخر سعر شراء من هذا المورد
    -- FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID),
    -- FOREIGN KEY (ItemID) REFERENCES Items(ItemID),
    UNIQUE (SupplierID, SupplierSKU) -- يمنع تكرار نفس كود المورد لنفس المورد
);
```

### 4. جدول طلبات التسعير (RFQs)

```sql
CREATE TABLE RFQs (
    RFQ_ID INT PRIMARY KEY AUTO_INCREMENT,
    RFQ_Number VARCHAR(50) UNIQUE NOT NULL,
    CreationDate DATE NOT NULL,
    ClosingDate DATE,
    Status VARCHAR(50) -- (Draft, Sent, Closed)
);

CREATE TABLE RFQ_Items (
    RFQ_ItemID INT PRIMARY KEY AUTO_INCREMENT,
    RFQ_ID INT NOT NULL,
    ItemID INT NOT NULL,
    Quantity INT NOT NULL,
    -- FOREIGN KEY (RFQ_ID) REFERENCES RFQs(RFQ_ID),
    -- FOREIGN KEY (ItemID) REFERENCES Items(ItemID)
);

CREATE TABLE RFQ_Suppliers (
    RFQ_SupplierID INT PRIMARY KEY AUTO_INCREMENT,
    RFQ_ID INT NOT NULL,
    SupplierID INT NOT NULL,
    -- FOREIGN KEY (RFQ_ID) REFERENCES RFQs(RFQ_ID),
    -- FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID)
);
```

### 5. جدول عروض أسعار الموردين (SupplierQuotations)

```sql
CREATE TABLE SupplierQuotations (
    QuotationID INT PRIMARY KEY AUTO_INCREMENT,
    RFQ_ID INT NOT NULL,
    SupplierID INT NOT NULL,
    QuotationReference VARCHAR(100), -- رقم عرض السعر من المورد
    QuotationDate DATE NOT NULL,
    DeliveryTimeDays INT,
    PaymentTerms VARCHAR(255),
    -- FOREIGN KEY (RFQ_ID) REFERENCES RFQs(RFQ_ID),
    -- FOREIGN KEY (SupplierID) REFERENCES Suppliers(SupplierID)
);

CREATE TABLE Quotation_Items (
    QuotationItemID INT PRIMARY KEY AUTO_INCREMENT,
    QuotationID INT NOT NULL,
    RFQ_ItemID INT NOT NULL, -- للربط بالصنف المطلوب في الـ RFQ
    UnitPrice DECIMAL(10, 3) NOT NULL,
    -- FOREIGN KEY (QuotationID) REFERENCES SupplierQuotations(QuotationID),
    -- FOREIGN KEY (RFQ_ItemID) REFERENCES RFQ_Items(RFQ_ItemID)
);
```

### 6. جدول مقارنة العروض (Comparison_Matrix)

هذا ليس جدولًا فعليًا في قاعدة البيانات، بل هو نتيجة استعلام (Query) معقد يجمع البيانات من الجداول السابقة لعرضها للمستخدم. يمكن إنشاؤه كـ View إذا كانت قاعدة البيانات تدعم ذلك.

```sql
-- مثال توضيحي لكيفية بناء الاستعلام
SELECT
    ri.ItemID,
    i.NameAR,
    s.Name AS SupplierName,
    qi.UnitPrice,
    sq.DeliveryTimeDays,
    s.Rating,
    sq.PaymentTerms
FROM RFQ_Items ri
JOIN Items i ON ri.ItemID = i.ItemID
LEFT JOIN SupplierQuotations sq ON ri.RFQ_ID = sq.RFQ_ID
LEFT JOIN Quotation_Items qi ON sq.QuotationID = qi.QuotationID AND ri.RFQ_ItemID = qi.RFQ_ItemID
LEFT JOIN Suppliers s ON sq.SupplierID = s.SupplierID
WHERE ri.RFQ_ID = [Your_RFQ_ID];
```

### العلاقات (Relationships)

*   `Suppliers` to `SupplierItems` (One-to-Many)
*   `Items` to `SupplierItems` (One-to-Many)
*   `RFQs` to `RFQ_Items` (One-to-Many)
*   `RFQs` to `RFQ_Suppliers` (Many-to-Many through linking table)
*   `RFQs` to `SupplierQuotations` (One-to-Many)
*   `Supp
```

---
## File: `docs/hr-audit-log-features.md`
```md
# سجل التدقيق للموظفين: شرح شامل

بناءً على سؤالك، هذا شرح مفصل للبيانات التي يتم تسجيلها تلقائيًا في "سجل التدقيق" الخاص بكل موظف، وهي ميزة مصممة لضمان الشفافية الكاملة وتتبع التغييرات الهامة.

---

### ما هو سجل التدقيق؟

هو سجل تاريخي لا يمكن تعديله، يقوم النظام من خلاله بتوثيق أي تغيير يطرأ على البيانات الحساسة أو الهامة في ملف الموظف. لكل تغيير، يسجل النظام:

*   **الحدث:** ما الذي تغير بالضبط (مثال: "تحديث الراتب الأساسي").
*   **القيمة القديمة:** القيمة التي كانت مسجلة قبل التعديل.
*   **القيمة الجديدة:** القيمة التي تم حفظها بعد التعديل.
*   **المستخدم:** اسم المستخدم الذي قام بإجراء التعديل.
*   **التاريخ:** تاريخ ووقت حدوث التغيير.

### ما هي البيانات التي يتم تتبعها؟

يقوم النظام حاليًا بمراقبة وتسجيل التغييرات التي تتم على الحقول التالية تلقائيًا:

**1. المعلومات الشخصية:**
*   الاسم الكامل (بالعربية)
*   الاسم (بالإنجليزية)
*   الرقم المدني
*   رقم الجوال
*   تاريخ انتهاء الإقامة

**2. المعلومات الوظيفية:**
*   القسم
*   المسمى الوظيفي
*   نوع العقد
*   نسبة العقد (للموظفين بعقود النسبة)

**3. المعلومات المالية:**
*   الراتب الأساسي
*   بدل السكن
*   بدل المواصلات

**4. إجراءات خاصة:**
*   **إنهاء الخدمة:** عند إنهاء خدمة موظف، يتم تسجيل حدث خاص يوضح سبب الإنهاء (استقالة أو إنهاء خدمات).
*   **تجديد الإقامة:** عند دفع رسوم تجديد الإقامة من خلال سند صرف، يتم تسجيل حدث خاص بتحديث تاريخ صلاحية الإقامة.

---

### مثال عملي:

لنفترض أنك قمت بتعديل "الراتب الأساسي" لموظف من 500 إلى 550. سيقوم النظام فورًا بإنشاء سجل تدقيق جديد يقول:

> **الحدث:** تحديث الراتب الأساسي
> **القيمة القديمة:** 500 د.ك
> **القيمة الجديدة:** 550 د.ك
> **المستخدم:** (اسمك)
> **التاريخ:** (التاريخ الحالي)

هذه الميزة تضمن وجود سجل دائم لجميع التعديلات المالية والوظيفية، مما يسهل المراجعات المستقبلية ويزيد من مستوى الرقابة الداخلية.
```

---
## File: `docs/hr-features.md`
```md
# وحدة الموارد البشرية (HR): شرح شامل للمميزات

هذا المستند يوضح جميع المميزات والعمليات في قسم الموارد البشرية، والذي تم تصميمه ليتوافق مع قانون العمل الكويتي ويوفر أدوات شاملة لإدارة فريق عملك.

---

### 1. ملف الموظف المتكامل

*   **المصدر:** `src/app/dashboard/hr/employees/`
*   **الوصف:** سجل شامل لكل موظف يحتوي على جميع بياناته الشخصية، الوظيفية، والمالية.
    *   **البيانات الشخصية:** الاسم، الرقم المدني، تاريخ الميلاد، الجنسية، معلومات الاتصال.
    *   **البيانات الوظيفية:** رقم الموظف، القسم، المسمى الوظيفي، تاريخ التعيين، نوع العقد (دائم، مؤقت، نسبة، بالقطعة، إلخ).
    *   **البيانات المالية:** تفاصيل الراتب (أساسي، بدلات)، معلومات الحساب البنكي.
    *   **الوثائق والتواريخ:** تتبع انتهاء الإقامة والعقد.

### 2. إدارة إنهاء الخدمة وسجل التدقيق

*   **الوصف:** يمكنك إنهاء خدمة موظف مع تحديد السبب (استقالة، إنهاء خدمات). يقوم النظام تلقائيًا بتغيير حالة الموظف وتجميد حسابه.
*   **سجل التدقيق:** يتم تسجيل جميع التغييرات التي تطرأ على ملف الموظف (مثل تعديل الراتب، المسمى الوظيفي، أو الحالة) في سجل تدقيق خاص به للمراجعة المستقبلية.
    > 🔗 **لمعرفة جميع الحقول التي يتم تتبعها بالتفصيل، راجع [ملف شرح سجل التدقيق](hr-audit-log-features.md).**

### 3. نظام الإجازات والاستئذانات

*   **الإجازات (نظام هجين):**
    *   **المصدر:** `src/app/dashboard/hr/leaves/`
    *   **الوصف:** نظام متكامل لتقديم ومتابعة طلبات الإجازات (سنوية، مرضية، طارئة) مع دورة موافقات وتحديث تلقائي لأرصدة الموظفين.
        *   **تحقق من الرصيد:** قبل تقديم طلب الإجازة السنوية، يتحقق النظام تلقائيًا من رصيد الموظف ويمنع التقديم إذا كان الرصيد غير كافٍ.
        *   **نموذج ورقي (PDF):** بعد الموافقة النهائية على الطلب، يمكنك طباعة نموذج إجازة رسمي بتصميم مطابق للنماذج الورقية، جاهز للتوقيع اليدوي من الإدارات المعنية.
*   **الاستئذانات:**
    *   **المصدر:** `src/app/dashboard/hr/permissions/`
    *   **الوصف:** يمكن للموظفين تقديم طلبات استئذان (للتأخير الصباحي أو الخروج المبكر). يمر الطلب بدورة موافقات، وعند الموافقة عليه، يقوم نظام الرواتب **تلقائيًا** بتجاهل أي خصم تأخير لهذا اليوم.

### 4. الحضور والانصراف والرواتب

*   **المصدر:** `src/app/dashboard/hr/payroll/`
*   **الوصف:** وحدة متكاملة لمعالجة رواتب الموظفين من الألف إلى الياء.
    *   **رفع الحضور والانصراف:** يمكنك بسهولة رفع ملف Excel يحتوي على بيانات الحضور والغياب للموظفين عن أي شهر.
    *   **معالجة الرواتب بمرونة:** بضغطة زر، يقوم النظام بمعالجة البيانات وتوليد "مسودة" لكشوف رواتب جميع الموظفين.
        *   **المنطق الذكي:** إذا لم يجد النظام سجل حضور لموظف، سيتحقق من نوع عقده. إذا كان عقده (نسبة، بالقطعة، مقاول باطن)، سيفترض النظام أنه كان حاضرًا ولن يقوم بأي خصم.
        *   **خيار الحضور الكامل:** يمكنك تحديد خيار "تجاهل سجلات الحضور" ليقوم النظام باحتساب حضور كامل لجميع الموظفين، بغض النظر عن ملف الإكسل.
    *   **إدارة ومراجعة الكشوفات:** من تبويب "كشوف الرواتب"، يمكنك عرض جميع الكشوفات التي تم إنشاؤها لشهر معين، مراجعتها، وتغيير حالتها.
    *   **تأكيد الدفع وإنشاء قيد محاسبي:** عند تأكيد دفع الرواتب (تغيير الحالة إلى "مدفوع")، يقوم النظام تلقائيًا بإنشاء قيد محاسبي مُجمّع ومُرحّل لإثبات عملية الصرف في الدفاتر المحاسبية.
    *   **طباعة كشف الراتب (Payslip):** يمكنك طباعة كشف راتب مفصل وواضح لأي موظف، جاهز للتسليم.

### 5. حاسبة مكافأة نهاية الخدمة

*   **المصدر:** `src/app/dashboard/hr/gratuity-calculator/`
*   **الوصف:** أداة دقيقة لحساب مستحقات نهاية الخدمة للموظف.
    *   **حساب تلقائي:** تقوم الحاسبة تلقائيًا بحساب مكافأة نهاية الخدمة وبدل الإجازات بناءً على آخر راتب للموظف، مدة خدمته، وسبب إنهاء الخدمة، وذلك وفقًا لقانون العمل الكويتي.
    *   **شفافية:** توفر تفصيلاً كاملاً لطريقة الحساب، مما يضمن الدقة والشفافية.
```

---
## File: `docs/hr-module-code.md`
```md
# الكود الكامل لوحدة الموارد البشرية (HR)

هذا المستند يحتوي على الشرح الكامل والأكواد المصدرية لجميع الملفات المتعلقة بوحدة الموارد البشرية في النظام.

---

## 1. نظرة عامة على المميزات

هذا ملخص للمميزات الرئيسية في هذه الوحدة، مأخوذ من ملف الشرح `docs/hr-features.md`.

*   **ملف الموظف المتكامل:** سجل شامل لكل موظف يحتوي على جميع بياناته الشخصية، الوظيفية، والمالية.
*   **إدارة إنهاء الخدمة وسجل التدقيق:** يمكنك إنهاء خدمة موظف مع تحديد السبب، ويقوم النظام بتسجيل جميع التغييرات التي تطرأ على ملف الموظف في سجل تدقيق خاص به.
*   **نظام الإجازات والاستئذانات:** نظام متكامل لتقديم ومتابعة طلبات الإجازات (سنوية، مرضية، طارئة) والاستئذانات (تأخير أو خروج مبكر) مع دورة موافقات وقيود ذكية وتحديث تلقائي لأرصدة الموظفين.
*   **الحضور والانصراف والرواتب:** وحدة متكاملة لمعالجة رواتب الموظفين، بدءًا من رفع ملف الحضور، ومعالجة البيانات بذكاء، وإنشاء كشوف الرواتب، وانتهاءً بإنشاء قيد محاسبي تلقائي عند تأكيد الدفع.
*   **حاسبة مكافأة نهاية الخدمة:** أداة دقيقة لحساب مستحقات نهاية الخدمة للموظف وفقًا لقانون العمل الكويتي.

---

## 2. الأكواد المصدرية

فيما يلي الأكواد الكاملة للملفات بالترتيب.

### ملف الموظفين (`src/app/dashboard/hr/employees/page.tsx`)

هذه هي الصفحة الرئيسية لقائمة الموظفين.

```tsx
'use client';
import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { EmployeesTable } from '@/components/hr/employees-table';
import { Input } from '@/components/ui/input';

export default function EmployeesPage() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>إدارة الموظفين</CardTitle>
                        <CardDescription>
                            عرض وتحديث ملفات الموظفين وإدارة حساباتهم.
                        </CardDescription>
                    </div>
                     <Button asChild size="sm" className="gap-1">
                        <Link href="/dashboard/hr/employees/new">
                            <PlusCircle className="h-4 w-4" />
                            إضافة موظف جديد
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between mb-4">
                    <Input
                      placeholder="ابحث بالاسم، الرقم الوظيفي، أو الرقم المدني..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="max-w-sm"
                    />
                </div>
                <EmployeesTable searchQuery={searchQuery} />
            </CardContent>
        </Card>
    );
}
```

### جدول الموظفين (`src/components/hr/employees-table.tsx`)

هذا المكون يعرض قائمة الموظفين مع إمكانية البحث والإجراءات.

```tsx
'use client';
import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2, Edit, Loader2, Calendar } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Employee } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';
import { format, differenceInYears } from 'date-fns';
import { Label } from '@/components/ui/label';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, updateDoc, query, orderBy, collection } from 'firebase/firestore';
import { searchEmployees } from '@/lib/cache/fuse-search';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '../ui/input';
import { DateInput } from '../ui/date-input';


type EmployeeStatus = 'active' | 'on-leave' | 'terminated';

const statusTranslations: Record<EmployeeStatus, string> = {
  active: 'نشط',
  'on-leave': 'في إجازة',
  terminated: 'منتهية خدماته',
};

const statusColors: Record<EmployeeStatus, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  'on-leave': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  terminated: 'bg-red-100 text-red-800 border-red-200',
};

interface EmployeesTableProps {
    searchQuery: string;
}

export function EmployeesTable({ searchQuery }: EmployeesTableProps) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    
    // CHANGED: Default filter is now 'active'
    const [statusFilter, setStatusFilter] = useState('active');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [serviceDurationFilter, setServiceDurationFilter] = useState('all');
    
    const employeesQuery = useMemo(() => {
        if (!firestore) return null;
        return [orderBy('createdAt', 'desc')];
    }, [firestore]);

    const { data: employees, loading, error } = useSubscription<Employee>(firestore, 'employees', employeesQuery || []);

    const [employeeToTerminate, setEmployeeToTerminate] = useState<Employee | null>(null);
    const [isTerminating, setIsTerminating] = useState(false);
    const [terminationReason, setTerminationReason] = useState<'resignation' | 'termination' | null>(null);

    const departmentOptions = useMemo(() => {
        if (!employees) return [];
        const depts = new Set(employees.map(emp => emp.department).filter(Boolean));
        return Array.from(depts);
    }, [employees]);


    const filteredEmployees = useMemo(() => {
        const today = new Date();
        let filtered = employees;

        if (statusFilter !== 'all') {
            filtered = filtered.filter(emp => emp.status === statusFilter);
        }

        if (departmentFilter !== 'all') {
            filtered = filtered.filter(emp => emp.department === departmentFilter);
        }
        
        if (serviceDurationFilter !== 'all') {
            filtered = filtered.filter(emp => {
                const hireDate = toFirestoreDate(emp.hireDate);
                if (!hireDate) return false;

                const yearsOfService = differenceInYears(today, hireDate);

                switch (serviceDurationFilter) {
                    case '1-3':
                        return yearsOfService >= 1 && yearsOfService < 3;
                    case '3-6':
                        return yearsOfService >= 3 && yearsOfService < 6;
                    case '6-10':
                        return yearsOfService >= 6 && yearsOfService < 10;
                    case '10+':
                        return yearsOfService >= 10;
                    default:
                        return true;
                }
            });
        }
        
        return searchEmployees(filtered, searchQuery);
    }, [employees, searchQuery, statusFilter, departmentFilter, serviceDurationFilter]);

    const formatDate = (dateValue: any) => {
        const date = toFirestoreDate(dateValue);
        if (!date) return '-';
        return format(date, 'dd/MM/yyyy');
    };

    const handleTerminateClick = (employee: Employee) => {
        setEmployeeToTerminate(employee);
    };

    const handleTerminationConfirm = async () => {
        if (!employeeToTerminate || !terminationReason || !firestore) {
             toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تحديد سبب إنهاء الخدمة.' });
             return;
        };
        setIsTerminating(true);
        try {
            const employeeRef = doc(firestore, 'employees', employeeToTerminate.id!);
            await updateDoc(employeeRef, {
                status: 'terminated',
                terminationDate: new Date(),
                terminationReason: terminationReason
            });
            toast({ title: 'نجاح', description: 'تم إنهاء خدمة الموظف بنجاح.'});
        } catch (error) {
            console.error("Error terminating employee:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إنهاء خدمة الموظف.' });
        } finally {
            setIsTerminating(false);
            setEmployeeToTerminate(null);
            setTerminationReason(null);
        }
    };

    return (
        <>
            <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                <div className="grid gap-2">
                    <Label htmlFor="status-filter">الحالة</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger id="status-filter" className="w-full sm:w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            {Object.entries(statusTranslations).map(([key, value]) => (
                                <SelectItem key={key} value={key}>{value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="department-filter">القسم</Label>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger id="department-filter" className="w-full sm:w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            {departmentOptions.map(dept => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="service-duration-filter">مدة الخدمة</Label>
                    <Select value={serviceDurationFilter} onValueChange={setServiceDurationFilter}>
                        <SelectTrigger id="service-duration-filter" className="w-full sm:w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            <SelectItem value="1-3">من 1-3 سنوات</SelectItem>
                            <SelectItem value="3-6">من 3-6 سنوات</SelectItem>
                            <SelectItem value="6-10">من 6-10 سنوات</SelectItem>
                            <SelectItem value="10+">أكثر من 10 سنوات</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>الاسم الكامل</TableHead>
                            <TableHead>الرقم الوظيفي</TableHead>
                            <TableHead>القسم</TableHead>
                            <TableHead>تاريخ التعيين</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                        ))}
                        {!loading && filteredEmployees.length === 0 && (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center">
                                {searchQuery ? 'لا توجد نتائج تطابق البحث.' : 'لا يوجد موظفون لعرضهم.'}
                            </TableCell></TableRow>
                        )}
                        {!loading && filteredEmployees.map((employee) => (
                            <TableRow key={employee.id}>
                                <TableCell className="font-medium">
                                    <Link href={`/dashboard/hr/employees/${employee.id}`} className="hover:underline">
                                        {employee.fullName}
                                    </Link>
                                </TableCell>
                                <TableCell className="font-mono">{employee.employeeNumber}</TableCell>
                                <TableCell>{employee.department}</TableCell>
                                <TableCell>{formatDate(employee.hireDate)}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={statusColors[employee.status]}>
                                        {statusTranslations[employee.status]}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Toggle menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" dir="rtl">
                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/dashboard/hr/employees/${employee.id}/edit`}>تعديل</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {employee.status !== 'terminated' && (
                                                <DropdownMenuItem onClick={() => handleTerminateClick(employee)} className="text-destructive focus:text-destructive">إنهاء الخدمة</DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!employeeToTerminate} onOpenChange={() => setEmployeeToTerminate(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد إنهاء الخدمة</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم تغيير حالة الموظف "{employeeToTerminate?.fullName}" إلى "منتهية خدمته" وتجميد حسابه.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="mt-4 space-y-2">
                         <Label>الرجاء تحديد سبب إنهاء الخدمة:</Label>
                         <div className="flex gap-4">
                            <Button variant={terminationReason === 'resignation' ? 'default' : 'outline'} onClick={() => setTerminationReason('resignation')}>استقالة</Button>
                            <Button variant={terminationReason === 'termination' ? 'default' : 'outline'} onClick={() => setTerminationReason('termination')}>إنهاء خدمات</Button>
                        </div>
                    </div>
                    <AlertDialogFooter className='mt-4'>
                        <AlertDialogCancel disabled={isTerminating}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleTerminationConfirm} disabled={!terminationReason || isTerminating} className="bg-destructive hover:bg-destructive/90">
                            {isTerminating ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، قم بالإنهاء'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
```

### ملف الإجازات (`src/app/dashboard/hr/leaves/page.tsx`)

هذه هي الصفحة الرئيسية لطلبات الإجازات.

```tsx
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LeaveRequestsList } from '@/components/hr/leave-requests-list';

export default function LeaveRequestsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة الإجازات</CardTitle>
                <CardDescription>عرض وتقديم وموافقة على طلبات الإجازات للموظفين.</CardDescription>
            </CardHeader>
            <CardContent>
                <LeaveRequestsList />
            </CardContent>
        </Card>
    );
}
```

### ملف الاستئذانات (`src/app/dashboard/hr/permissions/page.tsx`)

هذه هي الصفحة الرئيسية لطلبات الاستئذانات.

```tsx
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PermissionRequestsList } from '@/components/hr/permission-requests-list';

export default function PermissionRequestsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة الاستئذانات</CardTitle>
                <CardDescription>عرض وتقديم وموافقة على طلبات الاستئذان (تأخير أو خروج مبكر).</CardDescription>
            </CardHeader>
            <CardContent>
                <PermissionRequestsList />
            </CardContent>
        </Card>
    );
}
```

### ملف الرواتب (`src/app/dashboard/hr/payroll/page.tsx`)

هذه الصفحة تنظم عملية الرواتب في ثلاث خطوات (تابات).

```tsx
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceUploader } from '@/components/hr/attendance-uploader';
import { PayrollGenerator } from '@/components/hr/payroll-generator';
import { Users2, Sheet, FileSpreadsheet } from 'lucide-react';
import { PayslipsList } from '@/components/hr/payslips-list';

export default function PayrollPage() {
    return (
        <Tabs defaultValue="attendance" dir="rtl">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="attendance">
                    <Users2 className="ml-2 h-4 w-4" />
                    1. رفع الحضور والانصراف
                </TabsTrigger>
                <TabsTrigger value="payroll">
                    <Sheet className="ml-2 h-4 w-4" />
                    2. معالجة الرواتب
                </TabsTrigger>
                 <TabsTrigger value="payslips">
                    <FileSpreadsheet className="ml-2 h-4 w-4" />
                    3. عرض الكشوفات
                </TabsTrigger>
            </TabsList>
            <TabsContent value="attendance" className="mt-4">
                <AttendanceUploader />
            </TabsContent>
            <TabsContent value="payroll" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>معالجة كشوف الرواتب</CardTitle>
                        <CardDescription>
                           توليد كشوف الرواتب الشهرية بناءً على سجلات الحضور والغياب للموظفين.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <PayrollGenerator />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="payslips" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>كشوف الرواتب المُنشأة</CardTitle>
                        <CardDescription>
                           مراجعة وتأكيد دفع كشوف الرواتب التي تم إنشاؤها.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <PayslipsList />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
```

### حاسبة نهاية الخدمة (`src/app/dashboard/hr/gratuity-calculator/page.tsx`)

هذه الصفحة تعرض واجهة حاسبة نهاية الخدمة.

```tsx
'use client';

import { GratuityCalculatorView } from "@/components/hr/gratuity-calculator-view";

export default function GratuityCalculatorPage() {
    return <GratuityCalculatorView />;
}
```

### منطق حساب الإجازات ونهاية الخدمة (`src/services/leave-calculator.ts`)

هذا الملف يحتوي على الدوال الرياضية لحساب أيام العمل، أرصدة الإجازات، ومستحقات نهاية الخدمة وفقاً للقانون.

```ts
import { differenceInDays, eachDayOfInterval, format, differenceInYears, differenceInMonths } from 'date-fns';
import type { Holiday, Employee } from '@/lib/types';
import { toFirestoreDate } from './date-converter';

const dayNameToIndex: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

export function calculateWorkingDays(
  startDate: Date | undefined,
  endDate: Date | undefined,
  weeklyHolidays: string[],
  publicHolidays: Holiday[]
): { totalDays: number, workingDays: number } {
  if (!startDate || !endDate || startDate > endDate) {
    return { totalDays: 0, workingDays: 0 };
  }

  const totalDays = differenceInDays(endDate, startDate) + 1;
  const interval = { start: startDate, end: endDate };
  const allDaysInInterval = eachDayOfInterval(interval);

  const weeklyHolidayIndexes = new Set(weeklyHolidays.map(day => dayNameToIndex[day]));
  const publicHolidayDates = new Set(publicHolidays.map(h => format(toFirestoreDate(h.date)!, 'yyyy-MM-dd')));

  let workingDays = 0;

  for (const day of allDaysInInterval) {
    const dayIndex = day.getDay();
    const dateString = format(day, 'yyyy-MM-dd');
    
    if (!weeklyHolidayIndexes.has(dayIndex) && !publicHolidayDates.has(dateString)) {
      workingDays++;
    }
  }

  return { totalDays, workingDays };
}

export const calculateAnnualLeaveBalance = (employee: Partial<Employee>, asOfDate: Date): number => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return 0;

    // Calculate total months of service
    const totalMonthsOfService = differenceInMonths(asOfDate, hireDate);
    
    // Accrual is 30 days per year, which is 2.5 days per month.
    const totalAccrued = (totalMonthsOfService / 12) * 30;
    
    const usedLeave = employee.annualLeaveUsed || 0;
    const carriedOver = employee.carriedLeaveDays || 0;

    const balance = totalAccrued + carriedOver - usedLeave;

    return Math.floor(balance > 0 ? balance : 0);
};


export const calculateGratuity = (employee: Employee, asOfDate: Date) => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) {
      return { gratuity: 0, leaveBalancePay: 0, total: 0, notice: 'تاريخ التعيين غير صالح.', yearsOfService: 0, lastSalary: 0, leaveBalance: 0, dailyWage: 0 };
    }

    const yearsOfService = differenceInYears(asOfDate, hireDate);
    const lastSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);

    if (lastSalary === 0) {
        return { gratuity: 0, leaveBalancePay: 0, total: 0, notice: 'لم يتم تحديد راتب للموظف.', yearsOfService, lastSalary: 0, leaveBalance: 0, dailyWage: 0 };
    }

    let rawGratuity = 0;
    const dailyWage = lastSalary / 26; // As per common practice for Kuwait law

    // Kuwaiti Private Sector Labor Law No. 6 of 2010, Article 51
    if (yearsOfService <= 5) {
        // 15 days' remuneration for each of the first five years
        rawGratuity = yearsOfService * 15 * dailyWage;
    } else {
        // 15 days for first 5 years + one month's remuneration for each year thereafter.
        const firstFiveYearsGratuity = 5 * 15 * dailyWage;
        const subsequentYears = yearsOfService - 5;
        const subsequentYearsGratuity = subsequentYears * lastSalary;
        rawGratuity = firstFiveYearsGratuity + subsequentYearsGratuity;
    }

    // Cap at 1.5 years salary
    const maxGratuity = 1.5 * 12 * lastSalary;
    rawGratuity = Math.min(rawGratuity, maxGratuity);

    let finalGratuity = rawGratuity;
    let notice = `بناءً على ${yearsOfService.toFixed(1)} سنوات من الخدمة.`;

    if (employee.terminationReason === 'resignation') {
        if (yearsOfService < 3) {
            finalGratuity = 0;
            notice += " (لا يستحق مكافأة لخدمة أقل من 3 سنوات عند الاستقالة)";
        } else if (yearsOfService < 5) {
            finalGratuity = rawGratuity * 0.5;
             notice += " (يستحق نصف المكافأة لخدمة بين 3-5 سنوات عند الاستقالة)";
        } else if (yearsOfService < 10) {
            finalGratuity = rawGratuity * (2 / 3);
            notice += " (يستحق ثلثي المكافأة لخدمة بين 5-10 سنوات عند الاستقالة)";
        }
        // If > 10 years, they get the full amount, so no change needed.
    }

    const leaveBalance = calculateAnnualLeaveBalance(employee, asOfDate);
    const leaveBalancePay = leaveBalance * dailyWage;

    return { 
        gratuity: finalGratuity, 
        leaveBalancePay, 
        total: finalGratuity + leaveBalancePay, 
        notice,
        yearsOfService,
        lastSalary,
        leaveBalance,
        dailyWage,
    };
};
```

---
## File: `docs/multiselect-component-code.md`
```md
# كود مكون الاختيار المتعدد (MultiSelect)

بناءً على طلبك، هذا هو الكود الكامل لمكون الاختيار المتعدد المستخدم في التطبيق.
الملف الأصلي موجود في المسار: `src/components/ui/multi-select.tsx`

```tsx
'use client';

import * as React from 'react';
import Select, { type MultiValue, type StylesConfig } from 'react-select';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({ options, selected, onChange, placeholder = 'اختر...', className, disabled = false }: MultiSelectProps) {
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setPortalTarget(document.body);
    }
  }, []);
  
  const handleChange = (newSelected: MultiValue<MultiSelectOption>) => {
    const values = newSelected ? newSelected.map(opt => opt.value) : [];
    onChange(values);
  };

  const selectedOptions = options.filter(opt => selected.includes(opt.value));
  
  const customStyles: StylesConfig<MultiSelectOption, true> = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'hsl(var(--card))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
      minHeight: '40px',
      boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none',
      '&:hover': {
        borderColor: 'hsl(var(--ring))',
      },
    }),
    placeholder: (base) => ({
        ...base,
        color: 'hsl(var(--muted-foreground))',
    }),
    input: (base) => ({
        ...base,
        color: 'hsl(var(--foreground))',
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'hsl(var(--card))',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? 'hsl(var(--primary))' : state.isFocused ? 'hsl(var(--accent))' : 'transparent',
      color: state.isSelected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
      '&:active': {
        backgroundColor: 'hsl(var(--primary))',
      },
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: 'hsl(var(--secondary))',
      borderRadius: '9999px',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: 'hsl(var(--secondary-foreground))',
      paddingRight: '6px',
      fontSize: '0.875rem'
    }),
    multiValueRemove: (base, state) => ({
      ...base,
      color: 'hsl(var(--secondary-foreground))',
      '&:hover': {
        backgroundColor: 'hsl(var(--destructive) / 0.8)',
        color: 'hsl(var(--destructive-foreground))',
      },
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
    }),
  };

  return (
    <Select
      isMulti
      options={options}
      value={selectedOptions}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn("w-full", className)}
      classNamePrefix="react-select"
      isDisabled={disabled}
      isSearchable={true}
      noOptionsMessage={() => "لا توجد نتائج"}
      styles={customStyles}
      menuPortalTarget={portalTarget}
      menuPosition="fixed"
      menuPlacement="auto"
      theme={(theme) => ({
        ...theme,
        borderRadius: 6,
        colors: {
            ...theme.colors,
            primary: 'hsl(var(--primary))',
            primary75: 'hsl(var(--primary) / 0.75)',
            primary50: 'hsl(var(--primary) / 0.5)',
            primary25: 'hsl(var(--primary) / 0.25)',
            danger: 'hsl(var(--destructive))',
            dangerLight: 'hsl(var(--destructive) / 0.25)',
            neutral0: 'hsl(var(--card))',
            neutral5: 'hsl(var(--border))',
            neutral10: 'hsl(var(--secondary))',
            neutral20: 'hsl(var(--border))',
            neutral30: 'hsl(var(--border))',
            neutral40: 'hsl(var(--muted-foreground))',
            neutral50: 'hsl(var(--muted-foreground))',
            neutral60: 'hsl(var(--foreground))',
            neutral70: 'hsl(var(--foreground))',
            neutral80: 'hsl(var(--foreground))',
            neutral90: 'hsl(var(--foreground))',
        }
      })}
    />
  );
}
```

---
## File: `docs/purchasing-inventory-logic.md`
```md
# منطق عمل وحدة المشتريات والمخازن الذكية

هذا المستند يشرح بالتفصيل منطق العمل لدورة المشتريات الذكية، بدءًا من طلب التسعير وانتهاءً بتوليد القيود المحاسبية.

### 1. دورة المشتريات الذكية

1.  **طلب التسعير (Request for Quotation - RFQ):**
    *   تبدأ الدورة عندما يقوم قسم المشتريات بإنشاء "طلب تسعير" جديد.
    *   يتم في هذا الطلب تحديد الأصناف المطلوبة (بأكوادها الداخلية) والكميات.
    *   يتم اختيار قائمة الموردين المراد إرسال الطلب إليهم.
    *   حالة الطلب تكون "مسودة" ثم "مرسل".

2.  **استقبال عروض أسعار الموردين (Supplier Quotations):**
    *   عند استلام عرض سعر من مورد (بأي صيغة كانت، مثل PDF أو إيميل)، يقوم المستخدم بإدخال بياناته في النظام.
    *   يتم إنشاء "عرض سعر مورد" جديد وربطه بطلب التسعير (RFQ) الأصلي.
    *   هنا تحدث أهم خطوة: **الربط (Mapping)**.

### 2. آلية الربط (Mapping) - قلب النظام

*   **المشكلة:** كل مورد يستخدم أكواد وأسماء مختلفة لنفس الصنف. (مثال: صنف "أسمنت بورتلاندي" الداخلي، قد يكون عند مورد "Cem-X" وعند آخر "PC-42").
*   **الحل:** كيان وسيط اسمه `SupplierItem`.
    *   عند إدخال عرض سعر مورد لأول مرة، إذا كان يحتوي على صنف غير معروف، يطلب النظام من المستخدم ربطه بأحد الأصناف الداخلية.
    *   يتم حفظ هذا الربط في جدول `SupplierItem` مرة واحدة فقط. (مثال: ربط كود "Cem-X" من المورد "أ" بالصنف الداخلي "أسمنت بورتلاندي").
    *   في المرات القادمة، عند رفع عرض سعر من نفس المورد يحتوي على نفس الكود، يتعرف عليه النظام تلقائيًا ويقوم بالربط.

### 3. محرك المفاضلة (Comparison Engine)

*   بعد إغلاق طلب التسعير (RFQ) واستلام العروض، يقوم النظام تلقائيًا بإنشاء **جدول مقارنة (Comparison Matrix)**.
*   يعرض هذا الجدول كل صنف مطلوب في صف، وكل مورد في عمود.
*   **معايير المقارنة:**
    1.  **السعر (Price):** السعر المقدم من كل مورد للصنف.
    2.  **سرعة التوريد (Delivery Speed):** عدد أيام التوريد المذكورة في العرض.
    3.  **تقييم المورد (Vendor Rating):** (سيتم بناء هذا النظام لاحقًا) بناءً على التزامه بمواعيد التوريد وجودة الأصناف السابقة.
    4.  **شروط الدفع (Payment Terms):** (آجل 30 يوم، دفعة مقدمة، ...إلخ).
*   **تمييز الأفضل:** يقوم النظام بتلوين الخلية التي تحتوي على **أفضل عرض لكل صنف** بناءً على أقل سعر (يمكن تطويره لاحقًا ليشمل باقي المعايير).
*   **القرار النهائي:** يمكن لمدير المشتريات اختيار المورد الفائز لكل صنف (قد لا يكون الأرخص دائمًا)، أو اختيار مورد واحد لتوريد جميع الأصناف.

### 4. الأتمتة (Automation)

1.  **أمر الشراء (Purchase Order - PO):**
    *   بعد اعتماد العروض الفائزة، يقوم النظام بإنشاء "أمر شراء" تلقائيًا للمورد المختار، يحتوي على الأصناف والكميات والأسعار المتفق عليها.

2.  **إذن الإضافة المخزني (Goods Receipt Note - GRN):**
    *   عند وصول البضاعة من المورد، يقوم أمين المخزن بفتح أمر الشراء المرتبط وإنشاء "إذن إضافة مخزني".
    *   يسجل الكميات المستلمة فعليًا (قد تختلف عن المطلوب).
    *   عند تأكيد إذن الإضافة، يقوم النظام **تلقائيًا** بزيادة رصيد الأصناف المستلمة في المخزن المحدد.

3.  **القيود المحاسبية الآلية:**
    *   عند تأكيد إذن الإضافة المخزني، يقوم النظام بإنشاء **قيد يومية تلقائي** ومُرحّل:
        *   **مدين:** حـ/ المخزون (بقيمة البضاعة المستلمة).
        *   **دائن:** حـ/ المورد (لإثبات المديونية للمورد).
    *   عند دفع مستحقات المورد لاحقًا عبر "سند صرف"، يتم إغلاق حساب المورد مقابل حساب الصندوق أو البنك.

### 5. حلول OCR المقترحة

*   **الخيار الأول (الأكثر قوة ومرونة):** استخدام مكتبات Python مع نماذج تعلم الآلة.
    *   **المكتبات:** `PyMuPDF` لاستخلاص النصوص والصور من PDF، `OpenCV` للمعالجة الأولية للصور، `Pytesseract` (واجهة لـ Tesseract OCR) لتحويل الصور إلى نص.
    *   **المنطق:** يتم بناء Flow في Genkit يستدعي دالة Python عبر API. هذه الدالة تقوم بقراءة الـ PDF، استخلاص جداول البيانات، ثم استخدام نموذج لغة كبير (مثل Gemini) لفهم سياق الجدول (أين عمود الصنف، الكمية، السعر) وتحويله إلى JSON منظم، مع محاولة ربط الأصناف المستخرجة بجدول `SupplierItem` أو `Items`.
*   **الخيار الثاني (الأسرع للتنفيذ الأولي):** استخدام واجهات برمجة تطبيقات (APIs) جاهزة.
    *   **الخدمات:** Google Cloud Vision AI (Document AI) أو خدمات مشابهة من AWS أو Azure.
    *   **المنطق:** يتم إرسال ملف الـ PDF مباشرة إلى الـ API، والتي تقوم بتحليل المستند وإرجاع بيانات مهيكلة جاهزة. هذا الخيار أسرع في التنفيذ ولكنه قد يكون أعلى تكلفة على المدى الطويل.

**الاقتراح:** البدء بالخيار الثاني (API جاهز) لتقديم الميزة بسرعة، مع التخطيط لبناء الحل المخصص (الخيار الأول) في المستقبل لزيادة الدقة وتقليل التكاليف.
```

---
## File: `docs/purchasing-workflow.md`
```md
# دليل المستخدم: دورة عمل المشتريات من الألف إلى الياء

هذا المستند يشرح بالتفصيل خطوات دورة الشراء الكاملة في النظام، بدءًا من طلب الأسعار وحتى اتخاذ قرار الشراء.

---

### الخطوة 1: إنشاء طلب تسعير (Request for Quotation - RFQ)

هذه هي نقطة البداية لعملية الشراء.

1.  اذهب إلى **المشتريات** من القائمة الجانبية، ثم اختر **طلبات التسعير**.
2.  اضغط على زر **"طلب تسعير جديد"**.
3.  املأ النموذج بالبيانات التالية:
    *   **التاريخ:** تاريخ إنشاء الطلب.
    *   **الموردون:** اختر جميع الموردين الذين ترغب في إرسال الطلب إليهم من القائمة.
    *   **الأصناف المطلوبة:** قم بإضافة الأصناف التي تريد الحصول على أسعار لها، وحدد الكمية المطلوبة لكل صنف.
4.  اضغط على **"حفظ كمسودة"**.

![إنشاء طلب تسعير](https://i.postimg.cc/pX4G7vjQ/step1-rfq-form.png)

---

### الخطوة 2: إدخال عروض أسعار الموردين

بعد أن تستلم عروض الأسعار من الموردين (عبر الإيميل، واتساب، إلخ)، حان وقت إدخالها في النظام.

1.  من قائمة طلبات التسعير، اضغط على رقم الطلب الذي أنشأته. ستنتقل إلى **صفحة تفاصيل طلب التسعير**.
2.  ستجد بطاقة خاصة لكل مورد قمت باختياره. اضغط على زر **"إضافة عرض سعر"** للمورد الذي تريد إدخال عرضه.

![بطاقات الموردين](https://i.postimg.cc/8z0bJp3B/step2-supplier-cards.png)

3.  ستظهر لك نافذة جديدة. قم بتعبئة البيانات:
    *   **مرجع المورد:** رقم عرض السعر الذي أرسله المورد.
    *   **تاريخ العرض:** تاريخ عرض سعر المورد.
    *   **أسعار الأصناف:** أدخل **سعر الوحدة** لكل صنف كما هو مذكور في عرض المورد.
    *   **(اختياري) رفع الملف:** يمكنك رفع ملف الـ PDF الخاص بعرض السعر للتوثيق. (مستقبلاً، سيقوم النظام بقراءته تلقائيًا).
4.  اضغط على **"حفظ عرض السعر"**. كرر هذه العملية لكل الموردين.

![إدخال عرض سعر المورد](https://i.postimg.cc/k4GzZ2gm/step2-5-supplier-quote-form.png)

---

### الخطوة 3: إغلاق الطلب وبدء المقارنة

عندما تنتهي من إدخال جميع العروض، يجب إغلاق الطلب لمنع أي تعديلات إضافية.

1.  في صفحة تفاصيل طلب التسعير، اضغط على زر **"إغلاق الطلب وبدء المقارنة"**.
2.  ستتغير حالة الطلب إلى "مغلق"، وسيظهر زر جديد.

![إغلاق الطلب](https://i.postimg.cc/L51JqYjG/step3-close-rfq.png)

---

### الخطوة 4: المفاضلة واتخاذ القرار

هذه هي الشاشة التي تظهر فيها قوة النظام.

1.  اضغط على زر **"عرض جدول المقارنة"**.
2.  سينقلك النظام إلى جدول يعرض جميع الأصناف في صفوف، وجميع الموردين في أعمدة.
3.  **لاحظ الآتي:**
    *   يعرض الجدول **سعر الوحدة** الذي قدمه كل مورد.
    *   **يتم تظليل أقل سعر لكل صنف تلقائيًا باللون الأخضر.**
    *   في الأسفل، يتم حساب **الإجمالي لكل عرض سعر** لمساعدتك على رؤية الصورة الكاملة.
4.  بناءً على هذه المقارنة، يمكنك اتخاذ قرار الشراء الأفضل.

![جدول المقارنة](https://i.postimg.cc/mD7tBzwG/step4-comparison-table.png)

---

### الخطوة التالية (قيد التنفيذ)

بعد اتخاذ قرارك، ستتمكن مستقبلاً من اختيار العروض الفائزة من جدول المقارنة، وبضغطة زر، سيقوم النظام **تلقائيًا بإنشاء أوامر الشراء (POs)** اللازمة.
```

---
## File: `docs/reference_data_schema.md`
```md
# مخطط علاقات البيانات المرجعية

هذا المستند يوضح الهيكل والعلاقات بين القوائم المرجعية المختلفة في النظام. فهم هذا الهيكل يساعد على معرفة كيفية إدارة البيانات بشكل مركزي ومنظم.

---

## الرسم البياني للعلاقات (ERD)

```mermaid
erDiagram
    departments {
        string id PK
        string name
    }
    jobs {
        string id PK
        string name
        string departmentId FK
    }
    transaction_types {
        string id PK
        string name
        array departmentIds "FKs"
    }
    work_stages {
        string id PK
        string name
        string departmentId FK
    }
    governorates {
        string id PK
        string name
    }
    areas {
        string id PK
        string name
        string governorateId FK
    }
    companies {
        string id PK
        string name
    }

    departments ||--o{ jobs : "يحتوي على"
    departments ||--o{ work_stages : "يحتوي على"
    governorates ||--o{ areas : "يحتوي على"
    transaction_types }o..o| departments : "يرتبط بـ"
```

---

## شرح تفصيلي للعلاقات

ينقسم نظام البيانات المرجعية إلى محاور رئيسية مترابطة، مما يضمن أن تكون البيانات متسقة وسهلة الإدارة.

### 1. محور الأقسام وأنواع المعاملات

تم تعديل الهيكل ليصبح أكثر مرونة. الآن، تعتبر **الأقسام (Departments)** و **أنواع المعاملات (Transaction Types)** كيانات مركزية.

*   **الأقسام (Departments):**
    *   **العلاقة:** علاقة "واحد إلى متعدد" (One-to-Many). كل قسم واحد يحتوي على العديد من الوظائف ومراحل العمل.
    *   **القوائم التابعة:**
        *   **الوظائف (Jobs):** كل وظيفة (مثل "مهندس معماري") تابعة لقسم معين.
        *   **مراحل العمل (Work Stages):** كل مرحلة عمل قياسية (مثل "تسليم المخططات الابتدائية") يتم تعريفها تحت قسم معين.

*   **أنواع المعاملات (Transaction Types):**
    *   **العلاقة:** علاقة "متعدد إلى متعدد" (Many-to-Many) مع الأقسام. كل "نوع معاملة" (مثل "تصميم بلدية") يمكن أن يرتبط بقائمة من الأقسام المشاركة فيه.
    *   **مركزية الإدارة:**
        *   تتم إدارة الأقسام والوظائف ومراحل العمل من شاشة "إدارة الأقسام".
        *   تتم إدارة أنواع المعاملات وربطها بالأقسام من شاشة مستقلة خاصة بها.

### 2. محور المواقع الجغرافية (Locations Hub)

هذا المحور يتبع نفس منطق الأقسام ولكن على المستوى الجغرافي.

*   **العلاقة:** علاقة "واحد إلى متعدد" (One-to-Many).
*   **القائمة الرئيسية:** **المحافظات (Governorates)**.
*   **القائمة التابعة:** **المناطق (Areas)**. كل منطقة يتم تعريفها تحت محافظة معينة. لا يمكن إضافة منطقة بدون ربطها بمحافظة.

### 3. القوائم المستقلة (Standalone Lists)

*   **الشركات (Companies):** هذه القائمة حاليًا مستقلة ولا تتبع أي قائمة أخرى. تُستخدم لإدارة بيانات الشركة أو فروعها التي قد يتم استخدامها لاحقًا في طباعة العقود أو التقارير.
```

---
## File: `docs/reports-logic.md`
```md
# شرح منطق عمل التقارير

هذا المستند يشرح بالتفصيل كيف تعمل التقارير الموجودة في لوحة معلومات "تقارير سير العمل".

---

### 1. تقرير المهام المتأخرة

*   **الغرض:** تحديد الاختناقات والمشاكل في المشاريع بسرعة.
*   **كيف يعمل:**
    1.  يبحث النظام عن جميع مراحل العمل (`TransactionStage`) في كل المعاملات.
    2.  يقوم بفلترة المراحل التي حالتها **"قيد التنفيذ" (`in-progress`)**.
    3.  لكل مرحلة، يتحقق إذا كان لديها تاريخ انتهاء متوقع (`expectedEndDate`).
    4.  يقارن التاريخ الحالي بتاريخ الانتهاء المتوقع. إذا كان التاريخ الحالي قد تجاوز التاريخ المتوقع، تعتبر المرحلة "متأخرة".
    5.  يتم ترتيب النتائج لإظهار المراحل الأكثر تأخراً أولاً.

---

### 2. تقرير المراحل الخاملة

*   **الغرض:** اكتشاف المشاريع أو المهام التي تم تجاهلها أو توقفت دون سبب واضح.
*   **كيف يعمل:**
    1.  يبحث النظام عن جميع مراحل العمل التي حالتها **"قيد التنفيذ" (`in-progress`)**.
    2.  لكل مرحلة، يتحقق من تاريخ بدئها (`startDate`).
    3.  يقارن التاريخ الحالي بتاريخ البدء. إذا كانت المدة الزمنية **أكثر من 14 يومًا**، تعتبر المرحلة "خاملة".
    4.  يتم ترتيب النتائج لإظهار المراحل الأكثر خمولاً أولاً.

---

### 3. تقرير العملاء المحتملون

ينقسم هذا التقرير إلى قسمين:

#### أ. لم يحضروا (No-Shows)

*   **الغرض:** متابعة العملاء الذين حجزوا موعدًا ولم يحضروا.
*   **كيف يعمل:**
    1.  يبحث النظام عن جميع المواعيد المعمارية التي مضى تاريخها.
    2.  يُبقي فقط على المواعيد الخاصة بالعملاء غير المسجلين (الذين لديهم اسم ورقم جوال فقط).
    3.  يتحقق مما إذا كان قد تم اتخاذ أي إجراء بخصوص الزيارة (`workStageUpdated` تكون `false`) وأن الموعد لم يتم إلغاؤه (`status` ليس `cancelled`).
    4.  يجمع العملاء حسب رقم الجوال ويعرضهم في قائمة.

#### ب. بحاجة لمتابعة

*   **الغرض:** متابعة العملاء الذين أبدوا اهتمامًا جديًا وتوقفوا قبل توقيع العقد.
*   **كيف يعمل:**
    1.  يبحث النظام عن جميع العملاء الذين حالتهم لا تزال "جديد".
    2.  يتحقق إذا كان لدى العميل أي معاملة اكتملت فيها مرحلة "استفسارات عامة".
    3.  إذا تحقق الشرط، يتم عرض العميل في هذه القائمة كفرصة يجب متابعتها.

---

### 4. تقرير فرص البيع الإضافي (Upsell)

*   **الغرض:** زيادة الإيرادات من العملاء الحاليين عن طريق تحديد الخدمات التي لم يشتروها بعد.
*   **كيف يعمل:**
    1.  **تحديد المحفز (Trigger):** يبحث النظام عن جميع العملاء الذين لديهم معاملة رئيسية مكتملة. حاليًا، يتم تحديد هذه المعاملة إذا كان اسمها يحتوي على كلمة **"بلدية"** أو **"رخصة بناء"**.
    2.  **تحديد الخدمات المتوقعة:** يقوم النظام بتعريف قائمة بالخدمات الهندسية التي يتوقع أن يطلبها العميل بعد ذلك، وهي حاليًا: **"كهرباء"**، **"ميكانيك"**، **"واجهات"**، **"انشائي"**، **"صحي"**، **"اشراف"**.
    3.  **التحليل والمقارنة:** لكل عميل أكمل المعاملة المحفزة، يتحقق النظام من قائمة معاملاته الأخرى.
    4.  **عرض الفرصة:** إذا وجد النظام أن العميل لم يبدأ أي معاملة تحتوي على أي من الكلمات المفتاحية للخدمات المتوقعة، يتم إضافته إلى هذا التقرير مع قائمة بالخدمات الناقصة.
    5.  **المرونة:** تم تصميم هذا المنطق ليكون مرنًا. في المستقبل، يمكننا بسهولة تعديل قوائم الكلمات المفتاحية (سواء للمحفزات أو للخدمات المتوقعة) لتتناسب مع أي تغييرات في إجراءات عملك.

---
### 5. منطق مراكز الربحية والتكلفة (Profit & Cost Centers)

**نعم، النظام مبني بالكامل على مفهوم مراكز الربحية والتكلفة.**

*   **ما هو مركز الربحية؟** في نظامنا، كل **معاملة (مشروع)** تعتبر تلقائيًا **مركز ربحية مستقل**.

*   **كيف يعمل تلقائيًا؟**
    1.  **تتبع الإيرادات:** عند إنشاء أي **سند قبض** مرتبط بمعاملة، يقوم النظام بربط الإيراد مباشرة بمركز الربحية (المشروع).
    2.  **تتبع التكاليف المباشرة:** عند إنشاء **سند صرف** أو **قيد يومية** واختيار حساب من "تكلفة الإيرادات" (مثل أتعاب مقاول باطن، رسوم تراخيص)، وربطه بمعاملة، يقوم النظام بربط المصروف مباشرة بمركز الربحية (المشروع).
    3.  **التحليل على مستوى السطر:** الأهم من ذلك، أن هذا الربط يتم **على مستوى كل سطر محاسبي** داخل القيد. هذا يعني أنه لو كان لديك قيد واحد يحتوي على مصاريف تخص 3 مشاريع مختلفة، سيقوم النظام بتوزيع تكلفة كل سطر على المشروع الصحيح.

*   **أين تظهر النتائج؟**
    *   تظهر نتائج هذا التحليل الدقيق في صفحة **[التقارير التحليلية](/dashboard/accounting/reports)**، حيث يمكنك رؤية:
        *   **ربحية كل مشروع:** الإيرادات مقابل التكاليف المباشرة.
        *   **إنتاجية كل مهندس:** بناءً على المشاريع التي يشرف عليها.
        *   **أداء كل قسم.**

```

---
## File: `docs/system_overview_concise_ar.md`
```md
# نظرة عامة مختصرة على النظام

هذا ملخص سريع للعلاقات الأساسية بين أقسام النظام المختلفة.

*   **العملاء والمعاملات (القلب):**
    *   كل شيء يبدأ من **العميل**.
    *   لكل عميل، يمكن فتح عدة **"معاملات"** (مثل تصميم بلدية, تصميم كهرباء).
    *   كل معاملة لها **سير عمل** (مراحل) و **عقد مالي** خاص بها.

*   **المحاسبة والعقود:**
    *   عند إنشاء **عقد** لمعاملة، يقوم النظام تلقائيًا بتسجيل **قيد محاسبي** لإثبات الدين.
    *   عند تسجيل **سند قبض**، يتم تحديث سجلات المشروع والعميل تلقائيًا.

*   **المواعيد وسير العمل:**
    *   عند تحديث **مرحلة عمل** في تفاصيل زيارة العميل، يقوم النظام بتحديث حالة المعاملة المرتبطة.
    *   **الأهم:** إذا كانت هذه المرحلة مرتبطة بدفعة مالية في العقد، يقوم النظام **تلقائيًا** بتغيير حالة الدفعة إلى "مستحقة".

*   **الموارد البشرية والرواتب:**
    *   يتم إنشاء كشوف الرواتب بناءً على بيانات الحضور والغياب.
    *   عند **تأكيد دفع الرواتب**، يتم إنشاء **قيد محاسبي** تلقائي لإثبات المصروف في المحاسبة.

*   **الذكاء الاصطناعي:**
    *   **المساعد المحاسبي:** يفهم الأوامر باللغة العربية ويحولها إلى قيود يومية.
    *   **المساعد الذكي للنظام:** يجيب على أسئلتك حول كيفية استخدام النظام، ويمكنه البحث عن بيانات حية.

```

---
## File: `docs/system_relationships_ar.md`
```md
# شرح العلاقات بين أقسام النظام

هذا المستند يشرح بالتفصيل كيف تترابط وتتكامل الأقسام المختلفة في النظام لضمان سير عمل سلس وآلي.

### 1. العملاء والمعاملات (قلب النظام)
*   **العميل هو المحور:** كل شيء يبدأ من ملف العميل.
*   **المعاملات كخدمات:** كل خدمة تقدمها للعميل (مثل "تصميم بلدية"، "إشراف على التنفيذ") يتم تسجيلها كـ "معاملة" منفصلة تحت ملف العميل. هذا يسمح بتتبع كل خدمة على حدة.
*   **لكل معاملة كيانها الخاص:** كل معاملة تحتوي على سير العمل الخاص بها (المراحل)، وعقدها المالي، وفريق عملها.

### 2. المحاسبة والعقود (التكامل المالي)
*   **من العقد إلى القيد:** عند إنشاء عقد وتحديد دفعاته المالية لمعاملة ما، يقوم النظام **تلقائيًا** بإنشاء قيد يومية محاسبي لإثبات قيمة العقد كمديونية على العميل.
*   **من سند القبض إلى سجلات المشروع:** عند تسجيل "سند قبض" لدفعة من العميل وربطها بالمعاملة الصحيحة، يقوم النظام **تلقائيًا** بتحديث حالة الدفعة في العقد، وإضافة تعليق في سجل المعاملة ليراه المهندس المسؤول.

### 3. المواعيد وسير العمل (ربط الإجراءات بالماليات)
*   **الزيارة كأداة تنفيذ:** صفحة "تفاصيل الزيارة" ليست مجرد موعد، بل هي أداة لتنفيذ إجراءات العمل.
*   **تحديث المرحلة يفعّل الدفعات:** عندما يقوم المهندس بتحديث "مرحلة العمل" خلال زيارة العميل (مثال: تم تسليم المخططات الابتدائية)، يقوم النظام بالتحقق من العقد. إذا كانت هذه المرحلة مرتبطة باستحقاق دفعة مالية، يتم **تلقائيًا** تغيير حالة الدفعة من "غير مستحقة" إلى "مستحقة"، مما يظهر كدين جديد على العميل في قسم المحاسبة.

### 4. الموارد البشرية والرواتب (التأثير المحاسبي)
*   **من الحضور إلى مسير الرواتب:** يتم إنشاء كشوف الرواتب الشهرية بناءً على بيانات الحضور والغياب التي يتم رفعها للنظام.
*   **من تأكيد الدفع إلى قيد المصروف:** عند تأكيد دفع رواتب شهر معين من وحدة الموارد البشرية، يقوم النظام **تلقائيًا** بإنشاء قيد محاسبي مُرحّل لإثبات مصروف الرواتب في قسم المحاسبة، مما يضمن تطابق البيانات المالية مع عمليات الموارد البشرية.

### 5. الذكاء الاصطناعي (المساعد الذكي)
*   **المساعد المحاسبي:** يفهم الأوامر المحاسبية باللغة العربية العامية أو الفصحى (مثل "سجل فاتورة كهرباء بـ 50 دينار") ويقوم بتحويلها إلى قيد يومية جاهز للحفظ.
*   **المساعد الذكي للنظام:** يجيب على أسئلتك حول كيفية استخدام أي جزء من النظام، ويمكنه البحث عن بيانات حية (مثل "كم مديونية العميل محمد؟") أو توجيهك إلى الصفحات الصحيحة مباشرة.

```
