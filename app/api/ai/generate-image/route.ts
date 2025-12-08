import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseServer';

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!adminAuth) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log('🎨 DALL-E 3 Image Generation Request:', {
      uid,
      promptLength: prompt.length,
      promptPreview: prompt.substring(0, 100) + '...'
    });

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env.local' 
      }, { status: 500 });
    }

    // Call DALL-E 3 API
    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1, // DALL-E 3 only supports n=1
        size: '1792x1024', // 16:9 landscape format - ideal for social media
        quality: 'standard', // Options: 'standard' or 'hd' (hd costs more)
        response_format: 'b64_json', // Get base64 to avoid CORS issues
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('DALL-E 3 API error:', {
        status: openaiResponse.status,
        error: errorData
      });
      
      const errorMessage = errorData.error?.message || '';
      const errorCode = errorData.error?.code || '';
      const errorType = errorData.error?.type || '';

      // Handle insufficient quota / billing errors
      if (openaiResponse.status === 429 || errorType === 'insufficient_quota') {
        return NextResponse.json({ 
          error: 'Saldo insuficiente na conta OpenAI. Adicione créditos em platform.openai.com/account/billing',
          errorDetails: errorMessage,
          rateLimit: true,
          insufficientQuota: true
        }, { status: 429 });
      }

      // Handle rate limit (different from quota)
      if (errorCode === 'rate_limit_exceeded') {
        return NextResponse.json({ 
          error: 'Limite de requisições excedido. Aguarde alguns segundos e tente novamente.',
          errorDetails: errorMessage,
          rateLimit: true
        }, { status: 429 });
      }

      // Handle content policy violation
      if (openaiResponse.status === 400 && errorCode === 'content_policy_violation') {
        return NextResponse.json({ 
          error: 'Seu prompt foi bloqueado pela política de conteúdo da OpenAI. Tente reformular.',
          errorDetails: errorMessage,
          contentPolicy: true
        }, { status: 400 });
      }

      // Handle invalid API key
      if (openaiResponse.status === 401) {
        return NextResponse.json({ 
          error: 'Chave da API OpenAI inválida ou expirada. Verifique OPENAI_API_KEY no .env.local',
          errorDetails: errorMessage,
        }, { status: 401 });
      }

      // Generic error with OpenAI's message
      return NextResponse.json({ 
        error: errorMessage || 'Falha ao gerar imagem com DALL-E 3',
        errorCode,
        errorType,
        details: errorData 
      }, { status: openaiResponse.status });
    }

    const data = await openaiResponse.json();
    const b64Image = data.data[0]?.b64_json;
    const revisedPrompt = data.data[0]?.revised_prompt; // DALL-E 3 may revise your prompt

    if (!b64Image) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    // Convert base64 to data URL for frontend use
    const imageUrl = `data:image/png;base64,${b64Image}`;

    console.log('✅ Image generated successfully (base64)');

    return NextResponse.json({
      success: true,
      imageUrl,
      revisedPrompt, // What DALL-E 3 actually used (can be different from input)
      model: 'dall-e-3',
      size: '1792x1024',
      cost: 0.080, // Approximate cost in USD (landscape costs more)
    });

  } catch (error: any) {
    console.error('Image generation error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to generate image' 
    }, { status: 500 });
  }
}
