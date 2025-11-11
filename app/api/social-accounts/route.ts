import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import { getAdminFirestore } from '../../../lib/firebaseAdmin';

export async function GET() {
  try {
    const db = getAdminFirestore();
    
    // Buscar todas as contas conectadas
    const accountsSnapshot = await db.collection('socialAccounts').get();
    
    const accounts = accountsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        platform: data.platform,
        connected: data.connected || false,
        username: data.username,
        profileUrl: data.profileUrl,
        connectedAt: data.connectedAt,
        // Não enviar tokens por segurança
      };
    });

    // Garantir que todas as plataformas estão representadas
    const platforms = ['linkedin', 'facebook', 'twitter', 'instagram'];
    const accountsMap = new Map(accounts.map(acc => [acc.platform, acc]));
    
    const completeAccounts = platforms.map(platform => 
      accountsMap.get(platform) || {
        platform,
        connected: false,
        username: null,
        profileUrl: null,
        connectedAt: null
      }
    );

    return NextResponse.json({
      success: true,
      accounts: completeAccounts
    });

  } catch (error: any) {
    console.error('Error fetching social accounts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch social accounts' },
      { status: 500 }
    );
  }
}
