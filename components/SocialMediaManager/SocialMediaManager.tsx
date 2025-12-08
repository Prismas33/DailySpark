'use client';

import React, { useState } from 'react';
import ManualPost from './ManualPost';
import SchedulePost from './SchedulePost';
import QueueViewer from './QueueViewer';
import PostHistoryViewer from './PostHistoryViewer';
import Settings from './Settings';
import WeeklyCalendarViewer from './WeeklyCalendarViewer';
import UserDropdown from '@/components/UserDropdown';
import WelcomeBanner from '@/components/WelcomeBanner';
import { useIsMobile } from '@/hooks/useIsMobile';
import { User } from 'firebase/auth';

type TabType = 'manual' | 'schedule' | 'queue' | 'history' | 'calendar' | 'settings';

interface SocialMediaManagerProps {
  user: User;
  onLogout: () => void;
}

const SocialMediaManager: React.FC<SocialMediaManagerProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('manual');
  const isMobile = useIsMobile();

  const tabs = [
    { id: 'manual' as TabType, label: 'Post Now', icon: '✍️' },
    { id: 'schedule' as TabType, label: 'Schedule', icon: '📅' },
    { id: 'calendar' as TabType, label: 'Calendar', icon: '🗓️' },
    { id: 'queue' as TabType, label: 'Queue', icon: '📋' },
    { id: 'history' as TabType, label: 'History', icon: '📚' },
    { id: 'settings' as TabType, label: 'Settings', icon: '⚙️' }
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'manual':
        return <ManualPost />;
      case 'schedule':
        return <SchedulePost />;
      case 'calendar':
        return <WeeklyCalendarViewer />;
      case 'queue':
        return <QueueViewer />;
      case 'history':
        return <PostHistoryViewer />;
      case 'settings':
        return <Settings />;
      default:
        return <ManualPost />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Fixed Header */}
      <div className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Mobile: 2 rows | Desktop: 1 row */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Row 1: Logo + User (always visible) */}
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
                <div className="text-xl md:text-2xl">✨</div>
                <div>
                  <h1 className="text-base md:text-lg font-bold text-white">DailySpark</h1>
                  <p className="text-gray-400 text-[10px] md:text-xs hidden sm:block">Social Media Management</p>
                </div>
              </div>
              
              {/* User Dropdown (mobile: right side, desktop: far right) */}
              <div className="flex-shrink-0 md:hidden">
                <UserDropdown 
                  user={user} 
                  onLogout={onLogout}
                  onSettingsClick={() => setActiveTab('settings')}
                />
              </div>
            </div>
            
            {/* Row 2 (mobile) / Middle (desktop): Navigation Buttons */}
            <div className="flex items-center gap-2 justify-center md:flex-1">
              {tabs.filter(tab => tab.id !== 'settings').map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 py-2 px-3 rounded-lg font-medium transition-all text-sm flex-1 md:flex-none justify-center ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <span className="text-base md:text-lg">{tab.icon}</span>
                  <span className="text-xs md:text-sm">{tab.label}</span>
                </button>
              ))}
            </div>
            
            {/* User Dropdown (desktop only - far right) */}
            <div className="hidden md:block flex-shrink-0">
              <UserDropdown 
                user={user} 
                onLogout={onLogout}
                onSettingsClick={() => setActiveTab('settings')}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
        {/* Welcome Banner - only show on manual/schedule tabs, not on settings/history */}
        {(activeTab === 'manual' || activeTab === 'schedule' || activeTab === 'queue' || activeTab === 'calendar') && (
          <WelcomeBanner user={user} />
        )}

        {/* Active Tab Content */}
        <div className="transition-all duration-300 ease-in-out">
          {renderActiveTab()}
        </div>

        {/* Footer */}
        <div className="mt-8 md:mt-12 text-center text-gray-500 text-xs md:text-sm pb-4">
          <p className="flex items-center justify-center gap-2">
            <span className="text-emerald-400">✨</span>
            <span className="hidden sm:inline">DailySpark - Streamline your social media presence</span>
            <span className="sm:hidden">DailySpark</span>
            <span className="text-emerald-400">✨</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SocialMediaManager;