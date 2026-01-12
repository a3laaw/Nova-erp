
'use client';
import type { Project, EngineeringDiscipline } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';
import { CheckCircle, CircleDashed, Loader } from 'lucide-react';
import { useLanguage } from '@/context/language-context';

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
  const { language } = useLanguage();
  const t = (language === 'ar') ?
    { title: 'التخصصات الهندسية', description: 'حالة جميع مسارات العمل الهندسي لهذا المشروع.' } :
    { title: 'Engineering Disciplines', description: 'Status of all engineering work streams for this project.' };

  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {project.disciplines.map((discipline) => (
            <AccordionItem value={discipline.name[language]} key={discipline.name[language]}>
              <AccordionTrigger>
                <div className='flex items-center w-full gap-4 pr-4'>
                    <span className='font-semibold text-base flex-shrink-0 w-32 text-left'>{discipline.name[language]}</span>
                    <Progress value={getDisciplineProgress(discipline)} className='flex-grow h-2' />
                    <span className='text-sm text-muted-foreground'>{Math.round(getDisciplineProgress(discipline))}%</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className='space-y-3 pl-4 pt-2'>
                    {discipline.stages.map(stage => (
                        <li key={stage.name[language]} className='flex items-center gap-3 text-sm'>
                            {statusIcons[stage.status]}
                            <span className={cn(
                                stage.status === 'Completed' && 'line-through text-muted-foreground'
                            )}>{stage.name[language]}</span>
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
