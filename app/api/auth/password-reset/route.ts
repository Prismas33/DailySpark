import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import { sendEmail } from '@/utils/emailService';

// Lazily import admin auth (avoid build issues if creds missing)
async function getAdminAuth() {
  const adminInit = initAdmin();
  if (!adminInit) return null;
  const admin = await import('firebase-admin');
  return admin.auth();
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email obrigatório' }, { status: 400 });
    }

    const adminAuth = await getAdminAuth();
    if (!adminAuth) {
      // Fallback: pedir uso do fluxo client
      return NextResponse.json({ success: false, error: 'Credenciais admin ausentes. Use fluxo client.' }, { status: 500 });
    }

    // Gera link de reset
    const link = await adminAuth.generatePasswordResetLink(email, {
      handleCodeInApp: false,
      url: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    });

    // Envia email customizado
    await sendEmail({
      to: email,
      subject: 'Redefinição de senha - DailySpark',
      text: `Você solicitou redefinir sua senha. Acesse: ${link}\nSe não foi você, ignore este email.`,
      html: `<p>Você solicitou redefinir sua senha.</p><p><a href="${link}" style="color:#10b981;font-weight:bold">Clique aqui para redefinir</a></p><p style="font-size:12px;color:#666">Se não foi você, ignore este email.</p>`
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Erro password reset:', err);
    return NextResponse.json({ success: false, error: 'Falha ao processar redefinição.' }, { status: 500 });
  }
}
