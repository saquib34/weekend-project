// Holiday Awareness Service
// Automatically detects holidays and suggests long weekend opportunities

export interface Holiday {
  name: string;
  date: Date;
  type: 'federal' | 'religious' | 'cultural' | 'commercial' | 'national';
  country: string;
  description?: string;
  isLongWeekendOpportunity: boolean;
  suggestedWeekendType: 'regular' | 'long' | 'extended';
  location?: string;
  nameLocal?: string;
  weekDay?: string;
}

export interface AbstractApiHoliday {
  name: string;
  name_local: string;
  language: string;
  description: string;
  country: string;
  location: string;
  type: string;
  date: string;
  date_year: string;
  date_month: string;
  date_day: string;
  week_day: string;
}

export interface UserLocation {
  country: string;
  countryCode: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
}

export interface LongWeekendOpportunity {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  weekendType: 'long' | 'extended';
  holidays: Holiday[];
  description: string;
  suggestions: string[];
  priority: 'high' | 'medium' | 'low';
  daysUntil: number;
}

class HolidayService {
  private holidays: Holiday[] = [];
  private currentYear: number = new Date().getFullYear();
  private abstractApiKey: string = import.meta.env.VITE_ABSTRACT_API_KEY || '3310a6881ee149f6bfe15b136897e8f0';
  private userLocation: UserLocation | null = null;

  constructor() {
    this.initializeLocation();
  }

  private async initializeLocation(): Promise<void> {
    try {
      // Try to get user's location
      await this.getUserLocation();
      // Load holidays for user's location
      if (this.userLocation) {
        await this.loadHolidaysFromApi();
      } else {
        this.initializeHolidays();
      }
    } catch (error) {
      console.warn('Failed to initialize location-based holidays, using fallback:', error);
      this.initializeHolidays();
    }
  }

  private async getUserLocation(): Promise<void> {
    try {
      // First try to get location via IP geolocation API
      const response = await fetch('https://ipapi.co/json/');
      if (response.ok) {
        const locationData = await response.json();
        this.userLocation = {
          country: locationData.country_name || 'India',
          countryCode: locationData.country_code || 'IN',
          city: locationData.city || 'Unknown',
          region: locationData.region || 'Unknown',
          latitude: locationData.latitude || 0,
          longitude: locationData.longitude || 0,
        };
        console.log('Location detected:', this.userLocation);
        return;
      }
    } catch (error) {
      console.warn('IP geolocation failed:', error);
    }

    // Fallback to browser geolocation
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            enableHighAccuracy: false
          });
        });

        // Reverse geocode to get country
        await this.reverseGeocode(position.coords.latitude, position.coords.longitude);
      } catch (error) {
        console.warn('Browser geolocation failed:', error);
        // Default to India as fallback
        this.userLocation = {
          country: 'India',
          countryCode: 'IN',
          city: 'Unknown',
          region: 'Unknown',
          latitude: 20.5937,
          longitude: 78.9629,
        };
      }
    }
  }

  private async reverseGeocode(lat: number, lng: number): Promise<void> {
    try {
      // Use a free reverse geocoding service
      const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
      if (response.ok) {
        const data = await response.json();
        this.userLocation = {
          country: data.countryName || 'India',
          countryCode: data.countryCode || 'IN',
          city: data.city || 'Unknown',
          region: data.principalSubdivision || 'Unknown',
          latitude: lat,
          longitude: lng,
        };
      }
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
      // Fallback to India
      this.userLocation = {
        country: 'India',
        countryCode: 'IN',
        city: 'Unknown',
        region: 'Unknown',
        latitude: lat,
        longitude: lng,
      };
    }
  }

  private async loadHolidaysFromApi(): Promise<void> {
    if (!this.userLocation) return;

    try {
    
      this.initializeHolidays();
      
      // Try to verify a few major holidays for accuracy
      await this.verifyMajorHolidays();
      
      console.log(`Loaded ${this.holidays.length} holidays for ${this.userLocation.country}`);
    } catch (error) {
      console.error('Failed to load holidays from API:', error);
      this.initializeHolidays();
    }
  }

  private async verifyMajorHolidays(): Promise<void> {
    // Try to verify a few major holidays using individual day queries
    const majorHolidayDates = [
      { month: 1, day: 1, name: "New Year's Day" },
      { month: 12, day: 25, name: "Christmas Day" },
      { month: 1, day: 26, name: "Republic Day" }, // India specific
      { month: 8, day: 15, name: "Independence Day" }, // India specific
    ];

    for (const holidayDate of majorHolidayDates) {
      try {
        const date = new Date(this.currentYear, holidayDate.month - 1, holidayDate.day);
        
        const url = `https://holidays.abstractapi.com/v1/?api_key=${this.abstractApiKey}&country=${this.userLocation?.countryCode}&year=${this.currentYear}&month=${holidayDate.month}&day=${holidayDate.day}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const apiHolidays: AbstractApiHoliday[] = await response.json();
          if (Array.isArray(apiHolidays) && apiHolidays.length > 0) {
            // Update the fallback holiday with API data
            const existingHolidayIndex = this.holidays.findIndex(h => 
              h.date.getMonth() === date.getMonth() && h.date.getDate() === date.getDate()
            );
            
            if (existingHolidayIndex >= 0) {
              this.holidays[existingHolidayIndex] = this.convertApiHolidayToHoliday(apiHolidays[0]);
            } else {
              this.holidays.push(this.convertApiHolidayToHoliday(apiHolidays[0]));
            }
          }
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Failed to verify holiday on ${holidayDate.month}/${holidayDate.day}:`, error);
      }
    }
    
    // Sort holidays by date after verification
    this.holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private convertApiHolidayToHoliday(apiHoliday: AbstractApiHoliday): Holiday {
    const date = new Date(`${apiHoliday.date_month}/${apiHoliday.date_day}/${apiHoliday.date_year}`);
    const dayOfWeek = date.getDay();
    
    // Determine if this creates a long weekend opportunity
    const isLongWeekendOpportunity = this.determineWeekendOpportunity(dayOfWeek);
    const suggestedWeekendType = this.getSuggestedWeekendType(dayOfWeek, apiHoliday.name);

    return {
      name: apiHoliday.name,
      date,
      type: this.mapApiTypeToHolidayType(apiHoliday.type),
      country: apiHoliday.country,
      description: apiHoliday.description || undefined,
      isLongWeekendOpportunity,
      suggestedWeekendType,
      location: apiHoliday.location,
      nameLocal: apiHoliday.name_local,
      weekDay: apiHoliday.week_day,
    };
  }

  private determineWeekendOpportunity(dayOfWeek: number): boolean {
    // Monday (1), Friday (5), Thursday (4), or Tuesday (2) create good opportunities
    return [1, 2, 4, 5].includes(dayOfWeek);
  }

  private getSuggestedWeekendType(dayOfWeek: number, holidayName: string): 'regular' | 'long' | 'extended' {
    // Special extended weekends for major holidays
    const majorHolidays = ['christmas', 'new year', 'thanksgiving', 'diwali', 'eid'];
    const isMajorHoliday = majorHolidays.some(major => holidayName.toLowerCase().includes(major));
    
    if (isMajorHoliday && [4, 5].includes(dayOfWeek)) { // Thursday or Friday
      return 'extended';
    }
    
    if ([1, 5].includes(dayOfWeek)) { // Monday or Friday
      return 'long';
    }
    
    if ([2, 4].includes(dayOfWeek)) { // Tuesday or Thursday - suggest taking additional day
      return 'long';
    }
    
    return 'regular';
  }

  private mapApiTypeToHolidayType(apiType: string): Holiday['type'] {
    const type = apiType.toLowerCase();
    if (type.includes('national') || type.includes('federal')) return 'national';
    if (type.includes('religious')) return 'religious';
    if (type.includes('cultural')) return 'cultural';
    if (type.includes('commercial')) return 'commercial';
    return 'national'; // default
  }

  private initializeHolidays() {
    // Comprehensive fallback holidays when API is not available
    const currentYear = this.currentYear;
    const fallbackCountry = this.userLocation?.country || 'India';
    
    // Major holidays for India (and some international ones)
    this.holidays = [
      // Universal holidays
      {
        name: "New Year's Day",
        date: new Date(currentYear, 0, 1),
        type: 'national' as const,
        country: fallbackCountry,
        isLongWeekendOpportunity: true,
        suggestedWeekendType: 'long' as const
      },
      {
        name: "Christmas Day",
        date: new Date(currentYear, 11, 25),
        type: 'religious' as const,
        country: fallbackCountry,
        isLongWeekendOpportunity: true,
        suggestedWeekendType: 'extended' as const
      },
      
      // India-specific holidays (if in India)
      ...(this.userLocation?.countryCode === 'IN' ? [
        {
          name: "Republic Day",
          date: new Date(currentYear, 0, 26),
          type: 'national' as const,
          country: fallbackCountry,
          isLongWeekendOpportunity: true,
          suggestedWeekendType: 'long' as const
        },
        {
          name: "Independence Day",
          date: new Date(currentYear, 7, 15),
          type: 'national' as const,
          country: fallbackCountry,
          isLongWeekendOpportunity: true,
          suggestedWeekendType: 'long' as const
        },
        {
          name: "Gandhi Jayanti",
          date: new Date(currentYear, 9, 2),
          type: 'national' as const,
          country: fallbackCountry,
          isLongWeekendOpportunity: true,
          suggestedWeekendType: 'long' as const
        },
        {
          name: "Diwali",
          date: new Date(currentYear, 10, 12), // Approximate - varies each year
          type: 'religious' as const,
          country: fallbackCountry,
          isLongWeekendOpportunity: true,
          suggestedWeekendType: 'extended' as const
        },
        {
          name: "Holi",
          date: new Date(currentYear, 2, 14), // Approximate - varies each year
          type: 'religious' as const,
          country: fallbackCountry,
          isLongWeekendOpportunity: true,
          suggestedWeekendType: 'long' as const
        }
      ] : []),
      
      // Next year holidays
      {
        name: "New Year's Day",
        date: new Date(currentYear + 1, 0, 1),
        type: 'national' as const,
        country: fallbackCountry,
        isLongWeekendOpportunity: true,
        suggestedWeekendType: 'long' as const
      },
      
      ...(this.userLocation?.countryCode === 'IN' ? [
        {
          name: "Republic Day",
          date: new Date(currentYear + 1, 0, 26),
          type: 'national' as const,
          country: fallbackCountry,
          isLongWeekendOpportunity: true,
          suggestedWeekendType: 'long' as const
        }
      ] : [])
    ];

    // Sort holidays by date
    this.holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // Public methods for external use
  
  // Get user's current location
  getCurrentLocation(): UserLocation | null {
    return this.userLocation;
  }

  // Manually set user location and reload holidays
  async setLocation(countryCode: string, country?: string): Promise<void> {
    this.userLocation = {
      country: country || countryCode,
      countryCode: countryCode.toUpperCase(),
      city: 'Unknown',
      region: 'Unknown',
      latitude: 0,
      longitude: 0,
    };
    
    await this.loadHolidaysFromApi();
  }

  // Refresh holidays for current location
  async refreshHolidays(): Promise<void> {
    if (this.userLocation) {
      await this.loadHolidaysFromApi();
    } else {
      await this.initializeLocation();
    }
  }

  // Get upcoming long weekend opportunities
  getUpcomingLongWeekends(monthsAhead: number = 6): LongWeekendOpportunity[] {
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth() + monthsAhead, now.getDate());
    
    const opportunities: LongWeekendOpportunity[] = [];
    
    // Check holidays that create long weekend opportunities
    const upcomingHolidays = this.holidays.filter(holiday => 
      holiday.date >= now && 
      holiday.date <= endDate && 
      holiday.isLongWeekendOpportunity
    );

    upcomingHolidays.forEach((holiday) => {
      const opportunity = this.createLongWeekendOpportunity(holiday);
      if (opportunity) {
        opportunities.push(opportunity);
      }
    });

    // Add some general long weekend suggestions
    opportunities.push(...this.generateGeneralLongWeekendSuggestions(now, endDate));

    return opportunities.sort((a, b) => a.daysUntil - b.daysUntil);
  }

  private createLongWeekendOpportunity(holiday: Holiday): LongWeekendOpportunity | null {
    const holidayDate = holiday.date;
    const dayOfWeek = holidayDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    let startDate: Date;
    let endDate: Date;
    let weekendType: 'long' | 'extended' = 'long';
    let suggestions: string[] = [];

    // Determine the long weekend based on which day the holiday falls
    if (dayOfWeek === 1) { // Monday holiday
      startDate = new Date(holidayDate.getTime() - 2 * 24 * 60 * 60 * 1000); // Saturday
      endDate = new Date(holidayDate.getTime());
      suggestions = [
        'Perfect 3-day weekend!',
        'Great opportunity for a weekend getaway',
        'Plan outdoor activities for the extra day'
      ];
    } else if (dayOfWeek === 5) { // Friday holiday
      startDate = new Date(holidayDate.getTime());
      endDate = new Date(holidayDate.getTime() + 2 * 24 * 60 * 60 * 1000); // Sunday
      suggestions = [
        '3-day weekend starts early!',
        'Take a mini vacation',
        'Perfect for visiting family or friends'
      ];
    } else if (dayOfWeek === 4) { // Thursday holiday
      startDate = new Date(holidayDate.getTime());
      endDate = new Date(holidayDate.getTime() + 3 * 24 * 60 * 60 * 1000); // Sunday
      weekendType = 'extended';
      suggestions = [
        'Take Friday off for a 4-day weekend!',
        'Perfect for a longer trip',
        'Great opportunity for a staycation'
      ];
    } else if (dayOfWeek === 2) { // Tuesday holiday
      startDate = new Date(holidayDate.getTime() - 1 * 24 * 60 * 60 * 1000); // Monday
      endDate = new Date(holidayDate.getTime());
      suggestions = [
        'Take Monday off for a long weekend',
        'Extend your regular weekend',
        'Perfect for recovery and relaxation'
      ];
    } else {
      return null; // Holiday doesn't create good long weekend opportunity
    }

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const daysUntil = Math.ceil((holidayDate.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000));

    return {
      id: `holiday-${holiday.name.toLowerCase().replace(/\s+/g, '-')}-${holidayDate.getFullYear()}`,
      title: `${holiday.name} Long Weekend`,
      startDate,
      endDate,
      totalDays,
      weekendType,
      holidays: [holiday],
      description: `Take advantage of ${holiday.name} for a ${totalDays}-day weekend!`,
      suggestions,
      priority: this.calculatePriority(daysUntil, totalDays),
      daysUntil,
    };
  }

  private generateGeneralLongWeekendSuggestions(startDate: Date, endDate: Date): LongWeekendOpportunity[] {
    const suggestions: LongWeekendOpportunity[] = [];
    
    // Suggest taking Fridays or Mondays off for regular long weekends
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + 7); // Start checking next week
    
    while (currentDate <= endDate) {
      // Check if it's a good week for a long weekend (no existing holidays nearby)
      if (this.isGoodWeekForLongWeekend(currentDate)) {
        // Suggest Friday off
        const friday = new Date(currentDate);
        friday.setDate(friday.getDate() + (5 - friday.getDay())); // Get Friday of this week
        
        if (friday >= startDate && friday <= endDate) {
          const daysUntil = Math.ceil((friday.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000));
          
          suggestions.push({
            id: `general-friday-${friday.getTime()}`,
            title: 'Take Friday Off',
            startDate: friday,
            endDate: new Date(friday.getTime() + 2 * 24 * 60 * 60 * 1000),
            totalDays: 3,
            weekendType: 'long',
            holidays: [],
            description: 'Create your own 3-day weekend by taking Friday off!',
            suggestions: [
              'Perfect for a spontaneous trip',
              'Extra day for hobbies and relaxation',
              'Beat the weekend crowds'
            ],
            priority: this.calculatePriority(daysUntil, 3),
            daysUntil,
          });
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 7); // Next week
    }
    
    return suggestions.slice(0, 3); // Limit to 3 general suggestions
  }

  private isGoodWeekForLongWeekend(date: Date): boolean {
    // Check if there are any holidays within 2 weeks of this date
    const twoWeeksBefore = new Date(date.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twoWeeksAfter = new Date(date.getTime() + 14 * 24 * 60 * 60 * 1000);
    
    return !this.holidays.some(holiday => 
      holiday.date >= twoWeeksBefore && 
      holiday.date <= twoWeeksAfter && 
      holiday.isLongWeekendOpportunity
    );
  }

  private calculatePriority(daysUntil: number, totalDays: number): 'high' | 'medium' | 'low' {
    if (daysUntil < 14 && totalDays >= 4) return 'high';
    if (daysUntil < 30 && totalDays >= 3) return 'high';
    if (daysUntil < 60) return 'medium';
    return 'low';
  }

  // Get holidays for a specific date range
  getHolidaysInRange(startDate: Date, endDate: Date): Holiday[] {
    return this.holidays.filter(holiday => 
      holiday.date >= startDate && holiday.date <= endDate
    );
  }

  // Check if a date is a holiday
  isHoliday(date: Date): Holiday | null {
    return this.holidays.find(holiday => 
      holiday.date.toDateString() === date.toDateString()
    ) || null;
  }

  // Get weekend type recommendation based on available days
  getRecommendedWeekendType(startDate: Date, endDate: Date): {
    weekendType: 'regular' | 'long' | 'extended';
    availableDays: ('friday' | 'saturday' | 'sunday' | 'monday')[];
    suggestions: string[];
  } {
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const startDay = startDate.getDay();
    
    const availableDays: ('friday' | 'saturday' | 'sunday' | 'monday')[] = [];
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    for (let i = 0; i < daysDiff; i++) {
      const dayIndex = (startDay + i) % 7;
      const dayName = dayNames[dayIndex];
      if (['friday', 'saturday', 'sunday', 'monday'].includes(dayName)) {
        availableDays.push(dayName as 'friday' | 'saturday' | 'sunday' | 'monday');
      }
    }

    let weekendType: 'regular' | 'long' | 'extended';
    let suggestions: string[];

    if (daysDiff >= 4) {
      weekendType = 'extended';
      suggestions = [
        'Perfect for a longer getaway or staycation',
        'Great opportunity to tackle bigger projects',
        'Consider visiting multiple destinations',
        'Mix relaxation with adventure activities'
      ];
    } else if (daysDiff === 3) {
      weekendType = 'long';
      suggestions = [
        'Ideal for a weekend trip or deep relaxation',
        'Perfect balance of activities and rest',
        'Great for trying new experiences',
        'Good opportunity for social activities'
      ];
    } else {
      weekendType = 'regular';
      suggestions = [
        'Classic weekend for local activities',
        'Perfect for regular routines and nearby fun',
        'Great for recharging and light activities'
      ];
    }

    return { weekendType, availableDays, suggestions };
  }
}

export const holidayService = new HolidayService();
