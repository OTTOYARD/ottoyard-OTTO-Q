import { useMemo, useEffect, useState } from 'react';
import { SafeHarbor, ZonePoint, DrawnZone } from '@/stores/ottoResponseStore';
import { ottoqInvoke } from '@/lib/otto-q-api';

// Adapter interfaces matching what OTTO-RESPONSE needs
export interface AdaptedVehicle {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  status: string;
  soc?: number;
  lastUpdated?: string;
}

export interface AdaptedDepot {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  availableCapacity: number;
  type: 'Depot' | 'Partner';
}

// Haversine distance calculation in miles
export function calculateDistanceMiles(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
    Math.cos((point2.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check if point is inside polygon using ray casting
export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: ZonePoint[]
): boolean {
  if (polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    
    const intersect = ((yi > point.lat) !== (yj > point.lat))
      && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Calculate polygon centroid
export function getPolygonCentroid(polygon: ZonePoint[]): ZonePoint {
  if (polygon.length === 0) return { lat: 0, lng: 0 };
  
  const sum = polygon.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / polygon.length, lng: sum.lng / polygon.length };
}

// Calculate approximate polygon area in square miles
export function getPolygonAreaSqMiles(polygon: ZonePoint[]): number {
  if (polygon.length < 3) return 0;
  
  // Shoelace formula approximation
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].lng * polygon[j].lat;
    area -= polygon[j].lng * polygon[i].lat;
  }
  area = Math.abs(area) / 2;
  
  // Convert to square miles (rough approximation at mid-latitudes)
  const avgLat = polygon.reduce((a, p) => a + p.lat, 0) / n;
  const latMiles = 69; // miles per degree lat
  const lngMiles = 69 * Math.cos((avgLat * Math.PI) / 180); // miles per degree lng
  
  return area * latMiles * lngMiles;
}

// Get approximate distance from point to polygon edge
export function getDistanceToPolygon(
  point: { lat: number; lng: number },
  polygon: ZonePoint[]
): number {
  if (polygon.length === 0) return Infinity;
  
  // Find minimum distance to any edge
  let minDist = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    // Simplified: distance to centroid of edge segment
    const edgeCenter = {
      lat: (polygon[i].lat + polygon[j].lat) / 2,
      lng: (polygon[i].lng + polygon[j].lng) / 2,
    };
    const dist = calculateDistanceMiles(point, edgeCenter);
    minDist = Math.min(minDist, dist);
  }
  return minDist;
}

// Check if vehicle is in zone
export function isVehicleInZone(
  vehicle: AdaptedVehicle,
  zone: DrawnZone
): boolean {
  if (!zone || !zone.type) return false;
  
  if (zone.type === 'radius' && zone.center && zone.radiusMiles) {
    const distance = calculateDistanceMiles(vehicle.location, zone.center);
    return distance <= zone.radiusMiles;
  }
  
  if (zone.type === 'polygon' && zone.points && zone.points.length >= 3) {
    return isPointInPolygon(vehicle.location, zone.points);
  }
  
  return false;
}

// Check if vehicle is near zone (within buffer)
export function isVehicleNearZone(
  vehicle: AdaptedVehicle,
  zone: DrawnZone,
  bufferMiles: number = 0.5
): boolean {
  if (!zone || !zone.type) return false;
  
  if (zone.type === 'radius' && zone.center && zone.radiusMiles) {
    const distance = calculateDistanceMiles(vehicle.location, zone.center);
    return distance > zone.radiusMiles && distance <= zone.radiusMiles + bufferMiles;
  }
  
  if (zone.type === 'polygon' && zone.points && zone.points.length >= 3) {
    if (isPointInPolygon(vehicle.location, zone.points)) return false; // Inside, not near
    const distToPolygon = getDistanceToPolygon(vehicle.location, zone.points);
    return distToPolygon <= bufferMiles;
  }
  
  return false;
}

// Data adapter hook - uses existing shared data
export function useOttoResponseData(
  externalVehicles?: any[],
  externalDepots?: any[]
): {
  vehicles: AdaptedVehicle[];
  depots: AdaptedDepot[];
  safeHarbors: SafeHarbor[];
} {
  const [vehicles, setVehicles] = useState<AdaptedVehicle[]>([]);
  const [depots, setDepots] = useState<AdaptedDepot[]>([]);
  
  // Fetch real data from the OTTO-Q API
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch vehicles
        const vehiclesResponse = await ottoqInvoke<any[]>('ottoq-fleet-vehicles');
        
        const adaptedVehicles = vehiclesResponse.map((v: any) => ({
          id: v.id,
          name: v.name || v.external_ref || v.id,
          location: v.location || { lat: v.lat || 36.1627, lng: v.lng || -86.7816 },
          status: v.status?.toLowerCase() || 'idle',
          soc: typeof v.soc === 'number' ? v.soc : (typeof v.battery === 'number' ? v.battery / 100 : undefined),
          lastUpdated: v.lastLocationUpdate || v.lastUpdated || new Date().toISOString(),
        }));
        
        setVehicles(adaptedVehicles);
        
        // In a real implementation, we would also fetch depots
        // For now, we'll use an empty array since the source of truth
        // for depots might be different
        setDepots([]);
      } catch (error) {
        console.error('Failed to fetch data from OTTO-Q API:', error);
        // Set empty arrays on error, showing honest empty state
        setVehicles([]);
        setDepots([]);
      }
    };
    
    loadData();
    
    // Set up polling every 30 seconds
    const interval = setInterval(loadData, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  const safeHarbors = useMemo<SafeHarbor[]>(() => {
    return depots.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      distanceFromZone: 0, // Will be calculated when zone is drawn
      availableCapacity: d.availableCapacity,
      location: d.location,
    }));
  }, [depots]);
  
  return { vehicles, depots, safeHarbors };
}

// Calculate zone analytics
export function calculateZoneAnalytics(
  vehicles: AdaptedVehicle[],
  zone: DrawnZone | null
): { inside: number; near: number } {
  if (!zone) return { inside: 0, near: 0 };
  
  let inside = 0;
  let near = 0;
  
  for (const vehicle of vehicles) {
    if (isVehicleInZone(vehicle, zone)) {
      inside++;
    } else if (isVehicleNearZone(vehicle, zone)) {
      near++;
    }
  }
  
  return { inside, near };
}

// Update safe harbor distances from zone center
export function updateSafeHarborDistances(
  harbors: SafeHarbor[],
  zone: DrawnZone | null
): SafeHarbor[] {
  if (!zone) return harbors;
  
  let zoneCenter: ZonePoint;
  
  if (zone.type === 'radius' && zone.center) {
    zoneCenter = zone.center;
  } else if (zone.type === 'polygon' && zone.points?.length) {
    zoneCenter = getPolygonCentroid(zone.points);
  } else {
    return harbors;
  }
  
  return harbors.map((harbor) => ({
    ...harbor,
    distanceFromZone: Math.round(calculateDistanceMiles(harbor.location, zoneCenter) * 10) / 10,
  }));
}
