/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import * as admin from "firebase-admin";

// Inicialize o Firebase Admin SDK apenas se ainda não estiver inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

// Import functions
// import { syncLearn2EarnStatusJob, syncLearn2EarnStatusV2 } from "../syncLearn2EarnStatus"; // Commented out - file not found
// import { scheduledSocialMediaPromotion } from "./socialMediaPromotionScheduler"; // REMOVED - No longer using jobs system
import { manualSocialMediaPromotion } from "./manualSocialMediaPromotion";
// import { onQueuePostAdded } from "./queueTrigger"; // Commented out - file not found
// import { scheduledJobsImport } from "./jobsImportScheduler"; // Commented out - file not found
import { 
  scheduledSocialMediaQueue9AM, 
  scheduledSocialMediaQueue12PM, 
  scheduledSocialMediaQueue6PM 
} from "./socialMediaQueueScheduler";

// Re-export for external use
export { 
  // syncLearn2EarnStatusJob, 
  // syncLearn2EarnStatusV2, 
  // scheduledSocialMediaPromotion, // REMOVED - No longer using jobs system
  manualSocialMediaPromotion,
  // onQueuePostAdded, // Commented out - file not found
  // scheduledJobsImport,
  scheduledSocialMediaQueue9AM,
  scheduledSocialMediaQueue12PM,
  scheduledSocialMediaQueue6PM
};
