import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseServer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status'); // 'sent', 'failed', or null for all
    const platform = searchParams.get('platform'); // 'linkedin', 'x', or null for all
    const days = parseInt(searchParams.get('days') || '30', 10); // Last N days

    if (!adminDb) throw new Error('Firebase Admin not initialized');

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = adminDb.collection('postHistory')
      .where('movedToHistoryAt', '>=', startDate)
      .orderBy('movedToHistoryAt', 'desc')
      .limit(limit);

    // Apply status filter
    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();

    const history = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        content: data.content,
        platforms: data.platforms || [],
        sentPlatforms: data.sentPlatforms || [],
        failedPlatforms: data.failedPlatforms || [],
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        postType: data.postType,
        status: data.status,
        scheduledAt: data.scheduledAt?.toDate?.().toISOString() || null,
        sentAt: data.sentAt?.toDate?.().toISOString() || null,
        movedToHistoryAt: data.movedToHistoryAt?.toDate?.().toISOString() || null,
        failureReason: data.failureReason,
        results: data.results,
        queueId: data.queueId,
        createdAt: data.createdAt?.toDate?.().toISOString() || null,
      };
    });

    // Apply platform filter if needed (client-side for now)
    const filtered = platform 
      ? history.filter(post => post.sentPlatforms.includes(platform))
      : history;

    return NextResponse.json({
      success: true,
      history: filtered,
      count: filtered.length,
      totalCount: history.length,
      timeRange: {
        from: startDate.toISOString(),
        to: new Date().toISOString(),
        days
      }
    });

  } catch (error: any) {
    console.error('Error fetching post history:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error fetching history' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, postId, content, platforms, scheduledAt } = body;

    if (!adminDb) throw new Error('Firebase Admin not initialized');

    if (action === 'delete') {
      // Delete post from history
      await adminDb.collection('postHistory').doc(postId).delete();
      
      return NextResponse.json({
        success: true,
        message: 'Post deleted from history'
      });
    }

    if (action === 'repost') {
      // Get post from history
      const historyDoc = await adminDb.collection('postHistory').doc(postId).get();
    
      if (!historyDoc.exists) {
        return NextResponse.json(
          { success: false, error: 'Post not found in history' },
          { status: 404 }
        );
      }

      const post = historyDoc.data();
    
      if (!post) {
        return NextResponse.json(
          { success: false, error: 'Post data is empty' },
          { status: 404 }
        );
      }

      // Validate platforms
      if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Select at least one platform' },
          { status: 400 }
        );
      }

      // Parse scheduled date if provided
      let scheduledTime = new Date();
      if (scheduledAt) {
        const parsedDate = new Date(scheduledAt);
        if (!isNaN(parsedDate.getTime())) {
          scheduledTime = parsedDate;
        }
      }

      // Create new scheduled post from history with edited content
      const newPost = {
        content: content || post.content,
        platforms: platforms,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        postType: 'manual',
        status: 'scheduled',
        scheduledAt: scheduledTime,
        createdAt: new Date(),
        queuePosition: 1,
        addedBy: 'repost_from_history',
        originalPostId: postId
      };

      const docRef = await adminDb.collection('socialMediaQueue').add(newPost);

      return NextResponse.json({
        success: true,
        message: 'Post adicionado à fila!',
        queueId: docRef.id,
        scheduledFor: scheduledTime.toISOString()
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Error in post history action:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error processing request' },
      { status: 500 }
    );
  }
}
