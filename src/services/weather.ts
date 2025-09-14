/**
 * Weather Service for Weekendly
 * Provides weather data and weather-aware activity recommendations
 */

export interface WeatherData {
  condition: 'sunny' | 'cloudy' | 'partly-cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy';
  temperature: number; // Celsius
  humidity: number; // Percentage
  windSpeed: number; // km/h
  precipitation: number; // mm
  uvIndex: number; // 0-11+
  visibility: number; // km
  description: string;
  icon: string;
}

export interface WeatherForecast {
  current: WeatherData;
  saturday: WeatherData;
  sunday: WeatherData;
  hourly: WeatherData[];
}

export interface LocationCoords {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

class WeatherService {
  private baseUrl = 'https://api.open-meteo.com/v1'; // Free API, no key required
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // No API key needed for Open-Meteo
  }

  /**
   * Get user's current location
   */
  async getCurrentLocation(): Promise<LocationCoords> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5 * 60 * 1000, // 5 minutes
        }
      );
    });
  }

  /**
   * Get current weather data
   */
  async getCurrentWeather(location: LocationCoords): Promise<WeatherData> {
    const cacheKey = `current-${location.latitude}-${location.longitude}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return this.parseWeatherData(cached);

    try {
      const response = await fetch(
        `${this.baseUrl}/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,uv_index&timezone=auto`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.statusText}`);
      }

      const data = await response.json();
      this.setCachedData(cacheKey, data);
      return this.parseCurrentWeatherData(data);
    } catch (error) {
      console.warn('Failed to fetch real weather data, using mock data:', error);
      return this.getMockWeatherData('current');
    }
  }

  /**
   * Get weekend forecast (7-day forecast filtered for Saturday/Sunday)
   */
  async getWeekendForecast(location: LocationCoords): Promise<WeatherForecast> {
    const cacheKey = `forecast-${location.latitude}-${location.longitude}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return this.parseWeatherForecast(cached);

    try {
      const response = await fetch(
        `${this.baseUrl}/forecast?latitude=${location.latitude}&longitude=${location.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max,uv_index_max&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,uv_index&timezone=auto&forecast_days=7`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.statusText}`);
      }

      const data = await response.json();
      this.setCachedData(cacheKey, data);
      return this.parseWeatherForecast(data);
    } catch (error) {
      console.warn('Failed to fetch real forecast data, using mock data:', error);
      return this.getMockWeatherForecast();
    }
  }

  /**
   * Get weather alerts and recommendations
   */
  async getWeatherAlerts(location: LocationCoords): Promise<{
    alerts: Array<{
      type: 'warning' | 'watch' | 'advisory';
      title: string;
      description: string;
      severity: 'minor' | 'moderate' | 'severe' | 'extreme';
    }>;
    recommendations: string[];
  }> {
    const forecast = await this.getWeekendForecast(location);
    const alerts: any[] = [];
    const recommendations: string[] = [];

    // Check Saturday weather
    if (forecast.saturday.condition === 'rainy' || forecast.saturday.precipitation > 5) {
      alerts.push({
        type: 'advisory',
        title: 'Rain Expected Saturday',
        description: `${forecast.saturday.precipitation}mm of rain expected on Saturday`,
        severity: forecast.saturday.precipitation > 20 ? 'moderate' : 'minor',
      });
      recommendations.push('Consider indoor activities for Saturday');
      recommendations.push('Pack an umbrella for outdoor plans');
    }

    // Check Sunday weather
    if (forecast.sunday.condition === 'rainy' || forecast.sunday.precipitation > 5) {
      alerts.push({
        type: 'advisory',
        title: 'Rain Expected Sunday',
        description: `${forecast.sunday.precipitation}mm of rain expected on Sunday`,
        severity: forecast.sunday.precipitation > 20 ? 'moderate' : 'minor',
      });
      recommendations.push('Consider indoor activities for Sunday');
    }

    // UV warnings
    if (forecast.saturday.uvIndex > 7 || forecast.sunday.uvIndex > 7) {
      alerts.push({
        type: 'warning',
        title: 'High UV Index',
        description: 'UV index will be high this weekend',
        severity: 'moderate',
      });
      recommendations.push('Use sunscreen for outdoor activities');
      recommendations.push('Seek shade during peak sun hours (11 AM - 3 PM)');
    }

    // Wind warnings
    if (forecast.saturday.windSpeed > 25 || forecast.sunday.windSpeed > 25) {
      alerts.push({
        type: 'advisory',
        title: 'Windy Conditions',
        description: 'Strong winds expected this weekend',
        severity: 'minor',
      });
      recommendations.push('Secure outdoor equipment');
      recommendations.push('Consider wind-protected locations for outdoor dining');
    }

    return { alerts, recommendations };
  }

  /**
   * Filter activities based on weather conditions
   */
  filterActivitiesByWeather(
    activities: any[], 
    weather: WeatherData,
    strictMode = false
  ): any[] {
    return activities.filter(activity => {
      // Always include indoor activities
      if (activity.weatherSuitability === 'indoor-only') {
        return true;
      }

      // Weather-independent activities
      if (activity.weatherSuitability === 'any') {
        return true;
      }

      // Outdoor activities - check weather conditions
      if (activity.weatherSuitability === 'outdoor-only' || activity.weatherSuitability === 'sunny') {
        // Strict mode: only allow if weather is perfect
        if (strictMode) {
          return weather.condition === 'sunny' && weather.precipitation < 1;
        }
        
        // Lenient mode: allow unless actively raining
        return weather.condition !== 'rainy' && weather.condition !== 'stormy' && weather.precipitation < 5;
      }

      // Water activities
      if (activity.weatherSuitability === 'warm') {
        return weather.temperature > 20 && weather.condition !== 'rainy';
      }

      return true;
    });
  }

  /**
   * Get weather-appropriate activity suggestions
   */
  getWeatherBasedSuggestions(weather: WeatherData): string[] {
    const suggestions: string[] = [];

    if (weather.condition === 'sunny' && weather.temperature > 22) {
      suggestions.push('Perfect weather for outdoor dining');
      suggestions.push('Great day for hiking or cycling');
      suggestions.push('Consider visiting outdoor markets');
      suggestions.push('Beach or park activities recommended');
    } else if (weather.condition === 'rainy') {
      suggestions.push('Good time for museum visits');
      suggestions.push('Perfect for cozy café activities');
      suggestions.push('Indoor entertainment venues');
      suggestions.push('Home-based creative activities');
    } else if (weather.condition === 'cloudy' || weather.condition === 'partly-cloudy') {
      suggestions.push('Comfortable weather for walking tours');
      suggestions.push('Good for photography activities');
      suggestions.push('Ideal for outdoor shopping');
    }

    if (weather.temperature < 10) {
      suggestions.push('Bundle up for outdoor activities');
      suggestions.push('Consider warming indoor activities');
    } else if (weather.temperature > 30) {
      suggestions.push('Stay hydrated during outdoor activities');
      suggestions.push('Seek air-conditioned venues during peak heat');
    }

    return suggestions;
  }

  private parseCurrentWeatherData(data: any): WeatherData {
    const current = data.current;
    const condition = this.mapWeatherCodeToCondition(current.weather_code);
    return {
      condition,
      temperature: Math.round(current.temperature_2m),
      humidity: current.relative_humidity_2m || 65,
      windSpeed: Math.round(current.wind_speed_10m || 0),
      precipitation: current.precipitation || 0,
      uvIndex: current.uv_index || 0,
      visibility: 10, // Open-Meteo doesn't provide visibility, default to 10km
      description: this.getWeatherCodeDescription(current.weather_code),
      icon: this.getWeatherCodeIcon(current.weather_code),
    };
  }

  private mapWeatherCodeToCondition(code: number): WeatherData['condition'] {
    // Open-Meteo weather codes
    if (code === 0) return 'sunny';
    if (code === 1 || code === 2) return 'partly-cloudy';
    if (code === 3) return 'cloudy';
    if (code >= 45 && code <= 48) return 'foggy';
    if (code >= 51 && code <= 67) return 'rainy';
    if (code >= 71 && code <= 77) return 'snowy';
    if (code >= 80 && code <= 82) return 'rainy';
    if (code >= 85 && code <= 86) return 'snowy';
    if (code >= 95 && code <= 99) return 'stormy';
    return 'partly-cloudy';
  }

  private getWeatherCodeDescription(code: number): string {
    const descriptions: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      95: 'Thunderstorm',
      96: 'Thunderstorm with hail',
      99: 'Thunderstorm with heavy hail'
    };
    return descriptions[code] || 'Unknown weather';
  }

  private getWeatherCodeIcon(code: number): string {
    if (code === 0) return '01d';
    if (code === 1 || code === 2) return '02d';
    if (code === 3) return '04d';
    if (code >= 45 && code <= 48) return '50d';
    if (code >= 51 && code <= 67) return '10d';
    if (code >= 71 && code <= 77) return '13d';
    if (code >= 80 && code <= 82) return '09d';
    if (code >= 85 && code <= 86) return '13d';
    if (code >= 95 && code <= 99) return '11d';
    return '02d';
  }

  private parseWeatherData(data: any): WeatherData {
    // This method is kept for compatibility but redirects to new parsing
    if (data.current) {
      return this.parseCurrentWeatherData(data);
    }
    // Fallback for old API format or mock data
    return {
      condition: this.mapWeatherCondition(data.weather?.[0]?.main || 'Clear'),
      temperature: Math.round(data.main?.temp || 22),
      humidity: data.main?.humidity || 65,
      windSpeed: Math.round((data.wind?.speed || 0) * 3.6),
      precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
      uvIndex: data.uvi || 0,
      visibility: Math.round((data.visibility || 10000) / 1000),
      description: data.weather?.[0]?.description || 'Clear sky',
      icon: data.weather?.[0]?.icon || '01d',
    };
  }

  private parseWeatherForecast(data: any): WeatherForecast {
    // Get current weather from the response
    const current = this.parseCurrentWeatherData(data);
    
    // Find Saturday and Sunday from daily forecasts
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Calculate days until next Saturday (0-6)
    const daysUntilSaturday = dayOfWeek === 0 ? 6 : 6 - dayOfWeek;
    const saturdayIndex = daysUntilSaturday;
    const sundayIndex = daysUntilSaturday + 1;

    const daily = data.daily;
    
    const saturday: WeatherData = {
      condition: this.mapWeatherCodeToCondition(daily.weather_code[saturdayIndex]),
      temperature: Math.round(daily.temperature_2m_max[saturdayIndex]),
      humidity: 65, // Default as Open-Meteo doesn't provide daily humidity
      windSpeed: Math.round(daily.wind_speed_10m_max[saturdayIndex] || 0),
      precipitation: daily.precipitation_sum[saturdayIndex] || 0,
      uvIndex: daily.uv_index_max[saturdayIndex] || 0,
      visibility: 10,
      description: this.getWeatherCodeDescription(daily.weather_code[saturdayIndex]),
      icon: this.getWeatherCodeIcon(daily.weather_code[saturdayIndex]),
    };

    const sunday: WeatherData = {
      condition: this.mapWeatherCodeToCondition(daily.weather_code[sundayIndex]),
      temperature: Math.round(daily.temperature_2m_max[sundayIndex]),
      humidity: 65,
      windSpeed: Math.round(daily.wind_speed_10m_max[sundayIndex] || 0),
      precipitation: daily.precipitation_sum[sundayIndex] || 0,
      uvIndex: daily.uv_index_max[sundayIndex] || 0,
      visibility: 10,
      description: this.getWeatherCodeDescription(daily.weather_code[sundayIndex]),
      icon: this.getWeatherCodeIcon(daily.weather_code[sundayIndex]),
    };

    return {
      current,
      saturday,
      sunday,
      hourly: [current], // Simplified hourly for now
    };
  }

  private mapWeatherCondition(condition: string | number): WeatherData['condition'] {
    // Handle both old OpenWeatherMap conditions and new Open-Meteo weather codes
    if (typeof condition === 'number') {
      return this.mapWeatherCodeToCondition(condition);
    }
    
    const conditionMap: Record<string, WeatherData['condition']> = {
      'Clear': 'sunny',
      'Clouds': 'cloudy',
      'Rain': 'rainy',
      'Drizzle': 'rainy',
      'Thunderstorm': 'stormy',
      'Snow': 'snowy',
      'Mist': 'foggy',
      'Fog': 'foggy',
    };

    return conditionMap[condition] || 'partly-cloudy';
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private getMockWeatherData(type: 'current' | 'saturday' | 'sunday'): WeatherData {
    const mockData = {
      current: {
        condition: 'partly-cloudy' as const,
        temperature: 22,
        humidity: 65,
        windSpeed: 12,
        precipitation: 0,
        uvIndex: 6,
        visibility: 10,
        description: 'Partly cloudy',
        icon: '02d',
      },
      saturday: {
        condition: 'sunny' as const,
        temperature: 25,
        humidity: 55,
        windSpeed: 8,
        precipitation: 0,
        uvIndex: 8,
        visibility: 10,
        description: 'Clear sky',
        icon: '01d',
      },
      sunday: {
        condition: 'cloudy' as const,
        temperature: 20,
        humidity: 70,
        windSpeed: 15,
        precipitation: 2,
        uvIndex: 4,
        visibility: 8,
        description: 'Overcast',
        icon: '04d',
      },
    };

    return mockData[type];
  }

  private getMockWeatherForecast(): WeatherForecast {
    return {
      current: this.getMockWeatherData('current'),
      saturday: this.getMockWeatherData('saturday'),
      sunday: this.getMockWeatherData('sunday'),
      hourly: Array.from({ length: 24 }, (_, i) => ({
        ...this.getMockWeatherData('current'),
        temperature: 22 + Math.sin(i / 24 * Math.PI * 2) * 5,
      })),
    };
  }
}

// Export singleton instance
export const weatherService = new WeatherService();

// Export helper functions
export const getWeatherIcon = (condition: WeatherData['condition']): string => {
  const iconMap = {
    'sunny': '☀️',
    'cloudy': '☁️',
    'partly-cloudy': '⛅',
    'rainy': '🌧️',
    'stormy': '⛈️',
    'snowy': '❄️',
    'foggy': '🌫️',
  };
  return iconMap[condition] || '🌤️';
};

export const getWeatherDescription = (weather: WeatherData): string => {
  const { condition, temperature, precipitation } = weather;
  
  if (condition === 'rainy' && precipitation > 10) {
    return `Heavy rain expected, ${temperature}°C`;
  } else if (condition === 'rainy') {
    return `Light rain possible, ${temperature}°C`;
  } else if (condition === 'sunny' && temperature > 25) {
    return `Warm and sunny, ${temperature}°C`;
  } else if (condition === 'sunny') {
    return `Clear and pleasant, ${temperature}°C`;
  } else {
    return `${condition.charAt(0).toUpperCase() + condition.slice(1)}, ${temperature}°C`;
  }
};

