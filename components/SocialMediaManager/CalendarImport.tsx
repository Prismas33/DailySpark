'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, RefreshCw, Sparkles, X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { WeeklyCalendar, CalendarDay } from '@/types/user';
import { CacheService, CACHE_TTL } from '@/lib/cacheService';

const CACHE_KEY = 'weekly_calendars';

const DAY_NAMES: Record<CalendarDay['day'], string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

interface CalendarImportProps {
  onImport: (content: string) => void;
}

export default function CalendarImport({ onImport }: CalendarImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [calendars, setCalendars] = useState<WeeklyCalendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeekCalendar, setCurrentWeekCalendar] = useState<WeeklyCalendar | null>(null);

  const getAuthToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  };

  // Check if calendar is for current week
  const isCurrentWeek = (calendar: WeeklyCalendar): boolean => {
    const now = new Date();
    const weekStart = new Date(calendar.weekStart);
    const weekEnd = new Date(calendar.weekEnd);
    return now >= weekStart && now <= weekEnd;
  };

  // Get today's day key
  const getTodayKey = (): CalendarDay['day'] => {
    const days: CalendarDay['day'][] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  };

  const loadCalendars = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first
      const cached = CacheService.get<WeeklyCalendar[]>(CACHE_KEY);
      if (cached && cached.length > 0) {
        setCalendars(cached);
        const currentWeek = cached.find(isCurrentWeek);
        setCurrentWeekCalendar(currentWeek || null);
        setLoading(false);
        return;
      }

      const token = await getAuthToken();
      
      const response = await fetch('/api/calendar?limit=5', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 404 || data.calendars?.length === 0) {
          setCalendars([]);
          setCurrentWeekCalendar(null);
          return;
        }
        throw new Error(data.error || 'Failed to load calendars');
      }
      
      const loadedCalendars = data.calendars || [];
      setCalendars(loadedCalendars);
      CacheService.set(CACHE_KEY, loadedCalendars, CACHE_TTL.MEDIUM);
      
      const currentWeek = loadedCalendars.find(isCurrentWeek);
      setCurrentWeekCalendar(currentWeek || null);
    } catch (err: any) {
      console.error('Load calendars error:', err);
      if (err.message !== 'Not authenticated') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const generateCalendar = async () => {
    try {
      setGenerating(true);
      setError(null);
      
      const token = await getAuthToken();
      
      const response = await fetch('/api/ai/generate-calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate calendar');
      }

      const newCalendars = [data.calendar, ...calendars];
      setCalendars(newCalendars);
      CacheService.set(CACHE_KEY, newCalendars, CACHE_TTL.MEDIUM);
      setCurrentWeekCalendar(data.calendar);
    } catch (err: any) {
      console.error('Generate calendar error:', err);
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen && calendars.length === 0) {
      loadCalendars();
    }
  }, [isOpen]);

  const handleImportDay = (day: CalendarDay) => {
    const fullContent = `${day.content}\n\n${day.hashtags.map(h => `#${h}`).join(' ')}`;
    onImport(fullContent);
    setIsOpen(false);
  };

  const todayKey = getTodayKey();

  // Get available days (not discarded)
  const availableDays = currentWeekCalendar?.days.filter(d => d.status !== 'discarded') || [];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-medium transition-all"
      >
        <Calendar className="w-3.5 h-3.5" />
        Import from Calendar
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <span className="text-sm font-medium text-white">This Week's Calendar</span>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs mb-3">
                {error}
              </div>
            )}

            {/* No calendar for this week */}
            {!loading && !currentWeekCalendar && (
              <div className="text-center py-6">
                <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm mb-3">No calendar for this week</p>
                <button
                  onClick={generateCalendar}
                  disabled={generating}
                  className="flex items-center gap-2 mx-auto px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Now
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Calendar days list */}
            {!loading && currentWeekCalendar && (
              <div className="space-y-2">
                {availableDays.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">All days have been discarded</p>
                ) : (
                  availableDays.map((day) => (
                    <button
                      key={day.day}
                      onClick={() => handleImportDay(day)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        day.day === todayKey
                          ? 'bg-purple-500/20 border-purple-500/50 hover:bg-purple-500/30'
                          : 'bg-gray-700/30 border-gray-600/50 hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${day.day === todayKey ? 'text-purple-300' : 'text-white'}`}>
                          {DAY_NAMES[day.day]}
                          {day.day === todayKey && (
                            <span className="ml-2 px-1.5 py-0.5 bg-purple-500 text-white text-[10px] rounded">TODAY</span>
                          )}
                        </span>
                        <span className="text-xs text-gray-400">{day.topic}</span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">{day.content}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
