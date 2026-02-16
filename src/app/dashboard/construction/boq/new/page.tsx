'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BoqForm } from '@/components/construction/boq/boq-form';

export default function NewBoqPage() {
    return (
        <div className="container mx-auto py-8">
            <BoqForm />
        </div>
    );
}
