// Firebase Admin Configuration
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function initAdmin() {
  if (getApps().length === 0) {
    // Check if required environment variables are available
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!projectId || !clientEmail || !privateKey) {
      console.warn('Firebase Admin credentials not available. Skipping initialization.');
      return null;
    }
    
    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
      return null;
    }
  }
  return true;
}

export function getAdminFirestore() {
  const initialized = initAdmin();
  if (!initialized) {
    throw new Error('Firebase Admin not initialized - missing credentials');
  }
  return getFirestore();
}
