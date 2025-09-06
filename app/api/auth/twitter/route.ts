import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('Twitter OAuth error:', error);
    return NextResponse.redirect('/dashboard?error=twitter_auth_failed');
  }

  if (!code) {
    return NextResponse.redirect('/dashboard?error=missing_auth_code');
  }

  try {
    // Twitter uses OAuth 2.0 with PKCE
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: process.env.TWITTER_CLIENT_ID!,
        redirect_uri: process.env.TWITTER_REDIRECT_URI!,
        code_verifier: state!, // PKCE code verifier stored in state
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || 'Failed to get access token');
    }

    // Get user profile
    const profileResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const profile = await profileResponse.json();

    // TODO: Save connection to Firestore
    // - User ID
    // - Platform: 'twitter'
    // - Access token (encrypted)
    // - Profile info  
    // - Connection timestamp

    return NextResponse.redirect('/dashboard?connected=twitter');
  } catch (error) {
    console.error('Twitter OAuth callback error:', error);
    return NextResponse.redirect('/dashboard?error=twitter_connection_failed');
  }
}
