import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('Instagram OAuth error:', error);
    return NextResponse.redirect('/dashboard?error=instagram_auth_failed');
  }

  if (!code) {
    return NextResponse.redirect('/dashboard?error=missing_auth_code');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID!,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_message || 'Failed to get access token');
    }

    // Get user profile
    const profileResponse = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${tokenData.access_token}`);
    const profile = await profileResponse.json();

    // TODO: Save connection to Firestore
    // - User ID
    // - Platform: 'instagram'  
    // - Access token (encrypted)
    // - Profile info
    // - Connection timestamp

    return NextResponse.redirect('/dashboard?connected=instagram');
  } catch (error) {
    console.error('Instagram OAuth callback error:', error);
    return NextResponse.redirect('/dashboard?error=instagram_connection_failed');
  }
}
