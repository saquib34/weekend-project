import React, { useEffect, useRef, useState } from 'react';
import type { ScheduledActivity } from '../../types';
import { useActivityStore } from '../../stores/activityStore';
import { googleMapsLoader } from '../../utils/googleMapsLoader';

interface GoogleMapComponentProps {
  activities?: ScheduledActivity[];
  centerLocation?: { lat: number; lng: number };
  showRoute?: boolean;
  showNearbyPlaces?: boolean;
  onLocationSelect?: (location: any) => void;
  className?: string;
  height?: string;
}

interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  title: string;
  description?: string;
  type: 'activity' | 'nearby' | 'route';
  icon?: string;
  activity?: ScheduledActivity;
}

declare global {
  interface Window {
    google?: any;
    initMap?: () => void;
  }
}

export const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({
  activities = [],
  centerLocation = { lat: 40.7128, lng: -74.0060 }, // Default to NYC
  showRoute = false,
  showNearbyPlaces = false,
  onLocationSelect,
  className = '',
  height = '400px'
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const directionsRendererRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const { getActivityById } = useActivityStore();

  useEffect(() => {
    loadGoogleMaps();
  }, []);

  useEffect(() => {
    if (isLoaded && googleMapRef.current) {
      updateMap();
    }
  }, [activities, centerLocation, showRoute, showNearbyPlaces, isLoaded]);

  // Additional effect to handle DOM readiness
  useEffect(() => {
    if (mapRef.current && window.google && window.google.maps && !googleMapRef.current) {
      console.log('DOM and Google Maps ready, but map not initialized. Retrying...');
      setTimeout(() => {
        initializeMap();
      }, 100);
    }
  }, [mapRef.current, isLoaded]);

  const loadGoogleMaps = async () => {
    try {
      console.log('Loading Google Maps...');
      await googleMapsLoader.load();
      console.log('Google Maps loaded, waiting for DOM...');
      
      // Wait a bit to ensure DOM is ready
      setTimeout(() => {
        initializeMap();
      }, 50);
    } catch (err) {
      console.error('Failed to load Google Maps:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Google Maps');
    }
  };

  const initializeMap = () => {
    console.log('Initializing map, mapRef.current:', mapRef.current);
    
    if (!mapRef.current) {
      console.error('Map container not found');
      // Retry after a short delay
      setTimeout(() => {
        if (mapRef.current) {
          initializeMap();
        } else {
          setError('Map container not found');
        }
      }, 100);
      return;
    }
    
    if (!window.google) {
      setError('Google Maps API not loaded');
      return;
    }

    if (!window.google.maps) {
      setError('Google Maps API not ready');
      return;
    }

    try {
      console.log('Creating Google Map with center:', centerLocation);
      
      // Create the map
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: centerLocation,
        zoom: 12,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            "featureType": "poi",
            "elementType": "labels",
            "stylers": [{ "visibility": "on" }]
          }
        ]
      });

      // Create directions renderer for routes
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#3B82F6',
          strokeWeight: 4,
          strokeOpacity: 0.8
        }
      });
      directionsRendererRef.current.setMap(googleMapRef.current);

      console.log('Map initialized successfully');
      setIsLoaded(true);
      setError(null);
    } catch (err) {
      console.error('Map initialization error:', err);
      setError('Failed to initialize Google Maps');
    }
  };

  const updateMap = async () => {
    if (!googleMapRef.current || !window.google) return;

    try {
      // Clear existing markers
      clearMarkers();

      // Process activities and create markers
      const activityMarkers = await createActivityMarkers();
      setMarkers(activityMarkers);

      // Add markers to map
      addMarkersToMap(activityMarkers);

      // Show route if requested and multiple activities
      if (showRoute && activityMarkers.length > 1) {
        await showDirections(activityMarkers);
      }

      // Show nearby places if requested
      if (showNearbyPlaces && activityMarkers.length > 0) {
        await addNearbyPlaces(activityMarkers[0].position);
      }

      // Adjust map bounds to fit all markers
      if (activityMarkers.length > 0) {
        adjustMapBounds(activityMarkers);
      }
    } catch (err) {
      console.error('Error updating map:', err);
    }
  };

  const createActivityMarkers = async (): Promise<MapMarker[]> => {
    const markers: MapMarker[] = [];

    for (let i = 0; i < activities.length; i++) {
      const scheduledActivity = activities[i];
      const activity = getActivityById(scheduledActivity.activityId);
      
      if (!activity) continue;

      try {
        // Try to get real location for the activity
        let location = await getActivityLocation(activity.title, activity.category);
        
        // Fallback to mock location if real location not found
        if (!location) {
          location = generateMockLocation(activity.category, i);
        }

        const marker: MapMarker = {
          id: scheduledActivity.id,
          position: location,
          title: activity.title,
          description: activity.description,
          type: 'activity',
          activity: scheduledActivity,
          icon: getActivityIcon(activity.category)
        };

        markers.push(marker);
      } catch (error) {
        console.warn(`Failed to get location for activity: ${activity.title}`, error);
        
        // Use mock location as fallback
        const mockLocation = generateMockLocation(activity.category, i);
        markers.push({
          id: scheduledActivity.id,
          position: mockLocation,
          title: activity.title,
          description: activity.description,
          type: 'activity',
          activity: scheduledActivity,
          icon: getActivityIcon(activity.category)
        });
      }
    }

    return markers;
  };

  const getActivityLocation = async (activityName: string, category: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      // Use Google Places API to find real locations
      const service = new window.google.maps.places.PlacesService(googleMapRef.current);
      
      return new Promise((resolve) => {
        const request = {
          query: `${activityName} ${category} ${getCurrentCity()}`,
          fields: ['geometry', 'name', 'place_id']
        };

        service.textSearch(request, (results: any[], status: any) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
            const place = results[0];
            resolve({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            });
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('Error searching for activity location:', error);
      return null;
    }
  };

  const getCurrentCity = (): string => {
    // Try to get user's current city, fallback to default
    return 'New York'; // You can enhance this to detect user's actual location
  };

  const generateMockLocation = (_category: string, index: number): { lat: number; lng: number } => {
    // Generate locations around the center point
    const baseRadius = 0.02; // ~2km radius
    const angle = (index * 2 * Math.PI) / Math.max(activities.length, 1);
    
    return {
      lat: centerLocation.lat + (Math.cos(angle) * baseRadius),
      lng: centerLocation.lng + (Math.sin(angle) * baseRadius)
    };
  };

  const addMarkersToMap = (markers: MapMarker[]) => {
    markers.forEach(markerData => {
      const marker = new window.google.maps.Marker({
        position: markerData.position,
        map: googleMapRef.current,
        title: markerData.title,
        icon: {
          url: `data:image/svg+xml,${encodeURIComponent(createMarkerSVG(markerData.icon || '📍', getMarkerColor(markerData.type)))}`,
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 40)
        }
      });

      // Create info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 250px;">
            <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">${markerData.title}</h3>
            ${markerData.description ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">${markerData.description}</p>` : ''}
            ${markerData.activity ? `
              <div style="font-size: 12px; color: #3B82F6;">
                📅 ${markerData.activity.day} • ⏰ ${markerData.activity.timeSlot}
              </div>
            ` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(googleMapRef.current, marker);
        if (onLocationSelect) {
          onLocationSelect({
            address: markerData.title,
            coordinates: markerData.position,
            name: markerData.title
          });
        }
      });

      markersRef.current.push(marker);
    });
  };

  const createMarkerSVG = (icon: string, color: string): string => {
    return `
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="2"/>
        <text x="20" y="25" text-anchor="middle" font-size="16" fill="white">${icon}</text>
      </svg>
    `;
  };

  const getMarkerColor = (type: string): string => {
    switch (type) {
      case 'activity': return '#3B82F6';
      case 'nearby': return '#10B981';
      case 'route': return '#8B5CF6';
      default: return '#6B7280';
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

  const showDirections = async (markers: MapMarker[]) => {
    if (markers.length < 2 || !window.google) return;

    const directionsService = new window.google.maps.DirectionsService();
    
    const waypoints = markers.slice(1, -1).map(marker => ({
      location: marker.position,
      stopover: true
    }));

    const request = {
      origin: markers[0].position,
      destination: markers[markers.length - 1].position,
      waypoints: waypoints,
      travelMode: window.google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, (result: any, status: any) => {
      if (status === window.google.maps.DirectionsStatus.OK) {
        directionsRendererRef.current.setDirections(result);
      } else {
        console.error('Directions request failed:', status);
      }
    });
  };

  const addNearbyPlaces = async (center: { lat: number; lng: number }) => {
    if (!window.google) return;

    const service = new window.google.maps.places.PlacesService(googleMapRef.current);
    
    const request = {
      location: center,
      radius: 1000, // 1km radius
      type: 'restaurant'
    };

    service.nearbySearch(request, (results: any[], status: any) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        results.slice(0, 5).forEach((place) => {
          const marker = new window.google.maps.Marker({
            position: place.geometry.location,
            map: googleMapRef.current,
            title: place.name,
            icon: {
              url: `data:image/svg+xml,${encodeURIComponent(createMarkerSVG('🍽️', '#10B981'))}`,
              scaledSize: new window.google.maps.Size(32, 32),
              anchor: new window.google.maps.Point(16, 32)
            }
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 8px;">
                <h4 style="margin: 0 0 4px 0;">${place.name}</h4>
                <p style="margin: 0; font-size: 12px; color: #666;">
                  ⭐ ${place.rating || 'N/A'} • ${place.vicinity}
                </p>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(googleMapRef.current, marker);
          });

          markersRef.current.push(marker);
        });
      }
    });
  };

  const adjustMapBounds = (markers: MapMarker[]) => {
    if (!window.google || markers.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    markers.forEach(marker => {
      bounds.extend(marker.position);
    });

    googleMapRef.current.fitBounds(bounds);
    
    // Ensure minimum zoom level
    window.google.maps.event.addListenerOnce(googleMapRef.current, 'bounds_changed', () => {
      if (googleMapRef.current.getZoom() > 15) {
        googleMapRef.current.setZoom(15);
      }
    });
  };

  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] });
    }
  };

  if (error) {
    return (
      <div className={`${className} bg-red-50 border border-red-200 rounded-lg p-4`} style={{ height }}>
        <div className="text-center">
          <div className="text-2xl mb-2 text-red-500">⚠️</div>
          <div className="text-red-700 font-medium">Map Error</div>
          <div className="text-sm text-red-600 mt-1">{error}</div>
          <div className="text-xs text-red-500 mt-2">
            Check your Google Maps API key and internet connection
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${className} bg-gray-100 rounded-lg flex items-center justify-center`} style={{ height }}>
        <div className="text-center">
          <div className="text-2xl mb-2">🗺️</div>
          <div className="text-gray-600">Loading Google Maps...</div>
          <div className="text-xs text-gray-500 mt-1">Initializing map services</div>
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
              {markers.length} locations • Google Maps Integration
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => updateMap()}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Google Map Container */}
      <div 
        ref={mapRef}
        className="w-full"
        style={{ height }}
      />

      {/* Map Info Panel */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
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
              {isLoaded ? 'Google Maps Loaded' : 'Loading...'}
            </div>
          </div>

          {/* Features */}
          <div className="bg-white rounded-lg p-3">
            <div className="text-sm font-medium text-gray-900 mb-1">⚡ Features</div>
            <div className="text-xs text-gray-600">
              {showRoute ? 'Routes • ' : ''}
              {showNearbyPlaces ? 'Nearby Places • ' : ''}
              Real-time
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
          {showRoute && (
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

export default GoogleMapComponent;

