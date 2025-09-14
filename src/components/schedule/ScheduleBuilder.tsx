import React, { useState, useEffect } from 'react';
import { Droppable } from 'react-beautiful-dnd';
import { motion } from 'framer-motion';
import type { TimeSlot, ScheduledActivity } from '../../types';
import { useWeekendPlanStore } from '../../stores/weekendPlanStore';
import { useActivityStore } from '../../stores/activityStore';
import { ActivityCard } from '../activities/ActivityCard';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { format } from 'date-fns';

const ScheduleBuilder: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  
  const {
    currentPlan,
    currentWeekend,
    removeActivityFromSchedule,
    getActivitiesForTimeSlot,
    savePlan,
    getTotalEstimatedCost,
  } = useWeekendPlanStore();

  const { getActivityById } = useActivityStore();

  const handleSave = async () => {
    if (!currentPlan || isSaving) return;
    
    setIsSaving(true);
    try {
      await savePlan();
    } catch (error) {
      console.error('Failed to save plan:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Add keyboard shortcut for saving
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPlan, isSaving]); // Depend on these values instead of handleSave

  const timeSlots: TimeSlot[] = [
    'early-morning',
    'morning',
    'afternoon',
    'evening',
    'night',
  ];

  const timeSlotLabels = {
    'early-morning': '6-9 AM',
    'morning': '9 AM-12 PM',
    'afternoon': '12-5 PM',
    'evening': '5-8 PM',
    'night': '8+ PM',
  };

  const renderScheduledActivity = (scheduledActivity: ScheduledActivity) => {
    const activity = getActivityById(scheduledActivity.activityId);
    if (!activity) return null;

    return (
      <div key={scheduledActivity.id} className="relative group">
        <ActivityCard
          activity={activity}
          isDraggable={true}
          className="mb-2"
        />
        
        {/* Remove button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => removeActivityFromSchedule(scheduledActivity.id)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          aria-label="Remove activity"
        >
          ×
        </motion.button>
      </div>
    );
  };

  if (!currentPlan) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Weekend Plan Selected
          </h3>
          <p className="text-gray-600">
            Create a new plan to start scheduling activities
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {currentPlan.title}
              </h2>
              <p className="text-gray-600 mt-1">
                {format(currentWeekend.saturday, 'MMM d')} - {format(currentWeekend.sunday, 'MMM d, yyyy')}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className={cn(
                'px-3 py-1 rounded-full text-sm font-medium capitalize',
                {
                  'bg-green-100 text-green-700': currentPlan.mood === 'relaxed',
                  'bg-orange-100 text-orange-700': currentPlan.mood === 'energetic',
                  'bg-purple-100 text-purple-700': currentPlan.mood === 'romantic',
                  'bg-blue-100 text-blue-700': currentPlan.mood === 'social',
                  'bg-red-100 text-red-700': currentPlan.mood === 'adventurous',
                  'bg-indigo-100 text-indigo-700': currentPlan.mood === 'productive',
                  'bg-pink-100 text-pink-700': currentPlan.mood === 'spontaneous',
                  'bg-teal-100 text-teal-700': currentPlan.mood === 'peaceful',
                }
              )}>
                {currentPlan.mood}
              </span>
              
              <div className="text-sm text-gray-600">
                Budget: ${getTotalEstimatedCost().toFixed(2)}
              </div>
              
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="sm"
                className="flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    💾 Save Plan
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-2 gap-6 h-full">
            {/* Saturday */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Saturday
                </h3>
                <span className="text-sm text-gray-500">
                  {format(currentWeekend.saturday, 'MMM d')}
                </span>
              </div>
              
              <div className="space-y-3">
                {timeSlots.map((timeSlot) => {
                  const activities = getActivitiesForTimeSlot('saturday', timeSlot);
                  
                  return (
                    <div key={timeSlot} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-700 capitalize">
                          {timeSlot.replace('-', ' ')}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {timeSlotLabels[timeSlot]}
                        </span>
                      </div>
                      
                      <Droppable droppableId={`saturday-${timeSlot}`}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              'schedule-slot min-h-[120px] transition-all duration-200',
                              snapshot.isDraggingOver && 'border-primary-400 bg-primary-50',
                              activities.length === 0 && 'border-dashed'
                            )}
                          >
                            {activities.length === 0 ? (
                              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                                Drop activity here
                              </div>
                            ) : (
                              activities.map((scheduledActivity) =>
                                renderScheduledActivity(scheduledActivity)
                              )
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sunday */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Sunday
                </h3>
                <span className="text-sm text-gray-500">
                  {format(currentWeekend.sunday, 'MMM d')}
                </span>
              </div>
              
              <div className="space-y-3">
                {timeSlots.map((timeSlot) => {
                  const activities = getActivitiesForTimeSlot('sunday', timeSlot);
                  
                  return (
                    <div key={timeSlot} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-700 capitalize">
                          {timeSlot.replace('-', ' ')}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {timeSlotLabels[timeSlot]}
                        </span>
                      </div>
                      
                      <Droppable droppableId={`sunday-${timeSlot}`}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              'schedule-slot min-h-[120px] transition-all duration-200',
                              snapshot.isDraggingOver && 'border-primary-400 bg-primary-50',
                              activities.length === 0 && 'border-dashed'
                            )}
                          >
                            {activities.length === 0 ? (
                              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                                Drop activity here
                              </div>
                            ) : (
                              activities.map((scheduledActivity) =>
                                renderScheduledActivity(scheduledActivity)
                              )
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {currentPlan.activities.length} activities planned
            </span>
            <span>
              Mood: {currentPlan.mood}
            </span>
          </div>
        </div>
      </div>
  );
};

export { ScheduleBuilder };
