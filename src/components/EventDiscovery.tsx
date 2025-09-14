import React, { useState, useEffect } from 'react';
import { smartEventDiscovery } from '../services/smartEventDiscovery';
import type { DiscoveredEvent, EventCategory, EventDiscoveryOptions } from '../services/smartEventDiscovery';

interface EventDiscoveryProps {
  location?: {
    city: string;
    coordinates: { lat: number; lng: number };
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  onSelectEvent?: (event: DiscoveredEvent) => void;
  className?: string;
}

export const EventDiscovery: React.FC<EventDiscoveryProps> = ({
  location = {
    city: 'Your City',
    coordinates: { lat: 40.7128, lng: -74.0060 }
  },
  dateRange = {
    start: new Date(),
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next week
  },
  onSelectEvent,
  className = ''
}) => {
  const [events, setEvents] = useState<DiscoveredEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const availableCategories: EventCategory[] = [
    'music', 'arts', 'food', 'sports', 'outdoor', 'culture', 
    'family', 'nightlife', 'festival', 'workshop'
  ];

  useEffect(() => {
    loadEvents();
  }, [location, dateRange, selectedCategories]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      
      const options: EventDiscoveryOptions = {
        location: {
          ...location,
          radius: 25 // 25km radius
        },
        dateRange,
        categories: selectedCategories,
        audience: 'all',
        timePreference: 'any'
      };

      const discoveredEvents = await smartEventDiscovery.discoverEvents(options);
      setEvents(discoveredEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (category: EventCategory) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const getCategoryEmoji = (category: EventCategory): string => {
    const emojiMap: Record<EventCategory, string> = {
      music: '🎵', arts: '🎨', food: '🍽️', sports: '⚽', outdoor: '🏞️',
      culture: '🏛️', family: '👨‍👩‍👧‍👦', nightlife: '🌃', festival: '🎪', workshop: '🔧',
      technology: '💻', business: '💼', wellness: '🧘', education: '📚',
      shopping: '🛍️', community: '🤝', exhibition: '🖼️', theater: '🎭',
      comedy: '😂', dance: '💃', literature: '📖', photography: '📸',
      fitness: '💪', networking: '🤝', charity: '❤️', religious: '⛪', seasonal: '🎃'
    };
    return emojiMap[category] || '📅';
  };

  const formatEventTime = (event: DiscoveredEvent): string => {
    const date = event.date.toLocaleDateString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    return `${date} at ${event.startTime}`;
  };

  const getRelevanceColor = (score: number): string => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg p-6 shadow-sm border ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/2"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg p-6 shadow-sm border ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎯</span>
          <h3 className="font-semibold text-gray-900">Discover Events</h3>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Event Categories</h4>
          <div className="flex flex-wrap gap-2">
            {availableCategories.map(category => (
              <button
                key={category}
                onClick={() => handleCategoryToggle(category)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  selectedCategories.includes(category)
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="mr-1">{getCategoryEmoji(category)}</span>
                {category}
              </button>
            ))}
          </div>
          {selectedCategories.length > 0 && (
            <button
              onClick={() => setSelectedCategories([])}
              className="mt-3 text-xs text-gray-500 hover:text-gray-700"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      <div className="text-sm text-gray-600 mb-4">
        <span>📍 {location.city}</span>
        <span className="mx-2">•</span>
        <span>📅 {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}</span>
        <span className="mx-2">•</span>
        <span>{events.length} events found</span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-4xl block mb-3">🔍</span>
          <p className="text-gray-500 mb-2">No events found</p>
          <p className="text-sm text-gray-400">
            Try adjusting your filters or expanding your search area
          </p>
          <button
            onClick={() => setSelectedCategories([])}
            className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {events.slice(0, 5).map((event) => (
            <div
              key={event.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => onSelectEvent?.(event)}
            >
              <div className="flex items-start gap-4">
                {event.images.length > 0 && (
                  <img
                    src={event.images[0]}
                    alt={event.title}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 group-hover:text-blue-600 line-clamp-2">
                      {event.title}
                    </h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRelevanceColor(event.relevanceScore)}`}>
                      {event.relevanceScore}% match
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <span>{getCategoryEmoji(event.category)} {event.category}</span>
                    <span>🕒 {formatEventTime(event)}</span>
                    <span>📍 {event.location.name}</span>
                  </div>

                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {event.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">
                        {event.price.isFree ? 'Free' : `${event.price.priceRange || `$${event.price.amount}`}`}
                      </span>
                      <span className="text-xs text-gray-500">
                        by {event.organizer.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {event.tags.slice(0, 2).map((tag, index) => (
                        <span 
                          key={index}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {event.tags.length > 2 && (
                        <span className="text-xs text-gray-500">
                          +{event.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {events.length > 5 && (
        <div className="mt-4 text-center">
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View All Events ({events.length})
          </button>
        </div>
      )}

      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Events from {smartEventDiscovery.getActiveSources().map(s => s.name).join(', ')}
          </span>
          <button
            onClick={loadEvents}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};
