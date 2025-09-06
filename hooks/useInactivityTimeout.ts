"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { performCompleteLogout } from '../utils/completeLogout';

interface InactivityTimeoutOptions {
  /** Timeout duration in milliseconds (default: 3 hours) */
  timeout?: number;
  /** Events to listen for user activity (default: common interaction events) */
  events?: string[];
  /** Callback called when timeout occurs (before logout) */
  onTimeout?: () => void;
  /** Whether to show warning before logout (default: true) */
  showWarning?: boolean;
  /** Warning time before logout in milliseconds (default: 5 minutes) */
  warningTime?: number;
  /** Callback called when warning is shown */
  onWarning?: () => void;
  /** Whether the timeout is enabled (default: true) */
  enabled?: boolean;
  /** Custom warning component (optional) */
  useCustomWarning?: boolean;
}

interface InactivityTimeoutReturn {
  resetActivity: () => void;
  clearTimeouts: () => void;
  getLastActivity: () => number;
  getRemainingTime: () => number;
  isActive: () => boolean;
  showWarningModal: boolean;
  warningTimeLeft: number;
  continueSession: () => void;
  logoutNow: () => void;
}

const DEFAULT_TIMEOUT = 3 * 60 * 60 * 1000; // 3 hours
const DEFAULT_WARNING_TIME = 5 * 60 * 1000; // 5 minutes
const DEFAULT_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'scroll',
  'touchstart',
  'click',
  'wheel'
];

/**
 * Hook to handle automatic logout after a period of inactivity
 * Monitors user activity and logs out the user after specified timeout
 */
export function useInactivityTimeout(options: InactivityTimeoutOptions = {}): InactivityTimeoutReturn {
  const {
    timeout = DEFAULT_TIMEOUT,
    events = DEFAULT_EVENTS,
    onTimeout,
    showWarning = true,
    warningTime = DEFAULT_WARNING_TIME,
    onWarning,
    enabled = true,
    useCustomWarning = true
  } = options;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningTimeLeft, setWarningTimeLeft] = useState(0);

  // Clear all timeouts
  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (warningCountdownRef.current) {
      clearTimeout(warningCountdownRef.current);
      warningCountdownRef.current = null;
    }
  }, []);

  // Perform logout
  const performLogout = useCallback(async () => {
    console.log('🔒 Performing automatic logout due to inactivity');

    setShowWarningModal(false);

    try {
      // Call onTimeout callback if provided
      if (onTimeout) {
        onTimeout();
      }

      // Use centralized, robust logout to avoid duplicated logic and ensure full cleanup
      await performCompleteLogout({ redirect: true, redirectUrl: '/', dispatchEvent: true, verbose: true });
      // Note: performCompleteLogout handles Firebase signOut, storage/cookies cleanup,
      // event dispatch, small delay, and redirect. Nothing else to do here.
    } catch (error) {
      console.error('Error during automatic logout:', error);
      // Fallback redirect to ensure session is cleared
      window.location.href = "/";
    }
  }, [onTimeout]);

  // Show warning before logout
  const showWarningMessage = useCallback(() => {
    console.log('⚠️ Showing inactivity warning');
    
    if (onWarning) {
      onWarning();
    }
    
    if (useCustomWarning) {
      // Use custom modal warning
      setShowWarningModal(true);
      setWarningTimeLeft(Math.ceil(warningTime / 1000));
      
      // Start countdown
      let timeLeft = Math.ceil(warningTime / 1000);
      const countdown = () => {
        timeLeft -= 1;
        setWarningTimeLeft(timeLeft);
        
        if (timeLeft > 0) {
          warningCountdownRef.current = setTimeout(countdown, 1000);
        } else {
          setShowWarningModal(false);
          performLogout();
        }
      };
      
      warningCountdownRef.current = setTimeout(countdown, 1000);
    } else {
      // Use default browser alert
      const warningMinutes = Math.ceil(warningTime / (60 * 1000));
      const shouldLogout = confirm(
        `You will be logged out in ${warningMinutes} minutes due to inactivity. ` +
        `Click OK to stay logged in, or Cancel to logout now.`
      );
      
      if (!shouldLogout) {
        performLogout();
        return;
      }
      
      // User chose to stay - reset the activity timer
      resetActivity();
    }
  }, [onWarning, warningTime, performLogout, useCustomWarning]);

  // Continue session (dismiss warning and reset timer)
  const continueSession = useCallback(() => {
    setShowWarningModal(false);
    clearTimeouts();
    resetActivity();
  }, []);

  // Logout immediately
  const logoutNow = useCallback(() => {
    performLogout();
  }, [performLogout]);

  // Reset activity timer
  const resetActivity = useCallback(() => {
    if (!enabled) return;
    
    lastActivityRef.current = Date.now();
    setShowWarningModal(false);
    clearTimeouts();

    // Set warning timeout
    if (showWarning && warningTime > 0) {
      const warningDelay = timeout - warningTime;
      if (warningDelay > 0) {
        warningTimeoutRef.current = setTimeout(showWarningMessage, warningDelay);
      }
    }

    // Set logout timeout
    timeoutRef.current = setTimeout(performLogout, timeout);
  }, [enabled, timeout, showWarning, warningTime, showWarningMessage, performLogout, clearTimeouts]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    if (showWarningModal) {
      // If warning is showing and user is active, dismiss it and reset
      continueSession();
    } else {
      resetActivity();
    }
  }, [resetActivity, showWarningModal, continueSession]);

  // Initialize and cleanup
  useEffect(() => {
    if (!enabled) {
      clearTimeouts();
      setShowWarningModal(false);
      return;
    }

    // Initialize activity tracking
    resetActivity();

    // Add event listeners for user activity
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Cleanup function
    return () => {
      clearTimeouts();
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [enabled, events, handleActivity, resetActivity, clearTimeouts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeouts();
      setShowWarningModal(false);
    };
  }, [clearTimeouts]);

  // Return utility functions and state
  return {
    resetActivity,
    clearTimeouts,
    getLastActivity: () => lastActivityRef.current,
    getRemainingTime: () => {
      const elapsed = Date.now() - lastActivityRef.current;
      return Math.max(0, timeout - elapsed);
    },
    isActive: () => {
      const elapsed = Date.now() - lastActivityRef.current;
      return elapsed < timeout;
    },
    showWarningModal,
    warningTimeLeft,
    continueSession,
    logoutNow
  };
}

export default useInactivityTimeout;
