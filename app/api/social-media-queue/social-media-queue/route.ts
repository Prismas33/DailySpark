import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import { getAdminFirestore } from '../../../../lib/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const db = getAdminFirestore();
    const { jobId } = await request.json();

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

    // Verificar próxima posição na fila
    const queueSnapshot = await db
      .collection('socialMediaQueue')
      .orderBy('queuePosition', 'desc')
      .limit(1)
      .get();

    let nextPosition = 1;
    if (!queueSnapshot.empty) {
      const lastJob = queueSnapshot.docs[0].data();
      nextPosition = (lastJob.queuePosition || 0) + 1;
    }

    // Adicionar job à fila
    const queueData = {
      jobId,
      title: jobData?.title || '',
      companyName: jobData?.companyName || '',
      location: jobData?.location || '',
      status: 'pending',
      queuePosition: nextPosition,
      addedAt: new Date().toISOString(),
      platforms: ['linkedin', 'facebook', 'twitter'] // Platforms padrão
    };

    const docRef = await db.collection('socialMediaQueue').add(queueData);

    return NextResponse.json({
      success: true,
      queueId: docRef.id,
      queuePosition: nextPosition,
      message: 'Job added to social media queue'
    });

  } catch (error: any) {
    console.error('Error adding job to queue:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    
    // Buscar todos os jobs na fila
    const queueSnapshot = await db
      .collection('socialMediaQueue')
      .orderBy('queuePosition', 'asc')
      .get();

    const queueJobs = queueSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      queueJobs,
      totalJobs: queueJobs.length
    });

  } catch (error: any) {
    console.error('Error fetching social media queue:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = getAdminFirestore();
    const { queueId } = await request.json();

    if (!queueId) {
      return NextResponse.json(
        { error: 'Queue ID is required' },
        { status: 400 }
      );
    }

    // Remover job da fila
    await db.collection('socialMediaQueue').doc(queueId).delete();

    return NextResponse.json({
      success: true,
      message: 'Job removed from queue'
    });

  } catch (error: any) {
    console.error('Error removing job from queue:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}
