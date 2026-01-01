'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { suggestTaskPrioritization } from '@/ai/flows/suggest-task-prioritization';
import { Wand2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

const mockInput = {
    projectTimeline: "Project 'Downtown Villa' deadline is in 2 months. Structural phase is delayed by 1 week.",
    dependencies: "Electrical layout depends on final structural drawings. Interior design depends on electrical layout.",
    resourceAvailability: "Fatima Al-Mansoori (Lead Structural Engineer) is at 80% capacity. Hassan Ibrahim (Electrical Engineer) is at 30% capacity."
};

const mockSuggestion = `1. **Finalize Structural Drawings for 'Downtown Villa'**: This is the highest priority as it's currently blocking two other dependent phases (Electrical and Interior). Completing this will unlock other teams.
2. **Begin Electrical Layout for 'Downtown Villa'**: Once the structural drawings are approved, Hassan Ibrahim should immediately start this task, given his high availability.
3. **Client Follow-up for 'Yas Island Tower'**: As this project is in the planning phase, a follow-up is crucial to maintain momentum and clarify requirements.`;


export function TaskPrioritization() {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSuggest = async () => {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
        // In a real app, you would fetch real data
        // const response = await suggestTaskPrioritization(mockInput);
        // setSuggestion(response.prioritizedTasks);
        
        // Using mock response for demonstration
        await new Promise(resolve => setTimeout(resolve, 1500));
        setSuggestion(mockSuggestion);

    } catch (e) {
      setError('Failed to get suggestions. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>AI Task Prioritization</CardTitle>
        <CardDescription>
          Get AI-powered suggestions for your next tasks based on deadlines, dependencies, and resources.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {loading && (
            <div className="space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-6 w-2/4 mt-4" />
                <Skeleton className="h-4 w-full" />
            </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {suggestion && !loading && (
          <div className="prose prose-sm max-w-none text-foreground">
            <ul className="space-y-2">
                {suggestion.split('\n').map((item, index) => {
                    if (!item.trim()) return null;
                    const isTitle = item.startsWith('1.') || item.startsWith('2.') || item.startsWith('3.');
                    return (
                        <li key={index} className="flex items-start">
                            <span className="mr-2 mt-1">{isTitle ? '✅' : ''}</span>
                            <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        </li>
                    )
                })}
            </ul>
          </div>
        )}
        {!suggestion && !loading && (
            <div className="text-center text-muted-foreground p-8">
                <p>Click the button to generate task priorities.</p>
            </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSuggest} disabled={loading} className='w-full'>
          <Wand2 className="mr-2 h-4 w-4" />
          {loading ? 'Generating...' : 'Suggest Priorities'}
        </Button>
      </CardFooter>
    </Card>
  );
}
