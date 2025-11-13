'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Send, Image, X, Sparkles } from 'lucide-react';
import AIContentGenerator from '@/components/AIContentGenerator';
import { CacheService, CACHE_KEYS } from '@/lib/cacheService';

type Platform = 'linkedin' | 'x' | 'facebook' | 'instagram';

interface SchedulePostProps {
  onSuccess?: () => void;
}

const SchedulePost: React.FC<SchedulePostProps> = ({ onSuccess }) => {
  const [content, setContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00'); // Default to 9 AM UTC
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['linkedin', 'x']);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [postType, setPostType] = useState<'post' | 'reel'>('post');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');

  // Load AI prompt from cache/settings
  useEffect(() => {
    const cachedSettings = CacheService.get<{ aiPrompt: string }>(CACHE_KEYS.AI_PROMPT);
    if (cachedSettings?.aiPrompt) {
      setAiPrompt(cachedSettings.aiPrompt);
    }
  }, []);

  const platforms = [
    { id: 'linkedin' as Platform, name: 'LinkedIn', icon: '💼', enabled: true },
    { id: 'x' as Platform, name: 'X (Twitter)', icon: '𝕏', enabled: true },
    { id: 'facebook' as Platform, name: 'Facebook', icon: '📘', enabled: false },
    { id: 'instagram' as Platform, name: 'Instagram', icon: '📸', enabled: false }
  ];

  // Horários em que as funções executam (UTC)
  const scheduledTimes = [
    { value: '09:00', label: '09:00 UTC (9h da manhã)' },
    { value: '12:00', label: '12:00 UTC (Meio-dia)' },
    { value: '18:00', label: '18:00 UTC (6h da tarde)' }
  ];

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  // Validate image dimensions (async - loads image to check size)
  const validateImageDimensions = (file: File): Promise<{ width: number; height: number; aspectRatio: number }> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: img.width,
          height: img.height,
          aspectRatio: img.width / img.height
        });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  };

  // Validate media client-side before upload
  const validateMediaClientSide = async (file: File): Promise<{ isValid: boolean; warnings: string[] }> => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const warnings: string[] = [];
    let isValid = true;

    // Check if Reel requires video
    if (postType === 'reel' && !isVideo) {
      warnings.push('❌ Reels require video content, not images');
      return { isValid: false, warnings };
    }

    // File size validation
    const fileSizeMB = file.size / 1024 / 1024;
    
    if (isImage) {
      // LinkedIn: max 10MB, X: max 5MB
      if (file.size > 10 * 1024 * 1024) {
        warnings.push(`❌ Image too large (${fileSizeMB.toFixed(1)}MB). Max: 10MB for LinkedIn, 5MB for X`);
        isValid = false;
      } else if (file.size > 5 * 1024 * 1024) {
        warnings.push(`⚠️ Image too large for X (${fileSizeMB.toFixed(1)}MB, max 5MB). Will work on LinkedIn only.`);
      }

      // Check dimensions
      try {
        const dims = await validateImageDimensions(file);
        const ratio = dims.aspectRatio;
        
        warnings.push(`📐 Image: ${dims.width}x${dims.height} (${ratio.toFixed(2)}:1)`);
        
        // LinkedIn: 1:1 to 1.91:1
        if (ratio < 0.95 || ratio > 2.0) {
          warnings.push(`⚠️ LinkedIn may crop image (ideal ratio: 1:1 to 1.91:1)`);
        }
        
        // X: 1:1 to 2:1
        if (ratio < 0.95 || ratio > 2.1) {
          warnings.push(`⚠️ X may crop image (ideal ratio: 1:1 to 2:1)`);
        }
        
        if (ratio >= 0.95 && ratio <= 1.91) {
          warnings.push(`✅ Aspect ratio perfect for all platforms`);
        }
      } catch (error) {
        warnings.push(`⚠️ Could not validate dimensions`);
      }
    }

    if (isVideo) {
      // LinkedIn: max 200MB, X: max 512MB
      if (file.size > 512 * 1024 * 1024) {
        warnings.push(`❌ Video too large (${fileSizeMB.toFixed(1)}MB). Max: 512MB`);
        isValid = false;
      } else if (file.size > 200 * 1024 * 1024) {
        warnings.push(`⚠️ Video too large for LinkedIn (${fileSizeMB.toFixed(1)}MB, max 200MB). Will work on X only.`);
      } else {
        warnings.push(`✅ Video size OK (${fileSizeMB.toFixed(1)}MB)`);
      }

      if (postType === 'reel') {
        warnings.push('🎬 Reel: Certifique-se que o vídeo tem 9:16 (vertical) e 3-90s de duração');
      } else {
        warnings.push('📹 Vídeo: LinkedIn max 10min, X max 2:20min');
      }
    }

    return { isValid, warnings };
  };

  // Media upload handler (images and videos)
  const handleMediaUpload = async (file: File) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      setMessage({ type: 'error', text: 'Only images and videos are supported' });
      return;
    }

    // Validate BEFORE upload
    setMessage({ type: 'warning', text: 'Validating media...' });
    const validation = await validateMediaClientSide(file);
    setValidationWarnings(validation.warnings);

    if (!validation.isValid) {
      setMessage({ type: 'error', text: 'Media validation failed. Check warnings below.' });
      return;
    }

    setUploading(true);
    setMediaType(isVideo ? 'video' : 'image');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('postType', postType);

      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        setMediaUrl(result.url);
        setMediaFile(file);
        
        // Show validation warnings from backend
        const backendWarnings = result.validation?.warnings || [];
        setValidationWarnings(backendWarnings);
        
        // Success message
        const hasErrors = backendWarnings.some((w: string) => w.includes('❌') || w.includes('⚠️'));
        if (hasErrors) {
          setMessage({ type: 'warning', text: `${isVideo ? 'Video' : 'Image'} uploaded with warnings. Check below.` });
        } else {
          setMessage({ type: 'success', text: `${isVideo ? 'Video' : 'Image'} uploaded successfully!` });
        }
      } else {
        setMessage({ type: 'error', text: `Upload failed: ${result.error}` });
        if (result.warnings && result.warnings.length > 0) {
          setValidationWarnings(result.warnings);
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Upload error. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && (files[0].type.startsWith('image/') || files[0].type.startsWith('video/'))) {
      handleMediaUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const schedulePost = async () => {
    if (!content.trim()) {
      setMessage({ type: 'error', text: 'Please enter post content' });
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      setMessage({ type: 'error', text: 'Please select date and time' });
      return;
    }

    if (selectedPlatforms.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one platform' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Combinar data e hora em ISO
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

      const response = await fetch('/api/social-media-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          scheduledAt: scheduledDateTime,
          platforms: selectedPlatforms,
          imageUrl: mediaUrl || undefined,
          mediaType: mediaType,
          postType: postType
        })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: '✅ Post scheduled successfully!' });
        // Reset form
        setContent('');
        setScheduledDate('');
        setScheduledTime('');
        setMediaUrl('');
        setMediaFile(null);
        setMediaType(null);
        setValidationWarnings([]);
        setPostType('post');
        onSuccess?.();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to schedule post' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error scheduling post. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-xl border border-gray-800 p-4 shadow-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-emerald-400" />
        <h3 className="text-lg font-bold text-white">Schedule Post</h3>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
            : message.type === 'warning'
            ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {message.type === 'success' ? '✓' : message.type === 'warning' ? '⚠' : '✕'}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-300">Content</label>
          {content.trim() && (
            <button
              onClick={() => setShowAI(true)}
              className="text-xs px-2 py-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/30 text-emerald-300 rounded-md flex items-center gap-1 transition-all"
            >
              <Sparkles className="w-3 h-3" />
              Improve with AI
            </button>
          )}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full h-40 px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none resize-none transition-all"
        />
        <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
          <span>{content.length} characters</span>
          <span>LinkedIn: ~1300 | X: ~280</span>
        </div>
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            <Calendar className="w-4 h-4 inline mr-2" />
            Date
          </label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            <Clock className="w-4 h-4 inline mr-2" />
            Time (UTC)
          </label>
          <select
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
          >
            {scheduledTimes.map(time => (
              <option key={time.value} value={time.value}>
                {time.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Posts são processados automaticamente nestes horários
          </p>
        </div>
      </div>

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          {validationWarnings.map((warning, idx) => (
            <div key={idx} className="text-sm text-yellow-300 mb-1 last:mb-0">
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Media Upload with Drag & Drop */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          {postType === 'reel' ? 'Video (Required for Reels)' : 'Image or Video (Optional)'}
        </label>
        <div
          className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${
            dragOver 
              ? 'border-emerald-400 bg-emerald-400/10' 
              : 'border-gray-600/50 bg-gray-800/30 hover:border-gray-500'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('schedule-media-upload')?.click()}
        >
          {uploading ? (
            <div className="flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-emerald-500 rounded-full animate-spin border-t-transparent mr-2"></div>
              <span className="text-emerald-300 font-medium">Uploading...</span>
            </div>
          ) : mediaUrl ? (
            <div>
              {mediaType === 'video' ? (
                <video src={mediaUrl} className="max-w-60 max-h-40 mx-auto rounded-lg mb-3 shadow-lg" controls />
              ) : (
                <img src={mediaUrl} alt="Preview" className="max-w-40 max-h-40 mx-auto rounded-lg mb-3 shadow-lg" />
              )}
              <p className="text-emerald-400 text-sm font-medium">✓ {mediaType === 'video' ? 'Video' : 'Image'} ready</p>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setMediaUrl("");
                  setMediaFile(null);
                  setMediaType(null);
                  setValidationWarnings([]);
                }}
                className="mt-2 text-xs text-gray-400 hover:text-red-400"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <div className="text-5xl mb-3">{postType === 'reel' ? '🎬' : '📸'}</div>
              <p className="text-gray-300 font-medium mb-1">
                Drop {postType === 'reel' ? 'video' : 'image/video'} here or click to upload
              </p>
              <p className="text-xs text-gray-500">
                {postType === 'reel' 
                  ? 'MP4, MOV - 9:16 vertical, 3-90s'
                  : 'Images: PNG, JPG (10MB max) | Videos: MP4, MOV (512MB max)'
                }
              </p>
            </div>
          )}
          <input
            id="schedule-media-upload"
            type="file"
            accept={postType === 'reel' ? 'video/*' : 'image/*,video/*'}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0])}
          />
        </div>
      </div>

      {/* Platform Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-3">Platforms</label>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {platforms.map((platform) => (
            <button
              key={platform.id}
              onClick={() => platform.enabled && togglePlatform(platform.id)}
              disabled={!platform.enabled}
              className={`px-3 py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                platform.enabled ? '' : 'opacity-50 cursor-not-allowed'
              } ${
                selectedPlatforms.includes(platform.id) && platform.enabled
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300 shadow-lg shadow-emerald-500/20'
                  : 'border-gray-700 bg-gray-900/30 text-gray-400 hover:border-gray-600'
              }`}
            >
              <div className="text-2xl flex-shrink-0">{platform.icon}</div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium truncate">{platform.name}</div>
                {!platform.enabled && (
                  <div className="text-[10px] text-orange-400">Em breve</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Post Type (for Facebook/Instagram) */}
      {(selectedPlatforms.includes('facebook') || selectedPlatforms.includes('instagram')) && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-3">Post Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPostType('post')}
              className={`p-3 rounded-xl border-2 transition-all ${
                postType === 'post'
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
                  : 'border-gray-700 bg-gray-900/30 text-gray-400 hover:border-gray-600'
              }`}
            >
              <div className="text-xl mb-1">📄</div>
              <div className="text-sm font-medium">Normal Post</div>
            </button>
            <button
              onClick={() => setPostType('reel')}
              className={`p-3 rounded-xl border-2 transition-all ${
                postType === 'reel'
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
                  : 'border-gray-700 bg-gray-900/30 text-gray-400 hover:border-gray-600'
              }`}
            >
              <div className="text-xl mb-1">🎬</div>
              <div className="text-sm font-medium">Reel (Video 9:16)</div>
            </button>
          </div>
        </div>
      )}

      {/* Schedule Button */}
      <button
        onClick={schedulePost}
        disabled={loading || !content.trim() || !scheduledDate || !scheduledTime || selectedPlatforms.length === 0}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white rounded-full animate-spin border-t-transparent mr-3"></div>
            Scheduling...
          </>
        ) : (
          <>
            <Clock className="w-5 h-5 mr-3" />
            Schedule Post
          </>
        )}
      </button>

      {/* AI Content Generator Modal */}
      {showAI && (
        <AIContentGenerator
          originalContent={content}
          userPrompt={aiPrompt}
          onAcceptSuggestion={(newContent) => setContent(newContent)}
          onClose={() => setShowAI(false)}
        />
      )}
    </div>
  );
};

export default SchedulePost;
