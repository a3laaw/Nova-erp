'use server';
/**
 * @fileOverview AI-powered task prioritization suggestion flow.
 *
 * - suggestTaskPrioritization - A function that suggests task prioritization based on project timeline, dependencies, and resource availability.
 * - SuggestTaskPrioritizationInput - The input type for the suggestTaskPrioritization function.
 * - SuggestTaskPrioritizationOutput - The return type for the suggestTaskPrioritization function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTaskPrioritizationInputSchema = z.object({
  projectTimeline: z.string().describe('The project timeline in a textual format.'),
  dependencies: z.string().describe('The task dependencies in a textual format.'),
  resourceAvailability: z.string().describe('The resource availability in a textual format.'),
});
export type SuggestTaskPrioritizationInput = z.infer<typeof SuggestTaskPrioritizationInputSchema>;

const SuggestTaskPrioritizationOutputSchema = z.object({
  prioritizedTasks: z.string().describe('A list of tasks prioritized with explanations.'),
});
export type SuggestTaskPrioritizationOutput = z.infer<typeof SuggestTaskPrioritizationOutputSchema>;

export async function suggestTaskPrioritization(input: SuggestTaskPrioritizationInput): Promise<SuggestTaskPrioritizationOutput> {
  return suggestTaskPrioritizationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTaskPrioritizationPrompt',
  input: {schema: SuggestTaskPrioritizationInputSchema},
  output: {schema: SuggestTaskPrioritizationOutputSchema},
  prompt: `You are an AI assistant helping engineers prioritize tasks based on project timeline, dependencies, and resource availability.

  Analyze the following information:

  Project Timeline: {{{projectTimeline}}}
  Dependencies: {{{dependencies}}}
  Resource Availability: {{{resourceAvailability}}}

  Suggest a prioritized list of tasks with clear explanations for the prioritization.`,
});

const suggestTaskPrioritizationFlow = ai.defineFlow(
  {
    name: 'suggestTaskPrioritizationFlow',
    inputSchema: SuggestTaskPrioritizationInputSchema,
    outputSchema: SuggestTaskPrioritizationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
