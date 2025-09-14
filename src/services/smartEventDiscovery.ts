// Smart Event Discovery Service
// Integrates with multiple event platforms to suggest relevant activities

export interface EventSource {
  id: string;
  name: string;
  type: 'ticketing' | 'social' | 'local' | 'cultural';
  isActive: boolean;
  apiEndpoint?: string;
}

export interface EventDiscoveryOptions {
  location: {
    city: string;
    coordinates: { lat: number; lng: number };
    radius: number; // in kilometers
  };
  dateRange: {
    start: Date;
    end: Date;
  };
  categories: EventCategory[];
  priceRange?: {
    min: number;
    max: number;
    currency: string;
  };
  audience?: 'family' | 'adults' | 'teens' | 'seniors' | 'all';
  timePreference?: 'morning' | 'afternoon' | 'evening' | 'all-day' | 'any';
}

export interface DiscoveredEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  date: Date;
  startTime: string;
  endTime?: string;
  location: {
    name: string;
    address: string;
    coordinates: { lat: number; lng: number };
  };
  price: {
    amount: number;
    currency: string;
    isFree: boolean;
    priceRange?: string;
  };
  organizer: {
    name: string;
    website?: string;
    contact?: string;
  };
  images: string[];
  tags: string[];
  source: EventSource;
  popularity: number; // 0-100 score
  relevanceScore: number; // 0-100 based on user preferences
  ticketUrl?: string;
  website?: string;
  capacity?: number;
  attendeeCount?: number;
  rating?: number;
  reviews?: EventReview[];
}

export interface EventReview {
  author: string;
  rating: number;
  comment: string;
  date: Date;
}

export type EventCategory = 
  | 'music' | 'arts' | 'food' | 'sports' | 'technology' | 'business'
  | 'wellness' | 'education' | 'family' | 'outdoor' | 'nightlife' | 'culture'
  | 'shopping' | 'community' | 'festival' | 'workshop' | 'exhibition'
  | 'theater' | 'comedy' | 'dance' | 'literature' | 'photography'
  | 'fitness' | 'networking' | 'charity' | 'religious' | 'seasonal';

export interface EventRecommendation {
  event: DiscoveredEvent;
  reason: string;
  confidenceScore: number;
  matchingFactors: string[];
  suggestedTime: string;
  groupSize?: string;
  preparation?: string[];
}

class SmartEventDiscoveryService {
  private eventSources: EventSource[] = [];
  private eventbriteApiKey: string;
  private meetupApiKey: string;
  private cachedEvents: Map<string, DiscoveredEvent[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();

  constructor() {
    this.eventbriteApiKey = import.meta.env.VITE_EVENTBRITE_API_KEY || '';
    this.meetupApiKey = import.meta.env.VITE_MEETUP_API_KEY || '';
    this.initializeEventSources();
  }

  private initializeEventSources(): void {
    this.eventSources = [
      {
        id: 'eventbrite',
        name: 'Eventbrite',
        type: 'ticketing',
        isActive: !!this.eventbriteApiKey,
        apiEndpoint: 'https://www.eventbriteapi.com/v3/'
      },
      {
        id: 'meetup',
        name: 'Meetup',
        type: 'social',
        isActive: !!this.meetupApiKey,
        apiEndpoint: 'https://api.meetup.com/'
      },
      {
        id: 'mock_local',
        name: 'Local Events',
        type: 'local',
        isActive: true // Always available as fallback
      },
      {
        id: 'mock_cultural',
        name: 'Cultural Events',
        type: 'cultural',
        isActive: true // Always available as fallback
      }
    ];
  }

  // Main discovery method
  async discoverEvents(options: EventDiscoveryOptions): Promise<DiscoveredEvent[]> {
    const cacheKey = this.generateCacheKey(options);
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.cachedEvents.get(cacheKey);
      if (cached) {
        console.log('Returning cached events');
        return cached;
      }
    }

    const allEvents: DiscoveredEvent[] = [];
    const activeSources = this.eventSources.filter(source => source.isActive);

    // Fetch from all active sources in parallel
    const eventPromises = activeSources.map(source => 
      this.fetchEventsFromSource(source, options)
    );

    try {
      const eventResults = await Promise.allSettled(eventPromises);
      
      eventResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allEvents.push(...result.value);
        } else {
          console.warn(`Failed to fetch from ${activeSources[index].name}:`, result.reason);
        }
      });

      // Remove duplicates and sort by relevance
      const uniqueEvents = this.removeDuplicates(allEvents);
      const scoredEvents = this.scoreEventRelevance(uniqueEvents, options);
      const sortedEvents = scoredEvents.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Cache the results
      this.cacheEvents(cacheKey, sortedEvents);

      return sortedEvents;
    } catch (error) {
      console.error('Error discovering events:', error);
      // Return mock events as fallback
      return this.getMockEvents(options);
    }
  }

  // Get event recommendations based on user preferences and weekend plan
  async getEventRecommendations(
    options: EventDiscoveryOptions,
    userPreferences?: {
      favoriteCategories: EventCategory[];
      preferredTimes: string[];
      budgetRange: { min: number; max: number };
      groupSize: number;
    }
  ): Promise<EventRecommendation[]> {
    const events = await this.discoverEvents(options);
    
    return events.slice(0, 10).map(event => {
      const recommendation = this.generateRecommendation(event, options, userPreferences);
      return recommendation;
    });
  }

  // Fetch events from Eventbrite
  private async fetchFromEventbrite(options: EventDiscoveryOptions): Promise<DiscoveredEvent[]> {
    if (!this.eventbriteApiKey) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        'location.latitude': options.location.coordinates.lat.toString(),
        'location.longitude': options.location.coordinates.lng.toString(),
        'location.within': `${options.location.radius}km`,
        'start_date.range_start': options.dateRange.start.toISOString(),
        'start_date.range_end': options.dateRange.end.toISOString(),
        'expand': 'venue,organizer,category',
        'sort_by': 'relevance'
      });

      const response = await fetch(
        `https://www.eventbriteapi.com/v3/events/search/?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${this.eventbriteApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Eventbrite API error: ${response.status}`);
      }

      const data = await response.json();
      return this.convertEventbriteEvents(data.events || []);
    } catch (error) {
      console.error('Eventbrite fetch error:', error);
      return [];
    }
  }

  // Fetch events from multiple sources
  private async fetchEventsFromSource(
    source: EventSource, 
    options: EventDiscoveryOptions
  ): Promise<DiscoveredEvent[]> {
    switch (source.id) {
      case 'eventbrite':
        return this.fetchFromEventbrite(options);
      case 'meetup':
        return this.fetchFromMeetup(options);
      case 'mock_local':
      case 'mock_cultural':
        return this.getMockEventsForSource(source, options);
      default:
        return [];
    }
  }

  // Mock Meetup implementation (implement when API key available)
  private async fetchFromMeetup(options: EventDiscoveryOptions): Promise<DiscoveredEvent[]> {
    // Placeholder for Meetup API integration
    console.log('Meetup API integration pending');
    return this.getMockMeetupEvents(options);
  }

  // Convert Eventbrite API response to our format
  private convertEventbriteEvents(eventbriteEvents: any[]): DiscoveredEvent[] {
    return eventbriteEvents.map((event: any) => {
      const startDate = new Date(event.start.utc);
      const endDate = event.end ? new Date(event.end.utc) : null;
      
      return {
        id: `eventbrite-${event.id}`,
        title: event.name?.text || 'Untitled Event',
        description: event.description?.text || event.summary || '',
        category: this.mapEventbriteCategory(event.category),
        date: startDate,
        startTime: startDate.toLocaleTimeString(),
        endTime: endDate?.toLocaleTimeString(),
        location: {
          name: event.venue?.name || 'TBD',
          address: event.venue?.address?.localized_address_display || 'Address TBD',
          coordinates: {
            lat: parseFloat(event.venue?.latitude) || 0,
            lng: parseFloat(event.venue?.longitude) || 0
          }
        },
        price: {
          amount: event.ticket_availability?.minimum_ticket_price?.major_value || 0,
          currency: event.ticket_availability?.minimum_ticket_price?.currency || 'USD',
          isFree: event.is_free || false,
          priceRange: event.ticket_availability?.minimum_ticket_price?.display || 'Free'
        },
        organizer: {
          name: event.organizer?.name || 'Unknown Organizer',
          website: event.organizer?.url,
          contact: event.organizer?.description?.text
        },
        images: event.logo?.url ? [event.logo.url] : [],
        tags: event.tags?.map((tag: any) => tag.display_name) || [],
        source: this.eventSources.find(s => s.id === 'eventbrite')!,
        popularity: Math.min(100, (event.capacity || 50) / 5), // Rough popularity score
        relevanceScore: 50, // Will be calculated later
        ticketUrl: event.url,
        website: event.url,
        capacity: event.capacity,
        attendeeCount: event.capacity - (event.ticket_availability?.available || 0)
      };
    });
  }

  // Map Eventbrite categories to our categories
  private mapEventbriteCategory(category: any): EventCategory {
    if (!category) return 'community';
    
    const categoryName = category.short_name?.toLowerCase() || '';
    
    if (categoryName.includes('music')) return 'music';
    if (categoryName.includes('art')) return 'arts';
    if (categoryName.includes('food')) return 'food';
    if (categoryName.includes('sport')) return 'sports';
    if (categoryName.includes('tech')) return 'technology';
    if (categoryName.includes('business')) return 'business';
    if (categoryName.includes('health') || categoryName.includes('wellness')) return 'wellness';
    if (categoryName.includes('education') || categoryName.includes('class')) return 'education';
    if (categoryName.includes('family') || categoryName.includes('kid')) return 'family';
    if (categoryName.includes('outdoor') || categoryName.includes('nature')) return 'outdoor';
    if (categoryName.includes('night') || categoryName.includes('party')) return 'nightlife';
    if (categoryName.includes('culture') || categoryName.includes('heritage')) return 'culture';
    
    return 'community';
  }

  // Generate mock events for testing
  private getMockEvents(options: EventDiscoveryOptions): DiscoveredEvent[] {
    const mockEvents: DiscoveredEvent[] = [
      {
        id: 'mock-1',
        title: 'Weekend Food Festival',
        description: 'Explore local cuisine and street food from various vendors',
        category: 'food',
        date: new Date(options.dateRange.start.getTime() + 86400000), // Next day
        startTime: '10:00 AM',
        endTime: '8:00 PM',
        location: {
          name: 'City Park',
          address: `${options.location.city} City Park`,
          coordinates: {
            lat: options.location.coordinates.lat + 0.01,
            lng: options.location.coordinates.lng + 0.01
          }
        },
        price: { amount: 0, currency: 'USD', isFree: true },
        organizer: { name: 'Local Food Council' },
        images: ['https://via.placeholder.com/400x300?text=Food+Festival'],
        tags: ['food', 'family-friendly', 'outdoor'],
        source: this.eventSources.find(s => s.id === 'mock_local')!,
        popularity: 85,
        relevanceScore: 90
      },
      {
        id: 'mock-2',
        title: 'Outdoor Movie Night',
        description: 'Watch classic movies under the stars',
        category: 'culture',
        date: new Date(options.dateRange.start.getTime() + 86400000 * 2), // Day after tomorrow
        startTime: '7:00 PM',
        endTime: '10:00 PM',
        location: {
          name: 'Amphitheater Park',
          address: `${options.location.city} Amphitheater`,
          coordinates: {
            lat: options.location.coordinates.lat - 0.01,
            lng: options.location.coordinates.lng + 0.02
          }
        },
        price: { amount: 5, currency: 'USD', isFree: false, priceRange: '$5' },
        organizer: { name: 'City Recreation Department' },
        images: ['https://via.placeholder.com/400x300?text=Movie+Night'],
        tags: ['movies', 'outdoor', 'evening'],
        source: this.eventSources.find(s => s.id === 'mock_cultural')!,
        popularity: 75,
        relevanceScore: 80
      }
    ];

    return mockEvents.filter(event => 
      options.categories.length === 0 || options.categories.includes(event.category)
    );
  }

  // Mock Meetup events
  private getMockMeetupEvents(options: EventDiscoveryOptions): DiscoveredEvent[] {
    return [
      {
        id: 'mock-meetup-1',
        title: 'Weekend Hiking Group',
        description: 'Join us for a scenic hike and nature photography',
        category: 'outdoor',
        date: new Date(options.dateRange.start.getTime() + 86400000),
        startTime: '8:00 AM',
        endTime: '2:00 PM',
        location: {
          name: 'Trailhead Parking',
          address: `${options.location.city} Nature Trail`,
          coordinates: options.location.coordinates
        },
        price: { amount: 0, currency: 'USD', isFree: true },
        organizer: { name: 'Local Hiking Meetup' },
        images: ['https://via.placeholder.com/400x300?text=Hiking+Group'],
        tags: ['hiking', 'photography', 'nature'],
        source: this.eventSources.find(s => s.id === 'meetup')!,
        popularity: 70,
        relevanceScore: 85
      }
    ];
  }

  // Get mock events for specific source
  private getMockEventsForSource(source: EventSource, options: EventDiscoveryOptions): DiscoveredEvent[] {
    if (source.id === 'mock_local') {
      return this.getMockEvents(options).filter(e => e.source.type === 'local');
    }
    if (source.id === 'mock_cultural') {
      return this.getMockEvents(options).filter(e => e.source.type === 'cultural');
    }
    return [];
  }

  // Remove duplicate events
  private removeDuplicates(events: DiscoveredEvent[]): DiscoveredEvent[] {
    const seen = new Set<string>();
    return events.filter(event => {
      const key = `${event.title}-${event.date.toDateString()}-${event.location.address}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Score events based on relevance to options
  private scoreEventRelevance(events: DiscoveredEvent[], options: EventDiscoveryOptions): DiscoveredEvent[] {
    return events.map(event => {
      let score = 50; // Base score

      // Category match
      if (options.categories.includes(event.category)) {
        score += 30;
      }

      // Date proximity (prefer sooner events)
      const daysUntil = Math.ceil((event.date.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000));
      if (daysUntil <= 3) score += 20;
      else if (daysUntil <= 7) score += 10;

      // Price consideration
      if (options.priceRange) {
        if (event.price.amount >= options.priceRange.min && event.price.amount <= options.priceRange.max) {
          score += 20;
        }
      } else if (event.price.isFree) {
        score += 10; // Slight preference for free events
      }

      // Distance consideration (closer is better)
      const distance = this.calculateDistance(
        options.location.coordinates,
        event.location.coordinates
      );
      if (distance <= 5) score += 15;
      else if (distance <= 15) score += 10;
      else if (distance <= 30) score += 5;

      // Popularity boost
      score += Math.floor(event.popularity * 0.2);

      event.relevanceScore = Math.min(100, Math.max(0, score));
      return event;
    });
  }

  // Generate personalized recommendation
  private generateRecommendation(
    event: DiscoveredEvent, 
    options: EventDiscoveryOptions,
    _userPreferences?: any
  ): EventRecommendation {
    const matchingFactors: string[] = [];
    let confidenceScore = 50;

    // Check category match
    if (options.categories.includes(event.category)) {
      matchingFactors.push(`Matches your interest in ${event.category}`);
      confidenceScore += 20;
    }

    // Check price compatibility
    if (event.price.isFree) {
      matchingFactors.push('Free event');
      confidenceScore += 10;
    } else if (options.priceRange && 
               event.price.amount >= options.priceRange.min && 
               event.price.amount <= options.priceRange.max) {
      matchingFactors.push('Within your budget');
      confidenceScore += 15;
    }

    // Check timing
    const eventHour = new Date(`1970-01-01T${event.startTime}`).getHours();
    let timeOfDay = 'any';
    if (eventHour < 12) timeOfDay = 'morning';
    else if (eventHour < 17) timeOfDay = 'afternoon';
    else timeOfDay = 'evening';

    if (options.timePreference === 'any' || options.timePreference === timeOfDay) {
      matchingFactors.push(`Good timing for ${timeOfDay}`);
      confidenceScore += 10;
    }

    // Distance factor
    const distance = this.calculateDistance(
      options.location.coordinates,
      event.location.coordinates
    );
    if (distance <= 10) {
      matchingFactors.push('Close to your location');
      confidenceScore += 15;
    }

    // Popularity factor
    if (event.popularity > 80) {
      matchingFactors.push('Highly popular event');
      confidenceScore += 10;
    }

    const reasons = [
      `Perfect for a ${event.category} experience`,
      `Happening ${this.formatEventDistance(event.date)}`,
      `Located at ${event.location.name}`
    ];

    return {
      event,
      reason: reasons.join('. '),
      confidenceScore: Math.min(100, confidenceScore),
      matchingFactors,
      suggestedTime: this.getSuggestedTime(event),
      groupSize: this.getGroupSizeRecommendation(event),
      preparation: this.getPreparationTips(event)
    };
  }

  // Helper methods
  private calculateDistance(coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private formatEventDistance(date: Date): string {
    const daysUntil = Math.ceil((date.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000));
    if (daysUntil === 0) return 'today';
    if (daysUntil === 1) return 'tomorrow';
    if (daysUntil <= 7) return `in ${daysUntil} days`;
    return `on ${date.toLocaleDateString()}`;
  }

  private getSuggestedTime(event: DiscoveredEvent): string {
    const startTime = event.startTime;
    const duration = event.endTime ? 
      ` (about ${this.calculateDuration(event.startTime, event.endTime)})` : '';
    return `Arrive by ${startTime}${duration}`;
  }

  private calculateDuration(start: string, end: string): string {
    const startTime = new Date(`1970-01-01T${start}`);
    const endTime = new Date(`1970-01-01T${end}`);
    const diff = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  private getGroupSizeRecommendation(event: DiscoveredEvent): string {
    if (event.category === 'family') return 'Perfect for families';
    if (event.category === 'networking' || event.category === 'business') return 'Great for professional networking';
    if (event.category === 'outdoor' || event.category === 'sports') return 'Ideal for active groups';
    if (event.category === 'food' || event.category === 'culture') return 'Enjoyable with friends or solo';
    return 'Suitable for any group size';
  }

  private getPreparationTips(event: DiscoveredEvent): string[] {
    const tips: string[] = [];
    
    if (event.category === 'outdoor') {
      tips.push('Wear comfortable shoes', 'Bring water and snacks', 'Check weather forecast');
    } else if (event.category === 'food') {
      tips.push('Come hungry', 'Bring cash for vendors', 'Consider dietary restrictions');
    } else if (event.category === 'culture' || event.category === 'arts') {
      tips.push('Arrive early for best seating', 'Dress appropriately', 'Turn off phone notifications');
    } else if (event.price.amount > 0) {
      tips.push('Purchase tickets in advance', 'Check cancellation policy');
    }

    if (!event.price.isFree) {
      tips.push('Bring payment method');
    }

    return tips;
  }

  // Cache management
  private generateCacheKey(options: EventDiscoveryOptions): string {
    return `${options.location.city}-${options.dateRange.start.toDateString()}-${options.categories.join(',')}`;
  }

  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? expiry > Date.now() : false;
  }

  private cacheEvents(key: string, events: DiscoveredEvent[]): void {
    this.cachedEvents.set(key, events);
    this.cacheExpiry.set(key, Date.now() + (30 * 60 * 1000)); // 30 minutes cache
  }

  // Get available event categories
  getAvailableCategories(): EventCategory[] {
    return [
      'music', 'arts', 'food', 'sports', 'technology', 'business',
      'wellness', 'education', 'family', 'outdoor', 'nightlife', 'culture',
      'shopping', 'community', 'festival', 'workshop', 'exhibition',
      'theater', 'comedy', 'dance', 'literature', 'photography',
      'fitness', 'networking', 'charity', 'religious', 'seasonal'
    ];
  }

  // Get active event sources
  getActiveSources(): EventSource[] {
    return this.eventSources.filter(source => source.isActive);
  }
}

export const smartEventDiscovery = new SmartEventDiscoveryService();
