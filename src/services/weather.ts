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
  private apiKey: string;
  private baseUrl = 'https://api.openweathermap.org/data/2.5';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 10 * 60 * 1000; // 10 minutes

  constructor(apiKey?: string) {
    this.apiKey = apiKey || import.meta.env.VITE_OPENWEATHER_API_KEY || '';
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

    if (!this.apiKey) {
      return this.getMockWeatherData('current');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/weather?lat=${location.latitude}&lon=${location.longitude}&appid=${this.apiKey}&units=metric`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.statusText}`);
      }

      const data = await response.json();
      this.setCachedData(cacheKey, data);
      return this.parseWeatherData(data);
    } catch (error) {
      console.warn('Failed to fetch real weather data, using mock data:', error);
      return this.getMockWeatherData('current');
    }
  }

  /**
   * Get weekend forecast (5-day forecast filtered for Saturday/Sunday)
   */
  async getWeekendForecast(location: LocationCoords): Promise<WeatherForecast> {
    const cacheKey = `forecast-${location.latitude}-${location.longitude}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return this.parseWeatherForecast(cached);

    if (!this.apiKey) {
      return this.getMockWeatherForecast();
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/forecast?lat=${location.latitude}&lon=${location.longitude}&appid=${this.apiKey}&units=metric`
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

  private parseWeatherData(data: any): WeatherData {
    return {
      condition: this.mapWeatherCondition(data.weather[0].main),
      temperature: Math.round(data.main.temp),
      humidity: data.main.humidity,
      windSpeed: Math.round((data.wind?.speed || 0) * 3.6), // Convert m/s to km/h
      precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
      uvIndex: data.uvi || 0,
      visibility: Math.round((data.visibility || 10000) / 1000), // Convert m to km
      description: data.weather[0].description,
      icon: data.weather[0].icon,
    };
  }

  private parseWeatherForecast(data: any): WeatherForecast {
    const current = this.parseWeatherData(data.list[0]);
    
    // Find Saturday and Sunday forecasts (using noon forecasts as representative)
    const now = new Date();
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + ((6 - now.getDay()) % 7));
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);

    const saturdayForecast = this.findClosestForecast(data.list, saturday);
    const sundayForecast = this.findClosestForecast(data.list, sunday);

    return {
      current,
      saturday: this.parseWeatherData(saturdayForecast),
      sunday: this.parseWeatherData(sundayForecast),
      hourly: data.list.slice(0, 24).map((item: any) => this.parseWeatherData(item)),
    };
  }

  private findClosestForecast(forecasts: any[], targetDate: Date): any {
    const targetTime = new Date(targetDate);
    targetTime.setHours(12, 0, 0, 0); // Noon

    let closest = forecasts[0];
    let closestDiff = Math.abs(new Date(closest.dt * 1000).getTime() - targetTime.getTime());

    for (const forecast of forecasts) {
      const forecastTime = new Date(forecast.dt * 1000);
      const diff = Math.abs(forecastTime.getTime() - targetTime.getTime());
      
      if (diff < closestDiff) {
        closest = forecast;
        closestDiff = diff;
      }
    }

    return closest;
  }

  private mapWeatherCondition(condition: string): WeatherData['condition'] {
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
