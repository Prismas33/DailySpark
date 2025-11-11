import { getFirestore } from "firebase-admin/firestore";
// import { onSchedule } from "firebase-functions/v2/scheduler"; // Disabled - no longer using job scheduler
import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';
import { logSystemActivity } from "./logSystem";

// Social Media configuration - Using Firebase Functions config
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
 * Uploads media (image or video) to LinkedIn and returns the media URN
 * @param mediaUrl URL of the media to upload
 * @param token LinkedIn access token
 * @param authorId Person ID or Organization ID for the upload
 * @param isVideo Whether the media is a video (default: false)
 * @returns Media URN or null if upload fails
 */
export async function uploadMediaToLinkedIn(mediaUrl: string, token: string, authorId?: string, isVideo: boolean = false): Promise<string | null> {
  try {
    console.log(`[SocialMedia] Starting LinkedIn ${isVideo ? 'video' : 'image'} upload process...`);
    
    // Step 1: Register upload - use person or organization ID
    if (!authorId) {
      console.error('[SocialMedia] Author ID (person or organization) is required for media upload');
      return null;
    }
    
    // Determine if it's a person or organization URN
    const author = authorId.includes(':') ? authorId : `urn:li:person:${authorId}`;
    
    // Choose the appropriate recipe based on media type
    const recipe = isVideo ? 'urn:li:digitalmediaRecipe:feedshare-video' : 'urn:li:digitalmediaRecipe:feedshare-image';
    
    const registerUploadBody = {
      registerUploadRequest: {
        recipes: [recipe],
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

    // Step 2: Download the media
    const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
    const mediaBuffer = Buffer.from(mediaResponse.data);

    // Step 3: Upload the media binary
    await axios.post(uploadUrl, mediaBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });

    console.log(`[SocialMedia] ${isVideo ? 'Video' : 'Image'} uploaded successfully to LinkedIn`);
    return asset;
  } catch (error: any) {
    console.error(`[SocialMedia] Error uploading ${isVideo ? 'video' : 'image'} to LinkedIn:`, error.response?.data || error.message);
    return null;
  }
}

// Keep backward compatibility alias
export async function uploadImageToLinkedIn(imageUrl: string, token: string, authorId?: string): Promise<string | null> {
  return uploadMediaToLinkedIn(imageUrl, token, authorId, false);
}

/**
 * Posts a job on LinkedIn using the official API
 * @param job Job to be posted
 */
async function postToLinkedIn(job: SocialMediaJob): Promise<boolean> {
  try {
    // Get LinkedIn credentials from environment variables
    const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
    const LINKEDIN_PERSON_ID = process.env.LINKEDIN_PERSON_ID;
    
    console.log('[LinkedIn] 🔍 DEBUG - Using Person ID:', LINKEDIN_PERSON_ID);
    
    if (!LINKEDIN_ACCESS_TOKEN || !LINKEDIN_PERSON_ID) {
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
        'r_basicprofile, w_member_social'
      );
      return false;
    }
    
    // Use custom message if present, else build default
    const postText = job.shortDescription ||
      `🚀 New job: ${job.title}\nCompany: ${job.companyName}` +
      (job.location ? `\nLocation: ${job.location}` : '') +
      (job.salary ? `\nSalary: ${job.salary}` : '') +
      `\n\nSee details: https://gate33.net/jobs/${job.id}`;
    
    // Use person ID from environment (Personal Profile)
    const personId = LINKEDIN_PERSON_ID;
    let payload: any;
    
    // Check if there's media to upload
    let mediaUrn: string | null = null;
    let mediaCategory: 'IMAGE' | 'VIDEO' | 'NONE' = 'NONE';
    
    if (job.mediaUrl) {
      console.log('[LinkedIn] Media URL detected, attempting upload:', job.mediaUrl);
      
      // Detect if it's a video based on URL extension or content type
      const isVideo = /\.(mp4|mov|avi|wmv|flv|webm)$/i.test(job.mediaUrl);
      
      // LinkedIn personal profiles support image and video upload
      mediaUrn = await uploadMediaToLinkedIn(job.mediaUrl, LINKEDIN_ACCESS_TOKEN, personId, isVideo);
      if (mediaUrn) {
        mediaCategory = isVideo ? 'VIDEO' : 'IMAGE';
        console.log(`[LinkedIn] ${mediaCategory} uploaded successfully, URN:`, mediaUrn);
      } else {
        console.warn('[LinkedIn] Media upload failed, posting text-only');
      }
    }
    
    // Build the payload for LinkedIn (personal profile)
    if (mediaUrn && mediaCategory !== 'NONE') {
      // Post with image or video
      payload = {
        author: `urn:li:person:${personId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: postText
            },
            shareMediaCategory: mediaCategory,
            media: [
              {
                status: 'READY',
                description: {
                  text: mediaCategory === 'VIDEO' ? 'Post video' : 'Post image'
                },
                media: mediaUrn,
                title: {
                  text: job.title || 'Post'
                }
              }
            ]
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };
    } else {
      // Text-only post
      payload = {
        author: `urn:li:person:${personId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: postText
            },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };
    }
    console.log(`[SocialMedia] Posting to personal profile (${personId})`);
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
        
        // Download the media first
        const mediaResponse = await axios.get(job.mediaUrl, { responseType: 'arraybuffer' });
        const mediaBuffer = Buffer.from(mediaResponse.data);
        const contentType = mediaResponse.headers['content-type'] || 'image/jpeg';
        console.log('[SocialMedia] Media downloaded, size:', mediaBuffer.length, 'bytes, type:', contentType);
        
        // Determine if it's a video or image
        const isVideo = contentType.startsWith('video/');
        
        // Upload media to Twitter using v1.1 (media upload is still v1.1 even with v2 posting)
        // For videos, Twitter supports: video/mp4, video/quicktime, up to 512MB
        const mediaUpload = await twitterClient.v1.uploadMedia(mediaBuffer, { 
          mimeType: contentType,
          target: isVideo ? 'tweet' : undefined,
          additionalOwners: undefined,
          type: isVideo ? 'video/mp4' : undefined
        });
        
        tweetData.media = { media_ids: [mediaUpload] };
        console.log(`[SocialMedia] ${isVideo ? 'Video' : 'Image'} uploaded to X successfully, ID:`, mediaUpload);
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
export { postToLinkedIn, postToX };

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
      const xSuccess = await postToX(jobForSend);

      // Atualiza o contador se pelo menos um envio for bem-sucedido
      if (linkedInSuccess || xSuccess) {
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

// ⚠️ DISABLED: Job promotion scheduler (system no longer uses jobs, only social media posts)
// If you need to re-enable job promotion in the future, uncomment below:
/*
export const scheduledSocialMediaPromotion = onSchedule(
  {
    schedule: "every 8 hours",
    timeZone: "Europe/Lisbon" // Lisbon timezone
  },
  async (event) => {
    await runSocialMediaPromotionScheduler();
  }
);
*/

// If run directly, execute:
if (require.main === module) {
  runSocialMediaPromotionScheduler().then(() => process.exit(0));
}
