import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const { jobId, addedBy } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Verificar se o job existe
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const jobData = jobDoc.data();

    // Adicionar à fila
    const now = new Date();

    const queueData = {
      jobId,
      title: jobData?.title || 'Unknown Job',
      companyName: jobData?.companyName || 'Unknown Company',
      addedBy: addedBy || 'admin',
      addedAt: now.toISOString(),
      status: 'pending',
      queuePosition: Date.now(), // FIFO - usado para ordenação, primeiro a entrar = menor timestamp
      platforms: {
        linkedin: true,
        telegram: true,
        x: true
      }
    };

    const docRef = await db.collection('socialMediaQueue').add(queueData);

    return NextResponse.json({
      success: true,
      queueId: docRef.id,
      message: 'Job added to social media queue successfully'
    });

  } catch (error: any) {
    console.error('Error adding job to queue:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Buscar jobs na fila (sem ordenação complexa para evitar problemas de índice)
    const queueSnapshot = await db
      .collection('socialMediaQueue')
      .where('status', '==', 'pending')
      .limit(10)
      .get();

    const queueJobs = queueSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Ordenar no cliente para evitar problemas de índice
    queueJobs.sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));

    return NextResponse.json({
      success: true,
      queueJobs,
      count: queueJobs.length
    });

  } catch (error: any) {
    console.error('Error fetching queue:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queueId = searchParams.get('id');

    if (!queueId) {
      return NextResponse.json(
        { error: 'Queue ID is required' },
        { status: 400 }
      );
    }

    await db.collection('socialMediaQueue').doc(queueId).delete();

    return NextResponse.json({
      success: true,
      message: 'Job removed from queue successfully'
    });

  } catch (error: any) {
    console.error('Error removing job from queue:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
