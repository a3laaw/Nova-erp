import type { Project } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Upload } from 'lucide-react';

export function ProjectFiles({ project }: { project: Project }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Project Files</CardTitle>
                <CardDescription>All documents, blueprints, and images related to the project.</CardDescription>
            </div>
            <Button><Upload className="mr-2 h-4 w-4" /> Upload File</Button>
        </div>
      </CardHeader>
      <CardContent>
        {project.files.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* List of files would go here */}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-semibold">No Files Uploaded</h3>
            <p className="text-muted-foreground mt-2">Drag and drop files here or use the upload button.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
