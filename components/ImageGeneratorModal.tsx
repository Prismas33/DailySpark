'use client';

import React, { useState } from 'react';
import { Sparkles, RefreshCw, Check, X, Upload, Download } from 'lucide-react';

interface ImageGeneratorModalProps {
  prompt: string;
  onAcceptImage: (imageUrl: string, imageFile: File) => void;
  onClose: () => void;
}

export default function ImageGeneratorModal({
  prompt,
  onAcceptImage,
  onClose
}: ImageGeneratorModalProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [revisedPrompt, setRevisedPrompt] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateImage = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get Firebase auth token
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('You must be signed in to use AI features');
      }

      const token = await user.getIdToken();

      console.log('🎨 Generating image with DALL-E 3:', prompt);

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Show specific OpenAI error message
        let errorMsg = data.error || 'Failed to generate image';
        
        // Add extra details if available
        if (data.errorDetails) {
          errorMsg += `\n\nDetalhes: ${data.errorDetails}`;
        }
        
        throw new Error(errorMsg);
      }
      
      if (data.success && data.imageUrl) {
        setImageUrl(data.imageUrl);
        setRevisedPrompt(data.revisedPrompt || '');
        console.log('✅ Image generated:', data.imageUrl);
      } else {
        throw new Error('No image generated');
      }
    } catch (err: any) {
      console.error('❌ Image generation error:', err);
      setError(err.message || 'Failed to generate image');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAndAccept = async () => {
    if (!imageUrl) return;

    try {
      setLoading(true);
      
      // Download image as blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // Create File from blob
      const file = new File([blob], 'ai-generated-image.png', { type: 'image/png' });
      
      onAcceptImage(imageUrl, file);
      onClose();
    } catch (err: any) {
      console.error('❌ Failed to download image:', err);
      setError('Failed to download image. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDifferent = () => {
    // Close this modal and user can use normal upload
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">AI Image Generator</h3>
              <p className="text-xs text-gray-400">Powered by DALL-E 3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Prompt Display */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Image Description
            </label>
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-200 text-sm">
              {prompt}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-300 text-sm flex items-start gap-2">
              <span>⚠️</span>
              <div className="flex-1">
                <p className="font-medium mb-1">Generation Failed</p>
                <p className="whitespace-pre-line">{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && !imageUrl && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-300 font-medium">Generating your image...</p>
              <p className="text-xs text-gray-400 mt-2">This may take 10-30 seconds</p>
            </div>
          )}

          {/* Generated Image */}
          {imageUrl && !loading && (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden border-2 border-purple-500/30">
                <img 
                  src={imageUrl} 
                  alt="AI Generated" 
                  className="w-full h-auto"
                />
              </div>
              
              {revisedPrompt && (
                <div className="text-xs text-gray-400">
                  <p className="font-medium mb-1">DALL-E 3 interpreted your prompt as:</p>
                  <p className="italic">"{revisedPrompt}"</p>
                </div>
              )}
            </div>
          )}

          {/* Initial State - No Image Yet */}
          {!imageUrl && !loading && !error && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-purple-400" />
              </div>
              <p className="text-gray-300 font-medium mb-2">Ready to generate</p>
              <p className="text-sm text-gray-400">Click below to create your image with AI</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-700 flex gap-3">
          {!imageUrl ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={generateImage}
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-5 h-5" />
                {loading ? 'Generating...' : 'Generate Image'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleUploadDifferent}
                className="py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Upload className="w-5 h-5" />
                Upload Different
              </button>
              <button
                onClick={generateImage}
                disabled={loading}
                className="py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className="w-5 h-5" />
                Regenerate
              </button>
              <button
                onClick={handleDownloadAndAccept}
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Check className="w-5 h-5" />
                {loading ? 'Downloading...' : 'Use This Image'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
