import { useState, useEffect, useCallback } from 'react';
import { useWeekendPlanStore } from '../stores/weekendPlanStore';
import { useActivityStore } from '../stores/activityStore';
import type { 
  ScheduledActivity, 
  WeekendDay, 
  TimeSlot, 
  Activity,
  DragDropResult 
} from '../types';

/**
 * Hook for managing drag and drop operations in the schedule
 */
export const useScheduleDragDrop = () => {
  const { moveActivity, addActivityToSchedule } = useWeekendPlanStore();
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{
    type: 'activity' | 'scheduled-activity';
    id: string;
    activityId?: string;
  } | null>(null);

  const onDragStart = useCallback((result: any) => {
    setIsDragging(true);
    
    // Determine if dragging a new activity or existing scheduled activity
    if (result.draggableId.startsWith('activity-')) {
      setDraggedItem({
        type: 'activity',
        id: result.draggableId.replace('activity-', ''),
      });
    } else {
      setDraggedItem({
        type: 'scheduled-activity',
        id: result.draggableId,
      });
    }
  }, []);

  const onDragEnd = useCallback((result: DragDropResult) => {
    setIsDragging(false);
    setDraggedItem(null);

    if (!result.destination || !draggedItem) return;

    const [day, timeSlot] = result.destination.droppableId.split('-') as [WeekendDay, TimeSlot];
    
    if (draggedItem.type === 'activity') {
      // Adding new activity to schedule
      addActivityToSchedule(draggedItem.id, day, timeSlot);
    } else {
      // Moving existing scheduled activity
      moveActivity(draggedItem.id, day, timeSlot);
    }
  }, [draggedItem, addActivityToSchedule, moveActivity]);

  return {
    isDragging,
    draggedItem,
    onDragStart,
    onDragEnd,
  };
};

/**
 * Hook for managing activity recommendations based on current plan
 */
export const useActivityRecommendations = () => {
  const { currentPlan } = useWeekendPlanStore();
  const { getRecommendedActivities, getActivityById } = useActivityStore();
  const [recommendations, setRecommendations] = useState<Activity[]>([]);

  useEffect(() => {
    if (!currentPlan) {
      setRecommendations([]);
      return;
    }

    // Get recommendations based on plan mood and existing activities
    const mood = currentPlan.mood;
    const existingCategories = currentPlan.activities
      .map(sa => getActivityById(sa.activityId))
      .filter(Boolean)
      .map(a => a!.category);

    // Get recommendations avoiding duplicate categories
    const recommended = getRecommendedActivities(mood)
      .filter(activity => !existingCategories.includes(activity.category))
      .slice(0, 6);

    setRecommendations(recommended);
  }, [currentPlan, getRecommendedActivities, getActivityById]);

  return recommendations;
};

/**
 * Hook for managing smart scheduling suggestions
 */
export const useSmartScheduling = () => {
  const { currentPlan, getActivitiesForTimeSlot } = useWeekendPlanStore();
  const { getActivityById } = useActivityStore();

  const suggestTimeSlot = useCallback((activityId: string): { day: WeekendDay; timeSlot: TimeSlot }[] => {
    const activity = getActivityById(activityId);
    if (!activity || !currentPlan) return [];

    const suggestions: { day: WeekendDay; timeSlot: TimeSlot }[] = [];
    
    // Check each day and time slot
    (['saturday', 'sunday'] as WeekendDay[]).forEach(day => {
      activity.timeSlot.forEach(timeSlot => {
        const existingActivities = getActivitiesForTimeSlot(day, timeSlot);
        if (existingActivities.length === 0) {
          suggestions.push({ day, timeSlot });
        }
      });
    });

    // Sort suggestions by preference (morning activities first, etc.)
    return suggestions.sort((a, b) => {
      const timeOrder = {
        'early-morning': 0,
        'morning': 1,
        'afternoon': 2,
        'evening': 3,
        'night': 4,
      };
      return timeOrder[a.timeSlot] - timeOrder[b.timeSlot];
    });
  }, [currentPlan, getActivityById, getActivitiesForTimeSlot]);

  const getConflicts = useCallback((scheduledActivity: ScheduledActivity): string[] => {
    const activity = getActivityById(scheduledActivity.activityId);
    if (!activity || !currentPlan) return [];

    const conflicts: string[] = [];
    
    // Check if time slot matches activity's preferred times
    if (!activity.timeSlot.includes(scheduledActivity.timeSlot)) {
      conflicts.push(`This activity is typically better suited for ${activity.timeSlot.join(' or ')} times`);
    }

    // Check for duration conflicts
    const dayActivities = currentPlan.activities.filter(sa => sa.day === scheduledActivity.day);
    if (activity.duration === 'long' && dayActivities.length > 2) {
      conflicts.push('This is a long activity - consider reducing other activities on this day');
    }

    return conflicts;
  }, [currentPlan, getActivityById]);

  return {
    suggestTimeSlot,
    getConflicts,
  };
};

/**
 * Hook for managing plan validation and health checks
 */
export const usePlanValidation = () => {
  const { currentPlan } = useWeekendPlanStore();
  const { getActivityById } = useActivityStore();
  const [validation, setValidation] = useState<{
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  }>({
    isValid: true,
    warnings: [],
    suggestions: [],
  });

  useEffect(() => {
    if (!currentPlan) {
      setValidation({ isValid: true, warnings: [], suggestions: [] });
      return;
    }

    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for empty days
    const saturdayActivities = currentPlan.activities.filter(sa => sa.day === 'saturday');
    const sundayActivities = currentPlan.activities.filter(sa => sa.day === 'sunday');

    if (saturdayActivities.length === 0) {
      suggestions.push('Consider adding some activities for Saturday');
    }
    if (sundayActivities.length === 0) {
      suggestions.push('Consider adding some activities for Sunday');
    }

    // Check for balance
    const categories = currentPlan.activities
      .map(sa => getActivityById(sa.activityId))
      .filter(Boolean)
      .map(a => a!.category);

    const uniqueCategories = new Set(categories);
    if (uniqueCategories.size === 1 && categories.length > 1) {
      suggestions.push('Try mixing different types of activities for variety');
    }

    // Check for energy level balance
    const moods = currentPlan.activities
      .map(sa => getActivityById(sa.activityId))
      .filter(Boolean)
      .flatMap(a => a!.mood);

    const hasHighEnergy = moods.includes('energetic') || moods.includes('adventurous');
    const hasLowEnergy = moods.includes('relaxed') || moods.includes('peaceful');

    if (hasHighEnergy && !hasLowEnergy) {
      suggestions.push('Consider adding some relaxing activities to balance the energy');
    }
    if (hasLowEnergy && !hasHighEnergy) {
      suggestions.push('Consider adding some energizing activities for variety');
    }

    // Check for time conflicts
    (['saturday', 'sunday'] as WeekendDay[]).forEach(day => {
      (['early-morning', 'morning', 'afternoon', 'evening', 'night'] as TimeSlot[]).forEach(timeSlot => {
        const activitiesInSlot = currentPlan.activities.filter(
          sa => sa.day === day && sa.timeSlot === timeSlot
        );
        
        if (activitiesInSlot.length > 1) {
          warnings.push(`Multiple activities scheduled for ${day} ${timeSlot}`);
        }
      });
    });

    setValidation({
      isValid: warnings.length === 0,
      warnings,
      suggestions: suggestions.slice(0, 3), // Limit suggestions
    });
  }, [currentPlan, getActivityById]);

  return validation;
};

/**
 * Hook for managing plan auto-save functionality
 */
export const useAutoSave = (enabled = true, interval = 30000) => {
  const { currentPlan, savePlan } = useWeekendPlanStore();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!enabled || !currentPlan) return;

    const autoSaveInterval = setInterval(async () => {
      try {
        setSaveStatus('saving');
        await savePlan();
        setLastSaved(new Date());
        setSaveStatus('saved');
        
        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('error');
      }
    }, interval);

    return () => clearInterval(autoSaveInterval);
  }, [enabled, currentPlan, savePlan, interval]);

  const manualSave = useCallback(async () => {
    try {
      setSaveStatus('saving');
      await savePlan();
      setLastSaved(new Date());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Manual save failed:', error);
      setSaveStatus('error');
    }
  }, [savePlan]);

  return {
    lastSaved,
    saveStatus,
    manualSave,
  };
};

/**
 * Hook for managing undo/redo functionality
 */
export const useUndoRedo = <T>(initialState: T, maxHistorySize = 50) => {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const push = useCallback((newState: T) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(newState);
      
      // Limit history size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        return newHistory;
      }
      
      return newHistory;
    });
    setCurrentIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
  }, [currentIndex, maxHistorySize]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, history.length]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  const currentState = history[currentIndex];

  return {
    currentState,
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    historySize: history.length,
  };
};

