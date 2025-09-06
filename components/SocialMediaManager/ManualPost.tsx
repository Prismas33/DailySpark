'use client';

import React, { useState } from 'react';

type SocialMediaPlatform = 'linkedin' | 'facebook' | 'instagram' | 'threads' | 'x';

interface PlatformConfig {
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
}

const platformConfigs: Record<SocialMediaPlatform, PlatformConfig> = {
  linkedin: { name: 'LinkedIn', icon: '💼', color: 'bg-blue-600', enabled: true },
  facebook: { name: 'Facebook', icon: '📘', color: 'bg-blue-700', enabled: true },
  instagram: { name: 'Instagram', icon: '📸', color: 'bg-gradient-to-r from-purple-500 to-pink-500', enabled: true },
  threads: { name: 'Threads', icon: '🧵', color: 'bg-gray-900', enabled: true },
  x: { name: 'X (Twitter)', icon: '𝕏', color: 'bg-gray-800', enabled: true }
};

const ManualPost: React.FC = () => {
  // States
  const [manualText, setManualText] = useState<string>("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<SocialMediaPlatform>>(new Set(['linkedin', 'facebook', 'instagram']));
  const [useTemplateImage, setUseTemplateImage] = useState<boolean>(true);
  const [manualImage, setManualImage] = useState<string>("");
  const [manualImageFile, setManualImageFile] = useState<File | null>(null);
  const [manualImageUploading, setManualImageUploading] = useState<boolean>(false);
  const [jobId, setJobId] = useState<string>("");
  const [jobIdValid, setJobIdValid] = useState<boolean | null>(null);
  const [jobIdLoading, setJobIdLoading] = useState<boolean>(false);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  // Image upload handler
  const handleImageUpload = async (file: File) => {
    if (!file) return;

    setManualImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        setManualImage(result.url);
        setManualImageFile(file);
        setMessage('Image uploaded successfully!');
      } else {
        setMessage(`Error uploading image: ${result.error}`);
      }
    } catch (error) {
      setMessage('Error uploading image. Please try again.');
    } finally {
      setManualImageUploading(false);
    }
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleImageUpload(files[0]);
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

  // Job ID validation
  const validateJobId = async (id: string) => {
    if (!id.trim()) {
      setJobIdValid(null);
      return;
    }

    setJobIdLoading(true);
    try {
      const response = await fetch(`/api/firestore/jobs?id=${encodeURIComponent(id)}`);
      const data = await response.json();
      setJobIdValid(data.success);
    } catch (error) {
      setJobIdValid(false);
    } finally {
      setJobIdLoading(false);
    }
  };

  // Send manual post
  const sendManualPost = async () => {
    if (!manualText.trim() || selectedPlatforms.size === 0) return;

    setSending(true);
    try {
      const response = await fetch('/api/socialMediaManualPost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: manualText,
          platforms: Array.from(selectedPlatforms),
          imageUrl: useTemplateImage ? undefined : manualImage,
          jobId: jobId.trim() || undefined
        }),
      });

      const result = await response.json();
      if (result.success) {
        setMessage('✅ Post sent successfully to selected platforms!');
        setManualText("");
        setJobId("");
        setJobIdValid(null);
        setManualImage("");
        setManualImageFile(null);
      } else {
        setMessage(`❌ Error sending post: ${result.error}`);
      }
    } catch (error) {
      setMessage('❌ Error sending post. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-orange-300 mb-4">✍️ Create Manual Post</h3>
      
      {/* Message Display */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.includes('✅') ? 'bg-green-900/50 border-green-500 text-green-300' : 'bg-red-900/50 border-red-500 text-red-300'
        } border`}>
          {message}
        </div>
      )}

      {/* Post Content */}
      <div className="mb-4">
        <label className="block text-sm text-gray-300 mb-2">Post Content</label>
        <textarea
          className="w-full h-32 p-3 bg-black/60 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-400 focus:outline-none resize-none"
          placeholder="Write your post content here..."
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
        />
        <div className="text-xs text-gray-400 mt-1">
          Characters: {manualText.length} | Recommended: LinkedIn ~1300, Facebook ~2200, Instagram ~2200, Threads ~500, X ~280
        </div>
      </div>

      {/* Platform Selection */}
      <div className="mb-4">
        <label className="block text-sm text-gray-300 mb-2">Select Platforms</label>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {Object.entries(platformConfigs).map(([key, config]) => (
            <button
              key={key}
              onClick={() => togglePlatform(key as SocialMediaPlatform)}
              className={`p-3 rounded-lg border transition-all ${
                selectedPlatforms.has(key as SocialMediaPlatform)
                  ? 'border-orange-400 bg-orange-400/20 text-orange-300'
                  : 'border-gray-600 bg-black/40 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="text-lg mb-1">{config.icon}</div>
              <div className="text-xs">{config.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Image Options */}
      <div className="mb-4">
        <label className="block text-sm text-gray-300 mb-2">Image Options</label>
        <div className="space-y-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="imageOption"
              checked={useTemplateImage}
              onChange={() => setUseTemplateImage(true)}
              className="text-violet-500"
            />
            <span className="text-gray-300">Use template image</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="imageOption"
              checked={!useTemplateImage}
              onChange={() => setUseTemplateImage(false)}
              className="text-violet-500"
            />
            <span className="text-gray-300">Upload custom image</span>
          </label>
        </div>

        {/* Custom Image Upload */}
        {!useTemplateImage && (
          <div className="mt-3">
            <div
              className={`p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                dragOver ? 'border-orange-400 bg-orange-400/10' : 'border-gray-600 bg-black/30'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('manual-image-upload')?.click()}
            >
              {manualImageUploading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-violet-500 rounded-full animate-spin border-t-transparent mr-2"></div>
                  <span className="text-violet-300">Uploading...</span>
                </div>
              ) : manualImage ? (
                <div>
                  <img src={manualImage} alt="Preview" className="max-w-32 max-h-32 mx-auto rounded mb-2" />
                  <p className="text-green-400 text-sm">✓ Image uploaded</p>
                </div>
              ) : (
                <div>
                  <div className="text-4xl mb-2">📸</div>
                  <p className="text-gray-400">Drop image here or click to upload</p>
                </div>
              )}
              <input
                id="manual-image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
              />
            </div>
          </div>
        )}
      </div>

      {/* Job ID (Optional) */}
      <div className="mb-6">
        <label className="block text-sm text-gray-300 mb-2">Job ID (Optional)</label>
        <div className="relative">
          <input
            type="text"
            className="w-full p-3 pr-10 bg-black/60 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-violet-500 focus:outline-none"
            placeholder="Enter job ID to validate and create link..."
            value={jobId}
            onChange={(e) => {
              setJobId(e.target.value);
              validateJobId(e.target.value);
            }}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {jobIdLoading ? (
              <div className="w-4 h-4 border-2 border-violet-500 rounded-full animate-spin border-t-transparent"></div>
            ) : jobIdValid === true ? (
              <span className="text-green-400">✓</span>
            ) : jobIdValid === false ? (
              <span className="text-red-400">✗</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={sendManualPost}
        disabled={sending || manualImageUploading || !manualText.trim() || selectedPlatforms.size === 0}
        className="w-full bg-gradient-to-r from-orange-400 to-amber-500 text-white py-3 px-6 rounded-lg font-semibold hover:from-orange-500 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all transform hover:scale-105"
      >
        {sending || manualImageUploading ? (
          <>
            <div className="w-5 h-5 border-2 border-white rounded-full animate-spin border-t-transparent mr-2"></div>
            {sending ? 'Sending...' : 'Uploading...'}
          </>
        ) : (
          <>
            <span className="mr-2">🚀</span>
            Send to {selectedPlatforms.size} platform{selectedPlatforms.size !== 1 ? 's' : ''}
          </>
        )}
      </button>
    </div>
  );
};

export default ManualPost;
