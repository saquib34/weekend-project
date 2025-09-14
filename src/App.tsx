import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import type { DropResult } from 'react-beautiful-dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityBrowser } from './components/activities/ActivityBrowser';
import { ScheduleBuilder } from './components/schedule/ScheduleBuilder';
import { PlanHistory } from './components/plan/PlanHistory';
import { ActivityCard } from './components/activities/ActivityCard';
import { Button } from './components/ui/Button';
import { EmotionDetectionWidget } from './components/EmotionDetectionWidget';
import { SocialSharingModal } from './components/SocialSharingModal';
import { AIChatWidget } from './components/ai/AIChatWidget';
import { PricePredictionWidget } from './components/ai/PricePredictionWidget';
import { useWeekendPlanStore } from './stores/weekendPlanStore';
import { useActivityStore } from './stores/activityStore';
import { useUIStore } from './stores/uiStore';
import { useEmotionBasedRecommendations, type DetectionResult } from './hooks/useEmotionDetection';
import { weatherService, getWeatherIcon, getWeatherDescription, type WeatherData } from './services/weather';
import { pwaService } from './services/pwa';
import { LongWeekendSuggestions } from './components/LongWeekendSuggestions';
import type { WeekendMood, WeekendDay, TimeSlot, WeekendType } from './types';
import './index.css';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h2>
            <p className="text-gray-600 mb-6">We're sorry, but something unexpected happened.</p>
            <Button
              onClick={() => window.location.reload()}
              className="mr-4"
            >
              Reload App
            </Button>
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false })}
            >
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [currentView, setCurrentView] = useState<'browser' | 'schedule' | 'history'>('browser');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSharingModal, setShowSharingModal] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
  const [emotionRecommendations, setEmotionRecommendations] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedWeekendType, setSelectedWeekendType] = useState<WeekendType>('regular');
  const [selectedStartDate, setSelectedStartDate] = useState<Date>(new Date());
  
  const { 
    currentPlan, 
    createNewPlan, 
    savePlan,
    addActivityToSchedule 
  } = useWeekendPlanStore();
  
  const { filteredActivities } = useActivityStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  
  const { getRecommendationsByEmotion } = useEmotionBasedRecommendations();

  // Initialize services on app start
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize PWA service
      pwaService.on('install-prompt-available', () => {
        setShowInstallPrompt(true);
      });

      pwaService.on('online', () => setIsOnline(true));
      pwaService.on('offline', () => setIsOnline(false));

      // Request notification permission
      await pwaService.requestNotificationPermission();
      
      // Schedule weekend reminders
      await pwaService.scheduleWeekendReminder();

      // Load weather data
      await loadWeatherData();

    } catch (error) {
      console.error('App initialization failed:', error);
    }
  };

  const loadWeatherData = async () => {
    try {
      const location = await weatherService.getCurrentLocation();
      const weather = await weatherService.getCurrentWeather(location);
      setCurrentWeather(weather);
    } catch (error) {
      console.error('Failed to load weather:', error);
      // Use mock data on error
      setCurrentWeather({
        condition: 'partly-cloudy',
        temperature: 22,
        humidity: 65,
        windSpeed: 12,
        precipitation: 0,
        uvIndex: 6,
        visibility: 10,
        description: 'Partly cloudy',
        icon: '02d',
      });
    }
  };

  const handleEmotionDetection = useCallback((result: DetectionResult) => {
    const recommendations = getRecommendationsByEmotion(result.emotions, result.energyLevel);
    setEmotionRecommendations(recommendations);
    
    // Update activity filters based on emotion
    const { setFilters } = useActivityStore.getState();
    setFilters({
      moods: recommendations as WeekendMood[],
      searchQuery: '',
      categories: [],
      duration: [],
      weatherSuitability: [],
    });
  }, [getRecommendationsByEmotion]);

  const handleCreatePlan = useCallback(async (mood: WeekendMood, title: string, weekendType: WeekendType = 'regular', startDate: Date = new Date()) => {
    // Calculate end date and available days based on weekend type
    const endDate = new Date(startDate);
    let availableDays: ('friday' | 'saturday' | 'sunday' | 'monday')[] = [];
    
    switch (weekendType) {
      case 'long':
        // 3-day weekend (Friday-Sunday or Saturday-Monday)
        if (startDate.getDay() === 5) { // Friday
          endDate.setDate(startDate.getDate() + 2);
          availableDays = ['friday', 'saturday', 'sunday'];
        } else {
          endDate.setDate(startDate.getDate() + 2);
          availableDays = ['saturday', 'sunday', 'monday'];
        }
        break;
      case 'extended':
        // 4-day weekend (Friday-Monday)
        endDate.setDate(startDate.getDate() + 3);
        availableDays = ['friday', 'saturday', 'sunday', 'monday'];
        break;
      default:
        // Regular weekend (Saturday-Sunday)
        endDate.setDate(startDate.getDate() + 1);
        availableDays = ['saturday', 'sunday'];
    }

    createNewPlan(mood, title, weekendType, startDate, endDate, availableDays);
    setShowCreateModal(false);
    setCurrentView('schedule');

    // Get AI recommendations for the new plan
    if (currentWeather) {
      try {
        // For now, just log that we would get AI recommendations
        console.log('Would get AI recommendations for mood:', mood, 'weather:', currentWeather, 'weekend type:', weekendType);
      } catch (error) {
        console.error('Failed to get AI recommendations:', error);
      }
    }
  }, [createNewPlan, currentWeather]);

  const handleDragEnd = useCallback((result: DropResult) => {
    const { destination, draggableId, source } = result;
    
    console.log('Drag end:', { destination, draggableId, source, currentPlan });

    if (!destination) {
      console.log('No destination for drop');
      return;
    }
    
    // Auto-create a plan if none exists
    if (!currentPlan) {
      console.log('No current plan, creating one...');
      createNewPlan('energetic', 'My Weekend Plan');
      console.log('Auto-created plan for drag and drop');
      // The plan will be available after the state update, so we need to exit and let the user try again
      return;
    }

    const destDroppableId = destination.droppableId;
    console.log('Dropping to:', destDroppableId);
    
    // Only handle drops to schedule slots
    if (destDroppableId.includes('-')) {
      // Parse droppableId format: "day-timeSlot" where timeSlot might contain dashes
      const parts = destDroppableId.split('-');
      const day = parts[0] as WeekendDay;
      const timeSlot = parts.slice(1).join('-') as TimeSlot; // Rejoin timeSlot parts
      console.log('Adding activity:', { draggableId, day, timeSlot });
      
      addActivityToSchedule(draggableId, day, timeSlot);
      
      console.log('Activity added successfully');
    } else {
      console.log('Drop target is not a schedule slot:', destDroppableId);
    }
  }, [currentPlan, addActivityToSchedule]);

  const handleInstallApp = async () => {
    const installed = await pwaService.showInstallPrompt();
    if (installed) {
      setShowInstallPrompt(false);
    }
  };

  const moods: { value: WeekendMood; label: string; emoji: string }[] = [
    { value: 'relaxed', label: 'Relaxed & Chill', emoji: '😌' },
    { value: 'energetic', label: 'Active & Energetic', emoji: '⚡' },
    { value: 'romantic', label: 'Romantic', emoji: '💕' },
    { value: 'social', label: 'Social & Fun', emoji: '🎉' },
    { value: 'adventurous', label: 'Adventurous', emoji: '🗺️' },
    { value: 'productive', label: 'Productive', emoji: '💪' },
    { value: 'spontaneous', label: 'Spontaneous', emoji: '🎲' },
    { value: 'peaceful', label: 'Peaceful', emoji: '🧘' },
  ];

  const weekendTypes: { value: WeekendType; label: string; emoji: string; description: string }[] = [
    { value: 'regular', label: 'Regular Weekend', emoji: '📅', description: 'Saturday & Sunday (2 days)' },
    { value: 'long', label: 'Long Weekend', emoji: '🎊', description: 'Friday-Sunday or Saturday-Monday (3 days)' },
    { value: 'extended', label: 'Extended Weekend', emoji: '🌟', description: 'Friday-Monday (4 days)' },
  ];

  return (
    <ErrorBoundary>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="min-h-screen flex bg-gray-50 overflow-hidden">
          {/* PWA Install Banner */}
          <AnimatePresence>
            {showInstallPrompt && (
              <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                className="fixed top-0 left-0 right-0 bg-primary-600 text-white p-3 z-50"
              >
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📱</span>
                    <span className="text-sm font-medium">
                      Install Weekendly for the best experience
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleInstallApp}
                      className="text-white hover:bg-primary-700"
                    >
                      Install
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowInstallPrompt(false)}
                      className="text-white hover:bg-primary-700"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sidebar */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ x: -320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -320, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-80 bg-white border-r border-gray-200 flex flex-col"
              >
                {/* Sidebar Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold gradient-text">
                      Weekendly
                    </h1>
                    <div className="flex items-center gap-2">
                      {/* Online Status */}
                      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                      <button
                        onClick={toggleSidebar}
                        className="p-1 hover:bg-gray-100 rounded-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Weather Widget */}
                  {currentWeather && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getWeatherIcon(currentWeather.condition)}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">
                            {getWeatherDescription(currentWeather)}
                          </p>
                          <p className="text-xs text-blue-600">
                            Perfect for {currentWeather.condition === 'sunny' ? 'outdoor' : 'indoor'} activities
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Emotion Detection Widget */}
                  <div className="mt-4">
                    <EmotionDetectionWidget
                      onEmotionChange={handleEmotionDetection}
                      className="w-full"
                    />
                  </div>

                  {/* Price Prediction Widget */}
                  <div className="mt-4">
                    <PricePredictionWidget className="w-full" />
                  </div>

                  {/* Plan Status */}
                  <div className="mt-4">
                    {currentPlan ? (
                      <div className="bg-primary-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-primary-900">
                              {currentPlan.title}
                            </h3>
                            <p className="text-sm text-primary-600">
                              {currentPlan.activities.length} activities
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              onClick={() => savePlan()}
                              className="text-xs"
                            >
                              Save
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setShowSharingModal(true)}
                              className="text-xs"
                            >
                              Share
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Button
                        fullWidth
                        onClick={() => setShowCreateModal(true)}
                        className="text-sm"
                      >
                        Create Weekend Plan
                      </Button>
                    )}
                  </div>
                </div>

                {/* Navigation */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex gap-2">
                    <Button
                      variant={currentView === 'browser' ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setCurrentView('browser')}
                      fullWidth
                    >
                      Browse
                    </Button>
                    <Button
                      variant={currentView === 'schedule' ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setCurrentView('schedule')}
                      fullWidth
                    >
                      Schedule
                    </Button>
                    <Button
                      variant={currentView === 'history' ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setCurrentView('history')}
                      fullWidth
                    >
                      History
                    </Button>
                  </div>

                  {/* Emotion Recommendations */}
                  {emotionRecommendations.length > 0 && (
                    <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                      <h4 className="text-sm font-medium text-purple-900 mb-2">
                        🎭 Based on your mood
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {emotionRecommendations.map((mood) => (
                          <span
                            key={mood}
                            className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full"
                          >
                            {mood}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Draggable Activities */}
                {currentView === 'schedule' && (
                  <div className="flex-1 overflow-hidden">
                    <div className="p-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">
                        Drag to Schedule
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Drag activities from here to your weekend schedule
                      </p>
                    </div>
                    
                    <Droppable droppableId="activities" isDropDisabled={true}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="flex-1 overflow-auto px-4 pb-4 space-y-2"
                        >
                          {filteredActivities.length > 0 ? (
                            filteredActivities.slice(0, 10).map((activity, index) => (
                              <ActivityCard
                                key={activity.id}
                                activity={activity}
                                index={index}
                                isDraggable={true}
                                className="w-full"
                              />
                            ))
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <p className="text-sm">No activities available</p>
                              <p className="text-xs mt-1">Activities will appear here when loaded</p>
                            </div>
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Top Bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {!sidebarOpen && (
                    <button
                      onClick={toggleSidebar}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  )}
                  
                  <div className="text-sm text-gray-600">
                    {currentView === 'browser' 
                      ? `${filteredActivities.length} activities available`
                      : currentView === 'schedule'
                      ? (currentPlan ? `Planning: ${currentPlan.title}` : 'No plan selected')
                      : 'Your saved weekend plans'
                    }
                  </div>

                  {/* Weather in top bar when sidebar closed */}
                  {!sidebarOpen && currentWeather && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-lg">
                      <span>{getWeatherIcon(currentWeather.condition)}</span>
                      <span className="text-sm text-blue-900">
                        {currentWeather.temperature}°C
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Keyboard shortcuts hint */}
                  <div className="hidden md:block text-xs text-gray-500">
                    Ctrl+S to save • Ctrl+N for new plan
                  </div>

                  {currentPlan && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSharingModal(true)}
                      >
                        Share
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => savePlan()}
                      >
                        Save Plan
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto">
              {currentView === 'browser' ? (
                <ActivityBrowser />
              ) : currentView === 'schedule' ? (
                <ScheduleBuilder />
              ) : (
                <PlanHistory onLoadPlan={(planId) => {
                  if (planId) {
                    setCurrentView('schedule');
                  } else {
                    setCurrentView('browser');
                  }
                }} />
              )}
            </div>
          </div>

          {/* Create Plan Modal */}
          <AnimatePresence>
            {showCreateModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                onClick={() => setShowCreateModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    Create Weekend Plan
                  </h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Plan Title
                      </label>
                      <input
                        type="text"
                        placeholder="My Awesome Weekend"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        id="plan-title"
                      />
                    </div>

                    {/* Weekend Type Selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Weekend Type
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {weekendTypes.map((type) => (
                          <button
                            key={type.value}
                            onClick={() => setSelectedWeekendType(type.value)}
                            className={`flex items-center gap-3 p-3 border rounded-lg hover:border-primary-300 transition-all text-left ${
                              selectedWeekendType === type.value
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200'
                            }`}
                          >
                            <span className="text-xl">{type.emoji}</span>
                            <div>
                              <div className="text-sm font-medium">{type.label}</div>
                              <div className="text-xs text-gray-500">{type.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Start Date Selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        id="start-date"
                        min={new Date().toISOString().split('T')[0]}
                        defaultValue={selectedStartDate.toISOString().split('T')[0]}
                        onChange={(e) => setSelectedStartDate(new Date(e.target.value))}
                      />
                    </div>

                    {/* Holiday Suggestions */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        🎊 Holiday Opportunities
                      </label>
                      <LongWeekendSuggestions 
                        onSelectWeekend={(opportunity) => {
                          setSelectedWeekendType(opportunity.weekendType);
                          setSelectedStartDate(opportunity.startDate);
                        }}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Choose Your Mood
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {moods.map((mood) => (
                          <button
                            key={mood.value}
                            onClick={() => {
                              const title = (document.getElementById('plan-title') as HTMLInputElement)?.value || 'My Weekend Plan';
                              const startDate = new Date((document.getElementById('start-date') as HTMLInputElement)?.value || new Date());
                              handleCreatePlan(mood.value, title, selectedWeekendType, startDate);
                            }}
                            className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all text-left"
                          >
                            <span className="text-xl">{mood.emoji}</span>
                            <span className="text-sm font-medium">{mood.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="ghost"
                      onClick={() => setShowCreateModal(false)}
                      fullWidth
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Social Sharing Modal */}
          {showSharingModal && currentPlan && (
            <SocialSharingModal
              plan={currentPlan}
              onClose={() => setShowSharingModal(false)}
            />
          )}
          
          {/* AI Chat Widget */}
          <AIChatWidget className="fixed bottom-4 right-4 z-50" />
        </div>
      </DragDropContext>
    </ErrorBoundary>
  );
}

export default App;
