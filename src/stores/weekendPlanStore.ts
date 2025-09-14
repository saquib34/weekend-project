import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import type { WeekendPlan, ScheduledActivity, WeekendMood, WeekendDay, TimeSlot } from '../types';
import { format } from 'date-fns';
import { offlineStorageService } from '../services/offlineStorage';
import { activities } from '../data/activities';

interface WeekendPlanState {
  // Current plan being edited
  currentPlan: WeekendPlan | null;
  
  // Saved plans
  savedPlans: WeekendPlan[];
  
  // Plan templates
  templates: WeekendPlan[];
  
  // Current weekend dates
  currentWeekend: {
    saturday: Date;
    sunday: Date;
  };
  
  // Actions
  createNewPlan: (mood: WeekendMood, title?: string) => void;
  updatePlanTitle: (title: string) => void;
  updatePlanDescription: (description: string) => void;
  updatePlanMood: (mood: WeekendMood) => void;
  updatePlanBudget: (budget: { target?: number; max?: number; currency?: string }) => void;
  addActivityToSchedule: (activityId: string, day: WeekendDay, timeSlot: TimeSlot) => void;
  removeActivityFromSchedule: (scheduledActivityId: string) => void;
  moveActivity: (scheduledActivityId: string, newDay: WeekendDay, newTimeSlot: TimeSlot) => void;
  updateScheduledActivity: (scheduledActivityId: string, updates: Partial<ScheduledActivity>) => void;
  savePlan: () => Promise<boolean>;
  loadPlan: (planId: string) => void;
  deletePlan: (planId: string) => void;
  duplicatePlan: (planId: string) => void;
  createTemplate: (planId: string, templateName: string) => void;
  clearCurrentPlan: () => void;
  setCurrentWeekend: (saturday: Date, sunday: Date) => void;
  
  // Getters
  getActivitiesForDay: (day: WeekendDay) => ScheduledActivity[];
  getActivitiesForTimeSlot: (day: WeekendDay, timeSlot: TimeSlot) => ScheduledActivity[];
  getPlanById: (planId: string) => WeekendPlan | undefined;
  getTotalEstimatedCost: () => number;
}

// Helper function to get next weekend dates
const getNextWeekend = (): { saturday: Date; sunday: Date } => {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Calculate days until next Saturday
  const daysUntilSaturday = currentDay === 0 ? 6 : 6 - currentDay;
  
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSaturday);
  
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  
  return { saturday, sunday };
};

// Helper function to generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useWeekendPlanStore = create<WeekendPlanState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        currentPlan: null,
        savedPlans: [],
        templates: [],
        currentWeekend: getNextWeekend(),
        
        createNewPlan: (mood: WeekendMood, title?: string) => {
          const { currentWeekend } = get();
          const newPlan: WeekendPlan = {
            id: generateId(),
            title: title || `${format(currentWeekend.saturday, 'MMM d')} Weekend Plan`,
            description: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            mood,
            activities: [],
            budget: {
              target: 150,
              currency: 'USD'
            },
            isTemplate: false,
            shareSettings: {
              isPublic: false,
              allowEditing: false,
            },
          };
          
          set({ currentPlan: newPlan });
        },
        
        updatePlanTitle: (title: string) => {
          set((state) => ({
            currentPlan: state.currentPlan 
              ? { ...state.currentPlan, title, updatedAt: new Date() }
              : null
          }));
        },
        
        updatePlanDescription: (description: string) => {
          set((state) => ({
            currentPlan: state.currentPlan 
              ? { ...state.currentPlan, description, updatedAt: new Date() }
              : null
          }));
        },
        
        updatePlanMood: (mood: WeekendMood) => {
          set((state) => ({
            currentPlan: state.currentPlan 
              ? { ...state.currentPlan, mood, updatedAt: new Date() }
              : null
          }));
        },
        
        updatePlanBudget: (budget: { target?: number; max?: number; currency?: string }) => {
          set((state) => ({
            currentPlan: state.currentPlan 
              ? { 
                  ...state.currentPlan, 
                  budget: {
                    target: budget.target || state.currentPlan.budget?.target || 100,
                    actual: state.currentPlan.budget?.actual,
                    currency: budget.currency || state.currentPlan.budget?.currency || 'USD'
                  }, 
                  updatedAt: new Date() 
                }
              : null
          }));
        },
        
        addActivityToSchedule: (activityId: string, day: WeekendDay, timeSlot: TimeSlot) => {
          set((state) => {
            if (!state.currentPlan) return state;
            
            // Check if there's already an activity in this time slot
            const existingActivity = state.currentPlan.activities.find(
              activity => activity.day === day && activity.timeSlot === timeSlot
            );
            
            if (existingActivity) {
              // Replace existing activity
              const updatedActivities = state.currentPlan.activities.map(activity =>
                activity.id === existingActivity.id
                  ? { ...activity, activityId, updatedAt: new Date() }
                  : activity
              );
              
              return {
                currentPlan: {
                  ...state.currentPlan,
                  activities: updatedActivities,
                  updatedAt: new Date(),
                }
              };
            } else {
              // Add new activity
              const newScheduledActivity: ScheduledActivity = {
                id: generateId(),
                activityId,
                day,
                timeSlot,
                reminder: {
                  enabled: false,
                  minutes: 30,
                },
              };
              
              return {
                currentPlan: {
                  ...state.currentPlan,
                  activities: [...state.currentPlan.activities, newScheduledActivity],
                  updatedAt: new Date(),
                }
              };
            }
          });
        },
        
        removeActivityFromSchedule: (scheduledActivityId: string) => {
          set((state) => ({
            currentPlan: state.currentPlan 
              ? {
                  ...state.currentPlan,
                  activities: state.currentPlan.activities.filter(
                    activity => activity.id !== scheduledActivityId
                  ),
                  updatedAt: new Date(),
                }
              : null
          }));
        },
        
        moveActivity: (scheduledActivityId: string, newDay: WeekendDay, newTimeSlot: TimeSlot) => {
          set((state) => {
            if (!state.currentPlan) return state;
            
            const activityToMove = state.currentPlan.activities.find(
              activity => activity.id === scheduledActivityId
            );
            
            if (!activityToMove) return state;
            
            // Check if destination slot is occupied
            const destinationActivity = state.currentPlan.activities.find(
              activity => activity.day === newDay && activity.timeSlot === newTimeSlot
            );
            
            let updatedActivities = [...state.currentPlan.activities];
            
            if (destinationActivity && destinationActivity.id !== scheduledActivityId) {
              // Swap activities
              updatedActivities = updatedActivities.map(activity => {
                if (activity.id === scheduledActivityId) {
                  return { ...activity, day: newDay, timeSlot: newTimeSlot };
                }
                if (activity.id === destinationActivity.id) {
                  return { ...activity, day: activityToMove.day, timeSlot: activityToMove.timeSlot };
                }
                return activity;
              });
            } else {
              // Simple move
              updatedActivities = updatedActivities.map(activity =>
                activity.id === scheduledActivityId
                  ? { ...activity, day: newDay, timeSlot: newTimeSlot }
                  : activity
              );
            }
            
            return {
              currentPlan: {
                ...state.currentPlan,
                activities: updatedActivities,
                updatedAt: new Date(),
              }
            };
          });
        },
        
        updateScheduledActivity: (scheduledActivityId: string, updates: Partial<ScheduledActivity>) => {
          set((state) => ({
            currentPlan: state.currentPlan 
              ? {
                  ...state.currentPlan,
                  activities: state.currentPlan.activities.map(activity =>
                    activity.id === scheduledActivityId
                      ? { ...activity, ...updates }
                      : activity
                  ),
                  updatedAt: new Date(),
                }
              : null
          }));
        },
        
        savePlan: async () => {
          const state = get();
          if (!state.currentPlan) {
            console.warn('No current plan to save');
            return false;
          }
          
          const planToSave = { ...state.currentPlan, updatedAt: new Date() };
          
          // Save to offline storage first
          try {
            await offlineStorageService.savePlan(planToSave);
            console.log('✅ Plan saved successfully:', planToSave.title);
            
            // Update in-memory state
            set((currentState) => {
              const existingPlanIndex = currentState.savedPlans.findIndex(plan => plan.id === planToSave.id);
              
              if (existingPlanIndex >= 0) {
                // Update existing plan
                const updatedPlans = [...currentState.savedPlans];
                updatedPlans[existingPlanIndex] = planToSave;
                return { savedPlans: updatedPlans };
              } else {
                // Add new plan
                return { savedPlans: [...currentState.savedPlans, planToSave] };
              }
            });
            
            // Show success notification (you can enhance this with a toast library)
            if (typeof window !== 'undefined') {
              // Simple browser notification for now
              const notification = document.createElement('div');
              notification.innerHTML = `✅ "${planToSave.title}" saved successfully!`;
              notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all';
              document.body.appendChild(notification);
              
              setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => document.body.removeChild(notification), 300);
              }, 3000);
            }
            
            return true;
          } catch (error) {
            console.error('❌ Failed to save plan:', error);
            
            // Show error notification
            if (typeof window !== 'undefined') {
              const notification = document.createElement('div');
              notification.innerHTML = `❌ Failed to save "${planToSave.title}". Please try again.`;
              notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all';
              document.body.appendChild(notification);
              
              setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => document.body.removeChild(notification), 300);
              }, 3000);
            }
            
            return false;
          }
        },
        
        loadPlan: (planId: string) => {
          const { savedPlans } = get();
          const planToLoad = savedPlans.find(plan => plan.id === planId);
          
          if (planToLoad) {
            set({ currentPlan: { ...planToLoad } });
          }
        },
        
        deletePlan: (planId: string) => {
          set((state) => ({
            savedPlans: state.savedPlans.filter(plan => plan.id !== planId),
            currentPlan: state.currentPlan?.id === planId ? null : state.currentPlan,
          }));
        },
        
        duplicatePlan: (planId: string) => {
          const { savedPlans } = get();
          const planToDuplicate = savedPlans.find(plan => plan.id === planId);
          
          if (planToDuplicate) {
            const duplicatedPlan: WeekendPlan = {
              ...planToDuplicate,
              id: generateId(),
              title: `${planToDuplicate.title} (Copy)`,
              createdAt: new Date(),
              updatedAt: new Date(),
              activities: planToDuplicate.activities.map(activity => ({
                ...activity,
                id: generateId(),
              })),
            };
            
            set((state) => ({
              savedPlans: [...state.savedPlans, duplicatedPlan],
              currentPlan: duplicatedPlan,
            }));
          }
        },
        
        createTemplate: (planId: string, templateName: string) => {
          const { savedPlans } = get();
          const planToTemplate = savedPlans.find(plan => plan.id === planId);
          
          if (planToTemplate) {
            const template: WeekendPlan = {
              ...planToTemplate,
              id: generateId(),
              title: templateName,
              isTemplate: true,
              templateCategory: planToTemplate.mood,
              shareSettings: {
                isPublic: true,
                allowEditing: false,
              },
            };
            
            set((state) => ({
              templates: [...state.templates, template],
            }));
          }
        },
        
        clearCurrentPlan: () => {
          set({ currentPlan: null });
        },
        
        setCurrentWeekend: (saturday: Date, sunday: Date) => {
          set({ currentWeekend: { saturday, sunday } });
        },
        
        // Getters
        getActivitiesForDay: (day: WeekendDay) => {
          const { currentPlan } = get();
          if (!currentPlan) return [];
          
          return currentPlan.activities
            .filter(activity => activity.day === day)
            .sort((a, b) => {
              const timeSlotOrder = {
                'early-morning': 0,
                'morning': 1,
                'afternoon': 2,
                'evening': 3,
                'night': 4,
              };
              return timeSlotOrder[a.timeSlot] - timeSlotOrder[b.timeSlot];
            });
        },
        
        getActivitiesForTimeSlot: (day: WeekendDay, timeSlot: TimeSlot) => {
          const { currentPlan } = get();
          if (!currentPlan) return [];
          
          return currentPlan.activities.filter(
            activity => activity.day === day && activity.timeSlot === timeSlot
          );
        },
        
        getPlanById: (planId: string) => {
          const { savedPlans } = get();
          return savedPlans.find(plan => plan.id === planId);
        },
        
        getTotalEstimatedCost: () => {
          const { currentPlan } = get();
          if (!currentPlan) return 0;
          
          return currentPlan.activities.reduce((total, scheduledActivity) => {
            const activity = activities.find(a => a.id === scheduledActivity.activityId);
            if (activity?.estimatedCost) {
              // Use average of min and max cost
              return total + (activity.estimatedCost.min + activity.estimatedCost.max) / 2;
            }
            
            // Fallback estimated costs based on activity category
            const estimatedCosts: Record<string, number> = {
              'food': 25,
              'outdoor': 15,
              'entertainment': 30,
              'wellness': 40,
              'culture': 20,
              'shopping': 50,
              'nightlife': 35,
              'sports': 25,
              'social': 20,
              'relaxation': 15,
              'learning': 35,
              'adventure': 40,
              'creative': 25,
            };
            
            // Extract category from activityId or use activity data
            const category = activity?.category || scheduledActivity.activityId.split('-')[0];
            return total + (estimatedCosts[category] || 20);
          }, 0);
        },
      }),
      {
        name: 'weekend-plan-storage',
        partialize: (state) => ({
          savedPlans: state.savedPlans,
          templates: state.templates,
          currentWeekend: state.currentWeekend,
        }),
      }
    )
  )
);
