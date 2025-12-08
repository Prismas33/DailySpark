export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  createdAt: string | null;
  lastUpdated?: string;
}

export interface UserSettings {
  aiPrompt?: string;
  calendarPrompt?: string; // Prompt for weekly calendar generation
  notifications?: {
    postPublished: boolean;
    postFailed: boolean;
    dailySummary: boolean;
  };
  theme?: 'dark' | 'light';
}

export interface CalendarDay {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  topic: string;
  content: string;
  hashtags: string[];
  status: 'pending' | 'approved' | 'discarded' | 'posted';
}

export interface WeeklyCalendar {
  id: string;
  userId: string;
  weekStart: string; // ISO date string (Monday)
  weekEnd: string; // ISO date string (Sunday)
  days: CalendarDay[];
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'completed';
}

export interface UserData {
  profile: UserProfile;
  settings: UserSettings;
}
