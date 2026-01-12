
'use client';
import type { Project } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle, Milestone, MessageSquare, Construction, Plus } from 'lucide-react';
import { DelayReportGenerator } from './delay-report-generator';
import { useLanguage } from '@/context/language-context';

const eventIcons = {
  Milestone: <Milestone className="h-5 w-5 text-purple-500" />,
  Visit: <CheckCircle className="h-5 w-5 text-blue-500" />,
  Task: <Construction className="h-5 w-5 text-orange-500" />,
  Report: <MessageSquare className="h-5 w-5 text-green-500" />,
};

export function ProjectTimeline({ project }: { project: Project }) {
  const { language } = useLanguage();
  const sortedTimeline = [...project.timeline].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const t = (language === 'ar') ? 
    { title: 'الجدول الزمني للمشروع', description: 'سجل زمني لجميع أنشطة المشروع.', add: 'إضافة حدث' } : 
    { title: 'Project Timeline', description: 'A chronological log of all project activities.', add: 'Add Event' };

  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>{t.description}</CardDescription>
            </div>
            <div className='flex gap-2'>
                <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> {t.add}</Button>
                <DelayReportGenerator project={project} />
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6">
          <div className="absolute left-[35px] top-0 h-full w-0.5 bg-border -translate-x-1/2"></div>
          {sortedTimeline.map((event, index) => (
            <div key={event.id} className="relative mb-8 flex items-start">
              <div className="absolute left-0 top-0 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-card ring-8 ring-card -translate-x-[calc(50%+1.5rem)]">
                <div className='p-2 rounded-full bg-muted'>
                    {eventIcons[event.type]}
                </div>
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{event.title[language]}</p>
                  <time className="text-sm text-muted-foreground">{new Date(event.date).toLocaleDateString()}</time>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{event.description[language]}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
