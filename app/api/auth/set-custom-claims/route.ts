import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const initialized = initAdmin();
    if (!initialized) {
      return NextResponse.json({ error: 'Firebase Admin não inicializado' }, { status: 500 });
    }

    const { uid, claims } = await req.json();
    if (!uid || typeof claims !== 'object') {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    // Importa dinamicamente para evitar problemas na edge
    const { getAuth } = await import('firebase-admin/auth');
    await getAuth().setCustomUserClaims(uid, claims);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao definir custom claims:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
