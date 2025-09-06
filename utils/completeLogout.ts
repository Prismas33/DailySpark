/**
 * Complete logout utility
 * Ensures all authentication states are cleared across the entire application
 */

import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export interface CompleteLogoutOptions {
  /** Whether to redirect to home page after logout (default: true) */
  redirect?: boolean;
  /** Custom redirect URL (default: "/") */
  redirectUrl?: string;
  /** Whether to dispatch logout event (default: true) */
  dispatchEvent?: boolean;
  /** Whether to show console logs (default: true) */
  verbose?: boolean;
}

/**
 * Performs a complete logout clearing all authentication states
 * @param options Configuration options for logout behavior
 */
export async function performCompleteLogout(options: CompleteLogoutOptions = {}) {
  const {
    redirect = true,
    redirectUrl = "/",
    dispatchEvent = true,
    verbose = true
  } = options;

  if (verbose) {
    console.log('🔒 Performing complete logout...');
  }

  try {
    // 1. Sign out from Firebase Auth
    try {
      await signOut(auth);
      if (verbose) console.log("✅ Firebase Auth logout successful");
    } catch (firebaseError) {
      if (verbose) console.error("❌ Firebase Auth logout error:", firebaseError);
    }

    // 2. Clear ALL possible localStorage keys
    const localStorageKeysToRemove = [
      // User identification
      "userId", "userEmail", "userName", "userRole", "userPhoto",
      
      // Admin tokens and data
      "adminUsername", "adminToken", "adminFirebaseUid",
      
      // Support tokens and data
      "supportToken", "supportUsername", "accessLevel",
      
      // Company tokens and data
      "companyToken", "companyId", "companyName", "companyEmail", "companyFirebaseUid",
      
      // Seeker tokens and data
      "seekerToken", "seekerFirebaseUid",
      
      // Firebase tokens
      "firebaseToken", "firebaseUid",
      
      // Generic tokens (for backwards compatibility)
      "token", "authToken", "jwtToken",
      
      // Other session data
      "lastLoginTime", "sessionId", "rememberMe"
    ];
    
    localStorageKeysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    if (verbose) console.log("✅ localStorage cleared");

    // 3. Clear ALL authentication cookies
    const cookiesToClear = [
      "isAuthenticated", "adminSession", "supportSession", 
      "companySession", "seekerSession", "authToken", 
      "sessionId", "rememberUser", "userRole"
    ];
    
    const domains = [window.location.hostname, `.${window.location.hostname}`];
    const paths = ["/", "/admin", "/support-dashboard", "/dashboard"];
    
    cookiesToClear.forEach(cookie => {
      domains.forEach(domain => {
        paths.forEach(path => {
          // Clear with domain and path
          document.cookie = `${cookie}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${domain}`;
          // Clear without domain
          document.cookie = `${cookie}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        });
      });
      // Basic clear
      document.cookie = `${cookie}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });
    
    if (verbose) console.log("✅ Cookies cleared");

    // 4. Clear sessionStorage
    try {
      sessionStorage.clear();
      if (verbose) console.log("✅ SessionStorage cleared");
    } catch (sessionError) {
      if (verbose) console.warn("⚠️ Could not clear sessionStorage:", sessionError);
    }

    // 5. Clear any IndexedDB data if needed
    try {
      if ('indexedDB' in window) {
        // Clear Firebase IndexedDB
        const databases = ['firebaseLocalStorageDb', 'firebase-heartbeat-database'];
        for (const dbName of databases) {
          try {
            const deleteReq = indexedDB.deleteDatabase(dbName);
            deleteReq.onsuccess = () => {
              if (verbose) console.log(`✅ IndexedDB ${dbName} cleared`);
            };
          } catch (idbError) {
            // Silent fail for IndexedDB cleanup
          }
        }
      }
    } catch (idbError) {
      // Silent fail for IndexedDB cleanup
    }

    // 6. Dispatch logout event for components to react
    if (dispatchEvent) {
      if (verbose) console.log('📡 Dispatching userLoggedOut event');
      window.dispatchEvent(new Event('userLoggedOut'));
      
      // Also dispatch a custom detail event
      window.dispatchEvent(new CustomEvent('completeLogout', {
        detail: { timestamp: Date.now(), source: 'completeLogout' }
      }));
    }

    // 7. Small delay to ensure all components receive the event
    await new Promise(resolve => setTimeout(resolve, 150));

    // 8. Redirect if requested
    if (redirect) {
      if (verbose) console.log(`🏠 Redirecting to: ${redirectUrl}`);
      // Use window.location for complete page refresh to ensure all states are reset
      window.location.href = redirectUrl;
    }

    if (verbose) console.log('✅ Complete logout finished');

  } catch (error) {
    console.error('❌ Error during complete logout:', error);
    
    // In case of any error, still force redirect to ensure logout
    if (redirect) {
      window.location.href = redirectUrl;
    }
  }
}

/**
 * Quick logout function for immediate use in components
 */
export const logoutImmediately = () => performCompleteLogout({ redirect: true });

/**
 * Silent logout function (no redirect, useful for components that handle their own navigation)
 */
export const logoutSilent = () => performCompleteLogout({ redirect: false });

export default performCompleteLogout;
