// Location Mapping Service
// Integrates with Google Maps API for activity locations and directions

export interface Location {
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  placeId?: string;
  name?: string;
  rating?: number;
  priceLevel?: number;
  photos?: string[];
  types?: string[];
}

export interface DirectionsResult {
  distance: string;
  duration: string;
  route: {
    steps: DirectionStep[];
    bounds: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
  };
  alternativeRoutes?: DirectionsResult[];
}

export interface DirectionStep {
  instruction: string;
  distance: string;
  duration: string;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
  travelMode: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'BICYCLING';
}

export interface NearbyPlace {
  placeId: string;
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  rating: number;
  priceLevel: number;
  types: string[];
  distance: number; // in meters
  openNow: boolean;
  photos: string[];
  website?: string;
  phoneNumber?: string;
  reviews?: PlaceReview[];
}

export interface PlaceReview {
  author: string;
  rating: number;
  text: string;
  time: Date;
}

export interface MapConfig {
  center: { lat: number; lng: number };
  zoom: number;
  markers: MapMarker[];
  route?: DirectionsResult;
  style: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
}

export interface MapMarker {
  id: string;
  coordinates: { lat: number; lng: number };
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  type: 'activity' | 'dining' | 'accommodation' | 'landmark' | 'custom';
}

// Declare global Google Maps types for when the API is loaded
declare global {
  interface Window {
    google?: any;
    initMap?: () => void;
  }
}

class LocationMappingService {
  private apiKey: string;
  private isGoogleMapsLoaded: boolean = false;
  private mockMode: boolean = true; // Default to mock mode

  constructor(apiKey?: string) {
    this.apiKey = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    this.mockMode = !this.apiKey;
    
        
    if (!this.mockMode) {
      this.initializeGoogleMaps();
    }
  }

  private async initializeGoogleMaps(): Promise<void> {
    if (this.isGoogleMapsLoaded || this.mockMode) return;

    try {
      // Load Google Maps JavaScript API
      if (!window.google) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places,geometry&callback=initMap`;
          script.async = true;
          script.defer = true;
          
          window.initMap = () => {
            this.isGoogleMapsLoaded = true;
            resolve();
          };
          
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
    } catch (error) {
      console.warn('Failed to load Google Maps API, falling back to mock mode:', error);
      this.mockMode = true;
    }
  }

  // Geocode an address to get coordinates
  async geocodeAddress(address: string): Promise<Location | null> {
    if (this.mockMode) {
      return this.mockGeocodeAddress(address);
    }

    try {
      await this.initializeGoogleMaps();
      
      if (!window.google) {
        return this.mockGeocodeAddress(address);
      }

      const geocoder = new window.google.maps.Geocoder();
      const result = await new Promise<any[]>((resolve, reject) => {
        geocoder.geocode({ address }, (results: any, status: any) => {
          if (status === 'OK' && results && results.length > 0) {
            resolve(results);
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });

      const location = result[0];
      return {
        address: location.formatted_address,
        coordinates: {
          lat: location.geometry.location.lat(),
          lng: location.geometry.location.lng(),
        },
        placeId: location.place_id,
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      return this.mockGeocodeAddress(address);
    }
  }

  // Get directions between two locations
  async getDirections(
    origin: string | Location,
    destination: string | Location,
    travelMode: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'BICYCLING' = 'DRIVING'
  ): Promise<DirectionsResult | null> {
    if (this.mockMode) {
      return this.mockGetDirections(origin, destination, travelMode);
    }

    try {
      await this.initializeGoogleMaps();
      
      if (!window.google) {
        return this.mockGetDirections(origin, destination, travelMode);
      }

      const directionsService = new window.google.maps.DirectionsService();
      
      const originParam = typeof origin === 'string' ? origin : `${origin.coordinates.lat},${origin.coordinates.lng}`;
      const destinationParam = typeof destination === 'string' ? destination : `${destination.coordinates.lat},${destination.coordinates.lng}`;
      
      const result = await new Promise<any>((resolve, reject) => {
        directionsService.route({
          origin: originParam,
          destination: destinationParam,
          travelMode: window.google.maps.TravelMode[travelMode],
          alternatives: true,
        }, (result: any, status: any) => {
          if (status === 'OK' && result) {
            resolve(result);
          } else {
            reject(new Error(`Directions request failed: ${status}`));
          }
        });
      });

      const route = result.routes[0];
      const leg = route.legs[0];

      return {
        distance: leg.distance?.text || 'Unknown',
        duration: leg.duration?.text || 'Unknown',
        route: {
          steps: leg.steps.map((step: any) => ({
            instruction: step.instructions,
            distance: step.distance?.text || 'Unknown',
            duration: step.duration?.text || 'Unknown',
            startLocation: {
              lat: step.start_location.lat(),
              lng: step.start_location.lng(),
            },
            endLocation: {
              lat: step.end_location.lat(),
              lng: step.end_location.lng(),
            },
            travelMode,
          })),
          bounds: {
            northeast: {
              lat: route.bounds.getNorthEast().lat(),
              lng: route.bounds.getNorthEast().lng(),
            },
            southwest: {
              lat: route.bounds.getSouthWest().lat(),
              lng: route.bounds.getSouthWest().lng(),
            },
          },
        },
        alternativeRoutes: result.routes.slice(1).map((altRoute: any) => ({
          distance: altRoute.legs[0].distance?.text || 'Unknown',
          duration: altRoute.legs[0].duration?.text || 'Unknown',
          route: {
            steps: altRoute.legs[0].steps.map((step: any) => ({
              instruction: step.instructions,
              distance: step.distance?.text || 'Unknown',
              duration: step.duration?.text || 'Unknown',
              startLocation: {
                lat: step.start_location.lat(),
                lng: step.start_location.lng(),
              },
              endLocation: {
                lat: step.end_location.lat(),
                lng: step.end_location.lng(),
              },
              travelMode,
            })),
            bounds: {
              northeast: {
                lat: altRoute.bounds.getNorthEast().lat(),
                lng: altRoute.bounds.getNorthEast().lng(),
              },
              southwest: {
                lat: altRoute.bounds.getSouthWest().lat(),
                lng: altRoute.bounds.getSouthWest().lng(),
              },
            },
          },
        })),
      };
    } catch (error) {
      console.error('Directions error:', error);
      return this.mockGetDirections(origin, destination, travelMode);
    }
  }

  // Find nearby places of interest
  async findNearbyPlaces(
    location: Location,
    type: string,
    radius: number = 5000,
    limit: number = 10
  ): Promise<NearbyPlace[]> {
    if (this.mockMode) {
      return this.mockFindNearbyPlaces(location, type, radius, limit);
    }

    try {
      await this.initializeGoogleMaps();
      
      if (!window.google) {
        return this.mockFindNearbyPlaces(location, type, radius, limit);
      }

      const service = new window.google.maps.places.PlacesService(document.createElement('div'));
      
      const request = {
        location: new window.google.maps.LatLng(location.coordinates.lat, location.coordinates.lng),
        radius,
        type: type,
      };

      const results = await new Promise<any[]>((resolve, reject) => {
        service.nearbySearch(request, (results: any, status: any) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            resolve(results.slice(0, limit));
          } else {
            reject(new Error(`Places search failed: ${status}`));
          }
        });
      });

      return results.map((place: any) => ({
        placeId: place.place_id || '',
        name: place.name || 'Unknown',
        address: place.vicinity || 'Unknown address',
        coordinates: {
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0,
        },
        rating: place.rating || 0,
        priceLevel: place.price_level || 0,
        types: place.types || [],
        distance: this.calculateDistance(
          location.coordinates,
          {
            lat: place.geometry?.location?.lat() || 0,
            lng: place.geometry?.location?.lng() || 0,
          }
        ),
        openNow: place.opening_hours?.open_now || false,
        photos: place.photos?.map((photo: any) => photo.getUrl({ maxWidth: 400 })) || [],
      }));
    } catch (error) {
      console.error('Nearby places error:', error);
      return this.mockFindNearbyPlaces(location, type, radius, limit);
    }
  }

  // Create a map configuration for displaying activities
  createMapConfig(
    activities: { name: string; location?: Location }[],
    center?: Location
  ): MapConfig {
    const markers: MapMarker[] = activities
      .filter(activity => activity.location)
      .map((activity, index) => ({
        id: `activity-${index}`,
        coordinates: activity.location!.coordinates,
        title: activity.name,
        description: activity.location!.address,
        type: 'activity' as const,
        color: this.getMarkerColor(index),
      }));

    // Calculate center if not provided
    const mapCenter = center?.coordinates || this.calculateCenter(markers.map(m => m.coordinates));

    return {
      center: mapCenter,
      zoom: markers.length === 1 ? 15 : this.calculateZoom(markers.map(m => m.coordinates)),
      markers,
      style: 'roadmap',
    };
  }

  // Calculate distance between two coordinates (in meters)
  private calculateDistance(coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = coord1.lat * Math.PI / 180;
    const φ2 = coord2.lat * Math.PI / 180;
    const Δφ = (coord2.lat - coord1.lat) * Math.PI / 180;
    const Δλ = (coord2.lng - coord1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  // Calculate center point of multiple coordinates
  private calculateCenter(coordinates: { lat: number; lng: number }[]): { lat: number; lng: number } {
    if (coordinates.length === 0) return { lat: 40.7128, lng: -74.0060 }; // Default to NYC

    const sum = coordinates.reduce(
      (acc, coord) => ({
        lat: acc.lat + coord.lat,
        lng: acc.lng + coord.lng,
      }),
      { lat: 0, lng: 0 }
    );

    return {
      lat: sum.lat / coordinates.length,
      lng: sum.lng / coordinates.length,
    };
  }

  // Calculate appropriate zoom level for multiple coordinates
  private calculateZoom(coordinates: { lat: number; lng: number }[]): number {
    if (coordinates.length <= 1) return 15;

    const lats = coordinates.map(c => c.lat);
    const lngs = coordinates.map(c => c.lng);
    
    const latRange = Math.max(...lats) - Math.min(...lats);
    const lngRange = Math.max(...lngs) - Math.min(...lngs);
    const maxRange = Math.max(latRange, lngRange);

    if (maxRange > 10) return 5;
    if (maxRange > 5) return 7;
    if (maxRange > 2) return 9;
    if (maxRange > 1) return 11;
    if (maxRange > 0.5) return 13;
    return 15;
  }

  // Get marker color based on index
  private getMarkerColor(index: number): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    return colors[index % colors.length];
  }

  // Mock implementations for when API is not available
  private mockGeocodeAddress(address: string): Location {
    // Simple mock based on common city names
    const mockLocations: Record<string, { lat: number; lng: number }> = {
      'new york': { lat: 40.7128, lng: -74.0060 },
      'los angeles': { lat: 34.0522, lng: -118.2437 },
      'chicago': { lat: 41.8781, lng: -87.6298 },
      'houston': { lat: 29.7604, lng: -95.3698 },
      'phoenix': { lat: 33.4484, lng: -112.0740 },
      'philadelphia': { lat: 39.9526, lng: -75.1652 },
      'san antonio': { lat: 29.4241, lng: -98.4936 },
      'san diego': { lat: 32.7157, lng: -117.1611 },
      'dallas': { lat: 32.7767, lng: -96.7970 },
      'san jose': { lat: 37.3382, lng: -121.8863 },
    };

    const addressLower = address.toLowerCase();
    const matchingCity = Object.keys(mockLocations).find(city => 
      addressLower.includes(city)
    );

    const coordinates = matchingCity 
      ? mockLocations[matchingCity]
      : { lat: 40.7128, lng: -74.0060 }; // Default to NYC

    return {
      address: `${address} (Mock Location)`,
      coordinates,
      placeId: `mock-place-${Date.now()}`,
    };
  }

  private mockGetDirections(
    _origin: string | Location,
    _destination: string | Location,
    travelMode: string
  ): DirectionsResult {
    const mockDistance = Math.floor(Math.random() * 20) + 5; // 5-25 miles
    const mockDuration = Math.floor(mockDistance * (travelMode === 'WALKING' ? 12 : 3)); // rough estimate

    return {
      distance: `${mockDistance} mi`,
      duration: `${mockDuration} min`,
      route: {
        steps: [
          {
            instruction: `Head ${['north', 'south', 'east', 'west'][Math.floor(Math.random() * 4)]} on Main St`,
            distance: `${Math.floor(mockDistance * 0.3)} mi`,
            duration: `${Math.floor(mockDuration * 0.3)} min`,
            startLocation: { lat: 40.7128, lng: -74.0060 },
            endLocation: { lat: 40.7580, lng: -73.9855 },
            travelMode: travelMode as any,
          },
          {
            instruction: 'Continue straight to destination',
            distance: `${Math.floor(mockDistance * 0.7)} mi`,
            duration: `${Math.floor(mockDuration * 0.7)} min`,
            startLocation: { lat: 40.7580, lng: -73.9855 },
            endLocation: { lat: 40.7831, lng: -73.9712 },
            travelMode: travelMode as any,
          },
        ],
        bounds: {
          northeast: { lat: 40.7831, lng: -73.9712 },
          southwest: { lat: 40.7128, lng: -74.0060 },
        },
      },
    };
  }

  private mockFindNearbyPlaces(
    location: Location,
    type: string,
    radius: number,
    limit: number
  ): NearbyPlace[] {
    const mockPlaces = [
      { name: 'Central Park', type: 'park', rating: 4.5 },
      { name: 'Local Coffee Shop', type: 'cafe', rating: 4.2 },
      { name: 'Art Museum', type: 'museum', rating: 4.7 },
      { name: 'Italian Restaurant', type: 'restaurant', rating: 4.3 },
      { name: 'Bookstore', type: 'store', rating: 4.0 },
      { name: 'Movie Theater', type: 'movie_theater', rating: 4.1 },
      { name: 'Fitness Center', type: 'gym', rating: 4.4 },
      { name: 'Shopping Mall', type: 'shopping_mall', rating: 3.9 },
    ];

    return mockPlaces.slice(0, limit).map((place, index) => ({
      placeId: `mock-place-${index}`,
      name: place.name,
      address: `${123 + index} Mock Street, Mock City`,
      coordinates: {
        lat: location.coordinates.lat + (Math.random() - 0.5) * 0.01,
        lng: location.coordinates.lng + (Math.random() - 0.5) * 0.01,
      },
      rating: place.rating,
      priceLevel: Math.floor(Math.random() * 4) + 1,
      types: [type, 'establishment'],
      distance: Math.floor(Math.random() * radius),
      openNow: Math.random() > 0.3,
      photos: [`https://via.placeholder.com/400x300?text=${encodeURIComponent(place.name)}`],
    }));
  }
}

export const locationMappingService = new LocationMappingService();

