// Core types for the Weekendly application

export type ActivityCategory = 
  | 'food' 
  | 'outdoor' 
  | 'entertainment' 
  | 'wellness' 
  | 'social' 
  | 'culture' 
  | 'shopping' 
  | 'sports' 
  | 'relaxation' 
  | 'learning' 
  | 'adventure' 
  | 'creative';

export type ActivityDuration = 
  | 'short' // 1-2 hours
  | 'medium' // 2-4 hours  
  | 'long' // 4+ hours
  | 'flexible'; // Any duration

export type WeekendMood = 
  | 'energetic' 
  | 'relaxed' 
  | 'adventurous' 
  | 'romantic' 
  | 'social' 
  | 'productive' 
  | 'spontaneous' 
  | 'peaceful';

export type TimeSlot = 
  | 'early-morning' // 6-9 AM
  | 'morning' // 9-12 PM
  | 'afternoon' // 12-5 PM
  | 'evening' // 5-8 PM
  | 'night'; // 8+ PM

export type WeatherSuitability = 
  | 'any' 
  | 'sunny' 
  | 'cloudy' 
  | 'rainy' 
  | 'indoor-only' 
  | 'outdoor-preferred';

export interface Activity {
  id: string;
  title: string;
  description: string;
  category: ActivityCategory;
  duration: ActivityDuration;
  mood: WeekendMood[];
  timeSlot: TimeSlot[];
  weatherSuitability: WeatherSuitability;
  costLevel: 'free' | 'low' | 'medium' | 'high';
  difficultyLevel: 'easy' | 'moderate' | 'challenging';
  groupSize: 'solo' | 'couple' | 'small-group' | 'large-group' | 'any';
  location: 'home' | 'local' | 'city' | 'outdoor' | 'venue-specific';
  icon: string; // Emoji or icon identifier
  image?: string; // Optional image URL
  tags: string[];
  estimatedCost?: {
    min: number;
    max: number;
    currency: string;
  };
  preparation?: {
    timeNeeded: number; // minutes
    items: string[];
  };
  tips?: string[];
  alternatives?: string[]; // Related activity IDs
}

export interface ScheduledActivity {
  id: string;
  activityId: string;
  day: 'friday' | 'saturday' | 'sunday' | 'monday'; // Extended for long weekends
  timeSlot: TimeSlot;
  startTime?: string; // Custom time like "10:30 AM"
  endTime?: string;
  notes?: string;
  companions?: string[];
  customTitle?: string; // Override activity title
  reminder?: {
    enabled: boolean;
    minutes: number; // Minutes before activity
  };
}

export type WeekendType = 'regular' | 'long' | 'extended'; // regular = 2 days, long = 3 days, extended = 4+ days

export interface WeekendPlan {
  id: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  mood: WeekendMood;
  theme?: string;
  weekendType: WeekendType; // New field for weekend length
  startDate: Date; // Start date of the weekend
  endDate: Date; // End date of the weekend
  availableDays: ('friday' | 'saturday' | 'sunday' | 'monday')[]; // Which days are available
  activities: ScheduledActivity[];
  budget?: {
    target: number;
    actual?: number;
    currency: string;
  };
  weather?: Record<string, WeatherCondition>; // Weather for each day
  collaborators?: string[]; // User IDs for shared planning
  isTemplate: boolean;
  templateCategory?: string;
  shareSettings: {
    isPublic: boolean;
    shareCode?: string;
    allowEditing: boolean;
  };
  externalEvents?: string[]; // IDs of external events included
  externalPlaces?: string[]; // IDs of external places included
}

export interface WeatherCondition {
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy';
  temperature: {
    high: number;
    low: number;
    unit: 'celsius' | 'fahrenheit';
  };
  humidity: number;
  windSpeed: number;
  precipitation?: number;
}

export interface UserPreferences {
  favoriteCategories: ActivityCategory[];
  preferredMoods: WeekendMood[];
  preferredTimeSlots: TimeSlot[];
  budgetRange: {
    min: number;
    max: number;
    currency: string;
  };
  location: {
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  groupPreference: Activity['groupSize'];
  accessibility: {
    mobility: boolean;
    visual: boolean;
    hearing: boolean;
    cognitive: boolean;
  };
  notifications: {
    planning: boolean;
    reminders: boolean;
    weather: boolean;
    suggestions: boolean;
  };
  privacy: {
    shareData: boolean;
    publicProfile: boolean;
    anonymousUsage: boolean;
  };
}

export interface FilterOptions {
  categories: ActivityCategory[];
  moods: WeekendMood[];
  duration: ActivityDuration[];
  costLevel: Activity['costLevel'][];
  timeSlots: TimeSlot[];
  location: Activity['location'][];
  groupSize: Activity['groupSize'][];
  weatherSuitability: WeatherSuitability[];
  searchQuery: string;
  sortBy: 'relevance' | 'popularity' | 'duration' | 'cost' | 'mood-match';
  sortOrder: 'asc' | 'desc';
}

export interface AIRecommendation {
  activityId: string;
  confidence: number; // 0-1
  reasoning: string;
  alternatives: string[];
  personalizedNotes?: string;
}

export interface PlanSuggestion {
  id: string;
  title: string;
  description: string;
  confidence: number;
  activities: {
    saturday: AIRecommendation[];
    sunday: AIRecommendation[];
  };
  estimatedBudget: number;
  mood: WeekendMood;
  reasoning: string;
}

// UI State Types
export interface UIState {
  activeView: 'browse' | 'schedule' | 'plan-overview' | 'settings';
  sidebarOpen: boolean;
  modalOpen: string | null;
  theme: 'light' | 'dark' | 'auto';
  animations: boolean;
  compactMode: boolean;
  draggedActivity: Activity | null;
  selectedActivities: string[];
  filters: FilterOptions;
}

// API Response Types
export interface APIResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

// Event Types for Analytics
export interface AnalyticsEvent {
  type: 'activity_selected' | 'plan_created' | 'plan_shared' | 'activity_completed' | 'filter_applied';
  timestamp: Date;
  data: Record<string, any>;
  userId?: string;
  sessionId: string;
}

export type WeekendDay = 'saturday' | 'sunday';
export type DragDropResult = {
  draggableId: string;
  type: string;
  source: {
    droppableId: string;
    index: number;
  };
  destination?: {
    droppableId: string;
    index: number;
  } | null;
};

// Utility Types
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type Required<T> = {
  [P in keyof T]-?: T[P];
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
