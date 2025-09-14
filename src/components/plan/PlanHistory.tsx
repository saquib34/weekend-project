import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWeekendPlanStore } from '../../stores/weekendPlanStore';
import { useActivityStore } from '../../stores/activityStore';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { format } from 'date-fns';
import type { WeekendPlan } from '../../types';

interface PlanHistoryProps {
  onLoadPlan?: (planId: string) => void;
}

export const PlanHistory: React.FC<PlanHistoryProps> = ({ onLoadPlan }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'mood'>('date');
  const [selectedPlan, setSelectedPlan] = useState<WeekendPlan | null>(null);
  
  const { 
    savedPlans, 
    loadPlan, 
    deletePlan, 
    duplicatePlan, 
    currentPlan 
  } = useWeekendPlanStore();
  
  const { getActivityById } = useActivityStore();

  // Load saved plans on component mount
  useEffect(() => {
    // Plans are already loaded from storage via Zustand persistence
      }, [savedPlans]);

  const filteredPlans = savedPlans
    .filter(plan => 
      plan.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.mood.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (plan.description && plan.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'mood':
          return a.mood.localeCompare(b.mood);
        case 'date':
        default:
          return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      }
    });

  const handleLoadPlan = (planId: string) => {
    loadPlan(planId);
    onLoadPlan?.(planId);
  };

  const handleDeletePlan = (planId: string) => {
    if (window.confirm('Are you sure you want to delete this plan? This cannot be undone.')) {
      deletePlan(planId);
      if (selectedPlan?.id === planId) {
        setSelectedPlan(null);
      }
    }
  };

  const handleDuplicatePlan = (planId: string) => {
    duplicatePlan(planId);
  };

  const getMoodColor = (mood: string) => {
    const colors = {
      relaxed: 'bg-green-100 text-green-700 border-green-200',
      energetic: 'bg-orange-100 text-orange-700 border-orange-200',
      romantic: 'bg-purple-100 text-purple-700 border-purple-200',
      social: 'bg-blue-100 text-blue-700 border-blue-200',
      adventurous: 'bg-red-100 text-red-700 border-red-200',
      productive: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      spontaneous: 'bg-pink-100 text-pink-700 border-pink-200',
      peaceful: 'bg-teal-100 text-teal-700 border-teal-200',
    };
    return colors[mood as keyof typeof colors] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const renderPlanActivities = (plan: WeekendPlan) => {
    const activitiesCount = plan.activities.length;
    if (activitiesCount === 0) return 'No activities';
    
    const firstFew = plan.activities.slice(0, 3);
    const activityNames = firstFew.map(scheduledActivity => {
      const activity = getActivityById(scheduledActivity.activityId);
      return activity?.title || 'Unknown Activity';
    });
    
    if (activitiesCount > 3) {
      return `${activityNames.join(', ')} +${activitiesCount - 3} more`;
    }
    
    return activityNames.join(', ');
  };

  if (savedPlans.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Saved Plans Yet
          </h3>
          <p className="text-gray-600 mb-4">
            Create and save weekend plans to see them here
          </p>
          <Button onClick={() => onLoadPlan?.('')} variant="primary">
            Create Your First Plan
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Plan History</h2>
            <p className="text-gray-600 mt-1">
              {savedPlans.length} saved plan{savedPlans.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'title' | 'mood')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">Sort by Date</option>
              <option value="title">Sort by Title</option>
              <option value="mood">Sort by Mood</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search plans by title, mood, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            🔍
          </div>
        </div>
      </div>

      {/* Plans List */}
      <div className="flex-1 overflow-auto">
        {filteredPlans.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No plans match your search criteria.
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <AnimatePresence>
              {filteredPlans.map((plan) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={cn(
                    'bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer',
                    currentPlan?.id === plan.id && 'ring-2 ring-blue-500 border-blue-200',
                    selectedPlan?.id === plan.id && 'bg-blue-50'
                  )}
                  onClick={() => setSelectedPlan(selectedPlan?.id === plan.id ? null : plan)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{plan.title}</h3>
                        <span className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium border capitalize',
                          getMoodColor(plan.mood)
                        )}>
                          {plan.mood}
                        </span>
                        {currentPlan?.id === plan.id && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                            Current
                          </span>
                        )}
                      </div>
                      
                      {plan.description && (
                        <p className="text-gray-600 text-sm mb-2">{plan.description}</p>
                      )}
                      
                      <div className="text-sm text-gray-500 mb-2">
                        <div>Activities: {renderPlanActivities(plan)}</div>
                        <div className="flex items-center gap-4 mt-1">
                          <span>Created: {format(new Date(plan.createdAt), 'MMM d, yyyy')}</span>
                          {plan.updatedAt && plan.updatedAt !== plan.createdAt && (
                            <span>Updated: {format(new Date(plan.updatedAt), 'MMM d, yyyy')}</span>
                          )}
                          <span>{plan.activities.length} activities</span>
                          {plan.budget?.target && (
                            <span>Budget: ${plan.budget.target}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadPlan(plan.id);
                        }}
                        size="sm"
                        variant={currentPlan?.id === plan.id ? 'ghost' : 'primary'}
                        disabled={currentPlan?.id === plan.id}
                      >
                        {currentPlan?.id === plan.id ? 'Loaded' : 'Load'}
                      </Button>
                      
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicatePlan(plan.id);
                        }}
                        size="sm"
                        variant="ghost"
                        title="Duplicate plan"
                      >
                        📋
                      </Button>
                      
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlan(plan.id);
                        }}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        title="Delete plan"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {selectedPlan?.id === plan.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-4 pt-4 border-t border-gray-200 overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Saturday Activities</h4>
                            <div className="space-y-1">
                              {plan.activities
                                .filter(a => a.day === 'saturday')
                                .map(scheduledActivity => {
                                  const activity = getActivityById(scheduledActivity.activityId);
                                  return activity ? (
                                    <div key={scheduledActivity.id} className="text-sm text-gray-600">
                                      <span className="font-medium">{scheduledActivity.timeSlot.replace('-', ' ')}:</span> {activity.title}
                                    </div>
                                  ) : null;
                                })}
                              {plan.activities.filter(a => a.day === 'saturday').length === 0 && (
                                <div className="text-sm text-gray-400">No activities planned</div>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Sunday Activities</h4>
                            <div className="space-y-1">
                              {plan.activities
                                .filter(a => a.day === 'sunday')
                                .map(scheduledActivity => {
                                  const activity = getActivityById(scheduledActivity.activityId);
                                  return activity ? (
                                    <div key={scheduledActivity.id} className="text-sm text-gray-600">
                                      <span className="font-medium">{scheduledActivity.timeSlot.replace('-', ' ')}:</span> {activity.title}
                                    </div>
                                  ) : null;
                                })}
                              {plan.activities.filter(a => a.day === 'sunday').length === 0 && (
                                <div className="text-sm text-gray-400">No activities planned</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

