'use server';
/**
 * @fileOverview AI flow to analyze supplier quote documents (PDF/Images) and extract unit prices.
 *
 * - analyzeSupplierQuote - Main function to process the document.
 * - AnalyzeQuoteInput - Input including the document data and target item names.
 * - AnalyzeQuoteOutput - Extracted prices mapped to item IDs.
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
  input: { schema: AnalyzeQuoteInputSchema },
  output: { schema: AnalyzeQuoteOutputSchema },
  prompt: `You are a professional procurement auditor AI. Your task is to extract unit prices from the attached supplier quotation document.

Match the items in the document to the following items I am looking for:
{{#each rfqItems}}
- ID: {{this.id}}, Name: {{this.name}}
{{/each}}

Instructions:
1. Scan the document (image or PDF) and find the table or list of prices.
2. For each item in my list, find the corresponding unit price in the document.
3. If the supplier used a slightly different name, use your reasoning to find the best match based on keywords.
4. Return ONLY the unit prices for the requested IDs in the specified JSON format.
5. If an item is not found, do not include it in the extractedPrices array.
6. If the document has multiple pages, scan all of them.

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
      const { output } = await prompt(input);
      if (!output) {
        throw new Error('Failed to analyze the document. No data extracted.');
      }
      return output;
    } catch (error: any) {
      console.error("AI Analysis Flow Error:", error);
      throw new Error(`AI Analysis failed: ${error.message}`);
    }
  }
);
