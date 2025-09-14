import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UIState, Activity } from '../types';

interface UIStore extends UIState {
  // Actions
  setActiveView: (view: UIState['activeView']) => void;
  toggleSidebar: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  setTheme: (theme: UIState['theme']) => void;
  toggleAnimations: () => void;
  toggleCompactMode: () => void;
  setDraggedActivity: (activity: Activity | null) => void;
  toggleActivitySelection: (activityId: string) => void;
  clearSelectedActivities: () => void;
  updateFilters: (filters: Partial<UIState['filters']>) => void;
  resetFilters: () => void;
}

const defaultFilters = {
  categories: [],
  moods: [],
  duration: [],
  costLevel: [],
  timeSlots: [],
  location: [],
  groupSize: [],
  weatherSuitability: [],
  searchQuery: '',
  sortBy: 'relevance' as const,
  sortOrder: 'desc' as const,
};

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Initial state
      activeView: 'browse',
      sidebarOpen: true,
      modalOpen: null,
      theme: 'auto',
      animations: true,
      compactMode: false,
      draggedActivity: null,
      selectedActivities: [],
      filters: defaultFilters,
      
      // Actions
      setActiveView: (view) => {
        set({ activeView: view });
      },
      
      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },
      
      openModal: (modalId) => {
        set({ modalOpen: modalId });
      },
      
      closeModal: () => {
        set({ modalOpen: null });
      },
      
      setTheme: (theme) => {
        set({ theme });
        
        // Apply theme to document
        const root = document.documentElement;
        if (theme === 'dark') {
          root.classList.add('dark');
        } else if (theme === 'light') {
          root.classList.remove('dark');
        } else {
          // Auto theme - check system preference
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }
        }
      },
      
      toggleAnimations: () => {
        set((state) => ({ animations: !state.animations }));
      },
      
      toggleCompactMode: () => {
        set((state) => ({ compactMode: !state.compactMode }));
      },
      
      setDraggedActivity: (activity) => {
        set({ draggedActivity: activity });
      },
      
      toggleActivitySelection: (activityId) => {
        set((state) => {
          const isSelected = state.selectedActivities.includes(activityId);
          const updatedSelection = isSelected
            ? state.selectedActivities.filter(id => id !== activityId)
            : [...state.selectedActivities, activityId];
          
          return { selectedActivities: updatedSelection };
        });
      },
      
      clearSelectedActivities: () => {
        set({ selectedActivities: [] });
      },
      
      updateFilters: (newFilters) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters }
        }));
      },
      
      resetFilters: () => {
        set({ filters: defaultFilters });
      },
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        animations: state.animations,
        compactMode: state.compactMode,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
