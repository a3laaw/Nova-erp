'use client';
import type { Project } from '@/lib/types';
import { Button } from '../ui/button';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function DelayReportGenerator({ project }: { project: Project }) {
  const { toast } = useToast();

  const handleInfo = () => {
    toast({
        title: "ميزة غير متاحة",
        description: "تقارير التأخير الذكية متوقفة حالياً. يرجى مراجعة التقرير اليدوي في لوحة التقارير.",
    });
  };

  return (
    <Button variant="outline" onClick={handleInfo} className="text-muted-foreground opacity-50">
      <AlertTriangle className="mr-2 h-4 w-4" />
      تقرير التأخير (غير مفعل)
    </Button>
  );
}
