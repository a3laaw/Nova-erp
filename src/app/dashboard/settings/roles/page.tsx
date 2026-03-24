'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RolesTable } from '@/components/settings/roles-table';

export default function RolesSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>إدارة الأدوار والصلاحيات</CardTitle>
        <CardDescription>
          تعريف أنواع الأنشطة (الأدوار) وتخصيص صلاحيات كل دور داخل الشركة.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RolesTable />
      </CardContent>
    </Card>
  );
}
