'use client';

import React, { useState, useEffect } from 'react';
import { CacheService, CACHE_KEYS, CACHE_TTL } from '@/lib/cacheService';

interface QueuedPost {
  id: string;
  content: string;
  platforms: string[];
  imageUrl?: string;
  scheduledAt: string;
  status: string;
  createdAt: string;
}

const QueueViewer: React.FC = () => {
  const [posts, setPosts] = useState<QueuedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // Format date utility
  const formatDate = (dateValue: string | null | undefined, format: 'locale' | 'localedate' | 'localetime' = 'locale'): string => {
    if (!dateValue) return '—';
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '—';
      
      switch (format) {
        case 'localedate':
          return date.toLocaleDateString();
        case 'localetime':
          return date.toLocaleTimeString();
        default:
          return date.toLocaleString();
      }
    } catch (error) {
      return '—';
    }
  };

  // Load queue
  const loadQueue = async (forceRefresh: boolean = false) => {
    setLoading(true);
    try {
      // Clear cache if force refresh
      if (forceRefresh) {
        CacheService.remove(CACHE_KEYS.SOCIAL_QUEUE);
      }

      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedQueue = CacheService.get<QueuedPost[]>(CACHE_KEYS.SOCIAL_QUEUE);
        if (cachedQueue) {
          setPosts(cachedQueue);
          setLoading(false);
          return;
        }
      }

      const response = await fetch('/api/social-media-queue');
      const data = await response.json();
      
      if (data.success) {
        const queuedPosts = data.queue || [];
        setPosts(queuedPosts);
        // Cache for 20 minutes
        CacheService.set(CACHE_KEYS.SOCIAL_QUEUE, queuedPosts, 1200);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load queue' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadQueue();
  }, []);

  // Delete post from queue
  const deletePost = async (id: string) => {
    if (!confirm('Remove this scheduled post?')) return;
    
    try {
      const response = await fetch(`/api/social-media-queue?id=${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Post removed!' });
        loadQueue();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to delete' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Delete failed. Please try again.' });
    }
  };

  // Status badge styling
  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'scheduled') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (statusLower === 'pending') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    if (statusLower === 'processing') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    if (statusLower === 'completed') return 'bg-green-500/20 text-green-300 border-green-500/30';
    if (statusLower === 'failed') return 'bg-red-500/20 text-red-300 border-red-500/30';
    return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  // Platform icon
  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p === 'linkedin') return '💼';
    if (p === 'x' || p === 'twitter') return '𝕏';
    return '📱';
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 shadow-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent flex items-center gap-2">
          <span className="text-2xl">📋</span>
          Scheduled Queue
        </h3>
        <button
          onClick={() => loadQueue(true)}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 flex items-center gap-2 transition-all transform hover:scale-105 shadow-lg"
        >
          <span>🔄</span>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-4 p-4 rounded-xl text-sm font-medium ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
            : 'bg-red-500/10 border border-red-500/30 text-red-300'
        }`}>
          {message.type === 'success' ? '✅ ' : '❌ '}{message.text}
        </div>
      )}

      {/* Queue Posts */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="mt-4 text-gray-300 font-medium">Loading queue...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-lg font-medium text-gray-300 mb-2">No scheduled posts</p>
          <p className="text-sm">Posts you schedule will appear here</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {posts.map((post) => {
            const isExpanded = expandedPostId === post.id;
            const preview = post.content.length > 100 ? `${post.content.substring(0, 100)}...` : post.content;

            return (
              <div 
                key={post.id} 
                className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden transition-all hover:border-emerald-500/50"
              >
                {/* Collapsed/Header View */}
                <button
                  onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                  className="w-full text-left p-3 md:p-4 flex items-start gap-3 hover:bg-gray-700/30 transition-colors"
                >
                  {/* Image Thumbnail (Mobile) */}
                  {post.imageUrl && (
                    <img 
                      src={post.imageUrl} 
                      alt="Post image" 
                      className="w-12 h-12 md:w-0 md:h-0 object-cover rounded-lg shadow-lg flex-shrink-0"
                    />
                  )}

                  {/* Content Preview */}
                  <div className="flex-1 min-w-0">
                    {/* Status & Date */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStatusBadge(post.status)}`}>
                        {post.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        📅 {formatDate(post.scheduledAt, 'localedate')}
                      </span>
                    </div>

                    {/* Content Preview */}
                    <p className="text-gray-300 text-sm leading-relaxed truncate">
                      {preview}
                    </p>

                    {/* Platform Badges */}
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {post.platforms.map((platform) => (
                        <span key={platform} className="px-2 py-0.5 bg-gray-700/50 text-xs rounded text-gray-300 font-medium">
                          {getPlatformIcon(platform)} {platform}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Expand Arrow */}
                  <div className="text-gray-400 flex-shrink-0 text-lg mt-1">
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-700/50 bg-gray-900/30 p-3 md:p-4 space-y-3">
                    {/* Full Content */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2">📝 Full Content</p>
                      <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {post.content}
                      </p>
                    </div>

                    {/* Full Image (if exists) */}
                    {post.imageUrl && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 mb-2">🖼️ Image</p>
                        <img 
                          src={post.imageUrl} 
                          alt="Post image" 
                          className="w-full h-auto max-h-64 object-cover rounded-lg shadow-lg"
                        />
                      </div>
                    )}

                    {/* Scheduled Time */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-400 font-semibold mb-1">📅 Date & Time</p>
                        <p className="text-gray-200">{formatDate(post.scheduledAt)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-semibold mb-1">✏️ Created</p>
                        <p className="text-gray-200">{formatDate(post.createdAt)}</p>
                      </div>
                    </div>

                    {/* Platforms */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2">📱 Platforms</p>
                      <div className="flex flex-wrap gap-2">
                        {post.platforms.map((platform) => (
                          <span key={platform} className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-lg border border-emerald-500/30 font-medium">
                            {getPlatformIcon(platform)} {platform}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-gray-700/50">
                      <button
                        onClick={() => deletePost(post.id)}
                        className="flex-1 px-4 py-2 bg-red-500/20 text-red-300 text-xs font-medium rounded-lg hover:bg-red-500/30 border border-red-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        <span>🗑️</span>
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.5);
        }
      `}</style>
    </div>
  );
};

export default QueueViewer;
