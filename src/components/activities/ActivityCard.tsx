import React from 'react';
import { motion } from 'framer-motion';
import { Draggable } from 'react-beautiful-dnd';
import type { Activity } from '../../types';
import { useActivityStore } from '../../stores/activityStore';
import { cn } from '../../utils/cn';

interface ActivityCardProps {
  activity: Activity;
  index?: number;
  isDraggable?: boolean;
  isSelected?: boolean;
  onSelect?: (activity: Activity) => void;
  className?: string;
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  index = 0,
  isDraggable = true,
  isSelected = false,
  onSelect,
  className,
}) => {
  const { toggleFavoriteActivity, favoriteActivities } = useActivityStore();
  const isFavorite = favoriteActivities.includes(activity.id);

  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'activity-card group relative overflow-hidden',
        isSelected && 'ring-2 ring-primary-500 ring-offset-2',
        className
      )}
      onClick={() => onSelect?.(activity)}
    >
      {/* Background gradient based on category */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-gray-50 opacity-90" />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl" role="img" aria-label={activity.category}>
              {activity.icon}
            </span>
            <div className="flex items-center gap-1">
              {activity.mood.slice(0, 2).map((mood) => (
                <span
                  key={mood}
                  className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-full"
                >
                  {mood}
                </span>
              ))}
            </div>
          </div>
          
          {/* Favorite button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteActivity(activity.id);
            }}
            className={cn(
              'p-1 rounded-full transition-colors',
              isFavorite 
                ? 'text-red-500 hover:text-red-600' 
                : 'text-gray-400 hover:text-red-500'
            )}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <svg
              className="w-5 h-5"
              fill={isFavorite ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </motion.button>
        </div>

        {/* Title and Description */}
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
            {activity.title}
          </h3>
          <p className="text-sm text-gray-600 line-clamp-2">
            {activity.description}
          </p>
        </div>

        {/* Activity Details */}
        <div className="space-y-2">
          {/* Duration and Cost */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <span>⏱️</span>
              <span className="capitalize">{activity.duration}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>💰</span>
              <span className="capitalize">{activity.costLevel}</span>
            </div>
          </div>

          {/* Time slots */}
          <div className="flex flex-wrap gap-1">
            {activity.timeSlot.slice(0, 3).map((slot) => (
              <span
                key={slot}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md"
              >
                {slot.replace('-', ' ')}
              </span>
            ))}
            {activity.timeSlot.length > 3 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md">
                +{activity.timeSlot.length - 3} more
              </span>
            )}
          </div>

          {/* Tags */}
          {activity.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {activity.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs bg-secondary-100 text-secondary-700 rounded-md"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Estimated Cost */}
          {activity.estimatedCost && (
            <div className="text-xs text-gray-500">
              ${activity.estimatedCost.min}-${activity.estimatedCost.max}
            </div>
          )}
        </div>

        {/* Drag handle for draggable cards */}
        {isDraggable && (
          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8h16M4 16h16"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-primary-500 opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none" />
    </motion.div>
  );

  if (isDraggable) {
    return (
      <Draggable draggableId={activity.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={cn(
              snapshot.isDragging && 'rotate-3 scale-105 shadow-2xl z-50',
              'transition-all duration-200'
            )}
          >
            {cardContent}
          </div>
        )}
      </Draggable>
    );
  }

  return cardContent;
};

export { ActivityCard };
