'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Check, X } from 'lucide-react';
import { CacheService, CACHE_KEYS } from '@/lib/cacheService';

interface AIContentGeneratorProps {
  originalContent: string;
  userPrompt?: string;
  onAcceptSuggestion: (newContent: string, visualSuggestion?: string) => void;
  onClose: () => void;
}

export default function AIContentGenerator({
  originalContent,
  userPrompt: initialPrompt = '',
  onAcceptSuggestion,
  onClose
}: AIContentGeneratorProps) {
  const [suggestion, setSuggestion] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>(initialPrompt);
  const [aiModel, setAiModel] = useState<'gpt-4o-mini' | 'gpt-4o'>('gpt-4o-mini');

  // Always load the freshest prompt from cache when modal opens
  useEffect(() => {
    const cachedSettings = CacheService.get<{ aiPrompt: string }>(CACHE_KEYS.AI_PROMPT);
    if (cachedSettings?.aiPrompt) {
      setCurrentPrompt(cachedSettings.aiPrompt);
      console.log('✅ AI Prompt loaded from cache:', cachedSettings.aiPrompt.substring(0, 100) + '...');
    } else if (initialPrompt) {
      setCurrentPrompt(initialPrompt);
      console.log('✅ Using initial prompt:', initialPrompt.substring(0, 100) + '...');
    } else {
      console.log('⚠️ No custom AI prompt found, will use default');
    }
  }, [initialPrompt]);

  const generateContent = async () => {
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

      const payload = {
        content: originalContent,
        userPrompt: currentPrompt,
        action: suggestion ? 'regenerate' : 'improve',
        model: aiModel, // Pass selected model to API
      };

      console.log('🚀 Sending to AI API:', {
        contentLength: originalContent.length,
        hasCustomPrompt: !!currentPrompt,
        promptLength: currentPrompt?.length || 0,
        promptPreview: currentPrompt ? currentPrompt.substring(0, 80) + '...' : 'NONE',
        payload
      });

      // Call AI API to generate/improve content
      const response = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Show specific OpenAI error message
        let errorMsg = data.error || 'Failed to generate content';
        
        // Add extra details if available
        if (data.errorDetails) {
          errorMsg += `\n\nDetalhes: ${data.errorDetails}`;
        }
        
        throw new Error(errorMsg);
      }
      
      if (data.success && data.generatedContent) {
        setSuggestion(data.generatedContent);
        setShowComparison(true);
        console.log('✅ AI content generated successfully');
      } else {
        throw new Error(data.error || 'No content generated');
      }
    } catch (err: any) {
      console.error('❌ AI generation error:', err);
      setError(err.message || 'Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (suggestion) {
      let cleanContent = suggestion;
      let visualSuggestion: string | undefined;

      // Try multiple patterns for image/visual suggestions
      // Pattern 1: "Visual sugerido: ..."
      let visualMatch = suggestion.match(/Visual sugerido:\s*(.+?)(?:\n|$)/i);
      
      // Pattern 2: "[Imagem: ...]"
      if (!visualMatch) {
        visualMatch = suggestion.match(/\[Imagem:\s*(.+?)\]/i);
      }
      
      // Pattern 3: "Imagem sugerida: ..."
      if (!visualMatch) {
        visualMatch = suggestion.match(/Imagem sugerida:\s*(.+?)(?:\n|$)/i);
      }
      
      // Pattern 4: "Visual: ..."
      if (!visualMatch) {
        visualMatch = suggestion.match(/Visual:\s*(.+?)(?:\n|$)/i);
      }

      if (visualMatch) {
        visualSuggestion = visualMatch[1].trim();
        
        // Remove the matched pattern from content
        cleanContent = suggestion
          .replace(/Visual sugerido:\s*.+?(?:\n|$)/i, '')
          .replace(/\[Imagem:\s*.+?\]/i, '')
          .replace(/Imagem sugerida:\s*.+?(?:\n|$)/i, '')
          .replace(/Visual:\s*.+?(?:\n|$)/i, '')
          .trim();
        
        console.log('🎨 Extracted visual suggestion:', visualSuggestion);
      } else {
        console.log('⚠️ No visual suggestion pattern found');
      }

      onAcceptSuggestion(cleanContent, visualSuggestion);
      onClose();
    }
  };

  const handleRegenerate = () => {
    setSuggestion('');
    setShowComparison(false);
    generateContent();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">AI Content Assistant</h3>
                <p className="text-xs text-gray-400">Improve your content with AI</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* AI Model Selector */}
          <div className="flex items-center justify-between gap-4 mt-3 pt-3 border-t border-gray-700/50">
            <div className="flex items-center gap-2 text-xs">
              {currentPrompt ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-3 h-3" />
                  Using your custom AI prompt
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-700 text-gray-400">
                  Using default prompt
                </span>
              )}
            </div>
            
            {/* Model Switch */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Model:</span>
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setAiModel('gpt-4o-mini')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                    aiModel === 'gpt-4o-mini'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    ⚡ Mini
                    <span className="text-[10px] opacity-70">(fast)</span>
                  </span>
                </button>
                <button
                  onClick={() => setAiModel('gpt-4o')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                    aiModel === 'gpt-4o'
                      ? 'bg-purple-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    🧠 GPT-4o
                    <span className="text-[10px] opacity-70">(advanced)</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Model Info */}
          <div className="mt-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
            {aiModel === 'gpt-4o-mini' ? (
              <p className="text-xs text-gray-400">
                💡 <span className="text-blue-400 font-medium">GPT-4o-mini</span>: Best for quick posts, random ideas, and generic content. 
                <span className="text-emerald-400"> (~€0.0004/post)</span>
              </p>
            ) : (
              <p className="text-xs text-gray-400">
                🚀 <span className="text-purple-400 font-medium">GPT-4o</span>: Best for personal storytelling, deep analysis, and creative content. 
                <span className="text-orange-400"> (~€0.019/post)</span>
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className={`p-4 rounded-lg text-sm ${
              error.includes('limit') || error.includes('Rate limit')
                ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">
                  {error.includes('limit') || error.includes('Rate limit') ? '⏱️' : '⚠️'}
                </span>
                <div className="flex-1">
                  <p className="font-medium mb-1">
                    {error.includes('limit') || error.includes('Rate limit') 
                      ? 'Rate Limit Reached' 
                      : 'Error Generating Content'}
                  </p>
                  <p className="text-xs opacity-90 whitespace-pre-line">{error}</p>
                  {(error.includes('limit') || error.includes('Rate limit')) && (
                    <div className="mt-3 pt-3 border-t border-orange-500/20">
                      <p className="text-xs font-medium mb-1">What to do:</p>
                      <ul className="text-xs space-y-1 opacity-80">
                        <li>• Wait and try again later</li>
                        <li>• Use a different AI provider</li>
                        <li>• Check your API usage dashboard</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Initial State - Show Original + Generate Button */}
          {!suggestion && !loading && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Original Content
                </label>
                <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg text-white text-sm whitespace-pre-wrap">
                  {originalContent}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {originalContent.length} characters
                </p>
              </div>

              <button
                onClick={generateContent}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-5 h-5" />
                Generate AI Suggestion
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-300 font-medium">AI is working on your content...</p>
              <p className="text-gray-500 text-sm mt-1">This may take a few seconds</p>
            </div>
          )}

          {/* Comparison View */}
          {showComparison && suggestion && !loading && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Original */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                  Original
                </label>
                <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-400 text-sm whitespace-pre-wrap h-64 overflow-y-auto">
                  {originalContent}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {originalContent.length} characters
                </p>
              </div>

              {/* AI Suggestion */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  AI Suggestion
                </label>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-white text-sm whitespace-pre-wrap h-64 overflow-y-auto">
                  {suggestion}
                </div>
                <p className="text-xs text-emerald-400 mt-2">
                  {suggestion.length} characters
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {showComparison && suggestion && !loading && (
          <div className="px-6 py-4 border-t border-gray-700 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleRegenerate}
              className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              <X className="w-4 h-4" />
              Keep Original
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              <Check className="w-4 h-4" />
              Use AI Version
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
