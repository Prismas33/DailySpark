'use client';

import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import ProfileSection from './SettingsSections/ProfileSection';
import SecuritySection from './SettingsSections/SecuritySection';
import AIConfigSection from './SettingsSections/AIConfigSection';
import CalendarConfigSection from './SettingsSections/CalendarConfigSection';
import PlatformsSection from './SettingsSections/PlatformsSection';

export default function Settings() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        setCurrentUser(auth.currentUser);
      } catch (error) {
        console.error('Failed to load user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700/50 shadow-xl p-8">
        <div className="flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="mt-3 text-gray-300 font-medium">Loading settings...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700/50 shadow-xl p-8">
        <p className="text-center text-gray-400">User not found. Please sign in again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700/50 shadow-xl p-4">
        <h3 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-emerald-400" />
          Settings
        </h3>
        <p className="text-gray-400 text-sm mt-1">
          Manage your profile, security, and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <ProfileSection user={currentUser} />
          <SecuritySection user={currentUser} />
        </div>

        <div className="space-y-4">
          <AIConfigSection user={currentUser} />
          <CalendarConfigSection user={currentUser} />
          <PlatformsSection />
        </div>
      </div>
    </div>
  );
}
