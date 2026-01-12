
'use client';
import type { Project } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Upload } from 'lucide-react';
import { useLanguage } from '@/context/language-context';

export function ProjectFiles({ project }: { project: Project }) {
  const { language } = useLanguage();
  const t = (language === 'ar') ? 
    { title: 'ملفات المشروع', description: 'جميع المستندات والمخططات والصور المتعلقة بالمشروع.', upload: 'رفع ملف', noFiles: 'لم يتم رفع أي ملفات', noFilesDesc: 'اسحب وأفلت الملفات هنا أو استخدم زر الرفع.' } :
    { title: 'Project Files', description: 'All documents, blueprints, and images related to the project.', upload: 'Upload File', noFiles: 'No Files Uploaded', noFilesDesc: 'Drag and drop files here or use the upload button.' };

  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>{t.description}</CardDescription>
            </div>
            <Button><Upload className="mr-2 h-4 w-4" /> {t.upload}</Button>
        </div>
      </CardHeader>
      <CardContent>
        {project.files.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* List of files would go here */}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-semibold">{t.noFiles}</h3>
            <p className="text-muted-foreground mt-2">{t.noFilesDesc}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
