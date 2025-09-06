'use client';

import React, { useState } from 'react';
import ManualPost from './ManualPost';
import QueueViewer from './QueueViewer';
import Settings from './Settings';

type TabType = 'manual' | 'queue' | 'settings';

const SocialMediaManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('manual');

  const tabs = [
    { id: 'manual' as TabType, label: 'Manual Post', icon: '✍️' },
    { id: 'queue' as TabType, label: 'Queue', icon: '📋' },
    { id: 'settings' as TabType, label: 'Settings', icon: '⚙️' }
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'manual':
        return <ManualPost />;
      case 'queue':
        return <QueueViewer />;
      case 'settings':
        return <Settings />;
      default:
        return <ManualPost />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500 rounded-xl p-6 mb-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">✨</div>
            <div>
              <h1 className="text-2xl font-bold text-white">DailySpark</h1>
              <p className="text-orange-100 text-sm">Social Media Management Platform</p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-black/40 p-1 rounded-lg border border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-md font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Tab Content */}
        <div className="transition-all duration-300 ease-in-out">
          {renderActiveTab()}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>DailySpark - Streamline your social media presence</p>
        </div>
      </div>
    </div>
  );
};

export default SocialMediaManager;