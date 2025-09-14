import { useState, useCallback, useEffect } from 'react';
import { useWeekendPlanStore } from '../stores/weekendPlanStore';
import { useActivityStore } from '../stores/activityStore';
import type { WeekendPlan, Activity, AIRecommendation } from '../types';

/**
 * Hook for managing AI-powered recommendations
 */
export const useAIRecommendations = () => {
  const { currentPlan } = useWeekendPlanStore();
  // const { getActivityById } = useActivityStore(); // Removed unused
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generateRecommendations = useCallback(async () => {
    if (!currentPlan) return;

    setLoading(true);
    setError(null);

    try {
      // Simulate AI recommendation generation
      // In a real app, this would call the Gemini API
      const mockRecommendations: AIRecommendation[] = await new Promise(resolve => {
        setTimeout(() => {
          const existingActivityIds = currentPlan.activities.map(sa => sa.activityId);
          const availableActivities = useActivityStore.getState().allActivities
            .filter(activity => !existingActivityIds.includes(activity.id))
            .filter(activity => activity.mood.includes(currentPlan.mood))
            .slice(0, 5);

          const recs: AIRecommendation[] = availableActivities.map(activity => ({
            activityId: activity.id,
            confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
            reasoning: `This ${activity.category} activity matches your ${currentPlan.mood} mood and complements your existing plans.`,
            alternatives: [],
          }));

          resolve(recs);
        }, 1500);
      });

      setRecommendations(mockRecommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recommendations');
    } finally {
      setLoading(false);
    }
  }, [currentPlan]);

  return {
    recommendations,
    loading,
    error,
    generateRecommendations,
  };
};

/**
 * Hook for managing plan sharing functionality
 */
export const usePlanSharing = () => {
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const generateShareableImage = useCallback(async (plan: WeekendPlan): Promise<string> => {
    // This would use html2canvas to generate an image
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock image generation
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d')!;
        
        // Simple mock image
        ctx.fillStyle = '#f0f9ff';
        ctx.fillRect(0, 0, 800, 600);
        ctx.fillStyle = '#1e40af';
        ctx.font = '24px Arial';
        ctx.fillText(plan.title, 50, 100);
        ctx.font = '16px Arial';
        ctx.fillText(`${plan.activities.length} activities planned`, 50, 140);
        
        resolve(canvas.toDataURL());
      }, 1000);
    });
  }, []);

  const shareToSocial = useCallback(async (plan: WeekendPlan, platform: 'whatsapp' | 'instagram' | 'twitter') => {
    setSharing(true);
    
    try {
      const imageUrl = await generateShareableImage(plan);
      
      const text = `Check out my weekend plan: ${plan.title}! 🌟`;
      
      switch (platform) {
        case 'whatsapp':
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
          window.open(whatsappUrl, '_blank');
          break;
          
        case 'twitter':
          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
          window.open(twitterUrl, '_blank');
          break;
          
        case 'instagram':
          // Instagram sharing would require their API or manual copy
          navigator.clipboard?.writeText(text);
          alert('Text copied! You can now paste it on Instagram.');
          break;
      }
      
      setShareUrl(imageUrl);
    } catch (error) {
      console.error('Sharing failed:', error);
    } finally {
      setSharing(false);
    }
  }, [generateShareableImage]);

  const copyShareLink = useCallback((plan: WeekendPlan) => {
    const shareLink = `${window.location.origin}/plan/${plan.id}`;
    navigator.clipboard?.writeText(shareLink);
    setShareUrl(shareLink);
  }, []);

  return {
    sharing,
    shareUrl,
    shareToSocial,
    copyShareLink,
    generateShareableImage,
  };
};

/**
 * Hook for managing weather integration
 */
export const useWeatherIntegration = () => {
  const [weather, setWeather] = useState<{
    saturday: { condition: string; temp: number; humidity: number };
    sunday: { condition: string; temp: number; humidity: number };
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchWeather = useCallback(async (location?: { lat: number; lng: number }) => {
    setLoading(true);
    
    try {
      // Mock weather data - in real app, this would call a weather API
      // Location parameter is for future use when implementing real weather API
      console.log('Weather location:', location);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setWeather({
        saturday: {
          condition: 'sunny',
          temp: 22,
          humidity: 65,
        },
        sunday: {
          condition: 'partly-cloudy',
          temp: 20,
          humidity: 70,
        },
      });
    } catch (error) {
      console.error('Failed to fetch weather:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getWeatherBasedSuggestions = useCallback((activities: Activity[]) => {
    if (!weather) return activities;

    // Filter activities based on weather conditions
    return activities.filter(activity => {
      const weatherSuitability = activity.weatherSuitability;
      
      // Activities that work in any weather
      if (weatherSuitability === 'any') {
        return true;
      }
      
      // Indoor activities work regardless of weather
      if (weatherSuitability === 'indoor-only') {
        return true;
      }
      
      // Match specific weather conditions
      const saturdayCondition = weather.saturday.condition;
      if (saturdayCondition === 'sunny' && weatherSuitability === 'sunny') {
        return true;
      }
      
      if (saturdayCondition === 'rainy' && weatherSuitability === 'rainy') {
        return true;
      }
      
      if (saturdayCondition === 'cloudy' && weatherSuitability === 'cloudy') {
        return true;
      }
      
      return false;
    });
  }, [weather]);

  return {
    weather,
    loading,
    fetchWeather,
    getWeatherBasedSuggestions,
  };
};

/**
 * Hook for managing analytics and user behavior tracking
 */
export const useAnalytics = () => {
  const trackEvent = useCallback((eventName: string, properties?: Record<string, any>) => {
    // In a real app, this would send to analytics service
    console.log('Analytics Event:', eventName, properties);
    
    // Store locally for demo purposes
    const events = JSON.parse(localStorage.getItem('weekendly_analytics') || '[]');
    events.push({
      event: eventName,
      properties,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('weekendly_analytics', JSON.stringify(events.slice(-100))); // Keep last 100 events
  }, []);

  const trackActivitySelection = useCallback((activityId: string, method: 'click' | 'drag' | 'search') => {
    trackEvent('activity_selected', { activityId, method });
  }, [trackEvent]);

  const trackPlanCreation = useCallback((planId: string, mood: string, activityCount: number) => {
    trackEvent('plan_created', { planId, mood, activityCount });
  }, [trackEvent]);

  const trackPlanSharing = useCallback((planId: string, platform: string) => {
    trackEvent('plan_shared', { planId, platform });
  }, [trackEvent]);

  return {
    trackEvent,
    trackActivitySelection,
    trackPlanCreation,
    trackPlanSharing,
  };
};

/**
 * Hook for managing offline functionality
 */
export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addToPendingSync = useCallback((action: any) => {
    if (!isOnline) {
      setPendingSync(prev => [...prev, action]);
    }
  }, [isOnline]);

  const syncPendingActions = useCallback(async () => {
    if (isOnline && pendingSync.length > 0) {
      // Process pending sync actions
      console.log('Syncing pending actions:', pendingSync);
      
      // Clear pending actions after successful sync
      setPendingSync([]);
    }
  }, [isOnline, pendingSync]);

  useEffect(() => {
    if (isOnline) {
      syncPendingActions();
    }
  }, [isOnline, syncPendingActions]);

  return {
    isOnline,
    pendingSync: pendingSync.length,
    addToPendingSync,
  };
};

/**
 * Hook for managing keyboard shortcuts
 */
export const useKeyboardShortcuts = () => {
  const { savePlan, createNewPlan } = useWeekendPlanStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        savePlan();
      }

      // Ctrl/Cmd + N to create new plan
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        createNewPlan('relaxed');
      }

      // Escape to close modals/overlays
      if (event.key === 'Escape') {
        // This would be handled by individual components
        document.dispatchEvent(new CustomEvent('escape-pressed'));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [savePlan, createNewPlan]);

  return {
    shortcuts: [
      { key: 'Ctrl/Cmd + S', description: 'Save current plan' },
      { key: 'Ctrl/Cmd + N', description: 'Create new plan' },
      { key: 'Escape', description: 'Close modals' },
    ],
  };
};
