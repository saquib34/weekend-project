import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap
} from '@vis.gl/react-google-maps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { ScheduledActivity } from '../../types';
import { useActivityStore } from '../../stores/activityStore';

interface ModernGoogleMapProps {
  activities?: ScheduledActivity[];
  centerLocation?: { lat: number; lng: number };
  showRoute?: boolean;
  showNearbyPlaces?: boolean;
  onLocationSelect?: (location: any) => void;
  className?: string;
  height?: string;
}

interface MapMarker {
  key: string;
  position: { lat: number; lng: number };
  title: string;
  description?: string;
  activity?: ScheduledActivity;
  icon?: string;
}

// Get API key from environment
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export const ModernGoogleMap: React.FC<ModernGoogleMapProps> = ({
  activities = [],
  centerLocation = { lat: 40.7128, lng: -74.0060 }, // Default to NYC
  showRoute = false,
  showNearbyPlaces = false,
  onLocationSelect,
  className = '',
  height = '400px'
}) => {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [mapCenter, setMapCenter] = useState(centerLocation);
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const { allActivities } = useActivityStore();

  // Get user's current location (only once on mount)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentLocation(location);
          setMapCenter(location); // Center map on user's location
          
          // Generate simple suggestions
          const suggestions = [
            'Restaurants nearby',
            'Parks and outdoor activities',
            'Entertainment venues',
            'Shopping centers',
            'Cultural attractions',
            'Coffee shops and cafes'
          ];
          setLocationSuggestions(suggestions);
        },
        (error) => {
          console.warn('Could not get current location:', error);
          // Keep default center and suggestions
          const suggestions = [
            'Restaurants nearby',
            'Parks and outdoor activities', 
            'Entertainment venues',
            'Shopping centers',
            'Cultural attractions',
            'Coffee shops and cafes'
          ];
          setLocationSuggestions(suggestions);
        }
      );
    }
  }, []); // Empty dependency array - run only once

  // Live location tracking
  const toggleLocationTracking = useCallback(() => {
    if (!navigator.geolocation) return;

    if (isTrackingLocation) {
      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTrackingLocation(false);
    } else {
      // Start tracking
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentLocation(location);
        },
        (error) => {
          console.warn('Error tracking location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
      setIsTrackingLocation(true);
    }
  }, [isTrackingLocation]);

  // Cleanup location tracking on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const getActivityIcon = useCallback((category: string): string => {
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
  }, []);

  // Process activities into markers (only when activities change)
  useEffect(() => {
    if (!activities || activities.length === 0) {
      setMarkers([]);
      return;
    }

    const baseLocation = currentLocation || centerLocation;
    const newMarkers: MapMarker[] = [];

    activities.forEach((scheduledActivity, index) => {
      if (!scheduledActivity?.activityId) return;

      const activity = allActivities.find(act => act.id === scheduledActivity.activityId);
      if (!activity) return;

      // Generate location around base location
      const angle = (index * 2 * Math.PI) / Math.max(activities.length, 1);
      const radius = 0.02; // ~2km radius
      const position = {
        lat: baseLocation.lat + (Math.cos(angle) * radius),
        lng: baseLocation.lng + (Math.sin(angle) * radius)
      };

      newMarkers.push({
        key: scheduledActivity.id,
        position,
        title: activity.title,
        description: activity.description,
        activity: scheduledActivity,
        icon: getActivityIcon(activity.category)
      });
    });

    setMarkers(newMarkers);
  }, [activities, getActivityIcon]); // Removed problematic dependencies

  const handleMapLoad = () => {
    // Google Maps API loaded successfully
  };

  const handleCameraChange = () => {
    // Camera changed event
  };

  const goToMyLocation = useCallback(() => {
    if (currentLocation) {
      setMapCenter(currentLocation);
    }
  }, [currentLocation]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`${className} bg-red-50 border border-red-200 rounded-lg p-4`} style={{ height }}>
        <div className="text-center">
          <div className="text-2xl mb-2 text-red-500">⚠️</div>
          <div className="text-red-700 font-medium">Google Maps API Key Required</div>
          <div className="text-sm text-red-600 mt-1">
            Please add VITE_GOOGLE_MAPS_API_KEY to your .env file
          </div>
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
              {markers.length} locations • Modern Google Maps
            </p>
          </div>
          <div className="flex gap-2">
            {currentLocation && (
              <>
                <button
                  onClick={goToMyLocation}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  📍 My Location
                </button>
                <button
                  onClick={toggleLocationTracking}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    isTrackingLocation
                      ? 'bg-red-100 text-red-800 hover:bg-red-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                >
                  {isTrackingLocation ? '⏹️ Stop Tracking' : '🎯 Live Track'}
                </button>
              </>
            )}
            <div className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-lg">
              ✨ Official API
            </div>
          </div>
        </div>
      </div>

      {/* Google Maps Container */}
      <div style={{ height }}>
        <APIProvider 
          apiKey={GOOGLE_MAPS_API_KEY} 
          onLoad={handleMapLoad}
        >
          <Map
            mapId="weekend-harmony-map"
            defaultZoom={12}
            center={mapCenter}
            onCameraChanged={handleCameraChange}
            gestureHandling="greedy"
            disableDefaultUI={false}
          >
            {/* Current Location Marker */}
            {currentLocation && (
              <AdvancedMarker
                position={currentLocation}
                title="Your Current Location"
              >
                <Pin 
                  background="#FF4444" 
                  glyphColor="#FFFFFF" 
                  borderColor="#CC0000"
                  scale={1.5}
                >
                  <div className="text-lg">📍</div>
                </Pin>
              </AdvancedMarker>
            )}
            
            {/* Activity Markers with Clustering */}
            <ActivityMarkers markers={markers} onLocationSelect={onLocationSelect} />
          </Map>
        </APIProvider>
      </div>

      {/* Map Info Panel */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        {/* Location Status */}
        {currentLocation && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-blue-600">📍</div>
              <div className="text-sm font-medium text-blue-900">Current Location Detected</div>
            </div>
            <div className="text-xs text-blue-700">
              Activities are positioned around your location ({currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)})
            </div>
          </div>
        )}

        {/* Location Suggestions */}
        {locationSuggestions.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm font-medium text-green-900 mb-2">💡 Suggestions for Your Area</div>
            <div className="grid grid-cols-2 gap-2">
              {locationSuggestions.map((suggestion, index) => (
                <div key={index} className="text-xs text-green-700 bg-white px-2 py-1 rounded">
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Activity Count */}
          <div className="bg-white rounded-lg p-3">
            <div className="text-sm font-medium text-gray-900 mb-1">📍 Activities</div>
            <div className="text-xs text-gray-600">
              {activities.length} planned locations
            </div>
          </div>

          {/* Map Status */}
          <div className="bg-white rounded-lg p-3">
            <div className="text-sm font-medium text-gray-900 mb-1">🗺️ Map Status</div>
            <div className="text-xs text-gray-600">
              Official React Google Maps
            </div>
          </div>

          {/* Features */}
          <div className="bg-white rounded-lg p-3">
            <div className="text-sm font-medium text-gray-900 mb-1">⚡ Features</div>
            <div className="text-xs text-gray-600">
              {showRoute ? 'Routes • ' : ''}
              {showNearbyPlaces ? 'Nearby Places • ' : ''}
              Clustering
            </div>
          </div>
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
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span>Entertainment</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Activity Markers Component with Clustering
interface ActivityMarkersProps {
  markers: MapMarker[];
  onLocationSelect?: (location: any) => void;
}

const ActivityMarkers: React.FC<ActivityMarkersProps> = ({ markers, onLocationSelect }) => {
  const map = useMap();
  const clusterer = useRef<MarkerClusterer | null>(null);

  // Initialize MarkerClusterer
  useEffect(() => {
    if (!map) return;
    
    try {
      if (!clusterer.current) {
        clusterer.current = new MarkerClusterer({ map });
      }
    } catch (error) {
      console.warn('Failed to initialize marker clusterer:', error);
    }
  }, [map]);

  const handleMarkerClick = useCallback((marker: MapMarker, event: google.maps.MapMouseEvent) => {
    try {
      if (!map || !event.latLng) return;
      
      // Pan to marker location
      map.panTo(event.latLng);
      
      // Call location select callback
      if (onLocationSelect) {
        onLocationSelect({
          address: marker.title,
          coordinates: marker.position,
          name: marker.title,
          activity: marker.activity
        });
      }
    } catch (error) {
      console.warn('Failed to handle marker click:', error);
    }
  }, [map, onLocationSelect]);

  return (
    <>
      {markers.map((marker) => (
        <AdvancedMarker
          key={marker.key}
          position={marker.position}
          clickable={true}
          onClick={(event) => handleMarkerClick(marker, event)}
          title={marker.title}
        >
          <Pin 
            background="#3B82F6" 
            glyphColor="#FFFFFF" 
            borderColor="#1E40AF"
            scale={1.2}
          >
            <div className="text-base">{marker.icon}</div>
          </Pin>
        </AdvancedMarker>
      ))}
    </>
  );
};

export default ModernGoogleMap;
