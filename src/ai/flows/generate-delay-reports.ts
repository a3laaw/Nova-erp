'use server';

/**
 * @fileOverview AI flow to analyze project timelines and generate delay reports if project phases exceed deadlines.
 *
 * - generateDelayReport - A function that handles the generation of delay reports.
 * - GenerateDelayReportInput - The input type for the generateDelayReport function.
 * - GenerateDelayReportOutput - The return type for the generateDelayReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDelayReportInputSchema = z.object({
  projectTimelineData: z
    .string()
    .describe('A stringified JSON representing the project timeline data, including phases, start dates, end dates, and assigned engineers.'),
  currentDate: z.string().describe('The current date to compare against deadlines, in ISO format (YYYY-MM-DD).'),
});
export type GenerateDelayReportInput = z.infer<typeof GenerateDelayReportInputSchema>;

const GenerateDelayReportOutputSchema = z.object({
  delayReport: z.string().describe('A comprehensive delay report, highlighting phases exceeding deadlines, reasons for delays, and suggested corrective actions.'),
});
export type GenerateDelayReportOutput = z.infer<typeof GenerateDelayReportOutputSchema>;

export async function generateDelayReport(input: GenerateDelayReportInput): Promise<GenerateDelayReportOutput> {
  return generateDelayReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDelayReportPrompt',
  input: {schema: GenerateDelayReportInputSchema},
  output: {schema: GenerateDelayReportOutputSchema},
  prompt: `You are an AI assistant specializing in project management and risk assessment. Your task is to analyze project timelines and generate delay reports, identifying phases that have exceeded their deadlines. Provide potential reasons for the delays and suggest corrective actions.

Project Timeline Data: {{{projectTimelineData}}}
Current Date: {{{currentDate}}}

Based on the provided project timeline data and the current date, generate a delay report that includes:
- A list of phases exceeding their deadlines.
- The duration of the delay for each phase.
- Potential reasons for the delays (e.g., resource constraints, unforeseen circumstances, scope changes).
- Suggested corrective actions to mitigate further delays and get the project back on track.

Ensure the report is clear, concise, and actionable, providing project managers with the information they need to address project delays effectively. Focus on providing as much value as possible.
`,
});

const generateDelayReportFlow = ai.defineFlow(
  {
    name: 'generateDelayReportFlow',
    inputSchema: GenerateDelayReportInputSchema,
    outputSchema: GenerateDelayReportOutputSchema,
  },
  async input => {
    try {
      JSON.parse(input.projectTimelineData);
    } catch (e) {
      throw new Error('Invalid JSON format for projectTimelineData: ' + e);
    }
    const {output} = await prompt(input);
    return output!;
  }
);
