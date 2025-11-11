import { onRequest } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import { logSystemActivity } from "./logSystem";
import * as cors from 'cors';
import { TwitterApi } from 'twitter-api-v2';

// Configurar CORS
const allowedOrigins = [
  'https://gate33.net',
  'https://www.gate33.net',
  'https://gate33.me',
  'https://www.gate33.me'
];
const corsHandler = (cors.default || cors)({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (
      origin.startsWith('http://localhost:') ||
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  }
});

/**
 * Extract storage path from Firebase Storage URL
 * Example: https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile.jpg?alt=media
 * Returns: path/to/file.jpg
 */
function extractStoragePathFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/o\/(.+?)\?/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    return null;
  } catch (error) {
    console.error('[Storage] Error extracting path from URL:', error);
    return null;
  }
}

/**
 * Clean up media from Firebase Storage after successful post
 */
async function cleanupStorageMedia(mediaUrl: string): Promise<void> {
  if (!mediaUrl || !mediaUrl.includes('firebasestorage.googleapis.com')) {
    return; // Not a Firebase Storage URL, skip
  }
  
  try {
    const storage = getStorage();
    const mediaPath = extractStoragePathFromUrl(mediaUrl);
    
    if (mediaPath) {
      await storage.bucket().file(mediaPath).delete();
      console.log(`[ManualSocialMedia] ✅ Cleaned up media from Storage: ${mediaPath}`);
    } else {
      console.warn(`[ManualSocialMedia] ⚠️ Could not extract storage path from URL: ${mediaUrl}`);
    }
  } catch (cleanupError: any) {
    // Don't fail the whole process if cleanup fails
    console.warn(`[ManualSocialMedia] ⚠️ Failed to clean up media:`, cleanupError.message);
  }
}

/**
 * Post manual content directly to X/Twitter using OAuth 1.0a
 */
async function postManualToX(text: string, imageUrl?: string): Promise<boolean> {
  try {
    const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
    const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
    const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
    const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;

    if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET) {
      console.error('🔴 [TWITTER] Missing environment variables');
      return false;
    }

    // Initialize Twitter client with OAuth 1.0a (required for posting)
    const twitterClient = new TwitterApi({
      appKey: TWITTER_API_KEY,
      appSecret: TWITTER_API_SECRET,
      accessToken: TWITTER_ACCESS_TOKEN,
      accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
    });

    let tweetOptions: any = { text };

    // If there's an image, add it directly (like Telegram)
    if (imageUrl) {
      console.log('🔄 [TWITTER] Adding image to tweet...');
      try {
        // Download the image
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          console.error('🔴 [TWITTER] Failed to download image:', imageResponse.statusText);
        } else {
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          
          // Upload image to Twitter
          const mediaUpload = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: 'image/jpeg' });
          tweetOptions.media = { media_ids: [mediaUpload] };
          console.log('🟢 [TWITTER] Image uploaded successfully');
        }
      } catch (imageError: any) {
        console.error('🟡 [TWITTER] Failed to upload image, posting text only:', imageError.message);
      }
    }

    // Use Twitter API v2 with OAuth 1.0a authentication
    const tweet = await twitterClient.v2.tweet(tweetOptions);
    
    if (tweet.data && tweet.data.id) {
      console.log('🟢 [TWITTER] Manual post sent successfully. Tweet ID:', tweet.data.id);
      return true;
    } else {
      console.error('🔴 [TWITTER] Failed to send manual post: No tweet ID returned');
      return false;
    }
  } catch (error: any) {
    console.error('🔴 [TWITTER] Error sending manual post:', error.message);
    return false;
  }
}

/**
 * Post manual content directly to LinkedIn (text + image support)
 */
async function postManualToLinkedIn(text: string, imageUrl?: string): Promise<boolean> {
  try {
    const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
    const LINKEDIN_PERSON_ID = process.env.LINKEDIN_PERSON_ID;

    console.log('[LinkedIn] 🔍 DEBUG - Using Person ID:', LINKEDIN_PERSON_ID);

    if (!LINKEDIN_ACCESS_TOKEN || !LINKEDIN_PERSON_ID) {
      console.error('🔴 [LINKEDIN] Missing access token or person ID');
      return false;
    }

    const url = 'https://api.linkedin.com/v2/ugcPosts';
    
    let payload: any = {
      author: `urn:li:person:${LINKEDIN_PERSON_ID}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: text
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    // Note: Image upload for personal profiles works differently than organizations
    // For now, posting text-only to personal profile
    if (imageUrl) {
      console.warn('� [LINKEDIN] Image uploads not supported for personal profiles, posting text only');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 201) {
      console.log('🟢 [LINKEDIN] Manual post sent successfully');
      return true;
    } else {
      const errorData = await response.text();
      console.error('🔴 [LINKEDIN] Failed to send manual post:', errorData);
      return false;
    }
  } catch (error: any) {
    console.error('🔴 [LINKEDIN] Error sending manual post:', error.message);
    return false;
  }
}

/**
 * Posts custom content to selected social media platforms
 */
async function postCustomContentToPlatforms(postData: {
  text: string;
  platforms: string[];
  imageUrl?: string;
}) {
  const results = [];
  console.log('[ManualSocialMedia] Starting custom post to platforms:', postData.platforms);

  for (const platform of postData.platforms) {
    let postText = postData.text;

    try {
      let success = false;
      
      switch (platform) {
        case 'linkedin':
          console.log('[ManualSocialMedia] Posting to LinkedIn...');
          success = await postManualToLinkedIn(postText, postData.imageUrl);
          results.push({
            platform: 'linkedin',
            success,
            message: success ? 'Successfully posted to LinkedIn' : 'Failed to post to LinkedIn',
            postId: success ? `linkedin_${Date.now()}` : null
          });
          break;
          
        case 'x':
          console.log('[ManualSocialMedia] Posting to X...');
          success = await postManualToX(postText, postData.imageUrl);
          results.push({
            platform: 'x',
            success,
            message: success ? 'Successfully posted to X' : 'Failed to post to X',
            postId: success ? `x_${Date.now()}` : null
          });
          break;
          
        default:
          results.push({
            platform,
            success: false,
            message: `Platform '${platform}' is not supported`
          });
      }
      
      console.log(`[ManualSocialMedia] ${platform} result:`, success);
      
    } catch (error: any) {
      console.error(`[ManualSocialMedia] Error posting to ${platform}:`, error.message);
      results.push({
        platform,
        success: false,
        message: `Error posting to ${platform}: ${error.message}`
      });
    }
  }

  return results;
}

// HTTP function for manual sending
export const manualSocialMediaPromotion = onRequest(async (req, res) => {
  // Enable CORS
  corsHandler(req, res, async () => {

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const requestBody = req.body;
      console.log('[ManualSocialMedia] Request body:', JSON.stringify(requestBody, null, 2));

      // Handle new manual posting format
      if (requestBody.type === 'manual') {
        const { text, platforms, imageUrl } = requestBody;
        
        if (!text || !platforms || platforms.length === 0) {
          res.status(400).json({ error: "Text and at least one platform are required for manual posting" });
          return;
        }

        console.log('[ManualSocialMedia] Processing manual post request');

        // Send to selected platforms
        const results = await postCustomContentToPlatforms({
          text,
          platforms,
          imageUrl
        });

        // Clean up media from Storage if at least one platform succeeded
        const anySuccess = results.some(r => r.success);
        if (anySuccess && imageUrl) {
          await cleanupStorageMedia(imageUrl);
        }

        // Log the manual post activity
        await logSystemActivity(
          "admin_action",
          "ManualSocialMediaPost",
          {
            type: "manual",
            platforms,
            textLength: text.length,
            hasImage: !!imageUrl,
            results,
            timestamp: new Date().toISOString(),
          }
        );

        console.log('[ManualSocialMedia] Manual post results:', results);
        
        res.status(200).json({
          success: true,
          results,
          message: 'Manual post processed'
        });
        return;
      }

      // Legacy job posting removed - system now only supports manual social media posts
      // If you receive this error, update your client to use type: 'manual' format
      res.status(400).json({ 
        error: "Job posting is no longer supported. Use type: 'manual' with text, platforms, and imageUrl instead.",
        hint: "System now only supports manual social media posts (not job promotion)"
      });

    } catch (err: any) {
      console.error("[ManualSocialMedia] Error:", err);
      res.status(500).json({ error: err.message || "Internal error" });
    }
  });
});
