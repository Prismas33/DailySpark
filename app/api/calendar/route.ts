import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseServer';

// GET - Fetch calendars for user
export async function GET(req: NextRequest) {
  try {
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

    // Get query params
    const { searchParams } = new URL(req.url);
    const calendarId = searchParams.get('id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (calendarId) {
      // Fetch specific calendar
      const calendarDoc = await adminDb.collection('calendars').doc(calendarId).get();
      
      if (!calendarDoc.exists) {
        return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
      }

      const calendar = calendarDoc.data();
      
      // Verify ownership
      if (calendar?.userId !== uid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      return NextResponse.json({ calendar });
    }

    // Fetch all calendars for user
    let snapshot;
    try {
      let query = adminDb.collection('calendars')
        .where('userId', '==', uid)
        .orderBy('weekStart', 'desc')
        .limit(limit);

      if (status) {
        query = adminDb.collection('calendars')
          .where('userId', '==', uid)
          .where('status', '==', status)
          .orderBy('weekStart', 'desc')
          .limit(limit);
      }

      snapshot = await query.get();
    } catch (queryError: any) {
      // If index doesn't exist, try simple query without ordering
      console.warn('Calendar query failed, trying simple query:', queryError.message);
      const simpleQuery = adminDb.collection('calendars')
        .where('userId', '==', uid)
        .limit(limit);
      snapshot = await simpleQuery.get();
    }
    
    const calendars = snapshot.docs.map(doc => doc.data());

    return NextResponse.json({ calendars });

  } catch (error: any) {
    console.error('Calendar fetch error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch calendars' 
    }, { status: 500 });
  }
}

// PATCH - Update calendar or specific day
export async function PATCH(req: NextRequest) {
  try {
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
    const { calendarId, dayIndex, updates, calendarStatus } = body;

    if (!calendarId) {
      return NextResponse.json({ error: 'Calendar ID is required' }, { status: 400 });
    }

    // Fetch calendar
    const calendarRef = adminDb.collection('calendars').doc(calendarId);
    const calendarDoc = await calendarRef.get();

    if (!calendarDoc.exists) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    const calendar = calendarDoc.data();

    // Verify ownership
    if (calendar?.userId !== uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    // Update specific day
    if (dayIndex !== undefined && updates) {
      const days = [...calendar.days];
      days[dayIndex] = {
        ...days[dayIndex],
        ...updates
      };
      updateData.days = days;
    }

    // Update calendar status
    if (calendarStatus) {
      updateData.status = calendarStatus;
    }

    await calendarRef.update(updateData);

    // Fetch updated calendar
    const updatedDoc = await calendarRef.get();

    return NextResponse.json({ 
      success: true,
      calendar: updatedDoc.data()
    });

  } catch (error: any) {
    console.error('Calendar update error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to update calendar' 
    }, { status: 500 });
  }
}

// DELETE - Delete calendar
export async function DELETE(req: NextRequest) {
  try {
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

    const { searchParams } = new URL(req.url);
    const calendarId = searchParams.get('id');

    if (!calendarId) {
      return NextResponse.json({ error: 'Calendar ID is required' }, { status: 400 });
    }

    // Fetch calendar to verify ownership
    const calendarRef = adminDb.collection('calendars').doc(calendarId);
    const calendarDoc = await calendarRef.get();

    if (!calendarDoc.exists) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    const calendar = calendarDoc.data();

    // Verify ownership
    if (calendar?.userId !== uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await calendarRef.delete();

    return NextResponse.json({ 
      success: true,
      message: 'Calendar deleted successfully'
    });

  } catch (error: any) {
    console.error('Calendar delete error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to delete calendar' 
    }, { status: 500 });
  }
}
