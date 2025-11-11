import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseServer';

export async function GET() {
  try {
    // Get template configuration
    if (!adminDb) throw new Error('Firebase Admin not initialized');
    const templateDoc = await adminDb.collection('config').doc('socialMediaTemplate').get();
    
    if (templateDoc.exists) {
      const data = templateDoc.data();
      return NextResponse.json({ 
        success: true, 
        template: data?.template || '',
        mediaUrl: data?.mediaUrl || ''
      });
    } else {
      return NextResponse.json({ 
        success: true, 
        template: '',
        mediaUrl: ''
      });
    }
  } catch (error: any) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: error.message || 'Error fetching template' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { template, mediaUrl } = await req.json();
    
    // Save template configuration
    if (!adminDb) throw new Error('Firebase Admin not initialized');
    await adminDb.collection('config').doc('socialMediaTemplate').set({
      template: template || '',
      mediaUrl: mediaUrl || '',
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving template:', error);
    return NextResponse.json(
      { error: error.message || 'Error saving template' },
      { status: 500 }
    );
  }
}
