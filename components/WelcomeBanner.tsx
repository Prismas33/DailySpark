'use client';

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Sparkles, Calendar } from 'lucide-react';

interface WelcomeBannerProps {
  user: User;
}

export default function WelcomeBanner({ user }: WelcomeBannerProps) {
  const [postsToday, setPostsToday] = useState(0);
  const [scheduledPosts, setScheduledPosts] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch counters
  useEffect(() => {
    const fetchCounters = async () => {
      try {
        // Fetch scheduled queue count
        const queueResponse = await fetch('/api/social-media-queue?status=scheduled');
        const queueData = await queueResponse.json();
        if (queueData.success) {
          setScheduledPosts(queueData.count || 0);
        }

        // TODO: Fetch posts sent today from backend
        // For now, we'll set it to 0 as this requires logging posts sent
        setPostsToday(0);
      } catch (error) {
        console.error('Error fetching counters:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounters();
  }, []);
  // Get greeting based on time of day
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Get user's initials for avatar fallback
  const getInitials = (): string => {
    if (user.displayName) {
      const names = user.displayName.split(' ');
      if (names.length >= 2) {
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
      }
      return names[0].charAt(0).toUpperCase();
    }
    if (user.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  };

  // Format current date
  const getFormattedDate = (): string => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date().toLocaleDateString('en-US', options);
  };

  return (
    <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-xl border border-emerald-500/20 p-3 md:p-6 mb-4 md:mb-6">
      {/* Mobile: 2 rows | Desktop: 1 row */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-4">
        {/* Row 1 Mobile: Avatar + Welcome Text */}
        <div className="flex items-center gap-3 md:gap-4 flex-1">
          {/* Avatar Section */}
          <div className="relative flex-shrink-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-14 h-14 md:w-20 md:h-20 rounded-full object-cover border-2 md:border-4 border-emerald-500/30 shadow-lg"
              />
            ) : (
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xl md:text-3xl border-2 md:border-4 border-emerald-500/30 shadow-lg">
                {getInitials()}
              </div>
            )}
            
            {/* Sparkle decoration */}
            <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1">
              <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-yellow-900" />
            </div>
          </div>

          {/* Welcome Text Section */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-3xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent mb-0.5 md:mb-1">
              {getGreeting()}, {user.displayName?.split(' ')[0] || 'there'}! 👋
            </h2>
            <p className="text-gray-400 text-xs md:text-base">
              Ready to create amazing content today?
            </p>
            
            {/* Date - desktop only */}
            <div className="hidden md:flex items-center gap-2 text-gray-500 text-xs mt-1">
              <Calendar className="w-4 h-4" />
              <span>{getFormattedDate()}</span>
            </div>
          </div>
        </div>

        {/* Row 2 Mobile / Right Side Desktop: Stats + Date */}
        <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6">
          {/* Date mobile */}
          <div className="flex md:hidden items-center gap-1.5 text-gray-500 text-[11px]">
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>

          {/* Stats */}
          <div className="flex gap-4 md:gap-6">
            <div className="text-center">
              <div className="text-xl md:text-3xl font-bold text-emerald-400">{loading ? '—' : postsToday}</div>
              <div className="text-[10px] md:text-xs text-gray-500">Posts Today</div>
            </div>
            <div className="text-center">
              <div className="text-xl md:text-3xl font-bold text-teal-400">{loading ? '—' : scheduledPosts}</div>
              <div className="text-[10px] md:text-xs text-gray-500">Scheduled</div>
            </div>
          </div>
        </div>
      </div>

      {/* Optional: Quick Action Hint */}
      {!user.emailVerified && (
        <div className="mt-4 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-center gap-2">
          <span className="text-orange-400 text-sm">
            ⚠️ <strong>Action Required:</strong> Please verify your email address in Settings to unlock all features.
          </span>
        </div>
      )}
    </div>
  );
}
