
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ 
      error: 'No API key found',
      checkedVars: ['GOOGLE_GENAI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY'],
      allEnvKeys: Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('GEMINI') || k.includes('API'))
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.error) {
      return NextResponse.json({ error: data.error, apiKeyPrefix: apiKey.substring(0, 10) + '...' });
    }

    const models = (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => ({
        name: m.name,
        displayName: m.displayName,
        methods: m.supportedGenerationMethods,
      }));

    return NextResponse.json({ 
      success: true, 
      totalModels: models.length,
      models: models,
      apiKeyPrefix: apiKey.substring(0, 10) + '...'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
