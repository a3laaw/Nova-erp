'use server';
/**
 * @fileOverview An AI-powered bank reconciliation flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const BankTransactionSchema = z.object({
    id: z.string(),
    date: z.string(),
    description: z.string(),
    amount: z.number(),
});

const SystemTransactionSchema = z.object({
    id: z.string(),
    date: z.string(),
    description: z.string(),
    amount: z.number(),
});

export const ReconciliationInputSchema = z.object({
    bankTransactions: z.array(BankTransactionSchema),
    systemTransactions: z.array(SystemTransactionSchema),
});
export type ReconciliationInput = z.infer<typeof ReconciliationInputSchema>;

const MatchedPairSchema = z.object({
    bankTransactionId: z.string(),
    systemTransactionId: z.string(),
    confidence: z.number().describe('A confidence score from 0 to 1 on how certain the match is.'),
});

export const ReconciliationOutputSchema = z.object({
    matchedPairs: z.array(MatchedPairSchema),
    unmatchedBankIds: z.array(z.string()),
    unmatchedSystemIds: z.array(z.string()),
    explanation: z.string().describe("A brief summary of the reconciliation process and any notable findings."),
});
export type ReconciliationOutput = z.infer<typeof ReconciliationOutputSchema>;

const systemPrompt = `You are an expert financial auditor AI. Your task is to perform a bank reconciliation by matching transactions from a bank statement with transactions from an internal accounting system.

You will be given two lists of transactions:
1.  \`bankTransactions\`: A list of transactions from the bank statement.
2.  \`systemTransactions\`: A list of transactions from the company's journal entries affecting the bank account.

**Matching Logic:**

1.  **Primary Matching Criterion (Amount):** The most important factor is the amount. Transactions must have the exact same amount to be considered a potential match. A positive amount in one list must match a negative amount in the other (e.g., a bank credit of +100 KWD matches a system debit of -100 KWD, which represents cash coming into the bank).
2.  **Secondary Matching Criterion (Date):** The dates should be very close, ideally within a 3-day window.
3.  **Tertiary Matching Criterion (Description):** Use keywords in the description to confirm a match. For example, a bank transaction with "Cheque #1234" should match a system transaction with "Payment via Cheque 1234". Look for names, invoice numbers, or other references.

**Your Goal:**

Your goal is to produce a list of matched pairs. Each pair should link a \`bankTransactionId\` to a \`systemTransactionId\`. For each match, provide a confidence score from 0 (uncertain) to 1 (very certain).

- A score of **1.0** should be reserved for perfect matches (exact amount, same day, clear reference like a cheque number).
- A score between **0.8 and 0.9** can be used for matches with the same amount and very close dates (1-2 days apart).
- A score between **0.6 and 0.7** can be used for matches with the same amount but a slightly larger date difference or a less clear description link.
- Do not create matches with a confidence score below 0.6.

**Output Structure:**

Your final output must be a single JSON object with three keys:
1.  \`matchedPairs\`: An array of objects, each containing \`bankTransactionId\`, \`systemTransactionId\`, and \`confidence\`.
2.  \`unmatchedBankIds\`: An array of IDs for bank transactions that you could not match.
3.  \`unmatchedSystemIds\`: An array of IDs for system transactions that you could not match.
4.  \`explanation\`: A brief summary in Arabic explaining the results.

**IMPORTANT:**
- A single transaction can only be part of ONE match. Do not reuse transactions.
- Prioritize high-confidence matches first.
`;

const reconcileBankStatementPrompt = ai.definePrompt({
    name: 'reconcileBankStatementPrompt',
    system: systemPrompt,
    input: { schema: ReconciliationInputSchema },
    output: { schema: ReconciliationOutputSchema, format: 'json' },
    prompt: `
        Bank Transactions: {{{json bankTransactions}}}
        System Transactions: {{{json systemTransactions}}}
    `,
});

export const reconcileBankStatementFlow = ai.defineFlow(
    {
        name: 'reconcileBankStatementFlow',
        inputSchema: ReconciliationInputSchema,
        outputSchema: ReconciliationOutputSchema,
    },
    async (input) => {
        const { output } = await reconcileBankStatementPrompt(input);
        if (!output) {
            throw new Error("The AI model did not return a valid reconciliation response.");
        }
        return output;
    }
);
