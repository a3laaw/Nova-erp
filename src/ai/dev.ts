import { config } from 'dotenv';
config();

import '@/ai/flows/generate-delay-reports.ts';
import '@/ai/flows/suggest-task-prioritization.ts';
import '@/ai/flows/accounting-assistant.ts';
import '@/ai/flows/cash-flow-projection.ts';
import '@/ai/flows/ask-system-expert.ts';
import '@/ai/tools/find-navigation';
import '@/ai/flows/reconcile-bank-statement.ts';
import '@/ai/flows/analyze-supplier-quote.ts';
