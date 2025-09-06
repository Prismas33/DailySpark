import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('Facebook OAuth error:', error);
    return NextResponse.redirect('/dashboard?error=facebook_auth_failed');
  }

  if (!code) {
    return NextResponse.redirect('/dashboard?error=missing_auth_code');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error?.message || 'Failed to get access token');
    }

    // Get user profile
    const profileResponse = await fetch(`https://graph.facebook.com/me?access_token=${tokenData.access_token}&fields=id,name,email`);
    const profile = await profileResponse.json();

    // TODO: Save connection to Firestore
    // - User ID  
    // - Platform: 'facebook'
    // - Access token (encrypted)
    // - Profile info
    // - Connection timestamp

    return NextResponse.redirect('/dashboard?connected=facebook');
  } catch (error) {
    console.error('Facebook OAuth callback error:', error);
    return NextResponse.redirect('/dashboard?error=facebook_connection_failed');
  }
}
