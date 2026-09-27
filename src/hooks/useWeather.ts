import { useQuery } from "@tanstack/react-query";

export interface WeatherCurrent {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  visibility: number;
  uvIndex: number;
  isDay: boolean;
}

export interface WeatherDaily {
  date: string;
  tempHigh: number;
  tempLow: number;
  weatherCode: number;
  precipProbability: number;
  sunrise: string;
  sunset: string;
}

export interface EvImpact {
  rangeReduction: number;
  chargingEfficiency: number;
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}

export interface WeatherData {
  current: WeatherCurrent;
  daily: WeatherDaily[];
  evImpact: EvImpact;
  timezone: string;
}

async function fetchWeather(lat: number, lng: number): Promise<WeatherData> {
  const response = await fetch(
    // weather-data is deployed on the MVP project only: otto-q-core (gxdrc) answers 404 for it, so the weather
    // button never loaded (checked 2026-09-26; the MVP function returns 200). Point back when it is deployed on core.
    `https://ycsisvozzgmisboumfqc.supabase.co/functions/v1/weather-data?lat=${lat}&lng=${lng}`,
    {
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljc2lzdm96emdtaXNib3VtZnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NzI5NTcsImV4cCI6MjA2OTA0ODk1N30.8Na6XnuBNbHifv4BcNPGMltaEsmX3QVYMASbopT1MGI`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }

  return response.json();
}

export function useWeather(lat: number, lng: number, enabled: boolean = true) {
  return useQuery({
    queryKey: ['weather', lat, lng],
    queryFn: () => fetchWeather(lat, lng),
    enabled: enabled && !!lat && !!lng,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
    refetchInterval: 15 * 60 * 1000, // Refresh every 15 minutes
    retry: 2,
  });
}
