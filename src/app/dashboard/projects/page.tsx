
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { projects, clients, users } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ProjectStatus } from '@/lib/types';
import { useLanguage } from '@/context/language-context';

const statusStyles: Record<ProjectStatus, string> = {
    'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
    'Planning': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Completed': 'bg-green-100 text-green-800 border-green-200',
    'On Hold': 'bg-gray-100 text-gray-800 border-gray-200',
    'Cancelled': 'bg-red-100 text-red-800 border-red-200',
};


export default function ProjectsPage() {
  const { language } = useLanguage();
  const t = (language === 'ar') ? 
    { title: 'المشاريع', description: 'إدارة جميع مشاريعك الهندسية والإنشائية.', add: 'إضافة مشروع', project: 'المشروع', client: 'العميل', lead: 'المهندس المسؤول', status: 'الحالة', actions: 'الإجراءات', view: 'عرض التفاصيل', edit: 'تعديل', delete: 'حذف' } :
    { title: 'Projects', description: 'Manage all your engineering and construction projects.', add: 'Add Project', project: 'Project', client: 'Client', lead: 'Lead Engineer', status: 'Status', actions: 'Actions', view: 'View Details', edit: 'Edit', delete: 'Delete' };

  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>
                {t.description}
                </CardDescription>
            </div>
            <Button asChild size="sm" className="gap-1">
                <Link href="#">
                    <PlusCircle className="h-4 w-4" />
                    {t.add}
                </Link>
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden w-[100px] sm:table-cell">
                <span className="sr-only">Image</span>
              </TableHead>
              <TableHead>{t.project}</TableHead>
              <TableHead>{t.client}</TableHead>
              <TableHead className="hidden md:table-cell">
                {t.lead}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t.status}
              </TableHead>
              <TableHead>
                <span className="sr-only">{t.actions}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const client = clients.find(c => c.id === project.clientId);
              const leadEngineer = users.find(u => u.id === project.leadEngineerId);
              return (
                <TableRow key={project.id}>
                  <TableCell className="hidden sm:table-cell">
                    <Avatar className="h-10 w-10 rounded-md">
                        <AvatarImage src={project.imageUrl} alt={project.name[language]} className='object-cover' data-ai-hint={project.imageHint}/>
                        <AvatarFallback className="rounded-md">{project.name[language].charAt(0)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/projects/${project.id}`} className="hover:underline">
                        {project.name[language]}
                    </Link>
                  </TableCell>
                  <TableCell>{client?.name[language]}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className='flex items-center gap-2'>
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={leadEngineer?.avatarUrl} alt={leadEngineer?.fullName} />
                            <AvatarFallback>{leadEngineer?.fullName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{leadEngineer?.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={cn("border", statusStyles[project.status])}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-haspopup="true"
                          size="icon"
                          variant="ghost"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                        <DropdownMenuLabel>{t.actions}</DropdownMenuLabel>
                        <DropdownMenuItem asChild><Link href={`/dashboard/projects/${project.id}`}>{t.view}</Link></DropdownMenuItem>
                        <DropdownMenuItem>{t.edit}</DropdownMenuItem>
                        <DropdownMenuItem className='text-destructive'>{t.delete}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
