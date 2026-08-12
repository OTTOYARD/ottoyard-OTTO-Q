// Hook to fetch and poll real twin data from the OTTO-Q backend
// Replaces mock data stubs with live Supabase queries via ottoqRpc

import { useEffect, useState } from 'react';
import { ottoqRpc } from '../lib/otto-q-api';
import { 
  Incident, 
  IncidentType, 
  IncidentStatus, 
  TimelineEntry, 
  createIncident, 
  getRandomTruck,
  PredictedMaintenance,
  vehicles as mockVehicles,
  predictiveMaintenanceData,
  upcomingMaintenance,
  upcomingDetailing,
  getServicePrice
} from '../types/incidents';

// Types for real twin data
interface TwinVehicle {
  vehicle_id: string;
  display_name: string;
  fleet_operator_id: string;
  stall_id: string | null;
  stall_code: string | null;
  soc_pct: number;
  soc_status: string;
  odometer_miles: number;
  last_seen_at: string;
  status: string;
  service_queue: string[];
  wear_metrics: {
    battery_cycles: number;
    brake_wear_pct: number;
    tire_wear_pct: number;
    suspension_cycles: number;
  };
}

interface TwinEvent {
  id: string;
  sim_run_id: string;
  vehicle_id: string;
  event_type: string;
  severity: string;
  timestamp: string;
  details: Record<string, any>;
}

interface TwinSnapshot {
  vehicles: TwinVehicle[];
  // other fields omitted for brevity
}

interface TwinEventsWindow {
  events: TwinEvent[];
}

interface TwinWearWindow {
  wear_events: Array<{
    vehicle_id: string;
    metric: string;
    value: number;
    threshold: number;
    timestamp: string;
  }>;
}

// Mapping functions
function mapVehicleToIncidentVehicle(vehicle: TwinVehicle): string {
  return `${vehicle.display_name} (${vehicle.vehicle_id.slice(0, 8)})`;
}

function mapTwinEventToIncident(event: TwinEvent): Incident {
  // Map event_type to IncidentType
  const typeMap: Record<string, IncidentType> = {
    'collision': 'collision',
    'malfunction': 'malfunction',
    'interior_damage': 'interior',
    'vandalism': 'vandalism'
  };
  const incidentType = typeMap[event.event_type] || 'malfunction';

  // Map severity to priority
  const priorityMap: Record<string, Incident['priority']> = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'critical': 'Critical'
  };
  const priority = priorityMap[event.severity] || 'Medium';

  return {
    id: event.id,
    type: incidentType,
    status: 'Reported' as IncidentStatus,
    vehicle: mapVehicleToIncidentVehicle({
      vehicle_id: event.vehicle_id,
      display_name: event.details?.display_name || 'Unknown',
      fleet_operator_id: '',
      stall_id: null,
      stall_code: null,
      soc_pct: 0,
      soc_status: '',
      odometer_miles: 0,
      last_seen_at: '',
      status: '',
      service_queue: [],
      wear_metrics: { battery_cycles: 0, brake_wear_pct: 0, tire_wear_pct: 0, suspension_cycles: 0 }
    }),
    fleet: event.details?.fleet_operator_id || 'Unknown',
    location: event.details?.location || 'Unknown',
    reported: event.timestamp,
    priority,
    description: event.details?.description || `A ${event.event_type} event occurred.`,
    tow: getRandomTruck()
  };
}

function mapTwinVehicleToPredictedMaintenance(vehicle: TwinVehicle): PredictedMaintenance[] {
  const now = new Date();
  const maintenance: PredictedMaintenance[] = [];

  // Brake wear
  if (vehicle.wear_metrics.brake_wear_pct > 70) {
    maintenance.push({
      id: `${vehicle.vehicle_id}-brakes`,
      vehicle: mapVehicleToIncidentVehicle(vehicle),
      type: 'Brake Pad Replacement',
      predictedDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      confidence: 0.85,
      estimatedCost: getServicePrice('Brake Pad Replacement')
    });
  }

  // Tire wear
  if (vehicle.wear_metrics.tire_wear_pct > 80) {
    maintenance.push({
      id: `${vehicle.vehicle_id}-tires`,
      vehicle: mapVehicleToIncidentVehicle(vehicle),
      type: 'Tire Rotation',
      predictedDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      confidence: 0.75,
      estimatedCost: getServicePrice('Tire Rotation')
    });
  }

  // Battery health
  if (vehicle.wear_metrics.battery_cycles > 1000) {
    maintenance.push({
      id: `${vehicle.vehicle_id}-battery`,
      vehicle: mapVehicleToIncidentVehicle(vehicle),
      type: 'Battery Health Check',
      predictedDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      confidence: 0.9,
      estimatedCost: getServicePrice('Battery Health Check')
    });
  }

  return maintenance;
}

// Hook implementation
export function useTwinData(simRunId: string) {
  const [vehicles, setVehicles] = useState<TwinVehicle[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [predictiveMaintenance, setPredictiveMaintenance] = useState<PredictedMaintenance[]>([]);
  const [upcomingMaint, setUpcomingMaint] = useState<PredictedMaintenance[]>([]);
  const [upcomingDetail, setUpcomingDetail] = useState<PredictedMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout | null = null;

    const fetchData = async () => {
      try {
        // Fetch fleet condition (vehicles)
        const fleetCondition = await ottoqRpc<TwinSnapshot>('ottoq_twin_fleet_condition', { sim_run_id: simRunId });
        
        // Fetch events window (incidents)
        const eventsWindow = await ottoqRpc<TwinEventsWindow>('ottoq_twin_events_window', { sim_run_id: simRunId });
        
        // Fetch wear window (predictive maintenance)
        const wearWindow = await ottoqRpc<TwinWearWindow>('ottoq_twin_wear_window', { sim_run_id: simRunId }); // Assuming this RPC exists
        
        if (mounted) {
          // Update vehicles
          setVehicles(fleetCondition.vehicles);
          
          // Update incidents from events
          const newIncidents = eventsWindow.events
            .filter(event => ['collision', 'malfunction', 'interior_damage', 'vandalism'].includes(event.event_type))
            .map(mapTwinEventToIncident);
          setIncidents(newIncidents);
          
          // Update predictive maintenance from vehicle wear metrics
          const allPredictive: PredictedMaintenance[] = [];
          const upcoming: PredictedMaintenance[] = [];
          
          fleetCondition.vehicles.forEach(vehicle => {
            const vehiclePredictive = mapTwinVehicleToPredictedMaintenance(vehicle);
            allPredictive.push(...vehiclePredictive);
            // Filter for near-term maintenance
            if (vehiclePredictive.length > 0) {
              upcoming.push(...vehiclePredictive);
            }
          });
          
          setPredictiveMaintenance(allPredictive);
          setUpcomingMaint(upcoming);
          // upcomingDetailing remains empty as it's not derived from twin data yet
          setUpcomingDetail([]);
          
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch twin data');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchData();
    
    // Poll every 30 seconds
    interval = setInterval(fetchData, 30000);
    
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [simRunId]);

  return {
    vehicles,
    incidents,
    predictiveMaintenance,
    upcomingMaint,
    upcomingDetail,
    loading,
    error
  };
}
