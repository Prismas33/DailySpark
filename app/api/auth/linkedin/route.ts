import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('LinkedIn OAuth error:', error);
    return NextResponse.redirect('/dashboard?error=linkedin_auth_failed');
  }

  if (!code) {
    return NextResponse.redirect('/dashboard?error=missing_auth_code');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || 'Failed to get access token');
    }

    // Get user profile
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const profile = await profileResponse.json();

    // TODO: Save connection to Firestore
    // - User ID
    // - Platform: 'linkedin'
    // - Access token (encrypted)
    // - Profile info
    // - Connection timestamp

    return NextResponse.redirect('/dashboard?connected=linkedin');
  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error);
    return NextResponse.redirect('/dashboard?error=linkedin_connection_failed');
  }
}
