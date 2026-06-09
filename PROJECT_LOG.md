## 2026-06-09: توحيد منظومة العملاء وترقيم الملفات

**المشكلة:** كان النظام يعتمد على جدولين منفصلين (`leads` للعملاء المحتملين و `clients` للمسجلين)، مما أدى إلى مشاكل جوهرية:
1.  صعوبة في توحيد ترقيم ملفات العملاء.
2.  عدم ظهور العميل الجديد (من شاشة المواعيد) في قائمة "المحتملون" لأنه كان يفتقر لرقم ملف وحالة واضحة.
3.  تعقيد في عملية "نقل" العميل من محتمل إلى مسجل.

**الإجراء:** بناءً على ملاحظات دقيقة، تم إعادة بناء منطق إدارة العملاء بالكامل ليعتمد على مصدر حقيقة واحد.

**الإصلاح (Fix):**
1.  **إلغاء جدول `leads`:** تم التخلي تمامًا عن فكرة وجود جدول منفصل للعملاء المحتملين.
2.  **توحيد العملاء في جدول `clients`:** أصبح جدول `clients` هو المستودع الوحيد لجميع العملاء، بغض النظر عن حالتهم.
3.  **إضافة حقل الحالة `status`:** تم إضافة حقل `status` لتمييز حالة العميل (`prospective`، `active`، `inactive`).
4.  **تعديل شاشة المواعيد:** تم تعديل منطق إنشاء عميل جديد في `src/components/appointments/architectural-appointments-view.tsx` ليقوم بالآتي:
    *   **توليد رقم موحد:** سحب رقم ملف متسلسل من العدّاد الرئيسي `counters/clientFiles`.
    *   **الإنشاء المباشر:** إنشاء سجل للعميل في جدول `clients` مع `status: 'prospective'`.
    *   **التوثيق:** إضافة سجل تدقيق (audit log) داخل سجل العميل الجديد يوثق عملية الإنشاء ومصدرها.

**النتيجة:**
أصبح لكل عميل، منذ أول لحظة لدخوله النظام، **رقم ملف واحد وموحد ودائم**. أصبحت عملية تحويله من "محتمل" إلى "مسجل" مجرد تغيير في حالته (`status`)، مما يضمن تكامل البيانات وسهولة إدارتها ونقلها بين القوائم (طرق العرض) المختلفة. تم حل المشكلة الأصلية بشكل جذري.

---

## 2026-06-08: WBS Editor UI Fix

**Action:** User pointed out a UI bug in the WBS Editor where the list of items overflows the modal instead of scrolling.

**Diagnosis:** The flex container for the list didn't have a minimum height set, causing it to grow with its content instead of constraining it.

**Fix:** Added `min-h-0` to the `div` with class `col-span-7` in `src/components/settings/wbs-editor.tsx` to correctly enforce flexbox height constraints, enabling the child `ScrollArea` to function as intended.

**Next Step:** User to verify the fix.
ALAA - DONE
