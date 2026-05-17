'use client';

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

/**
 * خطأ صلاحيات Firestore المخصص:
 * يوفر سياقاً غنياً للمطور عند حدوث رفض من القواعد الأمنية.
 */
export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
{
  "operation": "${context.operation}",
  "path": "${context.path}",
  "data": ${JSON.stringify(context.requestResourceData || {}, null, 2)}
}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
  }
}
