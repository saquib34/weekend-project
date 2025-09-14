import React, { useState, useEffect } from 'react';
import { holidayService } from '../services/holidayService';
import type { LongWeekendOpportunity } from '../services/holidayService';

interface LongWeekendSuggestionsProps {
  onSelectWeekend?: (opportunity: LongWeekendOpportunity) => void;
  className?: string;
}

export const LongWeekendSuggestions: React.FC<LongWeekendSuggestionsProps> = ({
  onSelectWeekend,
  className = ''
}) => {
  const [opportunities, setOpportunities] = useState<LongWeekendOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<string>('');

  useEffect(() => {
    loadLongWeekends();
  }, []);

  const loadLongWeekends = async () => {
    try {
      setLoading(true);
      
      // Get user location
      const location = holidayService.getCurrentLocation();
      setUserLocation(location?.country || 'Your location');
      
      // Get upcoming long weekends
      const weekends = await holidayService.getUpcomingLongWeekends(6);
      setOpportunities(weekends);
    } catch (error) {
      console.error('Failed to load long weekends:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getPriorityIcon = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return '📈';
      case 'medium': return '⭐';
      case 'low': return '🕒';
    }
  };

  const formatDateRange = (start: Date, end: Date) => {
    const startStr = start.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
    const endStr = end.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
    return `${startStr} - ${endStr}`;
  };

  const getWeekendTypeLabel = (type: 'long' | 'extended') => {
    return type === 'long' ? '3-Day Weekend' : '4+ Day Weekend';
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg p-6 shadow-sm border ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/2"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className={`bg-white rounded-lg p-6 shadow-sm border ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">📅</span>
          <h3 className="font-semibold text-gray-900">Long Weekend Opportunities</h3>
        </div>
        <div className="text-center py-8">
          <span className="text-4xl block mb-3">📅</span>
          <p className="text-gray-500 mb-2">No long weekends found</p>
          <p className="text-sm text-gray-400">
            Check back later or try refreshing your location
          </p>
          <button
            onClick={loadLongWeekends}
            className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg p-6 shadow-sm border ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">📅</span>
          <h3 className="font-semibold text-gray-900">Long Weekend Opportunities</h3>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <span>📍</span>
          <span>{userLocation}</span>
        </div>
      </div>

      <div className="space-y-3">
        {opportunities.slice(0, 5).map((opportunity) => (
          <div
            key={opportunity.id}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => onSelectWeekend?.(opportunity)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-gray-900 group-hover:text-blue-600">
                    {opportunity.title}
                  </h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(opportunity.priority)}`}>
                    <div className="flex items-center gap-1">
                      <span>{getPriorityIcon(opportunity.priority)}</span>
                      {opportunity.priority}
                    </div>
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                  <div className="flex items-center gap-1">
                    <span>📅</span>
                    <span>{formatDateRange(opportunity.startDate, opportunity.endDate)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>🕒</span>
                    <span>{opportunity.totalDays} days</span>
                  </div>
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                    {getWeekendTypeLabel(opportunity.weekendType)}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-2">
                  {opportunity.description}
                </p>

                {opportunity.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {opportunity.suggestions.slice(0, 2).map((suggestion, index) => (
                      <span 
                        key={index}
                        className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                      >
                        {suggestion}
                      </span>
                    ))}
                    {opportunity.suggestions.length > 2 && (
                      <span className="text-xs text-gray-500">
                        +{opportunity.suggestions.length - 2} more
                      </span>
                    )}
                  </div>
                )}

                {opportunity.daysUntil <= 14 && (
                  <div className="mt-2 text-xs text-orange-600 font-medium">
                    Only {opportunity.daysUntil} days away!
                  </div>
                )}
              </div>

              <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-gray-400">→</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {opportunities.length > 5 && (
        <div className="mt-4 text-center">
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View All Long Weekends ({opportunities.length})
          </button>
        </div>
      )}

      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Holidays powered by Abstract API
          </span>
          <button
            onClick={loadLongWeekends}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

