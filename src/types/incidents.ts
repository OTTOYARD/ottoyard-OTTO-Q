// Incident and maintenance types — extracted from old mock data files.
// These types are used by components that now read from the real API.

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
// Stub: generates empty tow truck data since real incident dispatch isn't wired yet.
export function getRandomTruck(): TowInfo {
  return {
    assigned: false,
    provider: '',
    truckId: null,
    driverName: null,
    eta: -1,
  };
}

export function seedIncidents(): Incident[] {
  return [];
}

export interface TimelineEntry {
  id: string;
  incidentId: string;
  timestamp: string;
  action: string;
  details: string;
}

export function createIncident(incident: Partial<Incident>): Incident {
  return {
    id: incident.id || '',
    type: incident.type || 'malfunction',
    status: incident.status || 'Reported',
    vehicle: incident.vehicle || '',
    fleet: incident.fleet || '',
    location: incident.location || '',
    reported: incident.reported || new Date().toISOString(),
    priority: incident.priority || 'Low',
    description: incident.description || '',
    tow: incident.tow || getRandomTruck(),
  };
}
export const vehicles: any[] = [];

export interface PredictedMaintenance {
  id: string;
  vehicle: string;
  type: string;
  predictedDate: string;
  confidence: number;
  estimatedCost: number;
}

export function getServicePrice(service: string): number {
  return servicePricing[service] || 0;
}

export const predictiveMaintenanceData: PredictedMaintenance[] = [];
export const upcomingMaintenance: PredictedMaintenance[] = [];
export const upcomingDetailing: PredictedMaintenance[] = [];
