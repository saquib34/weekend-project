import React, { useState, useEffect, useRef } from 'react';
import { useActivityStore } from '../../stores/activityStore';
import type { ScheduledActivity } from '../../types';
import type { Location, DirectionsResult, NearbyPlace } from '../../services/locationMappingService';

interface InteractiveMapProps {
  activities?: ScheduledActivity[];
  centerLocation?: { lat: number; lng: number };
  showRoute?: boolean;
  showNearbyPlaces?: boolean;
  onLocationSelect?: (location: Location) => void;
  className?: string;
  height?: string;
}

interface MapMarker {
  id: string;
  location: { lat: number; lng: number };
  activity?: ScheduledActivity;
  type: 'activity' | 'nearby' | 'route';
  icon: string;
  title: string;
  description?: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  activities = [],
  centerLocation,
  showRoute = false,
  showNearbyPlaces = false,
  onLocationSelect,
  className = '',
  height = '400px'
}) => {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [routeInfo, setRouteInfo] = useState<DirectionsResult | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const { getActivityById } = useActivityStore();

  useEffect(() => {
    initializeMap();
  }, [activities, centerLocation, showRoute, showNearbyPlaces]);

  const initializeMap = async () => {
    setLoading(true);
    try {
      // Process activities to get locations
      const activityMarkers = await processActivities();
      setMarkers(activityMarkers);

      // Get route if multiple activities
      if (showRoute && activityMarkers.length > 1) {
        await generateRoute(activityMarkers);
      }

      // Get nearby places if requested
      if (showNearbyPlaces && activityMarkers.length > 0) {
        await loadNearbyPlaces(activityMarkers[0].location);
      }
    } catch (error) {
      console.error('Failed to initialize map:', error);
    } finally {
      setLoading(false);
    }
  };

  const processActivities = async (): Promise<MapMarker[]> => {
    const markers: MapMarker[] = [];
    
    for (const scheduledActivity of activities) {
      try {
        // Get the actual activity data
        const activity = getActivityById(scheduledActivity.activityId);
        if (!activity) continue;

        let location: { lat: number; lng: number };
        
        // Use a mock location based on activity type for demonstration
        location = getMockLocation(activity.category, markers.length);

        const marker: MapMarker = {
          id: scheduledActivity.id,
          location,
          activity: scheduledActivity,
          type: 'activity',
          icon: getActivityIcon(activity.category),
          title: activity.title,
          description: activity.description
        };

        markers.push(marker);
      } catch (error) {
        console.warn(`Failed to process activity: ${scheduledActivity.activityId}`, error);
      }
    }

    return markers;
  };

  const getMockLocation = (_category: string, index: number): { lat: number; lng: number } => {
    // Generate mock coordinates for demonstration
    const baseLatitude = 40.7128 + (Math.random() - 0.5) * 0.02;
    const baseLongitude = -74.0060 + (Math.random() - 0.5) * 0.02;
    
    return {
      lat: baseLatitude + index * 0.001,
      lng: baseLongitude + index * 0.001
    };
  };

  const generateRoute = async (activityMarkers: MapMarker[]) => {
    if (activityMarkers.length < 2) return;

    try {
      // Create mock route info for demonstration
      const mockRoute: DirectionsResult = {
        distance: `${(activityMarkers.length * 2.5).toFixed(1)} km`,
        duration: `${activityMarkers.length * 15} min`,
        route: {
          steps: [],
          bounds: {
            northeast: { lat: 40.720, lng: -74.000 },
            southwest: { lat: 40.705, lng: -74.015 }
          }
        }
      };
      setRouteInfo(mockRoute);
    } catch (error) {
      console.error('Failed to generate route:', error);
    }
  };

  const loadNearbyPlaces = async (center: { lat: number; lng: number }) => {
    try {
      // Create mock nearby places for demonstration
      const mockPlaces: NearbyPlace[] = [
        {
          placeId: 'mock-1',
          name: 'Central Cafe',
          address: '123 Main St',
          coordinates: { lat: center.lat + 0.001, lng: center.lng + 0.001 },
          rating: 4.5,
          priceLevel: 2,
          types: ['restaurant', 'cafe'],
          distance: 150,
          openNow: true,
          photos: []
        },
        {
          placeId: 'mock-2',
          name: 'Corner Bistro',
          address: '456 Oak Ave',
          coordinates: { lat: center.lat - 0.001, lng: center.lng + 0.002 },
          rating: 4.2,
          priceLevel: 3,
          types: ['restaurant'],
          distance: 300,
          openNow: true,
          photos: []
        }
      ];
      
      setNearbyPlaces(mockPlaces);
      
      // Add nearby places as markers
      const nearbyMarkers: MapMarker[] = mockPlaces.slice(0, 5).map(place => ({
        id: `nearby-${place.placeId}`,
        location: place.coordinates,
        type: 'nearby' as const,
        icon: '🍽️',
        title: place.name,
        description: `Rating: ${place.rating}/5 • ${place.address}`
      }));

      setMarkers(prev => [...prev.filter(m => m.type !== 'nearby'), ...nearbyMarkers]);
    } catch (error) {
      console.error('Failed to load nearby places:', error);
    }
  };

  const getActivityIcon = (category: string): string => {
    const iconMap: Record<string, string> = {
      'outdoor': '🏞️',
      'food': '🍽️',
      'entertainment': '🎬',
      'culture': '🎭',
      'sports': '⚽',
      'shopping': '🛍️',
      'relaxation': '🧘',
      'social': '👥',
      'adventure': '🎯',
      'educational': '📚',
      'family': '👨‍👩‍👧‍👦',
      'nightlife': '🌙'
    };
    return iconMap[category] || '📍';
  };

  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedMarker(marker);
    if (onLocationSelect) {
      // Create a proper Location object
      const locationObj: Location = {
        address: marker.title,
        coordinates: marker.location,
        name: marker.title
      };
      onLocationSelect(locationObj);
    }
  };

  const formatDuration = (duration: string): string => {
    // If it's already a formatted string, return as is
    if (typeof duration === 'string' && duration.includes('min')) {
      return duration;
    }
    // Otherwise assume it's seconds and format
    const seconds = parseInt(duration);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatDistance = (distance: string): string => {
    // If it's already a formatted string, return as is
    if (typeof distance === 'string' && (distance.includes('km') || distance.includes('m'))) {
      return distance;
    }
    // Otherwise assume it's meters and format
    const meters = parseInt(distance);
    const km = meters / 1000;
    return km >= 1 ? `${km.toFixed(1)} km` : `${meters}m`;
  };

  if (loading) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center`} style={{ height }}>
        <div className="text-center">
          <div className="text-2xl mb-2">🗺️</div>
          <div className="text-gray-600">Loading map...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} bg-white rounded-lg overflow-hidden border border-gray-200`}>
      {/* Map Header */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Weekend Map</h3>
            <p className="text-sm text-gray-600">
              {markers.length} locations • {routeInfo && `${formatDistance(routeInfo.distance)} route`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => initializeMap()}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Simulated Map Display */}
      <div 
        ref={mapRef}
        className="relative bg-gradient-to-br from-green-100 to-blue-100"
        style={{ height }}
      >
        {/* Map Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <svg width="100%" height="100%" className="w-full h-full">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#000" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Route Path */}
        {routeInfo && (
          <div className="absolute inset-4">
            <svg className="w-full h-full">
              <path
                d={`M 20 20 Q 50 10 80 20 Q 110 30 140 20`}
                stroke="#3B82F6"
                strokeWidth="3"
                fill="none"
                strokeDasharray="5,5"
                className="animate-pulse"
              />
            </svg>
          </div>
        )}

        {/* Activity Markers */}
        {markers.map((marker, index) => (
          <button
            key={marker.id}
            onClick={() => handleMarkerClick(marker)}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
              selectedMarker?.id === marker.id 
                ? 'scale-125 z-20' 
                : 'hover:scale-110 z-10'
            } transition-transform`}
            style={{
              left: `${20 + (index * 15) % 60}%`,
              top: `${20 + (index * 20) % 60}%`,
            }}
          >
            <div className={`relative ${
              marker.type === 'activity' 
                ? 'bg-blue-500 text-white' 
                : marker.type === 'nearby'
                ? 'bg-green-500 text-white'
                : 'bg-purple-500 text-white'
            } rounded-full w-10 h-10 flex items-center justify-center shadow-lg border-2 border-white`}>
              <span className="text-lg">{marker.icon}</span>
              {selectedMarker?.id === marker.id && (
                <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-2 min-w-48 z-30">
                  <div className="text-sm font-medium text-gray-900">{marker.title}</div>
                  {marker.description && (
                    <div className="text-xs text-gray-600 mt-1">{marker.description}</div>
                  )}
                  {marker.activity && (
                    <div className="text-xs text-blue-600 mt-1">
                      {marker.activity.timeSlot} • {marker.activity.day}
                    </div>
                  )}
                </div>
              )}
            </div>
          </button>
        ))}

        {/* Map Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button className="w-8 h-8 bg-white rounded shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-50">
            ➕
          </button>
          <button className="w-8 h-8 bg-white rounded shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-50">
            ➖
          </button>
        </div>
      </div>

      {/* Map Info Panel */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Route Info */}
          {routeInfo && (
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm font-medium text-gray-900 mb-1">🚗 Route</div>
              <div className="text-xs text-gray-600">
                {formatDistance(routeInfo.distance)} • {formatDuration(routeInfo.duration)}
              </div>
            </div>
          )}

          {/* Activity Count */}
          <div className="bg-white rounded-lg p-3">
            <div className="text-sm font-medium text-gray-900 mb-1">📍 Activities</div>
            <div className="text-xs text-gray-600">
              {activities.length} planned locations
            </div>
          </div>

          {/* Nearby Places */}
          {nearbyPlaces.length > 0 && (
            <div className="bg-white rounded-lg p-3">
              <div className="text-sm font-medium text-gray-900 mb-1">🍽️ Nearby</div>
              <div className="text-xs text-gray-600">
                {nearbyPlaces.length} restaurants found
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Activities</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Restaurants</span>
          </div>
          {routeInfo && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-1 bg-blue-400"></div>
              <span>Route</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractiveMap;
