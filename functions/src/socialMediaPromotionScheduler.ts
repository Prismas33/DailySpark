import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';
import { logSystemActivity } from "./logSystem";

// Telegram and LinkedIn configuration - Using Firebase Functions config
// Moved config loading inside functions to avoid initialization timeouts

/**
 * Validates LinkedIn token has the required scopes
 * @param token LinkedIn API access token
 * @returns boolean indicating if token has required scopes
 */
async function validateLinkedInToken(token: string): Promise<boolean> {
  try {
    const response = await axios.get('https://api.linkedin.com/v2/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // If we can fetch the profile, the token has at least basic access
    if (response.data && response.data.id) {
      console.log('[SocialMedia] LinkedIn token validation successful - profile access confirmed');
      
      // Additional validation: Try to check token info for scopes
      try {
        const tokenInfo = await axios.get('https://api.linkedin.com/v2/introspectToken', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
          const scopes = tokenInfo.data?.scope?.split(' ') || [];
        const requiredScopes = ['r_basicprofile', 'w_organization_social', 'r_organization_admin'];
        const hasAllScopes = requiredScopes.every(scope => scopes.includes(scope));
        
        if (hasAllScopes) {
          console.log('[SocialMedia] LinkedIn token has all required scopes:', requiredScopes.join(', '));
          return true;
        } else {
          const missingScopes = requiredScopes.filter(scope => !scopes.includes(scope));
          console.warn('[SocialMedia] LinkedIn token missing required scopes:', missingScopes.join(', '));
          console.warn('[SocialMedia] Available scopes:', scopes.join(', '));
          return false;
        }
      } catch (scopeError: any) {
        // If introspection fails, but we can access profile, assume token is valid
        // This is because LinkedIn's introspection endpoint might not be available for all tokens
        console.log('[SocialMedia] LinkedIn scope introspection failed, but profile access works - proceeding');
        return true;
      }
    }
    
    return false;
  } catch (err: any) {
    if (err?.response?.data) {
      console.error('[SocialMedia] LinkedIn token validation failed:', err.response.data);
    } else {
      console.error('[SocialMedia] LinkedIn token validation failed:', err.message);
    }
    return false;
  }
}

/**
 * Gets the LinkedIn organization ID for company page posting
 * @param token LinkedIn API access token
 */
export async function getLinkedInOrganizationId(token: string): Promise<string | null> {
  try {
    // First, get organizations where user is admin
    const response = await axios.get('https://api.linkedin.com/v2/organizationAcls?q=roleAssignee', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
    
    // Find the first organization where user has admin rights
    const organizations = response.data.elements || [];
    const adminOrg = organizations.find((org: any) => 
      org.role === 'ADMINISTRATOR' || org.role === 'MANAGER'
    );
    
    if (adminOrg) {
      // Extract organization ID from the organization URN
      const orgUrn = adminOrg.organization;
      const orgId = orgUrn.replace('urn:li:organization:', '');
      console.log('[SocialMedia] Found LinkedIn organization ID:', orgId);
      return orgId;
    }
    
    console.error('[SocialMedia] No organization found with admin rights');
    return null;
  } catch (err: any) {
    if (err && err.response && err.response.data) {
      console.error('[SocialMedia] Error fetching LinkedIn organization ID:', err.response.data);
    } else {
      console.error('[SocialMedia] Error fetching LinkedIn organization ID:', err);
    }
    return null;
  }
}

/**
 * Uploads an image to LinkedIn and returns the media URN
 * @param imageUrl URL of the image to upload
 * @param token LinkedIn access token
 * @param organizationId Organization ID for the upload
 * @returns Media URN or null if upload fails
 */
export async function uploadImageToLinkedIn(imageUrl: string, token: string, organizationId?: string): Promise<string | null> {
  try {
    console.log('[SocialMedia] Starting LinkedIn image upload process...');
    
    // Step 1: Register upload - use organization ID (required)
    if (!organizationId) {
      console.error('[SocialMedia] Organization ID is required for image upload');
      return null;
    }
    
    const author = `urn:li:organization:${organizationId}`;
    
    const registerUploadBody = {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: author,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }
        ]
      }
    };

    const registerResponse = await axios.post(
      'https://api.linkedin.com/v2/assets?action=registerUpload',
      registerUploadBody,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );    const uploadMechanism = registerResponse.data.value?.uploadMechanism;
    const uploadUrl = uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
    const asset = registerResponse.data.value?.asset;

    if (!uploadUrl || !asset) {
      console.error('[SocialMedia] Failed to get upload URL from LinkedIn');
      return null;
    }

    // Step 2: Download the image
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

    // Step 3: Upload the image binary
    await axios.post(uploadUrl, imageBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });

    console.log('[SocialMedia] Image uploaded successfully to LinkedIn');
    return asset;
  } catch (error: any) {
    console.error('[SocialMedia] Error uploading image to LinkedIn:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Posts a job on LinkedIn using the official API
 * @param job Job to be posted
 */
async function postToLinkedIn(job: SocialMediaJob): Promise<boolean> {
  try {
    // Get LinkedIn credentials from environment variables
    const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
    const LINKEDIN_ORGANIZATION_ID = process.env.LINKEDIN_ORGANIZATION_ID;
    
    if (!LINKEDIN_ACCESS_TOKEN || !LINKEDIN_ORGANIZATION_ID) {
      console.error('[SocialMedia] LinkedIn credentials not configured');
      return false;
    }
    
    if (!job.title || !job.companyName) {
      console.error(`[SocialMedia] Cannot post job ${job.id} to LinkedIn: Missing title or companyName`);
      return false;
    }
    
    // Validate token has required scopes
    const tokenValid = await validateLinkedInToken(LINKEDIN_ACCESS_TOKEN);
    if (!tokenValid) {
      console.error(
        '[SocialMedia] LinkedIn token validation failed - required scopes: ' +
        'r_basicprofile, w_organization_social, r_organization_admin'
      );
      return false;
    }
    
    // Use custom message if present, else build default
    const postText = job.shortDescription ||
      `🚀 New job: ${job.title}\nCompany: ${job.companyName}` +
      (job.location ? `\nLocation: ${job.location}` : '') +
      (job.salary ? `\nSalary: ${job.salary}` : '') +
      `\n\nSee details: https://gate33.net/jobs/${job.id}`;
    
    // Use organization ID from environment (Gate33)
    const organizationId = LINKEDIN_ORGANIZATION_ID;
    let payload: any;
    let mediaUrn: string | null = null;
    
    // Try to upload image if mediaUrl is provided
    if (job.mediaUrl) {
      console.log('[SocialMedia] Attempting to upload image to LinkedIn...');
      mediaUrn = await uploadImageToLinkedIn(job.mediaUrl, LINKEDIN_ACCESS_TOKEN!, organizationId);
      if (mediaUrn) {
        console.log('[SocialMedia] Image uploaded successfully, URN:', mediaUrn);
      } else {
        console.log('[SocialMedia] Image upload failed, posting text-only');
      }
    }
    
    // Build the payload for LinkedIn (organization page only)
    payload = {
      author: `urn:li:organization:${organizationId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: postText
          },
          shareMediaCategory: mediaUrn ? 'IMAGE' : 'NONE',
          ...(mediaUrn ? {
            media: [{
              status: 'READY',
              media: mediaUrn
            }]
          } : {})
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };
    console.log(`[SocialMedia] Using organization ${organizationId} for posting`);
    // Log token status (not the actual token)
    console.log(`[SocialMedia] LinkedIn token exists: ${!!LINKEDIN_ACCESS_TOKEN}`);
    console.log(`[SocialMedia] LinkedIn token length: ${LINKEDIN_ACCESS_TOKEN ? LINKEDIN_ACCESS_TOKEN.length : 0}`);
    // Make the POST to LinkedIn API
    const response = await axios.post(
      'https://api.linkedin.com/v2/ugcPosts',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json'
        }
      }
    );
    if (response.status === 201) {
      console.log(`[SocialMedia] Job "${job.title}" successfully posted to LinkedIn`);
      return true;
    } else {
      console.error(`[SocialMedia] Failed to post job to LinkedIn:`, response.data);
      return false;
    }
  } catch (error: any) {
    if (error?.response?.data) {
      console.error(`[SocialMedia] Error posting to LinkedIn:`, error.response.data);
    } else {
      console.error(`[SocialMedia] Error posting to LinkedIn:`, error);
    }
    return false;
  }
}

/**
 * Sends a message to the Telegram channel
 * @param job The job to be posted
 * @returns boolean indicating success or failure
 */
async function postToTelegram(job: SocialMediaJob): Promise<boolean> {
  try {
    console.log('🟢 [TELEGRAM] Function postToTelegram called with job:', job.id);
    console.log('🟢 [TELEGRAM] Job title:', job.title);
    
    // Get Telegram credentials from environment variables (Firebase Functions v2 compatible)
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
    
    if (!job.title || !job.companyName) {
      console.error(`[SocialMedia] Cannot post job ${job.id} to Telegram: Missing title or companyName`);
      return false;
    }

    // Use the template message directly - SAME AS LINKEDIN AND X
    const message = job.shortDescription;
    const hasMedia = !!job.mediaUrl;
    // Log token and channel ID status (not the actual token)
    console.log(`[SocialMedia] Telegram bot token exists: ${!!TELEGRAM_BOT_TOKEN}`);
    console.log(`[SocialMedia] Telegram bot token length: ${TELEGRAM_BOT_TOKEN ? TELEGRAM_BOT_TOKEN.length : 0}`);
    console.log(`[SocialMedia] Telegram channel ID: ${TELEGRAM_CHANNEL_ID}`);
    
    // Try to verify bot is working first
    try {
      const botCheck = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
      console.log(`[SocialMedia] Telegram bot check:`, botCheck.data);
    } catch (e: any) {
      console.error(`[SocialMedia] Telegram bot check failed:`, e.response?.data || e.message);
    }
    
    // Telegram API endpoint to send messages
    const url = hasMedia
      ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`
      : `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    // Request parameters
    const data = hasMedia
      ? {
          chat_id: TELEGRAM_CHANNEL_ID,
          photo: job.mediaUrl,
          caption: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        }
      : {
          chat_id: TELEGRAM_CHANNEL_ID,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        };
    
    // Make the POST request to Telegram API
    const response = await axios.post(url, data);
    
    if (response.status === 200 && response.data.ok) {
      console.log('🟢 [TELEGRAM] SUCCESS! Job posted to Telegram:', job.title);
      console.log('🟢 [TELEGRAM] Response:', response.data);
      return true;
    } else {
      console.error('🔴 [TELEGRAM] FAILED! Response not OK:', response.data);
      return false;
    }
  } catch (error) {
    console.error('🔴 [TELEGRAM] EXCEPTION in postToTelegram:', error);
    const err = error as any;
    if (err && err.response && err.response.data) {
      console.error('🔴 [TELEGRAM] Error details:', err.response.data);
    } else {
      console.error('🔴 [TELEGRAM] General error:', error);
    }
    return false;
  }
}

/**
 * Posts a job to X (Twitter) using API v2
 */
async function postToX(job: SocialMediaJob): Promise<boolean> {
  try {
    console.log('🟢 [TWITTER] Function postToX called with job:', job.id);
    console.log('🟢 [TWITTER] Job title:', job.title);
    
    // Get credentials from environment variables (Firebase Functions v2 compatible)
    // Get credentials from environment variables
    const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
    const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
    const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
    const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
    const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;
    
    console.log('[SocialMedia] Loading Twitter credentials from environment variables...');
    console.log('[SocialMedia] Available credentials:', {
      hasBearerToken: !!TWITTER_BEARER_TOKEN,
      hasApiKey: !!TWITTER_API_KEY,
      hasApiSecret: !!TWITTER_API_SECRET,
      hasAccessToken: !!TWITTER_ACCESS_TOKEN,
      hasAccessTokenSecret: !!TWITTER_ACCESS_TOKEN_SECRET
    });
    
    // For posting tweets, OAuth 1.0a User Context is REQUIRED - Bearer Token won't work
    if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET) {
      console.error('[SocialMedia] Twitter OAuth 1.0a credentials not configured (required for posting)');
      console.error('[SocialMedia] Missing credentials details:', {
        hasApiKey: !!TWITTER_API_KEY,
        hasApiSecret: !!TWITTER_API_SECRET,
        hasAccessToken: !!TWITTER_ACCESS_TOKEN,
        hasAccessTokenSecret: !!TWITTER_ACCESS_TOKEN_SECRET,
        apiKeyLength: TWITTER_API_KEY ? TWITTER_API_KEY.length : 0,
        apiSecretLength: TWITTER_API_SECRET ? TWITTER_API_SECRET.length : 0,
        accessTokenLength: TWITTER_ACCESS_TOKEN ? TWITTER_ACCESS_TOKEN.length : 0,
        accessTokenSecretLength: TWITTER_ACCESS_TOKEN_SECRET ? TWITTER_ACCESS_TOKEN_SECRET.length : 0
      });
      return false;
    }
    
    if (!job.title || !job.companyName) {
      console.error(`[SocialMedia] Cannot post job ${job.id} to X: Missing title or companyName`);
      return false;
    }
    
    // Initialize Twitter client - MUST use OAuth 1.0a for posting (Bearer Token doesn't work)
    let twitterClient: TwitterApi;
    console.log('[SocialMedia] Using OAuth 1.0a authentication (required for posting)');
    console.log('[SocialMedia] Credential lengths:', {
      apiKeyLength: TWITTER_API_KEY!.length,
      apiSecretLength: TWITTER_API_SECRET!.length,
      accessTokenLength: TWITTER_ACCESS_TOKEN!.length,
      accessTokenSecretLength: TWITTER_ACCESS_TOKEN_SECRET!.length
    });
    
    try {
      twitterClient = new TwitterApi({
        appKey: TWITTER_API_KEY!,
        appSecret: TWITTER_API_SECRET!,
        accessToken: TWITTER_ACCESS_TOKEN!,
        accessSecret: TWITTER_ACCESS_TOKEN_SECRET!,
      });
      console.log('[SocialMedia] TwitterApi client created successfully');
    } catch (initError: any) {
      console.error('[SocialMedia] Failed to initialize TwitterApi client:', initError.message);
      return false;
    }
    
    // Use custom message if present, else build default
    let postText = job.shortDescription || formatXMessage(job);
    
    // X has 280 character limit, so we need to truncate if necessary
    if (postText.length > 280) {
      // Reserve space for job link
      const jobUrl = `https://gate33.net/jobs/${job.id}`;
      const maxTextLength = 280 - jobUrl.length - 3; // 3 for "..." or spaces
      postText = postText.substring(0, maxTextLength).trim() + '...';
      postText += ` ${jobUrl}`;
    }
    
    console.log('[SocialMedia] Posting to X:', { text: postText, length: postText.length });
    
    // Post the tweet
    let tweetData: any = { text: postText };
    
    // If there's a media URL, try to upload it
    if (job.mediaUrl) {
      try {
        console.log('[SocialMedia] Attempting to upload media to X...');
        console.log('[SocialMedia] Media URL:', job.mediaUrl);
        
        // Download the image first
        const imageResponse = await axios.get(job.mediaUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data);
        console.log('[SocialMedia] Image downloaded, size:', imageBuffer.length, 'bytes');
        
        // Upload media to Twitter using v1.1 (media upload is still v1.1 even with v2 posting)
        const mediaUpload = await twitterClient.v1.uploadMedia(imageBuffer, { 
          mimeType: imageResponse.headers['content-type'] || 'image/jpeg' 
        });
        
        tweetData.media = { media_ids: [mediaUpload] };
        console.log('[SocialMedia] Media uploaded to X successfully, ID:', mediaUpload);
      } catch (mediaError: any) {
        console.error('[SocialMedia] Failed to upload media to X:', mediaError.message);
        console.error('[SocialMedia] Media error details:', mediaError.response?.data || mediaError);
        // Continue without media
      }
    }
    
    // Send the tweet using v2 API with OAuth 1.0a User Context (available in FREE plan)
    console.log('[SocialMedia] Attempting to post tweet with text length:', postText.length);
    console.log('[SocialMedia] Tweet data:', { 
      textPreview: postText.substring(0, 100) + (postText.length > 100 ? '...' : ''),
      hasMedia: !!tweetData.media 
    });
    
    try {
      // Use v2 API which is available in FREE plan (unlike v1.1 which is limited)
      let tweetPayload: any = { text: postText };
      
      // Add media if available
      if (tweetData.media && tweetData.media.media_ids) {
        tweetPayload.media = { media_ids: tweetData.media.media_ids };
      }
      
      const tweet = await twitterClient.v2.tweet(tweetPayload);
      
      if (tweet.data && tweet.data.id) {
        console.log(`[SocialMedia] Successfully posted to X. Tweet ID: ${tweet.data.id}`);
        return true;
      } else {
        console.error('[SocialMedia] Failed to post to X: No tweet ID returned');
        console.error('[SocialMedia] Tweet response:', tweet);
        return false;
      }
    } catch (tweetError: any) {
      console.error('[SocialMedia] Error during tweet posting:', tweetError.message);
      console.error('[SocialMedia] Tweet error details:', tweetError.response?.data || tweetError);
      return false;
    }
    
  } catch (error: any) {
    console.error('[SocialMedia] Error posting to X:', error.message);
    if (error.data) {
      console.error('[SocialMedia] X API Error details:', error.data);
    }
    return false;
  }
}

// Function to format the message for X (Twitter)
function formatXMessage(job: SocialMediaJob): string {
  const baseUrl = 'https://gate33.net';
  const jobUrl = `${baseUrl}/jobs/${job.id}`;
  
  // Build concise message for X (280 char limit)
  let message = `🚀 ${job.title}`;
  if (job.companyName) {
    message += ` at ${job.companyName}`;
  }
  
  // Add location if available and space permits
  if (job.location && (message.length + job.location.length + 4) < 200) {
    message += ` in ${job.location}`;
  }
  
  // Add salary if available and space permits
  if (job.salary && (message.length + job.salary.length + 10) < 200) {
    message += `\n💰 ${job.salary}`;
  }
  
  message += `\n\n${jobUrl}`;
  message += '\n\n#Jobs #Gate33 #Opportunity';
  
  return message;
}

// Export utility functions for external use
export { postToLinkedIn, postToTelegram, postToX };

// Function to render a custom template
export function renderTemplateFromJob(template: string, job: SocialMediaJob): string {
  return template
    .replace(/{{\s*title\s*}}/gi, job.title || "")
    .replace(/{{\s*companyName\s*}}/gi, job.companyName || "")
    .replace(/{{\s*mediaUrl\s*}}/gi, job.mediaUrl || "")
    .replace(/{{\s*id\s*}}/gi, job.id || "")
    .replace(/{{\s*jobUrl\s*}}/gi, `https://gate33.net/jobs/${job.id}`); // Fixed to .net
}

// SocialMediaJob interface with additional fields
export interface SocialMediaJob {
  id: string;
  title?: string;
  companyName?: string;
  socialMediaPromotion?: number;
  socialMediaPromotionCount?: number;
  socialMediaPromotionLastSent?: string | null;
  createdAt?: string | Date;
  expiresAt?: string | Date;
  duration?: number; // in days, if exists
  location?: string;
  salary?: string;
  shortDescription?: string;
  jobType?: string;
  mediaUrl?: string; // media/image URL for social post
  // other relevant fields
}

function getJobLifetimeDays(job: SocialMediaJob): number {
  if (job.createdAt && job.expiresAt) {
    const start = new Date(job.createdAt);
    const end = new Date(job.expiresAt);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }
  if (job.duration) return job.duration;
  // fallback: 30 days
  return 30;
}

function getMinIntervalHours(job: SocialMediaJob): number {
  const totalPosts = job.socialMediaPromotion ?? 1;
  const lifetimeDays = getJobLifetimeDays(job);
  // Distribute equally over the job's lifetime
  return (lifetimeDays / totalPosts) * 24;
}

function canSendAgainByPlan(job: SocialMediaJob): boolean {
  const lastSent = job.socialMediaPromotionLastSent ? new Date(job.socialMediaPromotionLastSent) : null;
  const minIntervalHours = getMinIntervalHours(job);
  if (!lastSent) return true;
  const now = new Date();
  const diff = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
  return diff >= minIntervalHours;
}

export async function runSocialMediaPromotionScheduler() {
  const db = getFirestore();
  const jobsRef = db.collection('jobs');
  const jobsSnapshot = await jobsRef.get();
  const jobs = jobsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as SocialMediaJob[];

  // Fetch centralized template and mediaUrl
  const templateSnap = await db.collection("config").doc("socialMediaTemplate").get();
  const templateData = (templateSnap && templateSnap.exists && typeof templateSnap.data === 'function')
    ? templateSnap.data() ?? {}
    : {};
  const template = templateData.template ||
    "🚀 New job: {{title}} at {{companyName}}!\nCheck it out and apply now!\n{{jobUrl}}";
  const templateMediaUrl = templateData.mediaUrl || "";

  for (const job of jobs) {
    if (
      (job.socialMediaPromotion ?? 0) > 0 &&
      (job.socialMediaPromotionCount ?? 0) < (job.socialMediaPromotion ?? 0) &&
      canSendAgainByPlan(job)
    ) {
      // Render message and prepare standardized object
      const message = renderTemplateFromJob(template, job);
      const jobForSend = { ...job, shortDescription: message, mediaUrl: job.mediaUrl || templateMediaUrl };
      // Post to social media
      const linkedInSuccess = await postToLinkedIn(jobForSend);
      const telegramSuccess = await postToTelegram(jobForSend);
      const xSuccess = await postToX(jobForSend);

      // Atualiza o contador se pelo menos um envio for bem-sucedido
      if (linkedInSuccess || telegramSuccess || xSuccess) {
        await jobsRef.doc(job.id).update({
          socialMediaPromotionCount: (job.socialMediaPromotionCount ?? 0) + 1,
          socialMediaPromotionLastSent: new Date().toISOString(),
        });
        console.log(
          `[SocialMedia] Job ${job.title} promovido (` +
          `${(job.socialMediaPromotionCount ?? 0) + 1}/` +
          `${job.socialMediaPromotion})`
        );
        // Log system activity for auditing
        await logSystemActivity(
          "system",
          "SocialMediaScheduler",
          {
            jobId: job.id,
            jobTitle: job.title,
            companyName: job.companyName,
            promotedPlatforms: [
              linkedInSuccess ? "LinkedIn" : null,
              telegramSuccess ? "Telegram" : null,
              xSuccess ? "X" : null
            ].filter(Boolean),
            timestamp: new Date().toISOString(),
            promotionCount: (job.socialMediaPromotionCount ?? 0) + 1,
            planLimit: job.socialMediaPromotion ?? 0
          }
        );
      }
    }
  }
  console.log('[SocialMedia] Scheduler run complete.');
}

export const scheduledSocialMediaPromotion = onSchedule(
  {
    schedule: "every 8 hours",
    timeZone: "Europe/Lisbon" // Lisbon timezone
  },
  async (event) => {
    await runSocialMediaPromotionScheduler();
  }
);

// If run directly, execute:
if (require.main === module) {
  runSocialMediaPromotionScheduler().then(() => process.exit(0));
}
