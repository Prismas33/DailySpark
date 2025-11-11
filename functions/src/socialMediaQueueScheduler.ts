import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logSystemActivity } from "./logSystem";
import { postToLinkedIn, postToX, SocialMediaJob } from "./socialMediaPromotionScheduler";

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

interface QueuedPost {
  id: string;
  content: string;
  platforms: string[];
  mediaUrl?: string;
  postType?: 'post' | 'reel';
  mediaType?: 'image' | 'video';
  scheduledAt: any; // Firestore Timestamp
  status: 'scheduled' | 'sent' | 'failed';
  createdAt: any;
}

/**
 * Process scheduled posts from the queue
 * Sends posts that are due to be published
 */
export async function processSocialMediaQueue(): Promise<void> {
  const db = getFirestore();
  
  try {
    console.log('[SocialQueue] Starting queue processing...');
    
    const now = new Date();
    const queueRef = db.collection('socialMediaQueue');
    
    // Find posts scheduled for now or earlier that haven't been sent yet
    // Firestore Timestamps are compared directly, not as ISO strings
    const duePostsQuery = await queueRef
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now)
      .orderBy('scheduledAt', 'asc')
      .limit(5) // Process up to 5 posts per run
      .get();
    
    console.log(`[SocialQueue] Found ${duePostsQuery.size} posts due for publishing`);
    
    if (duePostsQuery.empty) {
      console.log('[SocialQueue] No posts to process');
      return;
    }
    
    for (const postDoc of duePostsQuery.docs) {
      const post = { id: postDoc.id, ...postDoc.data() } as QueuedPost;
      
      console.log(`[SocialQueue] Processing post: "${post.content.substring(0, 50)}..."`);
      
      try {
        const results = {
          linkedin: false,
          x: false
        };
        
        // Create job object for posting functions (they expect this format)
        const jobForSend: SocialMediaJob = {
          id: post.id,
          title: '',
          companyName: '',
          shortDescription: post.content,
          mediaUrl: post.mediaUrl || ''
        };
        
        // Post to selected platforms
        console.log(`[SocialQueue] Posting to: ${post.platforms.join(', ')}`);
        console.log(`[SocialQueue] Media URL: ${post.mediaUrl || 'none'}`);
        console.log(`[SocialQueue] Post Type: ${post.postType || 'post'}, Media Type: ${post.mediaType || 'none'}`);
        
        if (post.platforms.includes('linkedin')) {
          results.linkedin = await postToLinkedIn(jobForSend);
        }
        if (post.platforms.includes('x')) {
          results.x = await postToX(jobForSend);
        }
        
        // Clean up media from Firebase Storage after successful post
        if (post.mediaUrl && post.mediaUrl.includes('firebasestorage.googleapis.com')) {
          try {
            const storage = getStorage();
            const mediaPath = extractStoragePathFromUrl(post.mediaUrl);
            
            if (mediaPath) {
              await storage.bucket().file(mediaPath).delete();
              console.log(`[SocialQueue] ✅ Cleaned up media from Storage: ${mediaPath}`);
            } else {
              console.warn(`[SocialQueue] ⚠️ Could not extract storage path from URL: ${post.mediaUrl}`);
            }
          } catch (cleanupError: any) {
            // Don't fail the whole process if cleanup fails
            console.warn(`[SocialQueue] ⚠️ Failed to clean up media:`, cleanupError.message);
          }
        }
        
        // Log success
        await logSystemActivity(
          "system",
          "SocialMediaQueueScheduler",
          {
            postId: post.id,
            content: post.content.substring(0, 100),
            platforms: post.platforms,
            results: results,
            timestamp: new Date().toISOString(),
            status: "success"
          }
        );
        
        // Delete post from queue immediately after successful send
        await postDoc.ref.delete();
        
        console.log(`[SocialQueue] ✅ Post sent successfully and removed from queue`);
        console.log(`[SocialQueue] Results: LinkedIn=${results.linkedin}, X=${results.x}`);
        
      } catch (postError: any) {
        console.error(`[SocialQueue] ❌ Error sending post ${post.id}:`, postError.message);
        
        // Log error before deleting
        await logSystemActivity(
          "system",
          "SocialMediaQueueScheduler",
          {
            postId: post.id,
            content: post.content.substring(0, 100),
            error: postError.message,
            timestamp: new Date().toISOString(),
            status: "post_failed"
          }
        );
        
        // Delete failed post from queue immediately (keeps queue clean)
        await postDoc.ref.delete();
        
        console.log(`[SocialQueue] ❌ Failed post removed from queue: ${postError.message}`);
      }
    }
    
  } catch (error: any) {
    console.error('[SocialQueue] ❌ Critical error:', error.message);
    
    await logSystemActivity(
      "system",
      "SocialMediaQueueScheduler",
      {
        error: error.message,
        timestamp: new Date().toISOString(),
        status: "critical_error"
      }
    );
  }
  
  // Note: No cleanup needed - posts are deleted immediately after processing (success or failure)
}

/**
 * Função agendada para executar às 09:00 UTC
 * Processa posts da fila de agendamento
 */
export const scheduledSocialMediaQueue9AM = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "UTC",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    console.log('[SocialQueue] 09:00 UTC execution started');
    await processSocialMediaQueue();
    console.log('[SocialQueue] 09:00 UTC execution completed');
  }
);

/**
 * Função agendada para executar às 12:00 UTC  
 * Processa posts da fila de agendamento
 */
export const scheduledSocialMediaQueue12PM = onSchedule(
  {
    schedule: "0 12 * * *",
    timeZone: "UTC", 
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    console.log('[SocialQueue] 12:00 UTC execution started');
    await processSocialMediaQueue();
    console.log('[SocialQueue] 12:00 UTC execution completed');
  }
);

/**
 * Função agendada para executar às 18:00 UTC
 * Processa posts da fila de agendamento
 */
export const scheduledSocialMediaQueue6PM = onSchedule(
  {
    schedule: "0 18 * * *",
    timeZone: "UTC",
    memory: "256MiB", 
    timeoutSeconds: 120,
  },
  async (event) => {
    console.log('[SocialQueue] 18:00 UTC execution started');
    await processSocialMediaQueue();
    console.log('[SocialQueue] 18:00 UTC execution completed');
  }
);
