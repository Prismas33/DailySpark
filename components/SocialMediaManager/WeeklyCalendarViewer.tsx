'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  Sparkles, 
  RefreshCw, 
  X, 
  Trash2, 
  Copy,
  Send,
  ChevronDown,
  ChevronRight,
  Plus
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { WeeklyCalendar, CalendarDay } from '@/types/user';
import { CacheService, CACHE_TTL } from '@/lib/cacheService';
import { useIsMobile } from '@/hooks/useIsMobile';

const CACHE_KEY = 'weekly_calendars';

const DAY_NAMES_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DAY_KEYS: CalendarDay['day'][] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DAY_COLORS: Record<CalendarDay['day'], string> = {
  monday: 'bg-blue-500',
  tuesday: 'bg-purple-500',
  wednesday: 'bg-green-500',
  thursday: 'bg-orange-500',
  friday: 'bg-pink-500',
  saturday: 'bg-cyan-500',
  sunday: 'bg-red-500'
};

const DAY_COLORS_LIGHT: Record<CalendarDay['day'], string> = {
  monday: 'bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30',
  tuesday: 'bg-purple-500/20 border-purple-500/30 hover:bg-purple-500/30',
  wednesday: 'bg-green-500/20 border-green-500/30 hover:bg-green-500/30',
  thursday: 'bg-orange-500/20 border-orange-500/30 hover:bg-orange-500/30',
  friday: 'bg-pink-500/20 border-pink-500/30 hover:bg-pink-500/30',
  saturday: 'bg-cyan-500/20 border-cyan-500/30 hover:bg-cyan-500/30',
  sunday: 'bg-red-500/20 border-red-500/30 hover:bg-red-500/30'
};

interface WeeklyCalendarViewerProps {
  onUseContent?: (content: string) => void;
}

export default function WeeklyCalendarViewer({ onUseContent }: WeeklyCalendarViewerProps) {
  const [calendars, setCalendars] = useState<WeeklyCalendar[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<{ calendar: WeeklyCalendar; day: CalendarDay; index: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const getAuthToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  }, []);

  const loadCalendars = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first
      if (!forceRefresh) {
        const cached = CacheService.get<WeeklyCalendar[]>(CACHE_KEY);
        if (cached) {
          setCalendars(cached);
          // Auto-expand the most recent week
          if (cached.length > 0) {
            setExpandedWeeks(new Set([cached[0].id]));
          }
          setLoading(false);
          return;
        }
      }

      const token = await getAuthToken();
      
      const response = await fetch('/api/calendar?limit=10', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 404 || data.calendars?.length === 0) {
          setCalendars([]);
          CacheService.set(CACHE_KEY, [], CACHE_TTL.MEDIUM);
          return;
        }
        throw new Error(data.error || 'Failed to load calendars');
      }
      
      const loadedCalendars = data.calendars || [];
      setCalendars(loadedCalendars);
      CacheService.set(CACHE_KEY, loadedCalendars, CACHE_TTL.MEDIUM);
      
      // Auto-expand the most recent week
      if (loadedCalendars.length > 0) {
        setExpandedWeeks(new Set([loadedCalendars[0].id]));
      }
    } catch (err: any) {
      console.error('Load calendars error:', err);
      if (err.message !== 'Not authenticated') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    loadCalendars();
  }, [loadCalendars]);

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

      console.log('✅ New calendar generated:', data.calendar.id);
      console.log('📆 Week:', data.calendar.weekStart, '-', data.calendar.weekEnd);
      
      // Check if this calendar already exists in the list (by ID)
      const existingIndex = calendars.findIndex(c => c.id === data.calendar.id);
      let newCalendars: WeeklyCalendar[];
      
      if (existingIndex >= 0) {
        // Replace existing calendar
        newCalendars = [...calendars];
        newCalendars[existingIndex] = data.calendar;
        console.log('📆 Replaced existing calendar at index:', existingIndex);
      } else {
        // Add new calendar at the beginning
        newCalendars = [data.calendar, ...calendars];
        console.log('📆 Added new calendar, total:', newCalendars.length);
      }
      
      setCalendars(newCalendars);
      CacheService.set(CACHE_KEY, newCalendars, CACHE_TTL.MEDIUM);
      
      // Auto-expand the new week
      setExpandedWeeks(prev => new Set([...prev, data.calendar.id]));
      
      setSuccessMessage('✅ Calendar generated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Generate calendar error:', err);
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const updateDayStatus = async (calendarId: string, dayIndex: number, status: CalendarDay['status']) => {
    try {
      const token = await getAuthToken();
      
      const response = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          calendarId,
          dayIndex,
          updates: { status }
        })
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);

      const updatedCalendars = calendars.map(c => 
        c.id === calendarId ? data.calendar : c
      );
      setCalendars(updatedCalendars);
      CacheService.set(CACHE_KEY, updatedCalendars, CACHE_TTL.MEDIUM);

      // Update selected day if it's the one being modified
      if (selectedDay && selectedDay.calendar.id === calendarId && selectedDay.index === dayIndex) {
        setSelectedDay({
          calendar: data.calendar,
          day: data.calendar.days[dayIndex],
          index: dayIndex
        });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteCalendar = async (calendarId: string) => {
    if (!confirm('Are you sure you want to delete this calendar?')) return;

    console.log('🗑️ Deleting calendar:', calendarId);
    
    try {
      const token = await getAuthToken();
      
      const response = await fetch(`/api/calendar?id=${encodeURIComponent(calendarId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Delete failed:', data);
        throw new Error(data.error || 'Failed to delete');
      }

      console.log('✅ Calendar deleted successfully:', calendarId);
      
      const updatedCalendars = calendars.filter(c => c.id !== calendarId);
      console.log('📆 Remaining calendars:', updatedCalendars.length, updatedCalendars.map(c => c.id));
      
      setCalendars(updatedCalendars);
      CacheService.set(CACHE_KEY, updatedCalendars, CACHE_TTL.MEDIUM);
      
      // Clear selected day if it belongs to deleted calendar
      if (selectedDay?.calendar.id === calendarId) {
        setSelectedDay(null);
      }
      
      setSuccessMessage('Calendar deleted');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Delete calendar error:', err);
      setError(err.message);
    }
  };

  const copyToClipboard = (content: string, hashtags: string[]) => {
    const fullContent = `${content}\n\n${hashtags.map(h => `#${h}`).join(' ')}`;
    navigator.clipboard.writeText(fullContent);
    setSuccessMessage('📋 Copied!');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startStr = startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const endStr = endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${startStr} - ${endStr}`;
  };

  const toggleWeek = (calendarId: string) => {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(calendarId)) {
        newSet.delete(calendarId);
        // Clear selected day if collapsing its calendar
        if (selectedDay?.calendar.id === calendarId) {
          setSelectedDay(null);
        }
      } else {
        newSet.add(calendarId);
      }
      return newSet;
    });
  };

  const getDayByKey = (calendar: WeeklyCalendar, dayKey: CalendarDay['day']): CalendarDay | undefined => {
    return calendar.days.find(d => d.day === dayKey);
  };

  const getDayIndex = (calendar: WeeklyCalendar, dayKey: CalendarDay['day']): number => {
    return calendar.days.findIndex(d => d.day === dayKey);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-400" />
          <h3 className={`font-bold text-white ${isMobile ? 'text-base' : 'text-lg'}`}>
            {isMobile ? 'Weekly Calendar' : 'Weekly Calendar'}
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadCalendars(true)}
            disabled={loading}
            className={`flex items-center justify-center bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-lg transition-all disabled:opacity-50 ${
              isMobile ? 'p-2' : 'gap-1 px-3 py-2'
            }`}
            title="Reload"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={generateCalendar}
            disabled={generating}
            className={`flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 ${
              isMobile ? 'p-2' : 'gap-2 px-4 py-2 text-sm'
            }`}
            title="Generate New Week"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {!isMobile && 'Generating...'}
              </>
            ) : (
              <>
                {isMobile ? <Plus className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {!isMobile && 'Generate New Week'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">×</button>
        </div>
      )}
      
      {successMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
          {successMessage}
        </div>
      )}

      {/* Loading State */}
      {loading && calendars.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && calendars.length === 0 && (
        <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700/50">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">No calendar generated yet</p>
          <p className="text-gray-500 text-sm mb-4">
            Configure your calendar prompt in Settings, then click "Generate New Week"
          </p>
        </div>
      )}

      {/* Calendar List with Grid */}
      <div className="space-y-3">
        {calendars.map((calendar) => {
          const isExpanded = expandedWeeks.has(calendar.id);
          
          return (
            <div key={calendar.id} className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
              {/* Week Header - Clickable */}
              <div className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors">
                <button
                  onClick={() => toggleWeek(calendar.id)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <p className="text-white font-medium">
                      {formatDateRange(calendar.weekStart, calendar.weekEnd)}
                    </p>
                    <p className="text-gray-500 text-xs">
                      Created: {new Date(calendar.createdAt).toLocaleDateString('en-US')}
                    </p>
                  </div>
                </button>
                
                <button
                  onClick={() => deleteCalendar(calendar.id)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete calendar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Calendar Grid - Expandable */}
              {isExpanded && (
                <div className="p-3 pt-0">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {DAY_NAMES_SHORT.map((name, i) => (
                      <div key={name} className={`text-center py-1 text-xs font-medium text-white rounded ${DAY_COLORS[DAY_KEYS[i]]}`}>
                        {name}
                      </div>
                    ))}
                  </div>

                  {/* Day Cells */}
                  <div className="grid grid-cols-7 gap-1">
                    {DAY_KEYS.map((dayKey) => {
                      const day = getDayByKey(calendar, dayKey);
                      const dayIndex = getDayIndex(calendar, dayKey);
                      const isSelected = selectedDay?.calendar.id === calendar.id && selectedDay?.day.day === dayKey;
                      const isDiscarded = day?.status === 'discarded';

                      if (!day) {
                        return (
                          <div key={dayKey} className="aspect-square bg-gray-700/30 rounded-lg border border-gray-700/50 flex items-center justify-center">
                            <span className="text-gray-600 text-xs">-</span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={dayKey}
                          onClick={() => setSelectedDay({ calendar, day, index: dayIndex })}
                          className={`aspect-square rounded-lg border p-1.5 transition-all text-left ${
                            isDiscarded 
                              ? 'bg-gray-700/20 border-gray-700/30 opacity-50' 
                              : DAY_COLORS_LIGHT[dayKey]
                          } ${isSelected ? 'ring-2 ring-purple-500' : ''}`}
                        >
                          <p className="text-white text-[10px] font-medium truncate leading-tight">{day.topic}</p>
                          <p className="text-gray-400 text-[9px] mt-0.5 line-clamp-2 leading-tight">{String(day.content || '').substring(0, 40)}...</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Day Detail Panel */}
      {selectedDay && (
        <div className="bg-gray-800/70 rounded-xl border border-gray-700/50 p-4 mt-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium text-white mb-2 ${DAY_COLORS[selectedDay.day.day]}`}>
                {DAY_NAMES_SHORT[DAY_KEYS.indexOf(selectedDay.day.day)]} - {selectedDay.day.topic}
              </div>
              {selectedDay.day.status === 'discarded' && (
                <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Discarded</span>
              )}
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-gray-300 text-sm mb-3 whitespace-pre-wrap">{selectedDay.day.content}</p>

          {/* Hashtags */}
          <div className="flex flex-wrap gap-1 mb-4">
            {selectedDay.day.hashtags.map((tag, i) => (
              <span key={i} className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                #{tag}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {selectedDay.day.status !== 'discarded' ? (
              <button
                onClick={() => updateDayStatus(selectedDay.calendar.id, selectedDay.index, 'discarded')}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs transition-colors"
              >
                <X className="w-3 h-3" />
                Discard
              </button>
            ) : (
              <button
                onClick={() => updateDayStatus(selectedDay.calendar.id, selectedDay.index, 'pending')}
                className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Restore
              </button>
            )}
            
            <button
              onClick={() => copyToClipboard(selectedDay.day.content, selectedDay.day.hashtags)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 rounded-lg text-xs transition-colors"
            >
              <Copy className="w-3 h-3" />
              Copiar
            </button>

            {onUseContent && (
              <button
                onClick={() => onUseContent(`${selectedDay.day.content}\n\n${selectedDay.day.hashtags.map(h => `#${h}`).join(' ')}`)}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-xs transition-colors"
              >
                <Send className="w-3 h-3" />
                Use in Post
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
