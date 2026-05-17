'use client';

import { EventEmitter } from 'events';
import { FirestorePermissionError } from './errors';

/**
 * باعث الأخطاء العالمي:
 * قناة مركزية لنقل أخطاء الصلاحيات من العمليات الخلفية إلى واجهة المستخدم.
 */
class ErrorEmitter extends EventEmitter {
  emit(event: 'permission-error', error: FirestorePermissionError): boolean {
    return super.emit(event, error);
  }

  on(event: 'permission-error', listener: (error: FirestorePermissionError) => void): this {
    return super.on(event, listener);
  }
}

export const errorEmitter = new ErrorEmitter();
