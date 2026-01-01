import type { Project } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { contracts } from '@/lib/data';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Check } from 'lucide-react';

export function ProjectContracts({ project }: { project: Project }) {
  const contract = contracts.find(c => c.id === project.contractId);

  if (!contract) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Contracts & Payments</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-center py-12">
                    <h3 className="text-lg font-semibold">No Contract Found</h3>
                    <p className="text-muted-foreground mt-2">A contract has not been linked to this project yet.</p>
                    <Button className='mt-4'>Create Contract</Button>
                </div>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>{contract.title}</CardTitle>
                <CardDescription>Total Value: {formatCurrency(contract.totalAmount)}</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <h4 className='font-semibold mb-4'>Payment Milestones</h4>
        <ul className='space-y-4'>
            {contract.milestones.map(milestone => (
                <li key={milestone.id} className='flex items-center justify-between p-4 rounded-lg border bg-card'>
                    <div>
                        <p className='font-medium'>{milestone.name} ({milestone.percentage}%)</p>
                        <p className='text-sm text-muted-foreground'>Due: {new Date(milestone.dueDate).toLocaleDateString()}</p>
                    </div>
                    <div className='flex items-center gap-4'>
                        <Badge variant={milestone.status === 'Completed' ? 'default' : 'secondary'}>{milestone.status}</Badge>
                        {milestone.status === 'Pending' && (
                            <Button size="sm">
                                <Check className='mr-2 h-4 w-4' /> Mark as Completed
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
