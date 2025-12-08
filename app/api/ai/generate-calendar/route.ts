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

    // Find the next available week that doesn't have a calendar yet
    const now = new Date();
    let startDate: Date;
    
    if (weekStart) {
      // If specific week is requested, use that
      startDate = new Date(weekStart);
    } else {
      // Find existing calendars for this user to determine the next available week
      let existingCalendars;
      try {
        existingCalendars = await adminDb.collection('calendars')
          .where('userId', '==', uid)
          .orderBy('weekStart', 'desc')
          .limit(20)
          .get();
      } catch (queryError: any) {
        // If index doesn't exist, try simple query
        console.warn('Calendar query failed, trying simple query:', queryError.message);
        existingCalendars = await adminDb.collection('calendars')
          .where('userId', '==', uid)
          .limit(20)
          .get();
      }
      
      const existingWeekStarts = new Set(
        existingCalendars.docs.map(doc => {
          const data = doc.data();
          // Normalize to just the date part (YYYY-MM-DD)
          return new Date(data.weekStart).toISOString().split('T')[0];
        })
      );
      
      console.log('📆 Existing calendars found:', existingWeekStarts.size);
      console.log('📆 Existing weeks:', Array.from(existingWeekStarts));
      
      // Start from the current week's Monday
      startDate = getNextMonday(now);
      
      // Keep advancing by 7 days until we find a week without a calendar
      let attempts = 0;
      const maxAttempts = 52; // Don't look more than a year ahead
      
      while (attempts < maxAttempts) {
        const weekKey = startDate.toISOString().split('T')[0];
        if (!existingWeekStarts.has(weekKey)) {
          console.log('📆 Found available week:', weekKey);
          break;
        }
        console.log('📆 Week already exists:', weekKey, '- checking next week');
        startDate.setDate(startDate.getDate() + 7);
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        return NextResponse.json({ 
          error: 'Could not find an available week in the next year. Please delete some calendars first.' 
        }, { status: 400 });
      }
    }
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    // User prompt - just add week info and ask for JSON format
    const userMessage = `${calendarPrompt}

Week: ${startDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} to ${endDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

Return as JSON with this structure (put ALL your content including Title, Message, CTA, Hashtags, Suggested Visual inside the "content" field as formatted text):
{
  "days": [
    {"day": "monday", "topic": "short topic name", "content": "Title: ...\\nMessage: ...\\nCTA: ...\\nHashtags: #tag1 #tag2\\nSuggested visual: ..."},
    {"day": "tuesday", "topic": "short topic name", "content": "Title: ...\\nMessage: ...\\nCTA: ...\\nHashtags: #tag1 #tag2\\nSuggested visual: ..."},
    {"day": "wednesday", "topic": "short topic name", "content": "..."},
    {"day": "thursday", "topic": "short topic name", "content": "..."},
    {"day": "friday", "topic": "short topic name", "content": "..."},
    {"day": "saturday", "topic": "short topic name", "content": "..."},
    {"day": "sunday", "topic": "short topic name", "content": "..."}
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
        model: 'gpt-4o',
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

    // Convert content to string - handle case where model returns object instead of string
    const contentToString = (content: any): string => {
      if (!content) return '';
      if (typeof content === 'string') return content;
      
      // If content is an object (model returned structured data), convert to readable text
      if (typeof content === 'object') {
        const parts: string[] = [];
        if (content.title) parts.push(`Title: ${content.title}`);
        if (content.message) parts.push(`Message: ${content.message}`);
        if (content.CTA) parts.push(`CTA: ${content.CTA}`);
        if (content.suggestedVisual) parts.push(`Suggested visual: ${content.suggestedVisual}`);
        if (content.hashtags) {
          // Handle hashtags in content object
          if (Array.isArray(content.hashtags)) {
            parts.push(content.hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' '));
          } else if (typeof content.hashtags === 'string') {
            parts.push(content.hashtags);
          }
        }
        return parts.join('\n');
      }
      
      return String(content);
    };

    // Extract hashtags from content and clean the text
    const extractHashtagsFromContent = (rawContent: any): { cleanContent: string; hashtags: string[] } => {
      const content = contentToString(rawContent);
      if (!content) return { cleanContent: 'Content not generated', hashtags: [] };
      
      const lines = content.split('\n');
      const hashtags: string[] = [];
      const cleanedLines: string[] = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Check if this is a "Hashtags:" line
        if (/^hashtags?\s*:/i.test(trimmedLine)) {
          const hashtagMatches = trimmedLine.match(/#(\w+)/g);
          if (hashtagMatches) {
            hashtagMatches.forEach(tag => {
              const cleanTag = tag.replace('#', '');
              if (cleanTag && !hashtags.includes(cleanTag)) {
                hashtags.push(cleanTag);
              }
            });
          }
          continue; // Skip this line in content
        }
        
        // Check if line is just hashtags (starts with # and mostly hashtags)
        if (trimmedLine.startsWith('#')) {
          const hashtagMatches = trimmedLine.match(/#(\w+)/g);
          if (hashtagMatches) {
            const words = trimmedLine.split(/\s+/);
            const hashtagWords = words.filter(w => w.startsWith('#'));
            
            if (hashtagWords.length >= words.length * 0.5) {
              hashtagMatches.forEach(tag => {
                const cleanTag = tag.replace('#', '');
                if (cleanTag && !hashtags.includes(cleanTag)) {
                  hashtags.push(cleanTag);
                }
              });
              continue; // Skip this line in content
            }
          }
        }
        
        cleanedLines.push(line);
      }
      
      return {
        cleanContent: cleanedLines.join('\n').trim(),
        hashtags
      };
    };

    // Validate and normalize the calendar data
    const days = DAYS_OF_WEEK.map(dayName => {
      const dayData = calendarData.days?.find((d: any) => d.day?.toLowerCase() === dayName);
      
      // Extract hashtags from content
      const { cleanContent, hashtags } = extractHashtagsFromContent(dayData?.content);
      
      return {
        day: dayName,
        topic: dayData?.topic || 'No topic',
        content: cleanContent,
        hashtags,
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
