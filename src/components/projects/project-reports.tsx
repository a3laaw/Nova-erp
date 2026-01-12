
'use client';
import type { Project } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Plus } from 'lucide-react';
import { useLanguage } from '@/context/language-context';


export function ProjectReports({ project }: { project: Project }) {
  const { language } = useLanguage();
  const t = (language === 'ar') ?
    { title: 'تقارير التقدم اليومية', description: 'تحديثات يومية من موقع المشروع.', submit: 'إرسال تقرير', noReports: 'لا توجد تقارير بعد', noReportsDesc: 'لم يتم إرسال التقرير اليومي الأول لهذا المشروع.' } :
    { title: 'Daily Progress Reports', description: 'Daily updates from the project site.', submit: 'Submit Report', noReports: 'No Reports Yet', noReportsDesc: 'The first daily report for this project has not been submitted.' };


  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>{t.description}</CardDescription>
            </div>
            <Button><Plus className="mr-2 h-4 w-4" /> {t.submit}</Button>
        </div>
      </CardHeader>
      <CardContent>
        {project.reports.length > 0 ? (
          <div className="space-y-4">
            {/* List of reports would go here */}
            <p className="text-muted-foreground">Displaying {project.reports.length} reports.</p>
          </div>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold">{t.noReports}</h3>
            <p className="text-muted-foreground mt-2">{t.noReportsDesc}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
