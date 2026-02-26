import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ 
      error: 'API Key is missing from environment variables.',
      checked: ['GOOGLE_GENAI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY']
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.error) {
      return NextResponse.json({ 
        status: 'API Key Error',
        message: data.error.message,
        code: data.error.code
      });
    }

    const flashModel = (data.models || []).find((m: any) => m.name.includes('gemini-1.5-flash'));

    return NextResponse.json({ 
      success: true,
      apiKeyPrefix: apiKey.substring(0, 10) + '...',
      modelsCount: data.models?.length || 0,
      stableModelFound: !!flashModel,
      stableModelName: flashModel?.name || 'Not Found'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
