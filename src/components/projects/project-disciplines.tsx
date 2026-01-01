import type { Project, EngineeringDiscipline } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';
import { CheckCircle, CircleDashed, Loader } from 'lucide-react';

const statusIcons = {
  Completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  'In Progress': <Loader className="h-4 w-4 animate-spin text-blue-500" />,
  Pending: <CircleDashed className="h-4 w-4 text-gray-400" />,
};

const getDisciplineProgress = (discipline: EngineeringDiscipline) => {
    const completed = discipline.stages.filter(s => s.status === 'Completed').length;
    return (completed / discipline.stages.length) * 100;
}

export function ProjectDisciplines({ project }: { project: Project }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engineering Disciplines</CardTitle>
        <CardDescription>Status of all engineering work streams for this project.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {project.disciplines.map((discipline) => (
            <AccordionItem value={discipline.name} key={discipline.name}>
              <AccordionTrigger>
                <div className='flex items-center w-full gap-4 pr-4'>
                    <span className='font-semibold text-base flex-shrink-0 w-32 text-left'>{discipline.name}</span>
                    <Progress value={getDisciplineProgress(discipline)} className='flex-grow h-2' />
                    <span className='text-sm text-muted-foreground'>{Math.round(getDisciplineProgress(discipline))}%</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className='space-y-3 pl-4 pt-2'>
                    {discipline.stages.map(stage => (
                        <li key={stage.name} className='flex items-center gap-3 text-sm'>
                            {statusIcons[stage.status]}
                            <span className={cn(
                                stage.status === 'Completed' && 'line-through text-muted-foreground'
                            )}>{stage.name}</span>
                        </li>
                    ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
