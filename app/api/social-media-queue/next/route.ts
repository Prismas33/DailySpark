import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '../../../../lib/firebaseAdmin';

export async function GET() {
  try {
    const db = getAdminFirestore();
    // Buscar o próximo job da fila (mais antigo primeiro - FIFO)
    const queueSnapshot = await db
      .collection('socialMediaQueue')
      .where('status', '==', 'pending')
      .orderBy('queuePosition', 'asc')
      .limit(1)
      .get();

    if (queueSnapshot.empty) {
      return NextResponse.json({
        success: true,
        nextJob: null,
        message: 'No jobs in queue'
      });
    }

    const nextJobDoc = queueSnapshot.docs[0];
    const nextJob = {
      id: nextJobDoc.id,
      ...nextJobDoc.data()
    };

    return NextResponse.json({
      success: true,
      nextJob,
      queuePosition: 1 // É sempre o primeiro da fila
    });

  } catch (error: any) {
    console.error('Error fetching next job from queue:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getAdminFirestore();
    const { queueId, status } = await request.json();

    if (!queueId || !status) {
      return NextResponse.json(
        { error: 'Queue ID and status are required' },
        { status: 400 }
      );
    }

    // Atualizar o status do job
    await db.collection('socialMediaQueue').doc(queueId).update({
      status,
      processedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Job status updated to ${status}`
    });

  } catch (error: any) {
    console.error('Error updating job status:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}
