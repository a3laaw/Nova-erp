
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

const statusStyles: Record<ProjectStatus, string> = {
    'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
    'Planning': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Completed': 'bg-green-100 text-green-800 border-green-200',
    'On Hold': 'bg-gray-100 text-gray-800 border-gray-200',
    'Cancelled': 'bg-red-100 text-red-800 border-red-200',
};

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const project = projects.find(p => p.id === params.id);

  if (!project) {
    notFound();
  }

  const client = clients.find(c => c.id === project.clientId);
  const leadEngineer = users.find(u => u.id === project.leadEngineerId);

  return (
    <div className="grid gap-8">
        <Button variant="outline" onClick={() => router.push('/dashboard/projects')} className='w-fit'>
            <ArrowRight className="ml-2 h-4 w-4" />
            العودة إلى المشاريع
        </Button>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 md:gap-8">
            <Image
              src={project.imageUrl}
              alt={project.name}
              width={250}
              height={160}
              className="rounded-lg object-cover"
              data-ai-hint={project.imageHint}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-3xl font-headline">{project.name}</CardTitle>
                <Badge variant="outline" className={cn("text-sm", statusStyles[project.status])}>
                  {project.status}
                </Badge>
              </div>
              <CardDescription className="mt-2 text-base">{project.description}</CardDescription>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ClientsIcon className="h-4 w-4" />
                  <span><strong>Client:</strong> {client?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span><strong>Lead Engineer:</strong> {leadEngineer?.fullName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span><strong>Timeline:</strong> {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeDollarSign className="h-4 w-4" />
                  <span><strong>Contract:</strong> <a href="#" className="text-primary hover:underline">View Contract</a></span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="disciplines">Disciplines</TabsTrigger>
          <TabsTrigger value="reports">Daily Reports</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
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
