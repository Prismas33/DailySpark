'use client';

import React, { useState } from 'react';
import ManualPost from './ManualPost';
import SchedulePost from './SchedulePost';
import QueueViewer from './QueueViewer';
import Settings from './Settings';

type TabType = 'manual' | 'schedule' | 'queue' | 'settings';

const SocialMediaManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('manual');

  const tabs = [
    { id: 'manual' as TabType, label: 'Post Now', icon: '✍️' },
    { id: 'schedule' as TabType, label: 'Schedule', icon: '📅' },
    { id: 'queue' as TabType, label: 'Queue', icon: '📋' },
    { id: 'settings' as TabType, label: 'Settings', icon: '⚙️' }
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'manual':
        return <ManualPost />;
      case 'schedule':
        return <SchedulePost />;
      case 'queue':
        return <QueueViewer />;
      case 'settings':
        return <Settings />;
      default:
        return <ManualPost />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-8 mb-8 shadow-2xl shadow-emerald-500/20">
          <div className="flex items-center space-x-4">
            <div className="text-4xl">✨</div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">DailySpark</h1>
              <p className="text-emerald-50 text-sm font-medium">Social Media Management Platform</p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-8">
          <div className="flex overflow-x-auto no-scrollbar gap-2 bg-gray-800/50 backdrop-blur-sm p-2 rounded-2xl border border-gray-700/50 shadow-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 sm:flex-[unset] min-w-[120px] flex items-center justify-center gap-2 py-3 md:py-4 px-4 md:px-6 rounded-xl font-semibold transition-all transform ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 scale-105'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="text-sm lg:text-base whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Tab Content */}
        <div className="transition-all duration-300 ease-in-out">
          {renderActiveTab()}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p className="flex items-center justify-center gap-2">
            <span className="text-emerald-400">✨</span>
            DailySpark - Streamline your social media presence
            <span className="text-emerald-400">✨</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SocialMediaManager;