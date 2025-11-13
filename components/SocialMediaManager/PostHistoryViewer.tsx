'use client';

import React, { useState, useEffect } from 'react';
import { CacheService, CACHE_KEYS, CACHE_TTL } from '@/lib/cacheService';

interface HistoryPost {
  id: string;
  content: string;
  platforms: string[];
  sentPlatforms: string[];
  failedPlatforms: string[];
  mediaUrl?: string;
  mediaType?: string;
  postType: string;
  status: 'sent' | 'failed' | 'partial';
  sentAt: string;
  movedToHistoryAt: string;
  failureReason?: string;
  results?: any;
}

const PostHistoryViewer: React.FC = () => {
  const [history, setHistory] = useState<HistoryPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [daysFilter, setDaysFilter] = useState<number>(30);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Load history
  const loadHistory = async (forceRefresh: boolean = false) => {
    setLoading(true);
    try {
      // Clear cache if force refresh
      if (forceRefresh) {
        CacheService.remove(CACHE_KEYS.POST_HISTORY);
      }

      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedHistory = CacheService.get<HistoryPost[]>(CACHE_KEYS.POST_HISTORY);
        if (cachedHistory) {
          setHistory(cachedHistory);
          setLoading(false);
          return;
        }
      }

      const params = new URLSearchParams();
      params.append('days', daysFilter.toString());
      params.append('limit', '100');
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (platformFilter !== 'all') {
        params.append('platform', platformFilter);
      }

      const response = await fetch(`/api/post-history?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setHistory(data.history);
        // Cache for 20 minutes
        CacheService.set(CACHE_KEYS.POST_HISTORY, data.history, 1200);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load history' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Load on mount and when filters change
  useEffect(() => {
    loadHistory();
  }, [statusFilter, platformFilter, daysFilter]);

  // Repost from history
  const handleRepost = async (postId: string) => {
    try {
      const response = await fetch('/api/post-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'repost', postId }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Post added back to queue!' });
        loadHistory(true);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to repost' });
    }
  };

  // Delete from history
  const handleDelete = async (postId: string) => {
    if (!confirm('Delete this post from history?')) return;

    try {
      const response = await fetch('/api/post-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', postId }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Post deleted from history' });
        loadHistory(true);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete' });
    }
  };

  // Status badge styling
  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'sent') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (statusLower === 'partial') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
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

  const filteredHistory = history.filter(post =>
    post.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 shadow-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent flex items-center gap-2">
          <span className="text-2xl">📚</span>
          Post History
        </h3>
        <button
          onClick={() => loadHistory(true)}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 flex items-center gap-2 transition-all transform hover:scale-105 shadow-lg"
        >
          <span>🔄</span>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 pb-4 border-b border-gray-700/50">
        <div>
          <label className="text-xs font-semibold text-gray-400 mb-2 block">Search</label>
          <input
            type="text"
            placeholder="Search posts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 mb-2 block">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All</option>
            <option value="sent">Sent</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 mb-2 block">Platform</label>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Platforms</option>
            <option value="linkedin">LinkedIn</option>
            <option value="x">X (Twitter)</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 mb-2 block">Days</label>
          <select
            value={daysFilter.toString()}
            onChange={(e) => setDaysFilter(parseInt(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>
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

      {/* History Posts */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="mt-4 text-gray-300 font-medium">Loading history...</span>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-lg font-medium text-gray-300 mb-2">No posts found</p>
          <p className="text-sm">Your post history will appear here</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredHistory.map((post) => {
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
                  {post.mediaUrl && (
                    <img 
                      src={post.mediaUrl} 
                      alt="Post media" 
                      className="w-12 h-12 md:w-0 md:h-0 object-cover rounded-lg shadow-lg flex-shrink-0"
                    />
                  )}

                  {/* Content Preview */}
                  <div className="flex-1 min-w-0">
                    {/* Status & Type */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStatusBadge(post.status)}`}>
                        {post.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {post.postType === 'manual' ? '✋ Manual' : '🤖 Scheduled'}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        📅 {formatDate(post.sentAt, 'localedate')}
                      </span>
                    </div>

                    {/* Content Preview */}
                    <p className="text-gray-300 text-sm leading-relaxed truncate">
                      {preview}
                    </p>

                    {/* Platform Badges */}
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {post.sentPlatforms.map((platform) => (
                        <span key={`sent-${platform}`} className="px-2 py-0.5 bg-emerald-500/20 text-xs rounded text-emerald-300 font-medium border border-emerald-500/30">
                          ✓ {getPlatformIcon(platform)} {platform}
                        </span>
                      ))}
                      {post.failedPlatforms.map((platform) => (
                        <span key={`failed-${platform}`} className="px-2 py-0.5 bg-red-500/20 text-xs rounded text-red-300 font-medium border border-red-500/30">
                          ✗ {getPlatformIcon(platform)} {platform}
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
                    {post.mediaUrl && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 mb-2">🖼️ Media</p>
                        <img 
                          src={post.mediaUrl} 
                          alt="Post media" 
                          className="w-full h-auto max-h-64 object-cover rounded-lg shadow-lg"
                        />
                      </div>
                    )}

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-400 font-semibold mb-1">📅 Sent</p>
                        <p className="text-gray-200">{formatDate(post.sentAt)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-semibold mb-1">📚 Archived</p>
                        <p className="text-gray-200">{formatDate(post.movedToHistoryAt)}</p>
                      </div>
                    </div>

                    {/* Platforms Status */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2">📱 Platforms</p>
                      <div className="flex flex-wrap gap-2">
                        {post.sentPlatforms.map((platform) => (
                          <span key={`sent-${platform}`} className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-lg border border-emerald-500/30 font-medium">
                            ✓ {getPlatformIcon(platform)} {platform}
                          </span>
                        ))}
                        {post.failedPlatforms.map((platform) => (
                          <span key={`failed-${platform}`} className="px-3 py-1 bg-red-500/20 text-red-300 text-xs rounded-lg border border-red-500/30 font-medium">
                            ✗ {getPlatformIcon(platform)} {platform}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Failure Reason (if failed) */}
                    {post.failedPlatforms.length > 0 && post.failureReason && (
                      <div>
                        <p className="text-xs font-semibold text-red-400 mb-2">⚠️ Failure Reason</p>
                        <p className="text-red-300 text-xs">{post.failureReason}</p>
                      </div>
                    )}

                    {/* Platform Details */}
                    {post.results && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 mb-2">📊 Details</p>
                        <pre className="text-xs bg-gray-900 p-2 rounded overflow-auto max-h-40 text-gray-300 border border-gray-700">
                          {JSON.stringify(post.results, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-gray-700/50 flex-wrap">
                      {post.status !== 'failed' && (
                        <button
                          onClick={() => handleRepost(post.id)}
                          className="flex-1 min-w-[120px] px-4 py-2 bg-emerald-500/20 text-emerald-300 text-xs font-medium rounded-lg hover:bg-emerald-500/30 border border-emerald-500/30 transition-all flex items-center justify-center gap-2"
                        >
                          <span>📋</span>
                          Repost
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="flex-1 min-w-[120px] px-4 py-2 bg-red-500/20 text-red-300 text-xs font-medium rounded-lg hover:bg-red-500/30 border border-red-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        <span>🗑️</span>
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {history.length > 0 && (
        <div className="mt-4 text-xs text-gray-400 text-center">
          Showing <strong>{filteredHistory.length}</strong> of <strong>{history.length}</strong> posts
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

export default PostHistoryViewer;
