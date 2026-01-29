'use server';

/**
 * @fileOverview An AI flow to analyze historical financial data and generate a future forecast.
 *
 * - runFinancialForecast - A function to process historical data and return a forecast.
 * - FinancialForecastInput - The input type for the runFinancialForecast function.
 * - FinancialForecastOutput - The return type for the runFinancialForecast function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const FinancialForecastInputSchema = z.object({
  historicalData: z.string().describe('A JSON string representing monthly revenue and expenses for the past several months.'),
  forecastPeriod: z.number().describe('The number of months to forecast into the future.'),
});
export type FinancialForecastInput = z.infer<typeof FinancialForecastInputSchema>;

const FinancialForecastOutputSchema = z.object({
  forecastSummary: z.array(z.object({
    month: z.string().describe('The forecasted month (e.g., "July 2024").'),
    revenue: z.number().describe('The predicted revenue for the month.'),
    expenses: z.number().describe('The predicted expenses for the month.'),
    profit: z.number().describe('The predicted profit for the month.'),
  })),
  analysis: z.string().describe('A detailed analysis of the forecast, including assumptions, trends observed, and potential risks or opportunities.'),
  confidenceScore: z.number().min(0).max(1).describe('A score from 0 to 1 indicating the confidence level of the forecast.'),
});
export type FinancialForecastOutput = z.infer<typeof FinancialForecastOutputSchema>;

export async function runFinancialForecast(input: FinancialForecastInput): Promise<FinancialForecastOutput> {
  return financialForecastFlow(input);
}

const prompt = ai.definePrompt({
    name: 'financialForecastPrompt',
    system: `You are an expert financial analyst for a consulting engineering company. Your task is to analyze historical financial data and provide a realistic month-by-month forecast for the specified future period.

You will be given historical monthly revenue and expense data.

Instructions:
1.  Analyze the trends, seasonality, and growth patterns in the historical data.
2.  Generate a month-by-month forecast for revenue, expenses, and profit for the requested number of months.
3.  Provide a detailed written analysis explaining your forecast in Arabic. Include your assumptions (e.g., "بناءً على نمو شهري 5%"), identify key trends (e.g., "تبدو الإيرادات موسمية وتصل للذروة في الربع الأخير"), and mention any potential risks or opportunities.
4.  Provide a confidence score (0.0 to 1.0) for your forecast, where 1.0 is very confident. Justify this score briefly in your analysis.
5.  Return the output in the specified JSON format.`,
    input: { schema: FinancialForecastInputSchema },
    output: { schema: FinancialForecastOutputSchema, format: 'json' },
    prompt: `
Historical Data:
{{{historicalData}}}

Forecast Period: {{forecastPeriod}} months.
`,
});

const financialForecastFlow = ai.defineFlow(
  {
    name: 'financialForecastFlow',
    inputSchema: FinancialForecastInputSchema,
    outputSchema: FinancialForecastOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid forecast.");
    }
    return output;
  }
);
