import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseServer';

export async function GET() {
  try {
    // Get jobs with pending social media promotion
    if (!adminDb) throw new Error('Firebase Admin not initialized');
    const jobsSnapshot = await adminDb.collection('jobs').get();
    
    const jobs = jobsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((job: any) => 
        (job.socialMediaPromotion ?? 0) > 0 && 
        (job.socialMediaPromotionCount ?? 0) < (job.socialMediaPromotion ?? 0)
      );

    return NextResponse.json({ success: true, jobs });
  } catch (error: any) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: error.message || 'Error fetching jobs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Get specific job
  if (!adminDb) throw new Error('Firebase Admin not initialized');
  const jobDoc = await adminDb.collection('jobs').doc(jobId).get();
    
    if (!jobDoc.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

  const jobData = { id: jobDoc.id, ...jobDoc.data() };
    return NextResponse.json({ success: true, job: jobData });
  } catch (error: any) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { error: error.message || 'Error fetching job' },
      { status: 500 }
    );
  }
}
