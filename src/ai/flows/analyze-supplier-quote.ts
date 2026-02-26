'use server';
/**
 * @fileOverview AI flow to analyze supplier quote documents (PDF/Images) and extract unit prices.
 * Using the stable gemini-1.5-flash model.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeQuoteInputSchema = z.object({
  quoteFileDataUri: z.string().describe("The quote document as a data URI (PDF or Image). Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  rfqItems: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).describe("The list of items we are looking for in the supplier's quote."),
});
export type AnalyzeQuoteInput = z.infer<typeof AnalyzeQuoteInputSchema>;

const AnalyzeQuoteOutputSchema = z.object({
  extractedPrices: z.array(z.object({
    rfqItemId: z.string(),
    unitPrice: z.number().describe("The extracted unit price from the document."),
    confidence: z.number().describe("Confidence score between 0 and 1.")
  })),
  currency: z.string().optional().describe("Detected currency in the document."),
  notes: z.string().optional().describe("Any extra notes or warnings from the AI."),
});
export type AnalyzeQuoteOutput = z.infer<typeof AnalyzeQuoteOutputSchema>;

export async function analyzeSupplierQuote(input: AnalyzeQuoteInput): Promise<AnalyzeQuoteOutput> {
  return analyzeSupplierQuoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeSupplierQuotePrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: AnalyzeQuoteInputSchema },
  output: { schema: AnalyzeQuoteOutputSchema },
  config: {
    temperature: 0.1,
  },
  prompt: `You are a professional procurement auditor AI.
أنت مدقق مشتريات محترف. استخرج أسعار الوحدة لكل صنف من عرض السعر المرفق.

Match these items (المطلوب استخراجه):
{{#each rfqItems}}
- ID: {{this.id}}, Name: {{this.name}}
{{/each}}

Instructions:
1. Find the unit price for each item above.
2. Return the results in the specified JSON format.
3. Extract only numbers for unitPrice.

Document: {{media url=quoteFileDataUri}}`,
});

const analyzeSupplierQuoteFlow = ai.defineFlow(
  {
    name: 'analyzeSupplierQuoteFlow',
    inputSchema: AnalyzeQuoteInputSchema,
    outputSchema: AnalyzeQuoteOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      if (!output) {
        throw new Error('No data extracted from the document.');
      }
      return output;
    } catch (error: any) {
      console.error("AI Analysis Flow Error:", error);
      throw new Error(`AI Analysis failed: ${error.message}`);
    }
  }
);
