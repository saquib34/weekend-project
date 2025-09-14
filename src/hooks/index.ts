import { useEffect, useState } from 'react';
import { useActivityStore } from '../stores/activityStore';
import { useWeekendPlanStore } from '../stores/weekendPlanStore';
import type { Activity, WeekendMood, ActivityCategory } from '../types';

/**
 * Hook for managing activity browsing, filtering, and selection
 */
export const useActivities = () => {
  const {
    filteredActivities,
    filters,
    selectedActivity,
    favoriteActivities,
    recentActivities,
    setFilters,
    resetFilters,
    setSelectedActivity,
    toggleFavoriteActivity,
    addToRecentActivities,
    searchActivities,
    filterByCategory,
    filterByMood,
    applyFilters,
    getFavoriteActivities,
    getRecentActivities,
    getActivityById,
    getPopularActivities,
    getRecommendedActivities,
  } = useActivityStore();

  return {
    // State
    activities: filteredActivities,
    filters,
    selectedActivity,
    favoriteActivityIds: favoriteActivities,
    recentActivityIds: recentActivities,
    
    // Actions
    setFilters,
    resetFilters,
    selectActivity: setSelectedActivity,
    toggleFavorite: toggleFavoriteActivity,
    addToRecent: addToRecentActivities,
    search: searchActivities,
    filterByCategory,
    filterByMood,
    applyFilters,
    
    // Getters
    getFavorites: getFavoriteActivities,
    getRecent: getRecentActivities,
    getById: getActivityById,
    getPopular: getPopularActivities,
    getRecommended: getRecommendedActivities,
  };
};

/**
 * Hook for managing weekend plans and schedule
 */
export const useWeekendPlan = () => {
  const {
    currentPlan,
    savedPlans,
    currentWeekend,
    createNewPlan,
    updatePlanTitle,
    updatePlanDescription,
    updatePlanMood,
    addActivityToSchedule,
    removeActivityFromSchedule,
    moveActivity,
    updateScheduledActivity,
    savePlan,
    loadPlan,
    deletePlan,
    duplicatePlan,
    clearCurrentPlan,
    getActivitiesForDay,
    getActivitiesForTimeSlot,
    getPlanById,
  } = useWeekendPlanStore();

  return {
    // State
    currentPlan,
    savedPlans,
    currentWeekend,
    
    // Actions
    createPlan: createNewPlan,
    updateTitle: updatePlanTitle,
    updateDescription: updatePlanDescription,
    updateMood: updatePlanMood,
    addActivity: addActivityToSchedule,
    removeActivity: removeActivityFromSchedule,
    moveActivity,
    updateActivity: updateScheduledActivity,
    savePlan,
    loadPlan,
    deletePlan,
    duplicatePlan,
    clearPlan: clearCurrentPlan,
    
    // Getters
    getActivitiesForDay,
    getActivitiesForTimeSlot,
    getPlanById,
  };
};

/**
 * Hook for managing drag and drop operations
 */
export const useDragAndDrop = () => {
  const [draggedItem, setDraggedItem] = useState<{
    type: 'activity' | 'scheduled-activity';
    data: Activity | { id: string; activityId: string };
  } | null>(null);

  const [dropTarget, setDropTarget] = useState<{
    day: 'saturday' | 'sunday';
    timeSlot: string;
  } | null>(null);

  const startDrag = (type: 'activity' | 'scheduled-activity', data: any) => {
    setDraggedItem({ type, data });
  };

  const endDrag = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };

  const setDropZone = (day: 'saturday' | 'sunday', timeSlot: string) => {
    setDropTarget({ day, timeSlot });
  };

  const clearDropZone = () => {
    setDropTarget(null);
  };

  return {
    draggedItem,
    dropTarget,
    startDrag,
    endDrag,
    setDropZone,
    clearDropZone,
    isDragging: !!draggedItem,
  };
};

/**
 * Hook for managing keyboard navigation and accessibility
 */
export const useKeyboardNavigation = () => {
  const [focusedElement, setFocusedElement] = useState<string | null>(null);
  const [keyboardMode, setKeyboardMode] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Enable keyboard mode on Tab key
      if (event.key === 'Tab') {
        setKeyboardMode(true);
      }

      // Handle Escape key
      if (event.key === 'Escape') {
        setFocusedElement(null);
      }
    };

    const handleMouseDown = () => {
      setKeyboardMode(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return {
    focusedElement,
    keyboardMode,
    setFocusedElement,
  };
};

/**
 * Hook for managing responsive design and window size
 */
export const useResponsive = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowSize.width < 768;
  const isTablet = windowSize.width >= 768 && windowSize.width < 1024;
  const isDesktop = windowSize.width >= 1024;

  return {
    windowSize,
    isMobile,
    isTablet,
    isDesktop,
  };
};

/**
 * Hook for managing local storage with error handling
 */
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
};

/**
 * Hook for debouncing values (useful for search)
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook for managing async operations with loading and error states
 */
export const useAsync = <T>(
  asyncFunction: () => Promise<T>,
  dependencies: React.DependencyList = []
) => {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    setState({ data: null, loading: true, error: null });

    asyncFunction()
      .then((data) => {
        if (isMounted) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (isMounted) {
          setState({ data: null, loading: false, error });
        }
      });

    return () => {
      isMounted = false;
    };
  }, dependencies);

  return state;
};

/**
 * Hook for managing intersection observer (useful for lazy loading)
 */
export const useIntersectionObserver = (
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [ref, options]);

  return isIntersecting;
};

/**
 * Hook for managing click outside detection
 */
export const useClickOutside = (
  ref: React.RefObject<HTMLElement>,
  handler: () => void
) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};

/**
 * Hook for managing animation preferences
 */
export const useAnimationPreference = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return { prefersReducedMotion };
};

/**
 * Hook for managing theme detection and switching
 */
export const useTheme = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const activeTheme = theme === 'auto' ? systemTheme : theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', activeTheme === 'dark');
  }, [activeTheme]);

  return {
    theme,
    setTheme,
    activeTheme,
    systemTheme,
  };
};
