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
}

export interface Incident {
  id: string;
  type: IncidentType;
  status: IncidentStatus;
  vehicle: string;
  fleet: string;
  location: string;
  reported: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  description: string;
  tow: TowInfo;
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
  id: string;
  incidentId: string;
  timestamp: string;
  action: string;
  description: string;
}

export interface PredictedMaintenance {
  id: string;
  vehicle: string;
  type: string;
  predictedDate: string;
  confidence: number;
  estimatedCost: number;
  notes: string;
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

export function getRandomTruck(): string { return ''; }
export function seedIncidents(): any[] { return []; }
export function createIncident(): any { return null; }
export function getServicePrice(service: string): number {
  return servicePricing[service] ?? 0;
}
