'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import AIContentGenerator from '@/components/AIContentGenerator';
import ImageGeneratorModal from '@/components/ImageGeneratorModal';
import CalendarImport from './CalendarImport';
import { CacheService, CACHE_KEYS } from '@/lib/cacheService';
import { useIsMobile } from '@/hooks/useIsMobile';

type SocialMediaPlatform = 'linkedin' | 'x' | 'facebook' | 'instagram';

interface PlatformConfig {
  name: string;
  icon: string;
  enabled: boolean;
}

const platformConfigs: Record<SocialMediaPlatform, PlatformConfig> = {
  linkedin: { name: 'LinkedIn', icon: '💼', enabled: true },
  x: { name: 'X (Twitter)', icon: '𝕏', enabled: true },
  facebook: { name: 'Facebook', icon: '📘', enabled: false },
  instagram: { name: 'Instagram', icon: '📸', enabled: false }
};

const ManualPost: React.FC = () => {
  // States
  const [content, setContent] = useState<string>("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<SocialMediaPlatform>>(new Set(['linkedin', 'x']));
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [postType, setPostType] = useState<'post' | 'reel'>('post');
  const [uploading, setUploading] = useState<boolean>(false);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [visualSuggestion, setVisualSuggestion] = useState<string>('');
  const [showImageGen, setShowImageGen] = useState(false);
  const isMobile = useIsMobile();

  // Load AI prompt from cache/settings
  useEffect(() => {
    const cachedSettings = CacheService.get<{ aiPrompt: string }>(CACHE_KEYS.AI_PROMPT);
    if (cachedSettings?.aiPrompt) {
      setAiPrompt(cachedSettings.aiPrompt);
      console.log('📝 ManualPost: AI prompt loaded from cache', {
        length: cachedSettings.aiPrompt.length,
        preview: cachedSettings.aiPrompt.substring(0, 50) + '...'
      });
    } else {
      console.log('⚠️ ManualPost: No AI prompt in cache');
    }
  }, []);

  // Platform toggle handler
  const togglePlatform = (platform: SocialMediaPlatform) => {
    setSelectedPlatforms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(platform)) {
        newSet.delete(platform);
      } else {
        newSet.add(platform);
      }
      return newSet;
    });
  };

  // Validate image dimensions (async - loads image to check size)
  const validateImageDimensions = (file: File): Promise<{ width: number; height: number; aspectRatio: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
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

    // Validate BEFORE upload (async now)
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
      formData.append('postType', postType); // Send postType for validation

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

  // Send manual post
  const sendManualPost = async () => {
    if (!content.trim() || selectedPlatforms.size === 0) return;

    // Validate Reels
    if (postType === 'reel') {
      const hasInstagramOrFacebook = selectedPlatforms.has('instagram') || selectedPlatforms.has('facebook');
      if (!hasInstagramOrFacebook) {
        setMessage({ type: 'error', text: 'Reels only available for Facebook/Instagram' });
        return;
      }
      if (mediaType !== 'video') {
        setMessage({ type: 'error', text: 'Reels require video content' });
        return;
      }
    }

    setSending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/socialMediaManualPost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'manual',
          text: content,
          platforms: Array.from(selectedPlatforms),
          mediaUrl: mediaUrl || null,
          postType: postType,
          mediaType: mediaType || null
        }),
      });

      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Post sent successfully!' });
        setContent("");
        setMediaUrl("");
        setMediaFile(null);
        setMediaType(null);
        setValidationWarnings([]);
      } else {
        setMessage({ type: 'error', text: `Failed: ${result.error}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error sending post. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700/50 shadow-xl p-4">
      <h3 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-4 flex items-center gap-2">
        <span className="text-xl">✍️</span>
        Post Now
      </h3>
      
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

      {/* Post Content */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-300">Content</label>
          <div className="flex items-center gap-1 sm:gap-2">
            <CalendarImport onImport={(text) => setContent(text)} />
            {content.trim() && (
              <button
                onClick={() => {
                  console.log('🎯 Opening AI modal with prompt:', {
                    hasPrompt: !!aiPrompt,
                    promptLength: aiPrompt?.length || 0,
                    promptPreview: aiPrompt ? aiPrompt.substring(0, 50) + '...' : 'EMPTY'
                  });
                  setShowAI(true);
                }}
                title="Improve with AI"
                className={`bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/30 text-emerald-300 rounded-md flex items-center gap-1 transition-all ${isMobile ? 'p-1.5' : 'text-xs px-2 py-1'}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {!isMobile && 'Improve with AI'}
              </button>
            )}
          </div>
        </div>
        <textarea
          className="w-full h-48 p-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none resize-y transition-all"
          placeholder="What do you want to share?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>{content.length} characters</span>
          <span>LinkedIn: ~1300 | X: ~280</span>
        </div>
      </div>

      {/* Visual Suggestion from AI */}
      {visualSuggestion && (
        <div className="mb-4 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <label className="flex items-center gap-2 text-sm font-medium text-purple-300 mb-1">
                🎨 AI Visual Suggestion
                <span className="text-xs text-purple-400 font-normal">(Click to generate image)</span>
              </label>
              <p className="text-sm text-gray-300 bg-gray-800/50 p-2 rounded border border-gray-600/50 whitespace-pre-wrap">
                {visualSuggestion}
              </p>
            </div>
            <button
              onClick={() => {
                console.log('🖼️ Opening image generator with prompt:', visualSuggestion);
                setShowImageGen(true);
              }}
              className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-all whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              Generate Image
            </button>
          </div>
          <button
            onClick={() => {
              console.log('🗑️ Clearing visual suggestion');
              setVisualSuggestion('');
            }}
            className="text-xs text-gray-400 hover:text-gray-300 mt-2 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear suggestion
          </button>
        </div>
      )}
      
      {/* Debug: Show if visualSuggestion state exists but empty */}
      {!visualSuggestion && content.includes('[Imagem:') && (
        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-300 text-sm">
          ⚠️ <strong>Debug:</strong> Found "[Imagem:" in content but not extracted. 
          <button
            onClick={() => {
              const match = content.match(/\[Imagem:\s*(.+?)\]/i);
              if (match) {
                setVisualSuggestion(match[1].trim());
                setContent(content.replace(/\[Imagem:\s*.+?\]/i, '').trim());
                console.log('🔧 Manually extracted:', match[1]);
              }
            }}
            className="ml-2 px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs"
          >
            Extract Now
          </button>
        </div>
      )}

      {/* Platform Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">Platforms</label>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {Object.entries(platformConfigs).map(([key, config]) => (
            <button
              key={key}
              onClick={() => config.enabled && togglePlatform(key as SocialMediaPlatform)}
              disabled={!config.enabled}
              className={`px-3 py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                config.enabled ? '' : 'opacity-50 cursor-not-allowed'
              } ${
                selectedPlatforms.has(key as SocialMediaPlatform) && config.enabled
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300 shadow-lg shadow-emerald-500/20'
                  : 'border-gray-600/50 bg-gray-800/30 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="text-2xl flex-shrink-0">{config.icon}</div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium truncate">{config.name}</div>
                {!config.enabled && (
                  <div className="text-[10px] text-orange-400">Em breve</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Post Type Selector (for Facebook/Instagram) */}
      {(selectedPlatforms.has('facebook') || selectedPlatforms.has('instagram')) && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">Post Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPostType('post')}
              className={`p-4 rounded-xl border-2 transition-all ${
                postType === 'post'
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
                  : 'border-gray-600/50 bg-gray-800/30 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="text-2xl mb-1">📄</div>
              <div className="text-sm font-medium">Post Normal</div>
              <div className="text-xs text-gray-500 mt-1">Imagem ou vídeo</div>
            </button>
            <button
              onClick={() => setPostType('reel')}
              className={`p-4 rounded-xl border-2 transition-all ${
                postType === 'reel'
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
                  : 'border-gray-600/50 bg-gray-800/30 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="text-2xl mb-1">🎬</div>
              <div className="text-sm font-medium">Reel</div>
              <div className="text-xs text-gray-500 mt-1">Apenas vídeo 9:16</div>
            </button>
          </div>
        </div>
      )}

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

      {/* Media Upload */}
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
          onClick={() => document.getElementById('media-upload')?.click()}
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
            id="media-upload"
            type="file"
            accept={postType === 'reel' ? 'video/*' : 'image/*,video/*'}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0])}
          />
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={sendManualPost}
        disabled={sending || uploading || !content.trim() || selectedPlatforms.size === 0}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center transition-all transform hover:scale-105 shadow-lg hover:shadow-emerald-500/30"
      >
        {sending || uploading ? (
          <>
            <div className="w-5 h-5 border-2 border-white rounded-full animate-spin border-t-transparent mr-2"></div>
            {sending ? 'Posting...' : 'Uploading...'}
          </>
        ) : (
          <>
            <span className="text-xl mr-2">🚀</span>
            Post to {selectedPlatforms.size} platform{selectedPlatforms.size !== 1 ? 's' : ''}
          </>
        )}
      </button>

      {/* AI Content Generator Modal */}
      {showAI && (
        <AIContentGenerator
          originalContent={content}
          userPrompt={aiPrompt}
          onAcceptSuggestion={(newContent, visual) => {
            console.log('📝 Received content from AI:', JSON.stringify(newContent));
            console.log('📝 Content has newlines:', newContent.includes('\n'));
            console.log('📝 Content has double newlines:', newContent.includes('\n\n'));
            setContent(newContent);
            if (visual) {
              setVisualSuggestion(visual);
              console.log('🎨 Visual suggestion saved:', visual);
            }
          }}
          onClose={() => setShowAI(false)}
        />
      )}

      {/* Image Generator Modal */}
      {showImageGen && visualSuggestion && (
        <ImageGeneratorModal
          prompt={visualSuggestion}
          onAcceptImage={async (imageUrl, imageFile) => {
            // Upload AI-generated image to Firebase Storage first
            setUploading(true);
            setMessage({ type: 'warning', text: 'Uploading generated image...' });
            
            try {
              const formData = new FormData();
              formData.append('file', imageFile);
              formData.append('postType', 'post');

              const response = await fetch('/api/storage/upload', {
                method: 'POST',
                body: formData,
              });

              const result = await response.json();
              if (result.success) {
                setMediaUrl(result.url);
                setMediaFile(imageFile);
                setMediaType('image');
                setMessage({ type: 'success', text: '✅ AI image uploaded successfully!' });
                console.log('✅ AI-generated image uploaded to Storage:', result.url);
              } else {
                setMessage({ type: 'error', text: `Upload failed: ${result.error}` });
              }
            } catch (error) {
              console.error('❌ Failed to upload AI image:', error);
              setMessage({ type: 'error', text: 'Error uploading image. Please try again.' });
            } finally {
              setUploading(false);
            }
          }}
          onClose={() => setShowImageGen(false)}
        />
      )}
    </div>
  );
};

export default ManualPost;
