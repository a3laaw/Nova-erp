'use client';
import { useState } from 'react';
import type { Project } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { AlertTriangle, Bot, X } from 'lucide-react';
import { generateDelayReport } from '@/ai/flows/generate-delay-reports';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function DelayReportGenerator({ project }: { project: Project }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const input = {
        projectTimelineData: JSON.stringify(project),
        currentDate: new Date().toISOString().split('T')[0],
      };
      // Mocking the AI call for demonstration purposes
      await new Promise(resolve => setTimeout(resolve, 2000));
      // const result = await generateDelayReport(input);
      const mockResult = {
        delayReport: `**Delay Report for ${project.name} as of ${new Date().toLocaleDateString()}**

**1. Delayed Phases:**
- **Structural - Structural drawings:** This phase was due on 2024-02-01 but is still 'In Progress'. The delay is approximately 1 month.

**2. Potential Reasons for Delay:**
- **Resource Constraints:** The lead structural engineer may be overloaded with other projects.
- **Scope Creep:** Unforeseen changes in the architectural design may have required rework on the structural drawings.
- **Dependency Delays:** A delay in the approval of the column design could have a cascading effect.

**3. Suggested Corrective Actions:**
- **Re-allocate Resources:** Assign a supporting engineer to assist Fatima Al-Mansoori to expedite the completion of drawings.
- **Daily Stand-ups:** Implement daily short meetings with the structural team to track progress and identify blockers quickly.
- **Client Communication:** Proactively inform the client about the delay and present a revised timeline to manage expectations.`
      };
      setReport(mockResult.delayReport);
    } catch (e) {
      console.error(e);
      setError('Failed to generate delay report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <AlertTriangle className="mr-2 h-4 w-4" />
          Generate Delay Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot /> AI-Powered Delay Analysis
          </DialogTitle>
          <DialogDescription>
            Analyzing '{project.name}' timeline for potential delays and risks.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {!report && !loading && !error && (
            <div className="text-center p-8">
              <p className="text-muted-foreground">Click "Run Analysis" to generate the report.</p>
            </div>
          )}
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-6 w-1/4 mt-4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {report && (
            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: report.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />') }} />
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
            Close
          </Button>
          <Button type="button" onClick={handleGenerateReport} disabled={loading}>
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
