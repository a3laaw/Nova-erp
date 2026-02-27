'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview خبير النظام الذكي باستخدام مكتبة Google الرسمية المباشرة.
 */

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY || "");

export async function askSystemExpert(input: { question: string, history?: any[] }) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: "أنت المساعد الذكي لنظام Nova ERP. مهمتك هي مساعدة المستخدم في استخدام النظام والإجابة على استفساراته حول البيانات. كن مهذباً ومختصراً في إجاباتك باللغة العربية."
    });

    const chat = model.startChat({
      history: input.history?.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      })) || [],
    });

    const result = await chat.sendMessage(input.question);
    const response = await result.response;
    
    return { answer: response.text() };
  } catch (error) {
    console.error("System Expert Error:", error);
    return { answer: "عذراً، واجهت مشكلة في معالجة سؤالك. يرجى المحاولة مرة أخرى لاحقاً." };
  }
}
