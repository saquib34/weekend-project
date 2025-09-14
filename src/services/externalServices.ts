// External Services Integration
// This service connects with various APIs to enrich the weekend planning experience

interface ExternalEvent {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  price: {
    min: number;
    max: number;
    currency: string;
  };
  category: string;
  imageUrl?: string;
  ticketUrl?: string;
  source: 'eventbrite' | 'facebook' | 'meetup' | 'local';
}

interface ExternalPlace {
  id: string;
  name: string;
  type: 'restaurant' | 'cafe' | 'bar' | 'attraction' | 'store' | 'entertainment';
  rating: number;
  priceLevel: 1 | 2 | 3 | 4; // $ to $$$$
  location: {
    address: string;
    lat: number;
    lng: number;
  };
  openingHours?: string[];
  photos?: string[];
  reviews?: {
    text: string;
    rating: number;
    author: string;
  }[];
  website?: string;
  phone?: string;
  source: 'google' | 'yelp' | 'foursquare';
}

interface LocationSearchParams {
  query: string;
  location: { lat: number; lng: number };
  radius: number; // in meters
  type?: string;
  minRating?: number;
  priceLevel?: number[];
}

class ExternalServicesIntegration {
  private googleMapsApiKey: string;
  private eventbriteToken: string;

  constructor() {
    // In production, these would come from environment variables
    this.googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    this.eventbriteToken = import.meta.env.VITE_EVENTBRITE_TOKEN || '';
  }

  // Google Places Integration for restaurants and attractions
  async searchPlaces(params: LocationSearchParams): Promise<ExternalPlace[]> {
    if (!this.googleMapsApiKey) {
      return this.getMockPlaces(params);
    }

    try {
      const { query, location, radius, type, minRating = 3.0 } = params;
      
      // Use Google Places Nearby Search API
      const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
      url.searchParams.append('key', this.googleMapsApiKey);
      url.searchParams.append('location', `${location.lat},${location.lng}`);
      url.searchParams.append('radius', radius.toString());
      url.searchParams.append('keyword', query);
      if (type) url.searchParams.append('type', type);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status !== 'OK') {
        console.warn('Google Places API error:', data.status);
        return this.getMockPlaces(params);
      }

      return data.results
        .filter((place: any) => place.rating >= minRating)
        .map((place: any) => ({
          id: place.place_id,
          name: place.name,
          type: this.mapGoogleTypeToOurType(place.types?.[0] || 'establishment'),
          rating: place.rating || 0,
          priceLevel: place.price_level || 2,
          location: {
            address: place.vicinity,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
          },
          photos: place.photos?.slice(0, 3).map((photo: any) => 
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${this.googleMapsApiKey}`
          ),
          source: 'google' as const,
        }))
        .slice(0, 10);

    } catch (error) {
      console.error('Error fetching places:', error);
      return this.getMockPlaces(params);
    }
  }

  // Eventbrite Integration for local events
  async searchEvents(location: { lat: number; lng: number }, dateRange: { start: Date; end: Date }): Promise<ExternalEvent[]> {
    if (!this.eventbriteToken) {
      return this.getMockEvents(location, dateRange);
    }

    try {
      const url = new URL('https://www.eventbriteapi.com/v3/events/search/');
      url.searchParams.append('location.latitude', location.lat.toString());
      url.searchParams.append('location.longitude', location.lng.toString());
      url.searchParams.append('location.within', '25km');
      url.searchParams.append('start_date.range_start', dateRange.start.toISOString());
      url.searchParams.append('start_date.range_end', dateRange.end.toISOString());
      url.searchParams.append('sort_by', 'relevance');

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.eventbriteToken}`,
        },
      });

      const data = await response.json();

      if (!data.events) {
        return this.getMockEvents(location, dateRange);
      }

      return data.events.map((event: any) => ({
        id: event.id,
        title: event.name.text,
        description: event.description?.text || '',
        startDate: new Date(event.start.local),
        endDate: new Date(event.end.local),
        location: {
          name: event.venue?.name || 'Online',
          address: event.venue?.address?.localized_address_display || '',
          lat: parseFloat(event.venue?.latitude) || location.lat,
          lng: parseFloat(event.venue?.longitude) || location.lng,
        },
        price: {
          min: event.ticket_availability?.minimum_ticket_price?.major_value || 0,
          max: event.ticket_availability?.maximum_ticket_price?.major_value || 0,
          currency: event.ticket_availability?.minimum_ticket_price?.currency || 'USD',
        },
        category: event.category?.name || 'Other',
        imageUrl: event.logo?.url,
        ticketUrl: event.url,
        source: 'eventbrite' as const,
      })).slice(0, 15);

    } catch (error) {
      console.error('Error fetching events:', error);
      return this.getMockEvents(location, dateRange);
    }
  }

  // Get directions between locations
  async getDirections(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<{
    distance: string;
    duration: string;
    steps: string[];
    mapUrl: string;
  }> {
    if (!this.googleMapsApiKey) {
      return this.getMockDirections(origin, destination);
    }

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
      url.searchParams.append('key', this.googleMapsApiKey);
      url.searchParams.append('origin', `${origin.lat},${origin.lng}`);
      url.searchParams.append('destination', `${destination.lat},${destination.lng}`);
      url.searchParams.append('mode', 'driving');

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status !== 'OK' || !data.routes.length) {
        return this.getMockDirections(origin, destination);
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      return {
        distance: leg.distance.text,
        duration: leg.duration.text,
        steps: leg.steps.map((step: any) => step.html_instructions.replace(/<[^>]*>/g, '')),
        mapUrl: `https://www.google.com/maps/dir/${origin.lat},${origin.lng}/${destination.lat},${destination.lng}`,
      };

    } catch (error) {
      console.error('Error getting directions:', error);
      return this.getMockDirections(origin, destination);
    }
  }

  // Helper methods for mock data when APIs are unavailable
  private getMockPlaces(params: LocationSearchParams): ExternalPlace[] {
    const mockPlaces: ExternalPlace[] = [
      {
        id: 'mock-restaurant-1',
        name: 'The Garden Bistro',
        type: 'restaurant',
        rating: 4.5,
        priceLevel: 3,
        location: {
          address: '123 Main Street',
          lat: params.location.lat + 0.001,
          lng: params.location.lng + 0.001,
        },
        openingHours: ['Mon-Sun: 11:00 AM - 10:00 PM'],
        source: 'google',
      },
      {
        id: 'mock-cafe-1',
        name: 'Sunrise Coffee Co.',
        type: 'cafe',
        rating: 4.2,
        priceLevel: 2,
        location: {
          address: '456 Oak Avenue',
          lat: params.location.lat - 0.002,
          lng: params.location.lng + 0.003,
        },
        openingHours: ['Mon-Fri: 6:00 AM - 8:00 PM', 'Sat-Sun: 7:00 AM - 9:00 PM'],
        source: 'google',
      },
      {
        id: 'mock-attraction-1',
        name: 'City Art Museum',
        type: 'attraction',
        rating: 4.7,
        priceLevel: 2,
        location: {
          address: '789 Cultural District',
          lat: params.location.lat + 0.005,
          lng: params.location.lng - 0.002,
        },
        openingHours: ['Tue-Sun: 10:00 AM - 6:00 PM', 'Closed Mondays'],
        source: 'google',
      },
    ];

    return mockPlaces.filter(place => 
      params.query ? place.name.toLowerCase().includes(params.query.toLowerCase()) : true
    );
  }

  private getMockEvents(location: { lat: number; lng: number }, dateRange: { start: Date; end: Date }): ExternalEvent[] {
    return [
      {
        id: 'mock-event-1',
        title: 'Weekend Jazz Festival',
        description: 'Enjoy live jazz music from local and international artists in the park.',
        startDate: new Date(dateRange.start.getTime() + 24 * 60 * 60 * 1000), // Next day
        endDate: new Date(dateRange.start.getTime() + 36 * 60 * 60 * 1000),
        location: {
          name: 'Central Park Amphitheater',
          address: '100 Park Avenue',
          lat: location.lat + 0.01,
          lng: location.lng + 0.01,
        },
        price: { min: 25, max: 75, currency: 'USD' },
        category: 'Music',
        source: 'eventbrite',
      },
      {
        id: 'mock-event-2',
        title: 'Farmers Market & Food Truck Rally',
        description: 'Fresh local produce and delicious food trucks every Saturday morning.',
        startDate: new Date(dateRange.start.getTime() + 8 * 60 * 60 * 1000), // Same day, morning
        endDate: new Date(dateRange.start.getTime() + 14 * 60 * 60 * 1000),
        location: {
          name: 'Downtown Square',
          address: '200 Main Street',
          lat: location.lat - 0.005,
          lng: location.lng + 0.008,
        },
        price: { min: 0, max: 0, currency: 'USD' },
        category: 'Food & Drink',
        source: 'local',
      },
    ];
  }

  private getMockDirections(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
    const distance = this.calculateDistance(origin, destination);
    return {
      distance: `${distance.toFixed(1)} km`,
      duration: `${Math.ceil(distance * 2)} min`,
      steps: [
        'Head northwest on Main Street',
        'Turn right onto Oak Avenue',
        'Continue straight for 2.3 km',
        'Turn left at the destination',
      ],
      mapUrl: `https://www.google.com/maps/dir/${origin.lat},${origin.lng}/${destination.lat},${destination.lng}`,
    };
  }

  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private mapGoogleTypeToOurType(googleType: string): ExternalPlace['type'] {
    const typeMap: Record<string, ExternalPlace['type']> = {
      'restaurant': 'restaurant',
      'cafe': 'cafe',
      'bar': 'bar',
      'tourist_attraction': 'attraction',
      'store': 'store',
      'shopping_mall': 'store',
      'movie_theater': 'entertainment',
      'amusement_park': 'entertainment',
    };
    return typeMap[googleType] || 'attraction';
  }
}

export const externalServices = new ExternalServicesIntegration();
export type { ExternalEvent, ExternalPlace, LocationSearchParams };

