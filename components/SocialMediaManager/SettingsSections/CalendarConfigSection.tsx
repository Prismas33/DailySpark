'use client';

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Calendar, Save, Sparkles } from 'lucide-react';
import { saveUserSettings, getUserSettings } from '@/lib/userProfile';

interface CalendarConfigSectionProps {
  user: User;
}

export default function CalendarConfigSection({ user }: CalendarConfigSectionProps) {
  const [calendarPrompt, setCalendarPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const MAX_CHARS = 5000;

  useEffect(() => {
    loadSettings();
  }, [user.uid]);

  const loadSettings = async () => {
    try {
      const settings = await getUserSettings(user.uid, user);
      if (settings?.calendarPrompt) {
        setCalendarPrompt(settings.calendarPrompt);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (calendarPrompt.length > MAX_CHARS) {
      setMessage({ type: 'error', text: `Prompt must be less than ${MAX_CHARS} characters` });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await saveUserSettings(user.uid, user, {
        calendarPrompt: calendarPrompt.trim(),
      });
      
      setMessage({ type: 'success', text: '✅ Calendar prompt saved successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save prompt' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
      <h4 className="text-base font-bold text-white mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-purple-400" />
        Weekly Calendar Configuration
      </h4>

      {/* Message */}
      {message && (
        <div
          className={`mb-3 p-2 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Info */}
      <div className="mb-3 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <p className="text-xs text-purple-400">
          📅 <strong>Tip:</strong> This prompt will be used to generate your weekly content calendar. Include your niche, topics you want to cover, posting style, and any specific themes for each day.
        </p>
      </div>

      {/* Prompt Textarea */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Calendar Generation Prompt
        </label>
        <textarea
          value={calendarPrompt}
          onChange={(e) => setCalendarPrompt(e.target.value)}
          className="w-full h-48 px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none resize-none"
          placeholder={`Example:
I'm a tech entrepreneur. Generate a weekly calendar with:

Monday: Motivation/productivity tips
Tuesday: Tech industry insights
Wednesday: Behind-the-scenes of my startup
Thursday: Educational content about programming
Friday: Weekend project ideas
Saturday: Personal development
Sunday: Week review and planning ahead

Style: Professional but friendly, use emojis, include call-to-action.
Focus on: AI, startups, coding, entrepreneurship.`}
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-400">
            {calendarPrompt.length} / {MAX_CHARS} characters
          </span>
          {calendarPrompt.length > MAX_CHARS && (
            <span className="text-xs text-red-400">Character limit exceeded!</span>
          )}
        </div>
      </div>

      {/* Examples */}
      <div className="mb-3 p-2 bg-gray-900/50 border border-gray-700/50 rounded-lg">
        <p className="text-xs font-medium text-gray-300 mb-1">Ideas for your calendar prompt:</p>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Define themes for each day of the week</li>
          <li>• Specify your industry/niche and target audience</li>
          <li>• Include preferred tone (professional, casual, humorous)</li>
          <li>• Mention types of content (tips, stories, questions, polls)</li>
          <li>• Add any hashtags you always want to include</li>
        </ul>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving || calendarPrompt.length > MAX_CHARS}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Calendar Prompt
          </>
        )}
      </button>
    </div>
  );
}
