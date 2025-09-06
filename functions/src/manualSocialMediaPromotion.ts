import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { logSystemActivity } from "./logSystem";
import * as cors from 'cors';
import { TwitterApi } from 'twitter-api-v2';

// Importar funções reutilizáveis do scheduler
import {
  postToLinkedIn,
  postToTelegram,
  postToX,
  renderTemplateFromJob,
  SocialMediaJob,
  uploadImageToLinkedIn
} from "./socialMediaPromotionScheduler";

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
 * Post manual content directly to Telegram (text only)
 */
async function postManualToTelegram(text: string, imageUrl?: string): Promise<boolean> {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
      console.error('🔴 [TELEGRAM] Missing environment variables');
      return false;
    }

    const hasMedia = !!imageUrl;
    const url = hasMedia 
      ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`
      : `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const payload = hasMedia
      ? {
          chat_id: TELEGRAM_CHANNEL_ID,
          photo: imageUrl,
          caption: text,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        }
      : {
          chat_id: TELEGRAM_CHANNEL_ID,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (response.ok) {
      console.log('🟢 [TELEGRAM] Manual post sent successfully');
      return true;
    } else {
      const errorData = await response.text();
      console.error('🔴 [TELEGRAM] Failed to send manual post:', errorData);
      return false;
    }
  } catch (error: any) {
    console.error('🔴 [TELEGRAM] Error sending manual post:', error.message);
    return false;
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
    const LINKEDIN_ORGANIZATION_ID = process.env.LINKEDIN_ORGANIZATION_ID;

    if (!LINKEDIN_ACCESS_TOKEN || !LINKEDIN_ORGANIZATION_ID) {
      console.error('🔴 [LINKEDIN] Missing access token or organization ID');
      return false;
    }

    const url = 'https://api.linkedin.com/v2/ugcPosts';
    
    let payload: any = {
      author: `urn:li:organization:${LINKEDIN_ORGANIZATION_ID}`,
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

    // If there's an image, add it (like Telegram)
    if (imageUrl) {
      console.log('🔄 [LINKEDIN] Adding image to post...');
      const assetUrn = await uploadImageToLinkedIn(imageUrl, LINKEDIN_ACCESS_TOKEN, LINKEDIN_ORGANIZATION_ID);
      
      if (assetUrn) {
        payload.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
        payload.specificContent['com.linkedin.ugc.ShareContent'].media = [
          {
            status: 'READY',
            media: assetUrn
          }
        ];
        console.log('🟢 [LINKEDIN] Image added to post');
      } else {
        console.warn('🟡 [LINKEDIN] Failed to upload image, posting text only');
      }
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
  jobId?: string;
}) {
  const results = [];
  console.log('[ManualSocialMedia] Starting custom post to platforms:', postData.platforms);

  for (const platform of postData.platforms) {
    let postText = postData.text;
    
    // Add job link if jobId is provided
    if (postData.jobId) {
      postText += `\n\n🔗 Find the job here: https://gate33.net/jobs/${postData.jobId}`;
    }

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
          
        case 'telegram':
          console.log('[ManualSocialMedia] Posting to Telegram...');
          success = await postManualToTelegram(postText, postData.imageUrl);
          results.push({
            platform: 'telegram',
            success,
            message: success ? 'Successfully posted to Telegram' : 'Failed to post to Telegram',
            postId: success ? `telegram_${Date.now()}` : null
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
        const { text, platforms, imageUrl, jobId } = requestBody;
        
        if (!text || !platforms || platforms.length === 0) {
          res.status(400).json({ error: "Text and at least one platform are required for manual posting" });
          return;
        }

        console.log('[ManualSocialMedia] Processing manual post request');
        
        // Validate job ID if provided
        if (jobId) {
          const db = getFirestore();
          const jobSnap = await db.collection("jobs").doc(jobId).get();
          if (!jobSnap.exists) {
            res.status(400).json({ error: "Invalid job ID provided" });
            return;
          }
        }

        // Send to selected platforms
        const results = await postCustomContentToPlatforms({
          text,
          platforms,
          imageUrl,
          jobId
        });

        // Log the manual post activity
        await logSystemActivity(
          "admin_action",
          "ManualSocialMediaPost",
          {
            type: "manual",
            platforms,
            textLength: text.length,
            hasImage: !!imageUrl,
            hasJobId: !!jobId,
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

      // Handle legacy automatic posting (existing functionality)
      const { jobId } = requestBody;
      if (!jobId) {
        res.status(400).json({ error: "jobId is required for automatic posting" });
        return;
      }

      const db = getFirestore();
      console.log("[ManualSocialMedia] Received jobId for auto posting:", jobId);
      
      const jobSnap = await db.collection("jobs").doc(jobId).get();
      if (!jobSnap.exists) {
        console.log("[ManualSocialMedia] Job not found:", jobId);
        res.status(404).json({ error: "Job not found" });
        return;
      }

      const jobData = jobSnap.data() as SocialMediaJob;
      const job: SocialMediaJob = { ...jobData, id: jobSnap.id };
      console.log("[ManualSocialMedia] Loaded job for auto posting:", job);

      // Fetch centralized template
      const templateSnap = await db.collection("config").doc("socialMediaTemplate").get();
      const templateData = (templateSnap && templateSnap.exists && typeof templateSnap.data === 'function')
        ? templateSnap.data() ?? {}
        : {};
      const template = templateData.template ||
        "🚀 New job: {{title}} at {{companyName}}!\nCheck it out and apply now!\n{{jobUrl}}";
      const templateMediaUrl = templateData.mediaUrl || "";

      // Render message
      const message = renderTemplateFromJob(template, job);
      console.log("[ManualSocialMedia] Rendered message:", message);

      // Prepare job object for sending (shortDescription for LinkedIn, mediaUrl for both)
      const jobForSend = { ...job, shortDescription: message, mediaUrl: job.mediaUrl || templateMediaUrl };
      console.log("[ManualSocialMedia] jobForSend:", jobForSend);

      let linkedInSuccess = false;
      let telegramSuccess = false;
      let xSuccess = false;
      
      // Try posting to LinkedIn
      try {
        linkedInSuccess = await postToLinkedIn(jobForSend);
        console.log("[ManualSocialMedia] LinkedIn result:", linkedInSuccess);
      } catch (err: any) {
        console.error("[ManualSocialMedia] Error posting to LinkedIn:", err.message);
      }
      
      // Try posting to Telegram
      try {
        telegramSuccess = await postToTelegram(jobForSend);
        console.log("[ManualSocialMedia] Telegram result:", telegramSuccess);
      } catch (err: any) {
        console.error("[ManualSocialMedia] Error posting to Telegram:", err.message);
      }
      
      // Try posting to X
      try {
        xSuccess = await postToX(jobForSend);
        console.log("[ManualSocialMedia] X result:", xSuccess);
      } catch (err: any) {
        console.error("[ManualSocialMedia] Error posting to X:", err.message);
      }
      
      // Consider success if at least one platform works
      if (linkedInSuccess || telegramSuccess || xSuccess) {
        console.log("[ManualSocialMedia] At least one platform succeeded, updating job");
        await db.collection("jobs").doc(jobId).update({
          socialMediaPromotionCount: (job.socialMediaPromotionCount ?? 0) + 1,
          socialMediaPromotionLastSent: new Date().toISOString(),
        });
        
        await logSystemActivity(
          "system",
          "AutomaticSocialMedia",
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
            planLimit: job.socialMediaPromotion ?? 0,
            manual: true,
          }
        );
        
        res.status(200).json({ success: true });
      } else {
        res.status(500).json({ error: "Failed to send to all platforms" });
      }

    } catch (err: any) {
      console.error("[ManualSocialMedia] Error:", err);
      res.status(500).json({ error: err.message || "Internal error" });
    }
  });
});
