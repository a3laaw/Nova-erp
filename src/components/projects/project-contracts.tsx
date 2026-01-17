
'use client';
import type { Project } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { contracts } from '@/lib/data';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Check } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { format } from 'date-fns';

export function ProjectContracts({ project }: { project: Project }) {
  const { language } = useLanguage();
  const contract = contracts.find(c => c.id === project.contractId);
  
  const t = (language === 'ar') ? 
    { noContract: 'لم يتم العثور على عقد', noContractDesc: 'لم يتم ربط عقد بهذا المشروع بعد.', create: 'إنشاء عقد', milestones: 'دفعات العقد', due: 'تاريخ الاستحقاق', markCompleted: 'تحديد كمكتمل', contracts: 'العقود' } : 
    { noContract: 'No Contract Found', noContractDesc: 'A contract has not been linked to this project yet.', create: 'Create Contract', milestones: 'Payment Milestones', due: 'Due', markCompleted: 'Mark as Completed', contracts: 'Contracts' };


  if (!contract) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t.contracts}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center py-12">
                    <h3 className="text-lg font-semibold">{t.noContract}</h3>
                    <p className="text-muted-foreground mt-2">{t.noContractDesc}</p>
                    <Button className='mt-4'>{t.create}</Button>
                </div>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>{contract.title[language]}</CardTitle>
                <CardDescription>Total Value: {formatCurrency(contract.totalAmount)}</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <h4 className='font-semibold mb-4'>{t.milestones}</h4>
        <ul className='space-y-4'>
            {contract.milestones.map(milestone => (
                <li key={milestone.id} className='flex items-center justify-between p-4 rounded-lg border bg-card'>
                    <div>
                        <p className='font-medium'>{milestone.name[language]} ({milestone.percentage}%)</p>
                        <p className='text-sm text-muted-foreground'>{t.due}: {format(new Date(milestone.dueDate), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className='flex items-center gap-4'>
                        <Badge variant={milestone.status === 'Completed' ? 'default' : 'secondary'}>{milestone.status}</Badge>
                        {milestone.status === 'Pending' && (
                            <Button size="sm">
                                <Check className='mr-2 h-4 w-4' /> {t.markCompleted}
                            </Button>
                        )}
                    </div>
                </li>
            ))}
        </ul>
      </CardContent>
    </Card>
  );
}
