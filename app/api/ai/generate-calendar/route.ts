import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseServer';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

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
    const { weekStart } = body; // Optional: specify which week to generate for

    // Read calendar prompt from Firestore
    console.log('📖 Reading calendar prompt from Firestore for user:', uid);
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const calendarPrompt = userData?.settings?.calendarPrompt || null;

    if (!calendarPrompt) {
      return NextResponse.json({ 
        error: 'No calendar prompt configured. Please add your calendar instructions in Settings > Calendar Configuration.' 
      }, { status: 400 });
    }

    console.log('📅 Calendar Generation Request:', {
      uid,
      promptLength: calendarPrompt.length,
      weekStart
    });

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env.local' 
      }, { status: 500 });
    }

    // Calculate week dates
    const now = new Date();
    const startDate = weekStart ? new Date(weekStart) : getNextMonday(now);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    // User has FULL control - only add minimal JSON formatting instruction
    const userMessage = `${calendarPrompt}

Week: ${startDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} to ${endDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

IMPORTANT: Return your response as a valid JSON object with this structure:
{
  "days": [
    {"day": "monday", "topic": "...", "content": "...", "hashtags": ["...", "..."]},
    {"day": "tuesday", "topic": "...", "content": "...", "hashtags": ["...", "..."]},
    {"day": "wednesday", "topic": "...", "content": "...", "hashtags": ["...", "..."]},
    {"day": "thursday", "topic": "...", "content": "...", "hashtags": ["...", "..."]},
    {"day": "friday", "topic": "...", "content": "...", "hashtags": ["...", "..."]},
    {"day": "saturday", "topic": "...", "content": "...", "hashtags": ["...", "..."]},
    {"day": "sunday", "topic": "...", "content": "...", "hashtags": ["...", "..."]}
  ]
}`;

    console.log('🤖 Calling OpenAI for calendar generation...');
    console.log('📝 Using user prompt:', calendarPrompt.substring(0, 200) + '...');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: userMessage }
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API error:', errorData);
      
      const errorMessage = errorData.error?.message || 'Failed to generate calendar';
      const errorType = errorData.error?.type || '';

      if (openaiResponse.status === 429 || errorType === 'insufficient_quota') {
        return NextResponse.json({ 
          error: 'Saldo insuficiente na conta OpenAI. Adicione créditos em platform.openai.com/account/billing',
          errorDetails: errorMessage
        }, { status: 429 });
      }

      return NextResponse.json({ 
        error: errorMessage 
      }, { status: openaiResponse.status });
    }

    const data = await openaiResponse.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Parse the JSON response
    let calendarData;
    try {
      // Clean up the response (remove markdown code blocks if present)
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.slice(7);
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.slice(3);
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.slice(0, -3);
      }
      cleanResponse = cleanResponse.trim();
      
      calendarData = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      return NextResponse.json({ 
        error: 'Failed to parse calendar data from AI. Please try again.',
        rawResponse: aiResponse.substring(0, 500)
      }, { status: 500 });
    }

    // Validate and normalize the calendar data
    const days = DAYS_OF_WEEK.map(dayName => {
      const dayData = calendarData.days?.find((d: any) => d.day?.toLowerCase() === dayName);
      return {
        day: dayName,
        topic: dayData?.topic || 'No topic',
        content: dayData?.content || 'Content not generated',
        hashtags: Array.isArray(dayData?.hashtags) ? dayData.hashtags : [],
        status: 'pending' as const
      };
    });

    // Create calendar document in Firestore
    const calendarId = `${uid}_${startDate.toISOString().split('T')[0]}`;
    const calendar = {
      id: calendarId,
      userId: uid,
      weekStart: startDate.toISOString(),
      weekEnd: endDate.toISOString(),
      days,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft'
    };

    await adminDb.collection('calendars').doc(calendarId).set(calendar);

    console.log('✅ Calendar generated and saved:', calendarId);

    return NextResponse.json({
      success: true,
      calendar,
      usage: data.usage
    });

  } catch (error: any) {
    console.error('Calendar generation error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to generate calendar' 
    }, { status: 500 });
  }
}

function getNextMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 1 : (day === 1 ? 0 : 8 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
