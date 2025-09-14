import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import type { Activity, ActivityCategory, WeekendMood, FilterOptions } from '../types';
import { activities, getActivitiesByCategory, getActivitiesByMood, searchActivities } from '../data/activities';

interface ActivityState {
  // All available activities
  allActivities: Activity[];
  
  // Filtered activities based on current filters
  filteredActivities: Activity[];
  
  // Current filter settings
  filters: FilterOptions;
  
  // Selected activity for detailed view
  selectedActivity: Activity | null;
  
  // Recently used activities
  recentActivities: string[]; // Activity IDs
  
  // Favorite activities
  favoriteActivities: string[]; // Activity IDs
  
  // Activity usage statistics
  activityStats: Record<string, {
    timesUsed: number;
    lastUsed: Date;
    userRating?: number;
    completionRate: number;
  }>;
  
  // Actions
  setFilters: (filters: Partial<FilterOptions>) => void;
  resetFilters: () => void;
  setSelectedActivity: (activity: Activity | null) => void;
  toggleFavoriteActivity: (activityId: string) => void;
  addToRecentActivities: (activityId: string) => void;
  searchActivities: (query: string) => void;
  filterByCategory: (category: ActivityCategory) => void;
  filterByMood: (mood: WeekendMood) => void;
  rateActivity: (activityId: string, rating: number) => void;
  markActivityCompleted: (activityId: string, completed: boolean) => void;
  applyFilters: () => void;
  
  // Getters
  getFavoriteActivities: () => Activity[];
  getRecentActivities: () => Activity[];
  getActivityById: (id: string) => Activity | undefined;
  getPopularActivities: () => Activity[];
  getRecommendedActivities: (mood?: WeekendMood, category?: ActivityCategory) => Activity[];
}

const defaultFilters: FilterOptions = {
  categories: [],
  moods: [],
  duration: [],
  costLevel: [],
  timeSlots: [],
  location: [],
  groupSize: [],
  weatherSuitability: [],
  searchQuery: '',
  sortBy: 'relevance',
  sortOrder: 'desc',
};

export const useActivityStore = create<ActivityState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        allActivities: activities,
        filteredActivities: activities,
        filters: defaultFilters,
        selectedActivity: null,
        recentActivities: [],
        favoriteActivities: [],
        activityStats: {},
        
        setFilters: (newFilters: Partial<FilterOptions>) => {
          set((state) => {
            const updatedFilters = { ...state.filters, ...newFilters };
            return { filters: updatedFilters };
          });
          
          // Apply filters after setting them
          get().applyFilters();
        },
        
        resetFilters: () => {
          set({ filters: defaultFilters, filteredActivities: activities });
        },
        
        setSelectedActivity: (activity: Activity | null) => {
          set({ selectedActivity: activity });
          
          // Add to recent activities if activity is selected
          if (activity) {
            get().addToRecentActivities(activity.id);
          }
        },
        
        toggleFavoriteActivity: (activityId: string) => {
          set((state) => {
            const isFavorite = state.favoriteActivities.includes(activityId);
            const updatedFavorites = isFavorite
              ? state.favoriteActivities.filter(id => id !== activityId)
              : [...state.favoriteActivities, activityId];
            
            return { favoriteActivities: updatedFavorites };
          });
        },
        
        addToRecentActivities: (activityId: string) => {
          set((state) => {
            const updatedRecent = [
              activityId,
              ...state.recentActivities.filter(id => id !== activityId)
            ].slice(0, 10); // Keep only last 10
            
            return { recentActivities: updatedRecent };
          });
        },
        
        searchActivities: (query: string) => {
          set((state) => ({
            filters: { ...state.filters, searchQuery: query }
          }));
          
          get().applyFilters();
        },
        
        filterByCategory: (category: ActivityCategory) => {
          set((state) => {
            const categories = state.filters.categories.includes(category)
              ? state.filters.categories.filter(c => c !== category)
              : [...state.filters.categories, category];
            
            return {
              filters: { ...state.filters, categories }
            };
          });
          
          get().applyFilters();
        },
        
        filterByMood: (mood: WeekendMood) => {
          set((state) => {
            const moods = state.filters.moods.includes(mood)
              ? state.filters.moods.filter(m => m !== mood)
              : [...state.filters.moods, mood];
            
            return {
              filters: { ...state.filters, moods }
            };
          });
          
          get().applyFilters();
        },
        
        rateActivity: (activityId: string, rating: number) => {
          set((state) => ({
            activityStats: {
              ...state.activityStats,
              [activityId]: {
                ...state.activityStats[activityId],
                userRating: rating,
                timesUsed: (state.activityStats[activityId]?.timesUsed || 0) + 1,
                lastUsed: new Date(),
                completionRate: state.activityStats[activityId]?.completionRate || 0,
              }
            }
          }));
        },
        
        markActivityCompleted: (activityId: string, completed: boolean) => {
          set((state) => {
            const currentStats = state.activityStats[activityId] || {
              timesUsed: 0,
              lastUsed: new Date(),
              completionRate: 0,
            };
            
            const totalUsed = currentStats.timesUsed + (completed ? 1 : 0);
            const completedCount = Math.round(currentStats.completionRate * currentStats.timesUsed) + (completed ? 1 : 0);
            const newCompletionRate = totalUsed > 0 ? completedCount / totalUsed : 0;
            
            return {
              activityStats: {
                ...state.activityStats,
                [activityId]: {
                  ...currentStats,
                  timesUsed: totalUsed,
                  lastUsed: new Date(),
                  completionRate: newCompletionRate,
                }
              }
            };
          });
        },
        
        applyFilters: () => {
          const { allActivities, filters, activityStats } = get();
          
          let filtered = [...allActivities];
          
          // Apply search query
          if (filters.searchQuery.trim()) {
            filtered = searchActivities(filters.searchQuery);
          }
          
          // Apply category filters
          if (filters.categories.length > 0) {
            filtered = filtered.filter(activity => 
              filters.categories.includes(activity.category)
            );
          }
          
          // Apply mood filters
          if (filters.moods.length > 0) {
            filtered = filtered.filter(activity =>
              activity.mood.some(mood => filters.moods.includes(mood))
            );
          }
          
          // Apply duration filters
          if (filters.duration.length > 0) {
            filtered = filtered.filter(activity =>
              filters.duration.includes(activity.duration)
            );
          }
          
          // Apply cost level filters
          if (filters.costLevel.length > 0) {
            filtered = filtered.filter(activity =>
              filters.costLevel.includes(activity.costLevel)
            );
          }
          
          // Apply time slot filters
          if (filters.timeSlots.length > 0) {
            filtered = filtered.filter(activity =>
              activity.timeSlot.some(slot => filters.timeSlots.includes(slot))
            );
          }
          
          // Apply location filters
          if (filters.location.length > 0) {
            filtered = filtered.filter(activity =>
              filters.location.includes(activity.location)
            );
          }
          
          // Apply group size filters
          if (filters.groupSize.length > 0) {
            filtered = filtered.filter(activity =>
              filters.groupSize.includes(activity.groupSize) || activity.groupSize === 'any'
            );
          }
          
          // Apply weather suitability filters
          if (filters.weatherSuitability.length > 0) {
            filtered = filtered.filter(activity =>
              filters.weatherSuitability.includes(activity.weatherSuitability) || 
              activity.weatherSuitability === 'any'
            );
          }
          
          // Sort activities
          filtered.sort((a, b) => {
            switch (filters.sortBy) {
              case 'popularity':
                const aUsage = activityStats[a.id]?.timesUsed || 0;
                const bUsage = activityStats[b.id]?.timesUsed || 0;
                return filters.sortOrder === 'desc' ? bUsage - aUsage : aUsage - bUsage;
                
              case 'duration':
                const durationOrder = { short: 1, medium: 2, long: 3, flexible: 4 };
                const aDuration = durationOrder[a.duration];
                const bDuration = durationOrder[b.duration];
                return filters.sortOrder === 'desc' ? bDuration - aDuration : aDuration - bDuration;
                
              case 'cost':
                const costOrder = { free: 0, low: 1, medium: 2, high: 3 };
                const aCost = costOrder[a.costLevel];
                const bCost = costOrder[b.costLevel];
                return filters.sortOrder === 'desc' ? bCost - aCost : aCost - bCost;
                
              case 'mood-match':
                // Sort by how many moods match the filter
                const aMatches = a.mood.filter(mood => filters.moods.includes(mood)).length;
                const bMatches = b.mood.filter(mood => filters.moods.includes(mood)).length;
                return filters.sortOrder === 'desc' ? bMatches - aMatches : aMatches - bMatches;
                
              default: // relevance
                return 0; // Keep original order for relevance
            }
          });
          
          set({ filteredActivities: filtered });
        },
        
        // Getters
        getFavoriteActivities: () => {
          const { allActivities, favoriteActivities } = get();
          return allActivities.filter(activity => 
            favoriteActivities.includes(activity.id)
          );
        },
        
        getRecentActivities: () => {
          const { allActivities, recentActivities } = get();
          return recentActivities
            .map(id => allActivities.find(activity => activity.id === id))
            .filter(Boolean) as Activity[];
        },
        
        getActivityById: (id: string) => {
          const { allActivities } = get();
          return allActivities.find(activity => activity.id === id);
        },
        
        getPopularActivities: () => {
          const { allActivities, activityStats } = get();
          return allActivities
            .sort((a, b) => {
              const aUsage = activityStats[a.id]?.timesUsed || 0;
              const bUsage = activityStats[b.id]?.timesUsed || 0;
              return bUsage - aUsage;
            })
            .slice(0, 10);
        },
        
        getRecommendedActivities: (mood?: WeekendMood, category?: ActivityCategory) => {
          const { allActivities, activityStats, favoriteActivities } = get();
          
          let recommended = [...allActivities];
          
          // Filter by mood if provided
          if (mood) {
            recommended = getActivitiesByMood(mood);
          }
          
          // Filter by category if provided
          if (category) {
            recommended = getActivitiesByCategory(category);
          }
          
          // Sort by a combination of factors: completion rate, times used, and favorites
          recommended.sort((a, b) => {
            const aStats = activityStats[a.id] || { timesUsed: 0, completionRate: 0 };
            const bStats = activityStats[b.id] || { timesUsed: 0, completionRate: 0 };
            
            const aIsFavorite = favoriteActivities.includes(a.id) ? 1 : 0;
            const bIsFavorite = favoriteActivities.includes(b.id) ? 1 : 0;
            
            // Calculate recommendation score
            const aScore = (aStats.completionRate * 0.4) + (aStats.timesUsed * 0.3) + (aIsFavorite * 0.3);
            const bScore = (bStats.completionRate * 0.4) + (bStats.timesUsed * 0.3) + (bIsFavorite * 0.3);
            
            return bScore - aScore;
          });
          
          return recommended.slice(0, 8);
        },
      }),
      {
        name: 'activity-storage',
        partialize: (state) => ({
          favoriteActivities: state.favoriteActivities,
          recentActivities: state.recentActivities,
          activityStats: state.activityStats,
        }),
      }
    )
  )
);
