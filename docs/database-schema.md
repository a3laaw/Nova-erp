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
*   `Suppliers` to `SupplierQuotations` (One-to-Many)
*   `SupplierQuotations` to `Quotation_Items` (One-to-Many)
