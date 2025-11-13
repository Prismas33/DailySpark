// Firebase Admin SDK (Server-side only)
// Use this in API routes, server actions, cron jobs. Do NOT import in the browser.

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

let adminApp: App | undefined;

if (!getApps().length) {
  if (projectId && clientEmail && privateKey) {
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
    console.log('🔥 Firebase Admin initializing with storageBucket:', storageBucket);
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket: storageBucket
    });
  } else {
    console.warn('Firebase Admin credentials missing. Some server features may fail.');
  }
} else {
  adminApp = getApps()[0];
}

export const adminAuth = adminApp ? getAuth(adminApp) : undefined;
export const adminDb = adminApp ? getFirestore(adminApp) : undefined;
export const adminStorage = adminApp ? getStorage(adminApp) : undefined;
export default adminApp;
