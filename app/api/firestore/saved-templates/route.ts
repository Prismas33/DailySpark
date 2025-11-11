import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseServer';

export async function GET() {
  try {
    // Get saved templates
    if (!adminDb) throw new Error('Firebase Admin not initialized');
    const templatesSnapshot = await adminDb.collection('savedTemplates').get();
    
    const templates = templatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    console.error('Error fetching saved templates:', error);
    return NextResponse.json(
      { error: error.message || 'Error fetching saved templates' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, text } = await req.json();
    
    if (!name || !text) {
      return NextResponse.json({ error: 'Name and text are required' }, { status: 400 });
    }

    // Save new template
    if (!adminDb) throw new Error('Firebase Admin not initialized');
    const templateRef = await adminDb.collection('savedTemplates').add({
      name,
      text,
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true, id: templateRef.id });
  } catch (error: any) {
    console.error('Error saving template:', error);
    return NextResponse.json(
      { error: error.message || 'Error saving template' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    // Delete template
  if (!adminDb) throw new Error('Firebase Admin not initialized');
  await adminDb.collection('savedTemplates').doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: error.message || 'Error deleting template' },
      { status: 500 }
    );
  }
}
