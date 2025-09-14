import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Activity, ScheduledActivity, WeekendMood, TimeSlot } from '../types';

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format time slot for display
 */
export function formatTimeSlot(timeSlot: TimeSlot): string {
  const timeSlotLabels = {
    'early-morning': 'Early Morning (6-9 AM)',
    'morning': 'Morning (9-12 PM)',
    'afternoon': 'Afternoon (12-5 PM)',
    'evening': 'Evening (5-8 PM)',
    'night': 'Night (8+ PM)',
  };
  return timeSlotLabels[timeSlot];
}

/**
 * Get emoji for mood
 */
export function getMoodEmoji(mood: WeekendMood): string {
  const moodEmojis = {
    energetic: '⚡',
    relaxed: '😌',
    adventurous: '🗺️',
    romantic: '💕',
    social: '👥',
    productive: '🎯',
    spontaneous: '🎲',
    peaceful: '🧘',
  };
  return moodEmojis[mood];
}

/**
 * Get color class for activity category
 */
export function getCategoryColor(category: string): string {
  const categoryColors = {
    food: 'bg-orange-100 text-orange-700 border-orange-200',
    outdoor: 'bg-green-100 text-green-700 border-green-200',
    entertainment: 'bg-purple-100 text-purple-700 border-purple-200',
    wellness: 'bg-pink-100 text-pink-700 border-pink-200',
    social: 'bg-blue-100 text-blue-700 border-blue-200',
    culture: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    shopping: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    sports: 'bg-red-100 text-red-700 border-red-200',
    relaxation: 'bg-teal-100 text-teal-700 border-teal-200',
    learning: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    adventure: 'bg-amber-100 text-amber-700 border-amber-200',
    creative: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  return categoryColors[category as keyof typeof categoryColors] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Calculate estimated duration in hours
 */
export function getActivityDuration(activity: Activity): string {
  const durations = {
    short: '1-2 hours',
    medium: '2-4 hours',
    long: '4+ hours',
    flexible: 'Flexible',
  };
  return durations[activity.duration];
}

/**
 * Get cost level display
 */
export function getCostDisplay(costLevel: Activity['costLevel']): string {
  const costs = {
    free: 'Free',
    low: '$',
    medium: '$$',
    high: '$$$',
  };
  return costs[costLevel];
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as { [key: string]: any };
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj as T;
  }
  return obj;
}

/**
 * Calculate plan statistics
 */
export function getPlanStats(activities: ScheduledActivity[], allActivities: Activity[]) {
  const activityDetails = activities
    .map(sa => allActivities.find(a => a.id === sa.activityId))
    .filter(Boolean) as Activity[];

  const categories = [...new Set(activityDetails.map(a => a.category))];
  const moods = [...new Set(activityDetails.flatMap(a => a.mood))];
  
  const totalCost = activityDetails.reduce((sum, activity) => {
    if (activity.estimatedCost) {
      return sum + (activity.estimatedCost.min + activity.estimatedCost.max) / 2;
    }
    return sum;
  }, 0);

  const duration = activityDetails.reduce((total, activity) => {
    const hours = {
      short: 1.5,
      medium: 3,
      long: 5,
      flexible: 2,
    };
    return total + hours[activity.duration];
  }, 0);

  return {
    totalActivities: activities.length,
    uniqueCategories: categories.length,
    dominantMoods: moods.slice(0, 3),
    estimatedCost: Math.round(totalCost),
    estimatedDuration: Math.round(duration * 10) / 10, // Round to 1 decimal
    categoryBreakdown: categories,
  };
}

/**
 * Search and filter utilities
 */
export function searchInText(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

export function highlightSearchTerm(text: string, searchTerm: string): string {
  if (!searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
}

/**
 * Animation utilities
 */
export function getStaggerDelay(index: number, baseDelay = 0.1): number {
  return baseDelay * index;
}

export function getRandomDelay(min = 0, max = 0.5): number {
  return Math.random() * (max - min) + min;
}

/**
 * Local storage utilities
 */
export function saveToLocalStorage<T>(key: string, data: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    return false;
  }
}

export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return null;
  }
}

/**
 * URL utilities
 */
export function createShareableUrl(planId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/plan/${planId}`;
}

export function downloadAsFile(content: string, filename: string, type = 'text/plain'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Accessibility utilities
 */
export function announceToScreenReader(message: string): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Color utilities
 */
export function getContrastColor(backgroundColor: string): string {
  // Simple contrast calculation - in a real app, you'd use a proper color library
  const lightColors = ['yellow', 'orange', 'pink', 'rose'];
  const isLight = lightColors.some(color => backgroundColor.includes(color));
  return isLight ? 'text-gray-800' : 'text-white';
}

/**
 * Platform detection
 */
export function isMobile(): boolean {
  return window.innerWidth < 768;
}

export function isTablet(): boolean {
  return window.innerWidth >= 768 && window.innerWidth < 1024;
}

export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

