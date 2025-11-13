import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseServer';
import axios from 'axios';

// Function to send to the Cloud Function endpoint
async function callCloudFunction(data: any) {
  try {
    // URL of the manualSocialMediaPromotion function in Firebase Cloud Functions
    const cloudFunctionUrl = process.env.FIREBASE_FUNCTION_URL;
    
    if (!cloudFunctionUrl) {
      throw new Error('FIREBASE_FUNCTION_URL environment variable is not configured');
    }
    
    // Adding headers for CORS (DO NOT include 'Origin' in server-to-server calls)
    const headers = {
      'Content-Type': 'application/json'
    };
    
    console.log('📞 Calling Firebase Function:', cloudFunctionUrl, 'with data:', data);
    
    const response = await axios.post(cloudFunctionUrl, data, { headers });
    
    console.log('✅ Firebase Function response:', response.data);
    
    return response.data;
  } catch (error: any) {
    console.error('❌ Error calling Cloud Function:', error.message);
    console.error('Error details:', error.response?.data);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { type, jobId, text, platforms, imageUrl } = data;

    console.log('🚀 Received request:', { type, hasJobId: !!jobId, hasText: !!text, platforms });

    // Handle manual posting (new functionality)
    if (type === 'manual') {
      if (!text || !platforms || platforms.length === 0) {
        return NextResponse.json({ 
          error: 'Text and at least one platform are required for manual posting' 
        }, { status: 400 });
      }

      // Validate job ID if provided
      if (jobId) {
        if (!adminDb) throw new Error('Firebase Admin not initialized');
        const jobDoc = await adminDb.collection('jobs').doc(jobId).get();

        if (!jobDoc.exists) {
          return NextResponse.json({ error: 'Invalid job ID provided' }, { status: 400 });
        }
      }

      // Call Firebase Function for manual posting
      const result = await callCloudFunction({
        type: 'manual',
        text,
        platforms,
        imageUrl,
        jobId
      });

      console.log('📨 Manual post result from Firebase Function:', result);

      // Log to post history
      try {
        const sentPlatforms: string[] = [];
        const failedPlatforms: string[] = [];

        // Parse results to determine which platforms succeeded
        if (result.results && typeof result.results === 'object') {
          Object.entries(result.results).forEach(([platform, response]: [string, any]) => {
            if (response?.success || response?.status === 'success') {
              sentPlatforms.push(platform);
            } else {
              failedPlatforms.push(platform);
            }
          });
        } else {
          // If all succeeded
          sentPlatforms.push(...platforms);
        }

        const historyRecord = {
          content: text,
          platforms: platforms,
          mediaUrl: imageUrl,
          mediaType: imageUrl ? 'image' : null,
          postType: 'manual',
          status: failedPlatforms.length === 0 ? 'sent' : (sentPlatforms.length > 0 ? 'partial' : 'failed'),
          sentAt: new Date(),
          movedToHistoryAt: new Date(),
          sentPlatforms: sentPlatforms,
          failedPlatforms: failedPlatforms,
          results: result.results,
          jobId: jobId || null,
          manualPostBy: 'web_interface',
          failureReason: sentPlatforms.length === 0 ? result.message : null
        };

        await adminDb.collection('postHistory').add(historyRecord);
        console.log('✅ Manual post logged to history');
      } catch (historyError: any) {
        console.error('⚠️ Warning: Could not log manual post to history:', historyError.message);
        // Don't fail the request if history logging fails
      }

      return NextResponse.json({ 
        success: true, 
        results: result.results || result,
        message: result.message || 'Manual post processed'
      });
    }

    // Handle automatic posting (existing functionality)
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required for automatic posting' }, { status: 400 });
    }

    // Check if the job exists before sending
  if (!adminDb) throw new Error('Firebase Admin not initialized');
  const jobDoc = await adminDb.collection('jobs').doc(jobId).get();

    if (!jobDoc.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Call the Cloud Function for automatic posting
    const result = await callCloudFunction({ jobId });

    // Update the promotion counter in the job (also done in the Cloud Function, but we ensure it here)
    const jobData = jobDoc.data();
    await adminDb.collection('jobs').doc(jobId).update({
      socialMediaPromotionCount: (jobData?.socialMediaPromotionCount || 0) + 1,
      socialMediaPromotionLastSent: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, result });

  } catch (error: any) {
    console.error('❌ Error processing social media post:', error);
    return NextResponse.json(
      { error: error.message || 'Error processing the request' },
      { status: 500 }
    );
  }
}
