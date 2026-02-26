'use server';
/**
 * @fileOverview AI flow to analyze supplier quote documents (PDF/Images) and extract unit prices.
 * Using stable multimodal gemini-1.5-flash which has built-in OCR capabilities.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeQuoteInputSchema = z.object({
  quoteFileDataUri: z.string().describe("The quote document as a data URI (PDF or Image)."),
  rfqItems: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).describe("The list of items we are looking for in the supplier's quote."),
});
export type AnalyzeQuoteInput = z.infer<typeof AnalyzeQuoteInputSchema>;

const AnalyzeQuoteOutputSchema = z.object({
  extractedPrices: z.array(z.object({
    rfqItemId: z.string(),
    unitPrice: z.number().describe("The extracted unit price."),
    confidence: z.number().describe("Confidence score between 0 and 1.")
  })),
  notes: z.string().optional().describe("Any warnings or notes."),
});
export type AnalyzeQuoteOutput = z.infer<typeof AnalyzeQuoteOutputSchema>;

export async function analyzeSupplierQuote(input: AnalyzeQuoteInput): Promise<AnalyzeQuoteOutput> {
  return analyzeSupplierQuoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeSupplierQuotePrompt',
  input: { schema: AnalyzeQuoteInputSchema },
  output: { schema: AnalyzeQuoteOutputSchema },
  config: {
    temperature: 0.1,
  },
  prompt: `You are a professional procurement auditor. Extract unit prices for the requested items from the provided quote document.

أنت مدقق مشتريات محترف. استخرج سعر الوحدة لكل صنف من عرض السعر المرفق.

Requested Items:
{{#each rfqItems}}
- ID: {{this.id}}, Name: {{this.name}}
{{/each}}

Instructions:
1. Scan the document image/PDF.
2. Find the unit price for each requested item ID.
3. Return ONLY the data in the requested JSON format.
4. If an item price is not clear, assign a lower confidence score.

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
      if (!output) throw new Error('No output from AI');
      return output;
    } catch (error: any) {
      console.error("AI Analysis Flow Error:", error);
      throw new Error(`AI Analysis failed: ${error.message}`);
    }
  }
);
