import type { Project } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Plus } from 'lucide-react';

export function ProjectReports({ project }: { project: Project }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Daily Progress Reports</CardTitle>
                <CardDescription>Daily updates from the project site.</CardDescription>
            </div>
            <Button><Plus className="mr-2 h-4 w-4" /> Submit Report</Button>
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
            <h3 className="text-lg font-semibold">No Reports Yet</h3>
            <p className="text-muted-foreground mt-2">The first daily report for this project has not been submitted.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
