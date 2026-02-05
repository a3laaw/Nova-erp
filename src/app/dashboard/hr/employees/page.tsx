
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmployeesTable } from '@/components/hr/employees-table';

export default function EmployeesPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>إدارة الموظفين</CardTitle>
                        <CardDescription>
                        عرض وإدارة جميع الموظفين في الشركة.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <EmployeesTable />
            </CardContent>
        </Card>
    );
}

    