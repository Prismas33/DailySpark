'use client';

import React, { useState, useEffect } from 'react';
import { CacheService, CACHE_KEYS } from '@/lib/cacheService';

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

interface RepostModalState {
  isOpen: boolean;
  postId: string | null;
  post: HistoryPost | null;
  content: string;
  platforms: string[];
  scheduleType: 'now' | 'later';
  scheduledDate: string;
  scheduledTime: string;
  isSubmitting: boolean;
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
  const [repostModal, setRepostModal] = useState<RepostModalState>({
    isOpen: false,
    postId: null,
    post: null,
    content: '',
    platforms: [],
    scheduleType: 'now',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '12:00',
    isSubmitting: false
  });

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

  const loadHistory = async (forceRefresh: boolean = false) => {
    setLoading(true);
    try {
      if (forceRefresh) {
        CacheService.remove(CACHE_KEYS.POST_HISTORY);
      }

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

  useEffect(() => {
    loadHistory();
  }, [statusFilter, platformFilter, daysFilter]);

  const handleOpenRepostModal = (post: HistoryPost) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    setRepostModal({
      isOpen: true,
      postId: post.id,
      post,
      content: post.content,
      platforms: post.sentPlatforms.length > 0 ? post.sentPlatforms : post.platforms,
      scheduleType: 'now',
      scheduledDate: tomorrow.toISOString().split('T')[0],
      scheduledTime: '12:00',
      isSubmitting: false
    });
  };

  const handleSubmitRepost = async () => {
    if (!repostModal.postId) return;

    setRepostModal(prev => ({ ...prev, isSubmitting: true }));
    
    try {
      let scheduledAt = new Date();
      
      if (repostModal.scheduleType === 'later') {
        scheduledAt = new Date(`${repostModal.scheduledDate}T${repostModal.scheduledTime}:00`);
        
        if (isNaN(scheduledAt.getTime())) {
          throw new Error('Invalid date or time');
        }
      }

      const response = await fetch('/api/post-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'repost',
          postId: repostModal.postId,
          content: repostModal.content,
          platforms: repostModal.platforms,
          scheduledAt: scheduledAt.toISOString()
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: '✅ Post adicionado à fila!' });
        setRepostModal(prev => ({ ...prev, isOpen: false }));
        loadHistory(true);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao repostar' });
    } finally {
      setRepostModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

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

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'sent') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (statusLower === 'partial') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    if (statusLower === 'failed') return 'bg-red-500/20 text-red-300 border-red-500/30';
    return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

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

      <details className="mb-4 pb-4 border-b border-gray-700/50">
        <summary className="text-sm font-semibold text-gray-300 cursor-pointer hover:text-emerald-400 transition-colors flex items-center gap-2 mb-3">
          <span>🔍</span>
          Filters
        </summary>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
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
      </details>

      {message && (
        <div className={`mb-4 p-4 rounded-xl text-sm font-medium ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
            : 'bg-red-500/10 border border-red-500/30 text-red-300'
        }`}>
          {message.type === 'success' ? '✅ ' : '❌ '}{message.text}
        </div>
      )}

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
                <button
                  onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                  className="w-full text-left p-3 md:p-4 flex items-start gap-3 hover:bg-gray-700/30 transition-colors"
                >
                  {post.mediaUrl && (
                    <img 
                      src={post.mediaUrl} 
                      alt="Post media" 
                      className="w-12 h-12 md:w-0 md:h-0 object-cover rounded-lg shadow-lg flex-shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
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

                    <p className="text-gray-300 text-sm leading-relaxed truncate">
                      {preview}
                    </p>

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

                  <div className="text-gray-400 flex-shrink-0 text-lg mt-1">
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-700/50 bg-gray-900/30 p-3 md:p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2">📝 Full Content</p>
                      <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {post.content}
                      </p>
                    </div>

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

                    <div className="flex gap-2 pt-3 border-t border-gray-700/50 flex-wrap">
                      <button
                        onClick={() => handleOpenRepostModal(post)}
                        className="flex-1 min-w-[120px] px-4 py-2 bg-emerald-500/20 text-emerald-300 text-xs font-medium rounded-lg hover:bg-emerald-500/30 border border-emerald-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        <span>📋</span>
                        Repostar
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="flex-1 min-w-[120px] px-4 py-2 bg-red-500/20 text-red-300 text-xs font-medium rounded-lg hover:bg-red-500/30 border border-red-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        <span>🗑️</span>
                        Apagar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4 text-xs text-gray-400 text-center">
          Showing <strong>{filteredHistory.length}</strong> of <strong>{history.length}</strong> posts
        </div>
      )}

      {repostModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-700/50 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                📋 Repostar
              </h2>
              <button
                onClick={() => setRepostModal(prev => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-white text-2xl transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {repostModal.post?.mediaUrl && (
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-2 block">🖼️ Imagem</label>
                  <img 
                    src={repostModal.post.mediaUrl} 
                    alt="Post media" 
                    className="w-full h-40 object-cover rounded-lg shadow-lg border border-gray-700"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-400 mb-2 block">📝 Conteúdo</label>
                <textarea
                  value={repostModal.content}
                  onChange={(e) => setRepostModal(prev => ({ ...prev, content: e.target.value }))}
                  maxLength={5000}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:border-emerald-500 focus:outline-none resize-none"
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">{repostModal.content.length}/5000</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 mb-2 block">📱 Plataformas</label>
                <div className="space-y-2">
                  {['linkedin', 'x'].map((platform) => (
                    <label key={platform} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={repostModal.platforms.includes(platform)}
                        onChange={(e) => {
                          setRepostModal(prev => ({
                            ...prev,
                            platforms: e.target.checked
                              ? [...prev.platforms, platform]
                              : prev.platforms.filter(p => p !== platform)
                          }));
                        }}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 cursor-pointer"
                      />
                      <span className="text-sm text-gray-300 capitalize">{platform === 'x' ? 'X (Twitter)' : platform}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 mb-2 block">⏰ Quando enviar?</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scheduleType"
                      value="now"
                      checked={repostModal.scheduleType === 'now'}
                      onChange={() => setRepostModal(prev => ({ ...prev, scheduleType: 'now' }))}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm text-gray-300">Agora</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scheduleType"
                      value="later"
                      checked={repostModal.scheduleType === 'later'}
                      onChange={() => setRepostModal(prev => ({ ...prev, scheduleType: 'later' }))}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <span className="text-sm text-gray-300">Agendar para...</span>
                  </label>
                </div>
              </div>

              {repostModal.scheduleType === 'later' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-2 block">📅 Data</label>
                    <input
                      type="date"
                      value={repostModal.scheduledDate}
                      onChange={(e) => setRepostModal(prev => ({ ...prev, scheduledDate: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-2 block">🕐 Hora</label>
                    <input
                      type="time"
                      value={repostModal.scheduledTime}
                      onChange={(e) => setRepostModal(prev => ({ ...prev, scheduledTime: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-700/50 p-6 flex gap-3">
              <button
                onClick={() => setRepostModal(prev => ({ ...prev, isOpen: false }))}
                disabled={repostModal.isSubmitting}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-all"
              >
                Cancelar
              </button>
              
              {repostModal.scheduleType === 'now' ? (
                <button
                  onClick={async () => {
                    if (!repostModal.postId || repostModal.platforms.length === 0) {
                      setMessage({ type: 'error', text: 'Selecione pelo menos uma plataforma' });
                      return;
                    }
                    setRepostModal(prev => ({ ...prev, isSubmitting: true }));
                    try {
                      const res = await fetch('/api/socialMediaManualPost', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          type: 'manual',
                          text: repostModal.content,
                          platforms: repostModal.platforms,
                          mediaUrl: repostModal.post?.mediaUrl || null,
                          imageUrl: repostModal.post?.mediaUrl || null,
                          mediaType: repostModal.post?.mediaType || (repostModal.post?.mediaUrl ? 'image' : null)
                        })
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        setMessage({ type: 'success', text: '✅ Post enviado agora!' });
                        setRepostModal(prev => ({ ...prev, isOpen: false }));
                        loadHistory(true);
                      } else {
                        throw new Error(data.error || 'Falha ao enviar');
                      }
                    } catch (err: any) {
                      setMessage({ type: 'error', text: err.message });
                    } finally {
                      setRepostModal(prev => ({ ...prev, isSubmitting: false }));
                    }
                  }}
                  disabled={repostModal.isSubmitting || repostModal.platforms.length === 0}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  {repostModal.isSubmitting ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      Enviar agora
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSubmitRepost}
                  disabled={repostModal.isSubmitting || repostModal.platforms.length === 0}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  {repostModal.isSubmitting ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Agendando...
                    </>
                  ) : (
                    <>
                      <span>📅</span>
                      Agendar
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
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
