
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { projects, clients, users } from '@/lib/data';
import Image from 'next/image';
import { notFound, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProjectStatus } from '@/lib/types';
import { Calendar, User, Users as ClientsIcon, BadgeDollarSign, ArrowRight } from 'lucide-react';
import { ProjectTimeline } from '@/components/projects/project-timeline';
import { ProjectDisciplines } from '@/components/projects/project-disciplines';
import { ProjectReports } from '@/components/projects/project-reports';
import { ProjectContracts } from '@/components/projects/project-contracts';
import { ProjectFiles } from '@/components/projects/project-files';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { format } from 'date-fns';

const statusStyles: Record<ProjectStatus, string> = {
    'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
    'Planning': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Completed': 'bg-green-100 text-green-800 border-green-200',
    'On Hold': 'bg-gray-100 text-gray-800 border-gray-200',
    'Cancelled': 'bg-red-100 text-red-800 border-red-200',
};

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { language } = useLanguage();
  const project = projects.find(p => p.id === params.id);

  if (!project) {
    notFound();
  }

  const client = clients.find(c => c.id === project.clientId);
  const leadEngineer = users.find(u => u.id === project.leadEngineerId);
  
  const t = (language === 'ar') ? 
    { back: 'العودة إلى المشاريع', client: 'العميل', lead: 'المهندس المسؤول', timeline: 'الجدول الزمني', contract: 'عرض العقد', disciplines: 'التخصصات', reports: 'التقارير اليومية', contracts: 'العقود', files: 'الملفات' } : 
    { back: 'Back to Projects', client: 'Client', lead: 'Lead Engineer', timeline: 'Timeline', contract: 'View Contract', disciplines: 'Disciplines', reports: 'Daily Reports', contracts: 'Contracts', files: 'Files' };


  return (
    <div className="grid gap-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <Button variant="outline" onClick={() => router.push('/dashboard/projects')} className='w-fit'>
            <ArrowRight className="ml-2 h-4 w-4" />
            {t.back}
        </Button>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 md:gap-8">
            <Image
              src={project.imageUrl}
              alt={project.name[language]}
              width={250}
              height={160}
              className="rounded-lg object-cover"
              data-ai-hint={project.imageHint}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-3xl font-headline">{project.name[language]}</CardTitle>
                <Badge variant="outline" className={cn("text-sm", statusStyles[project.status])}>
                  {project.status}
                </Badge>
              </div>
              <CardDescription className="mt-2 text-base">{project.description[language]}</CardDescription>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ClientsIcon className="h-4 w-4" />
                  <span><strong>{t.client}:</strong> {client?.name[language]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span><strong>{t.lead}:</strong> {leadEngineer?.fullName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span><strong>{t.timeline}:</strong> {format(new Date(project.startDate), 'dd/MM/yyyy')} - {format(new Date(project.endDate), 'dd/MM/yyyy')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeDollarSign className="h-4 w-4" />
                  <span><strong>{t.contracts}:</strong> <a href="#" className="text-primary hover:underline">{t.contract}</a></span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5">
          <TabsTrigger value="timeline">{t.timeline}</TabsTrigger>
          <TabsTrigger value="disciplines">{t.disciplines}</TabsTrigger>
          <TabsTrigger value="reports">{t.reports}</TabsTrigger>
          <TabsTrigger value="contracts">{t.contracts}</TabsTrigger>
          <TabsTrigger value="files">{t.files}</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline">
          <ProjectTimeline project={project} />
        </TabsContent>
        <TabsContent value="disciplines">
            <ProjectDisciplines project={project} />
        </TabsContent>
        <TabsContent value="reports">
          <ProjectReports project={project} />
        </TabsContent>
        <TabsContent value="contracts">
          <ProjectContracts project={project} />
        </TabsContent>
        <TabsContent value="files">
          <ProjectFiles project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
