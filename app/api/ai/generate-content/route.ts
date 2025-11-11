import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseServer';

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const body = await req.json();
    const { content, action, model } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Default to gpt-4o-mini if not specified
    const selectedModel = model || 'gpt-4o-mini';

    // ALWAYS read AI prompt directly from Firestore (source of truth)
    console.log('📖 Reading AI prompt from Firestore for user:', uid);
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const aiPrompt = userData?.settings?.aiPrompt || null;

    console.log('📩 AI API Request:', {
      uid,
      contentLength: content.length,
      hasAiPrompt: !!aiPrompt,
      promptLength: aiPrompt?.length || 0,
      promptPreview: aiPrompt ? aiPrompt.substring(0, 100) + '...' : 'NOT FOUND IN FIRESTORE',
      action,
      selectedModel
    });

    if (!aiPrompt) {
      return NextResponse.json({ 
        error: 'No AI prompt configured. Please add your custom instructions in Settings > AI Configuration.' 
      }, { status: 400 });
    }

    console.log('✅ Using AI prompt directly from Firestore');

    // User has FULL control via their Firestore prompt
    const userMessage = `${aiPrompt}\n\n${content}`;

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env.local' 
      }, { status: 500 });
    }

    console.log(`🎯 Using OpenAI ${selectedModel}`);

    // OpenAI API (gpt-4o-mini or gpt-4o)
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: selectedModel, // 'gpt-4o-mini' or 'gpt-4o'
        messages: [
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API error:', {
        status: openaiResponse.status,
        model: selectedModel,
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

      // Handle invalid API key
      if (openaiResponse.status === 401) {
        return NextResponse.json({ 
          error: 'Chave da API OpenAI inválida ou expirada. Verifique OPENAI_API_KEY no .env.local',
          errorDetails: errorMessage,
        }, { status: 401 });
      }

      // Generic error with OpenAI's message
      return NextResponse.json({ 
        error: errorMessage || 'Falha ao gerar conteúdo com OpenAI',
        errorCode,
        errorType,
        details: errorData 
      }, { status: openaiResponse.status });
    }

    const openaiData = await openaiResponse.json();
    const generatedContent = openaiData.choices[0]?.message?.content?.trim();

    if (!generatedContent) {
      return NextResponse.json({ error: 'No content generated' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      generatedContent,
      originalLength: content.length,
      newLength: generatedContent.length,
      model: selectedModel,
    });

  } catch (error: any) {
    console.error('AI generation error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to generate content' 
    }, { status: 500 });
  }
}
