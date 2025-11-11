import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseServer';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const { content, scheduledAt, platforms, imageUrl, postType, mediaType } = await request.json();

    // Validations
    if (!content || !scheduledAt || !platforms || platforms.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: content, scheduledAt, platforms' },
        { status: 400 }
      );
    }

    // Verify scheduled time is in the future
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { success: false, error: 'Scheduled time must be in the future' },
        { status: 400 }
      );
    }

    // Get next queue position
  if (!adminDb) throw new Error('Firebase Admin not initialized');
  const queueSnapshot = await adminDb.collection('socialMediaQueue').get();
    const nextPosition = queueSnapshot.size + 1;

    // Create queue entry
    const queueData = {
      content,
      scheduledAt: Timestamp.fromDate(scheduledDate),
      platforms: Array.isArray(platforms) ? platforms : [],
      mediaUrl: imageUrl || null, // Support both imageUrl (legacy) and mediaUrl
      postType: postType || 'post', // 'post' or 'reel'
      mediaType: mediaType || null, // 'image' or 'video'
      status: 'scheduled', // Changed from 'pending' to 'scheduled'
      createdAt: Timestamp.now(),
      queuePosition: nextPosition,
      addedBy: 'manual' // Could be user ID if you have auth
    };

  const docRef = await adminDb.collection('socialMediaQueue').add(queueData);

    return NextResponse.json({
      success: true,
      queueId: docRef.id,
      scheduledAt,
      platforms
    });

  } catch (error: any) {
    console.error('Error scheduling post:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'scheduled';

    if (!adminDb) throw new Error('Firebase Admin not initialized');
    const querySnapshot = await adminDb
      .collection('socialMediaQueue')
      .where('status', '==', status)
      .limit(50)
      .get();

    const queue = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        content: data.content,
        platforms: data.platforms || [],
        imageUrl: data.mediaUrl || data.imageUrl, // Support both
        mediaUrl: data.mediaUrl || data.imageUrl,
        postType: data.postType || 'post',
        mediaType: data.mediaType,
        status: data.status,
        scheduledAt: data.scheduledAt?.toDate?.().toISOString() || null,
        createdAt: data.createdAt?.toDate?.().toISOString() || null,
        queuePosition: data.queuePosition
      };
    });

    // Sort by scheduled time
    queue.sort((a, b) => {
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });

    return NextResponse.json({
      success: true,
      queue,
      count: queue.length
    });

  } catch (error: any) {
    console.error('Error fetching queue:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Queue ID required' },
        { status: 400 }
      );
    }

  if (!adminDb) throw new Error('Firebase Admin not initialized');
  await adminDb.collection('socialMediaQueue').doc(id).delete();

    return NextResponse.json({
      success: true,
      message: 'Post removed from queue'
    });

  } catch (error: any) {
    console.error('Error deleting from queue:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
