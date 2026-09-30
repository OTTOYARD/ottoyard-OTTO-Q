import React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWeather } from '@/hooks/useWeather';
import { getWeatherEmoji } from '@/utils/weatherCodes';
import { City } from '@/components/CitySearchBar';
import { WeatherDialog } from '@/components/WeatherDialog';

interface WeatherButtonProps {
  city: City;
}

export const WeatherButton: React.FC<WeatherButtonProps> = ({ city }) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  
  const { data: weather, isLoading, error } = useWeather(
    city.coordinates[1], // lat
    city.coordinates[0], // lng
  );

  if (isLoading) {
    return (
      <Skeleton className="h-8 w-32 rounded-md" />
    );
  }

  if (error || !weather) {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className="text-muted-foreground text-xs"
        disabled
      >
        Weather unavailable
      </Button>
    );
  }

  const emoji = getWeatherEmoji(weather.current.weatherCode, weather.current.isDay);
  const tempColor = weather.current.temperature < 50 
    ? 'text-blue-400' 
    : weather.current.temperature > 85 
      ? 'text-orange-400' 
      : 'text-foreground';

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDialogOpen(true)}
        className="bg-background/50 backdrop-blur-sm border border-border/50 hover:bg-background/80 px-1.5 py-0.5 h-6 [@media(pointer:coarse)]:h-8 gap-1 text-xs"
      >
        <span className="text-xs text-muted-foreground">{city.name}</span>
        <span className={`text-xs font-semibold ${tempColor}`}>
          {weather.current.temperature}°F
        </span>
        <span className="text-sm">{emoji}</span>
      </Button>

      <WeatherDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        city={city}
        weather={weather}
      />
    </>
  );
};
