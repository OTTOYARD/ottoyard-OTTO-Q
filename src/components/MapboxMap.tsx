import React from 'react';
import { MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Vehicle {
  id: string;
  name: string;
  status: string;
  battery: number;
  location: { lat: number; lng: number };
  route: string;
}

interface Depot {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  totalStalls: number;
  availableStalls: number;
  energyGenerated: number;
  energyReturned: number;
  vehiclesCharging: number;
  status: string;
}

interface MapboxMapProps {
  vehicles: Vehicle[];
  depots: Depot[];
  city?: { name: string; coordinates: [number, number] };
  onVehicleClick?: (vehicleId: string) => void;
  onDepotClick?: (depotId: string) => void;
}

const MapboxMap: React.FC<MapboxMapProps> = ({ vehicles, depots, city }) => {
  return (
    <Card className="w-full h-full min-h-[400px] surface-luxury">
      <CardContent className="flex flex-col items-center justify-center h-full py-16 text-center gap-3">
        <MapPin className="w-10 h-10 text-muted-foreground" />
        <div className="text-lg font-medium text-foreground">
          Map / GPS view unavailable
        </div>
        <div className="text-sm text-muted-foreground max-w-md">
          Live map rendering is currently disabled.
          {city ? ` Tracking ${vehicles.length} vehicles and ${depots.length} depots in ${city.name}.` : ''}
        </div>
      </CardContent>
    </Card>
  );
};

export default MapboxMap;
