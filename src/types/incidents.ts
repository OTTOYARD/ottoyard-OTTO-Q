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

// Maintenance record type
export interface MaintenanceRecord {
  id: string;
  vehicle: string;
  type: string;
  status: string;
  date: string;
  cost: number;
  notes: string;
}

// Service pricing (from maintenance-mock) — explicit; not fake data
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
// All other stubs and exports are now replaced with real data from the twin via useTwinData hook.
// See src/hooks/useTwinData.ts for the implementation that replaces:
// - getRandomTruck
// - seedIncidents
// - vehicles array
// - predictiveMaintenanceData
// - upcomingMaintenance
// - upcomingDetailing
// - createIncident
