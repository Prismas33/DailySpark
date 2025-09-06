'use client';

import React, { useState, useEffect } from 'react';

type SocialMediaPlatform = 'linkedin' | 'facebook' | 'instagram' | 'threads' | 'x';

interface PlatformConfig {
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  description: string;
  authUrl?: string;
}

const platformConfigs: Record<SocialMediaPlatform, PlatformConfig> = {
  linkedin: { 
    name: 'LinkedIn', 
    icon: '💼', 
    color: 'bg-blue-600', 
    enabled: true,
    description: 'Connect your LinkedIn profile to share professional content',
    authUrl: '/api/auth/linkedin'
  },
  facebook: { 
    name: 'Facebook', 
    icon: '📘', 
    color: 'bg-blue-700', 
    enabled: true,
    description: 'Connect your Facebook page to reach your audience',
    authUrl: '/api/auth/facebook'
  },
  instagram: { 
    name: 'Instagram', 
    icon: '📸', 
    color: 'bg-gradient-to-r from-purple-500 to-pink-500', 
    enabled: true,
    description: 'Connect your Instagram business account for visual content',
    authUrl: '/api/auth/instagram'
  },
  threads: { 
    name: 'Threads', 
    icon: '🧵', 
    color: 'bg-gray-900', 
    enabled: true,
    description: 'Connect to Meta\'s Threads for text-based social posts',
    authUrl: '/api/auth/threads'
  },
  x: { 
    name: 'X (Twitter)', 
    icon: '𝕏', 
    color: 'bg-gray-800', 
    enabled: true,
    description: 'Connect your X (Twitter) account for microblogging',
    authUrl: '/api/auth/twitter'
  }
};

const Settings: React.FC = () => {
  // Social Media Connections states
  const [connectedAccounts, setConnectedAccounts] = useState<Set<SocialMediaPlatform>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  // Load connected accounts on component mount
  useEffect(() => {
    loadConnectedAccounts();
  }, []);

  const loadConnectedAccounts = async () => {
    try {
      setLoading(true);
      
      // TODO: Load connected accounts from API
      // For now, simulate loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock connected accounts (remove when implementing real OAuth)
      setConnectedAccounts(new Set(['linkedin']));
      
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage('❌ Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const connectAccount = async (platform: SocialMediaPlatform) => {
    try {
      const config = platformConfigs[platform];
      
      if (config.authUrl) {
        // Redirect to OAuth flow
        window.location.href = config.authUrl;
      } else {
        setMessage(`❌ OAuth not configured for ${config.name}`);
      }
    } catch (error) {
      console.error('Error connecting account:', error);
      setMessage(`❌ Error connecting to ${platformConfigs[platform].name}`);
    }
  };

  const disconnectAccount = async (platform: SocialMediaPlatform) => {
    try {
      // TODO: Implement disconnect API call
      const newConnected = new Set(connectedAccounts);
      newConnected.delete(platform);
      setConnectedAccounts(newConnected);
      
      setMessage(`✅ Disconnected from ${platformConfigs[platform].name}`);
    } catch (error) {
      console.error('Error disconnecting account:', error);
      setMessage(`❌ Error disconnecting from ${platformConfigs[platform].name}`);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // TODO: Save settings to API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMessage('✅ Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('❌ Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-300">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-orange-300 mb-6">⚙️ Settings & Connections</h3>
      
      {/* Message Display */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.includes('✅') ? 'bg-green-900/50 border-green-500 text-green-300' : 'bg-red-900/50 border-red-500 text-red-300'
        } border`}>
          {message}
        </div>
      )}

      {/* Social Media Connections */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-white mb-4">🔗 Social Media Connections</h4>
        <div className="space-y-4">
          {Object.entries(platformConfigs).map(([platform, config]) => {
            const isConnected = connectedAccounts.has(platform as SocialMediaPlatform);
            
            return (
              <div key={platform} className="bg-black/30 rounded-lg border border-gray-600 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center text-white font-bold`}>
                      {config.icon}
                    </div>
                    <div>
                      <h5 className="font-semibold text-white">{config.name}</h5>
                      <p className="text-sm text-gray-400">{config.description}</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                      <span className={`text-xs font-medium ${isConnected ? 'text-green-400' : 'text-gray-500'}`}>
                        {isConnected ? '✓ Connected' : '✗ Not Connected'}
                      </span>
                    </div>
                    
                    {isConnected ? (
                      <button
                        onClick={() => disconnectAccount(platform as SocialMediaPlatform)}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => connectAccount(platform as SocialMediaPlatform)}
                        className="px-4 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition-colors"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={saveSettings}
        disabled={saving}
        className="w-full bg-gradient-to-r from-orange-400 to-amber-500 text-white py-3 px-6 rounded-lg font-semibold hover:from-orange-500 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
      >
        {saving ? (
          <>
            <div className="w-5 h-5 border-2 border-white rounded-full animate-spin border-t-transparent mr-2"></div>
            Saving...
          </>
        ) : (
          <>
            <span className="mr-2">💾</span>
            Save Settings
          </>
        )}
      </button>
    </div>
  );
};

export default Settings;
