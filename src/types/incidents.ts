// Incident and maintenance types — extracted from old mock data files.
// These types and stubs are being replaced with live Supabase queries from the twin.
// See src/hooks/useTwinData.ts for the real implementation.

export type IncidentType = "collision" | "malfunction" | "interior" | "vandalism";
export type IncidentStatus = "Reported" | "Dispatched" | "Secured" | "At Depot" | "Closed";

export interface TowInfo {
  assigned: boolean;
  provider: string;
  truckId: string | null;
  driverName: string | null;
  eta: number;
  // Legacy / alternate shapes still referenced by UI components
  id?: string;
  driver?: any;
  pickupEtaSeconds?: number;
  [key: string]: any;
}

export interface Incident {
  id: string;
  type: IncidentType;
  status: IncidentStatus;
  vehicle: any;
  fleet: string;
  location: any;
  reported: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  description: string;
  tow: any;
  // Legacy fields still referenced by UI components
  incidentId?: string;
  city?: string;
  vehicleId?: string;
  summary?: string;
  timestamps?: any;
  timeline?: any[];
  etaSeconds?: number;
  report?: any;
  [key: string]: any;
}

export interface MaintenanceRecord {
  id: string;
  vehicle: string;
  type: string;
  status: string;
  date: string;
  cost: number;
  notes: string;
}

export interface TimelineEntry {
  id?: string;
  incidentId?: string;
  timestamp?: string;
  action?: string;
  description?: string;
  status?: string;
  [key: string]: any;
}

export interface PredictedMaintenance {
  id: string;
  vehicle: any;
  type: string;
  predictedDate: string;
  confidence: number;
  estimatedCost: number;
  notes?: string;
  // Legacy fields still referenced by UI components
  vehicleId?: string;
  vehicleName?: string;
  oem?: string;
  predictedService?: any;
  [key: string]: any;
}

export const servicePricing: Record<string, number> = {
  "Tire Rotation": 75,
  "Brake Pad Replacement": 350,
  "Battery Health Check": 125,
  "Sensor Calibration": 200,
  "Fluid Top-up": 50,
  "Full Interior Detail": 150,
  "Exterior Wash": 45,
  "Interior Sanitization": 80,
};

// Compatibility stubs — components should use useTwinData instead
export const vehicles: any[] = [];
export const predictiveMaintenanceData: any[] = [];
export const upcomingMaintenance: any[] = [];
export const upcomingDetailing: any[] = [];

export function getRandomTruck(): any { return { id: '', driver: '' }; }
export function seedIncidents(): any[] { return []; }
export function createIncident(...args: any[]): any { return null; }
export function getServicePrice(service: string): number {
  return servicePricing[service] ?? 0;
}
