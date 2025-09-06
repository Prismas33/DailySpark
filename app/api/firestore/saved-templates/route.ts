import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    // Get saved templates
    const templatesSnapshot = await db.collection('savedTemplates').get();
    
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
    const templateRef = await db.collection('savedTemplates').add({
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
    await db.collection('savedTemplates').doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: error.message || 'Error deleting template' },
      { status: 500 }
    );
  }
}
