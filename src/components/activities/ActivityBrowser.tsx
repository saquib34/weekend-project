import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ActivityCategory, WeekendMood } from '../../types';
import { useActivityStore } from '../../stores/activityStore';
import { categoryMetadata } from '../../data/activities';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

const ActivityBrowser: React.FC = () => {
  const {
    filteredActivities,
    filters,
    setFilters,
    searchActivities,
    filterByCategory,
    filterByMood,
    resetFilters,
  } = useActivityStore();

  const [searchQuery, setSearchQuery] = useState(filters.searchQuery);
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    searchActivities(query);
  };

  const moods: WeekendMood[] = [
    'energetic',
    'relaxed',
    'adventurous',
    'romantic',
    'social',
    'productive',
    'spontaneous',
    'peaceful',
  ];

  const costLevels = [
    { value: 'free', label: 'Free', icon: '🆓' },
    { value: 'low', label: 'Low Cost', icon: '💰' },
    { value: 'medium', label: 'Medium', icon: '💳' },
    { value: 'high', label: 'Premium', icon: '💎' },
  ] as const;

  const durations = [
    { value: 'short', label: 'Quick (1-2h)', icon: '⚡' },
    { value: 'medium', label: 'Medium (2-4h)', icon: '⏰' },
    { value: 'long', label: 'Long (4+ h)', icon: '🕰️' },
    { value: 'flexible', label: 'Flexible', icon: '🔄' },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Browse Activities
            </h2>
            <p className="text-gray-600 mt-1">
              {filteredActivities.length} activities available
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              }
            >
              Filters
            </Button>
            
            {(filters.categories.length > 0 || filters.moods.length > 0 || filters.searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-red-600 hover:text-red-700"
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search activities..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-b border-gray-200 overflow-hidden"
          >
            <div className="p-6 space-y-6">
              {/* Categories */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(categoryMetadata).map(([category, meta]) => (
                    <motion.button
                      key={category}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => filterByCategory(category as ActivityCategory)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        filters.categories.includes(category as ActivityCategory)
                          ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.name}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Moods */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Moods</h3>
                <div className="flex flex-wrap gap-2">
                  {moods.map((mood) => (
                    <motion.button
                      key={mood}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => filterByMood(mood)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm font-medium transition-all capitalize',
                        filters.moods.includes(mood)
                          ? 'bg-secondary-100 text-secondary-700 ring-2 ring-secondary-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {mood}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Duration</h3>
                <div className="flex flex-wrap gap-2">
                  {durations.map((duration) => (
                    <motion.button
                      key={duration.value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setFilters({
                        duration: filters.duration.includes(duration.value)
                          ? filters.duration.filter(d => d !== duration.value)
                          : [...filters.duration, duration.value]
                      })}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        filters.duration.includes(duration.value)
                          ? 'bg-green-100 text-green-700 ring-2 ring-green-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      <span>{duration.icon}</span>
                      <span>{duration.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Cost Level */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Cost Level</h3>
                <div className="flex flex-wrap gap-2">
                  {costLevels.map((cost) => (
                    <motion.button
                      key={cost.value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setFilters({
                        costLevel: filters.costLevel.includes(cost.value)
                          ? filters.costLevel.filter(c => c !== cost.value)
                          : [...filters.costLevel, cost.value]
                      })}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        filters.costLevel.includes(cost.value)
                          ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      <span>{cost.icon}</span>
                      <span>{cost.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activities Grid */}
      <div className="flex-1 overflow-auto p-6">
        {filteredActivities.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No activities found
            </h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your filters or search terms
            </p>
            <Button onClick={resetFilters} variant="outline">
              Clear Filters
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredActivities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="activity-card cursor-pointer"
                whileHover={{ y: -2 }}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{activity.icon}</span>
                    <div className="flex flex-wrap gap-1">
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
                  
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {activity.title}
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {activity.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="capitalize">{activity.duration}</span>
                    <span className="capitalize">{activity.costLevel}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export { ActivityBrowser };

