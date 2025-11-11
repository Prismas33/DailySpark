'use client';

import React, { useState, useEffect } from 'react';

type SocialPlatform = 'linkedin' | 'x' | 'facebook' | 'instagram';

interface ConnectedAccount {
  platform: SocialPlatform;
  connected: boolean;
  username?: string;
  profileUrl?: string;
  accessToken?: string;
  expiresAt?: string;
}

const platformConfigs = {
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    description: 'Share professional content and updates to your LinkedIn profile',
    enabled: true
  },
  x: {
    name: 'X (Twitter)',
    icon: '𝕏',
    description: 'Post quick updates and engage with your X audience',
    enabled: true
  },
  facebook: {
    name: 'Facebook',
    icon: '📘',
    description: 'Share posts to your Facebook page',
    enabled: false
  },
  instagram: {
    name: 'Instagram',
    icon: '📸',
    description: 'Share visual content to Instagram',
    enabled: false
  }
};

export default function Settings() {
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([
    { platform: 'linkedin', connected: true, username: 'André Ventura' },
    { platform: 'x', connected: true, username: 'Your X Account' },
    { platform: 'facebook', connected: false },
    { platform: 'instagram', connected: false }
  ]);
  const [loading, setLoading] = useState(false);

  // Não precisamos de funções de conexão - tudo é via API keys no .env

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 shadow-xl p-12">
        <div className="flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="mt-4 text-gray-300 font-medium">Updating connections...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 shadow-xl p-6">
      <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-6 flex items-center gap-2">
        <span className="text-2xl">⚙️</span>
        Platform Settings
      </h3>
      
      <p className="text-gray-400 mb-8 text-sm">
        Manage your connected social media accounts. Your credentials are configured via environment variables.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {Object.entries(platformConfigs).map(([platform, config]) => {
          const account = connectedAccounts.find(acc => acc.platform === platform);
          const isConnected = account?.connected || false;
          
          return (
            <div key={platform} className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6 hover:border-gray-600 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="text-3xl">{config.icon}</div>
                  <div>
                    <h3 className="font-bold text-white text-lg">{config.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{config.description}</p>
                  </div>
                </div>
              </div>
              
              <div className={`px-4 py-3 rounded-lg mb-4 ${
                isConnected 
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-gray-700/30 border border-gray-600/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-sm font-semibold ${isConnected ? 'text-emerald-300' : 'text-gray-400'}`}>
                      {isConnected ? '✅ Connected' : '❌ Not Connected'}
                    </div>
                    {isConnected && account?.username && (
                      <div className="text-xs text-gray-400 mt-1">
                        {account.username}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col space-y-2">
                {config.enabled ? (
                  <div className="text-xs text-gray-500 italic">
                    ✓ Configurado via .env.local
                  </div>
                ) : (
                  <div className="text-xs text-orange-400 italic flex items-center gap-2">
                    <span>⏳</span>
                    API em desenvolvimento
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <span className="text-teal-400 text-2xl">💡</span>
          <div>
            <h4 className="font-bold text-teal-300 mb-3">Configuration Notes</h4>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start">
                <span className="text-emerald-400 mr-2">•</span>
              </li>
              <li className="flex items-start">
                <span className="text-emerald-400 mr-2">•</span>
                <span>Posts are only sent to platforms you explicitly select</span>
              </li>
              <li className="flex items-start">
                <span className="text-emerald-400 mr-2">•</span>
                <span>LinkedIn character limit: ~1300 | X limit: ~280 characters</span>
              </li>
              <li className="flex items-start">
                <span className="text-emerald-400 mr-2">•</span>
                <span>All data is encrypted and stored securely in Firebase</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
