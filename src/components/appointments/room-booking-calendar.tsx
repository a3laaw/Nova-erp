'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// This is a placeholder component.
// The original conflicting content has been removed to allow the main appointments view to work correctly.

export default function RoomBookingCalendar() {
  return (
    <Card className="h-[500px] flex items-center justify-center border-dashed border-2 rounded-3xl bg-gray-50">
      <div className="text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-400">جدول حجوزات القاعات</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">هذا المكون قيد التطوير حالياً.</p>
        </CardContent>
      </div>
    </Card>
  );
}
