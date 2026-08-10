// Incidents Store with Auto-Rotating Lifecycle Timers

import { create } from 'zustand';
import {
  Incident,
  IncidentStatus,
  IncidentType,
  seedIncidents,
  createIncident,
  getRandomTruck,
  TimelineEntry,
} from '@/types/incidents';

interface IncidentsStore {
  incidents: Incident[];
  selectedIncidentId: string | null;
  statusFilter: IncidentStatus[];
  cityFilter: string;
  
  // Actions
  initializeIncidents: () => void;
  selectIncident: (id: string | null) => void;
  setStatusFilter: (statuses: IncidentStatus[]) => void;
  setCityFilter: (city: string) => void;
  refreshIncidents: () => void;
  
  // Incident lifecycle
  advanceIncidentStatus: (incidentId: string) => void;
  markIncidentClosed: (incidentId: string) => void;
  updateIncidentReport: (incidentId: string, report: Partial<Incident['report']>) => void;
  
  // OTTOW dispatch
  dispatchOTTOW: (vehicleId: string, city: string, type: IncidentType, summary: string) => string;
  
  // Timer management
  startTimers: () => void;
  stopTimers: () => void;
  tick: () => void;
}

let timerInterval: NodeJS.Timeout | null = null;
const TICK_INTERVAL = 15000; // 15 seconds

export const useIncidentsStore = create<IncidentsStore>((set, get) => ({
  incidents: [],
  selectedIncidentId: null,
  statusFilter: [],
  cityFilter: "All Cities",
  
  initializeIncidents: () => {
    const incidents = seedIncidents();
    set({ incidents });
    get().startTimers();
  },
  
  selectIncident: (id) => {
    set({ selectedIncidentId: id });
  },
  
  setStatusFilter: (statuses) => {
    set({ statusFilter: statuses });
  },
  
  setCityFilter: (city) => {
    set({ cityFilter: city });
  },
  
  refreshIncidents: () => {
    get().stopTimers();
    const incidents = seedIncidents();
    set({ incidents, selectedIncidentId: null });
    get().startTimers();
  },
  
  advanceIncidentStatus: (incidentId) => {
    set((state) => {
      const incidents = [...state.incidents];
      const incident = incidents.find((i) => i.incidentId === incidentId);
      if (!incident) return state;
      
      const now = new Date().toISOString();
      const newTimeline: TimelineEntry[] = [...incident.timeline];
      
      if (incident.status === "Reported") {
        // Reported → Dispatched
        incident.status = "Dispatched";
        incident.timestamps.dispatchedAt = now;
        const truck = getRandomTruck();
        incident.tow.assigned = true;
        incident.tow.truckId = truck.id;
        incident.tow.driver = truck.driver;
        const pickupEta = 240 + Math.floor(Math.random() * 240); // 4-8 min
        incident.tow.pickupEtaSeconds = pickupEta;
        incident.etaSeconds = pickupEta;
        newTimeline.unshift({
          status: "Dispatched",
          ts: now,
          note: `OTTOW ${truck.id} en route with driver ${truck.driver}`,
        });
      } else if (incident.status === "Dispatched") {
        // Dispatched → Secured
        incident.status = "Secured";
        incident.timestamps.securedAt = now;
        const returnEta = 300 + Math.floor(Math.random() * 300); // 5-10 min
        incident.tow.returnEtaSeconds = returnEta;
        incident.etaSeconds = returnEta;
        newTimeline.unshift({
          status: "Secured",
          ts: now,
          note: `Vehicle secured on truck ${incident.tow.truckId}`,
        });
      } else if (incident.status === "Secured") {
        // Secured → At Depot
        incident.status = "At Depot";
        incident.timestamps.atDepotAt = now;
        incident.etaSeconds = null;
        newTimeline.unshift({
          status: "At Depot",
          ts: now,
          note: "Arrived at depot intake",
        });
        
        // Schedule auto-close after 2-5 min
        const autoCloseDelay = 120000 + Math.floor(Math.random() * 180000);
        setTimeout(() => {
          const currentState = get();
          const currentIncident = currentState.incidents.find((i) => i.incidentId === incidentId);
          if (currentIncident && currentIncident.status === "At Depot") {
            get().markIncidentClosed(incidentId);
          }
        }, autoCloseDelay);
      }
      
      incident.timeline = newTimeline;
      
      return { incidents };
    });
  },
  
  markIncidentClosed: (incidentId) => {
    set((state) => {
      const incidents = [...state.incidents];
      const incident = incidents.find((i) => i.incidentId === incidentId);
      if (!incident) return state;
      
      if (incident.status !== "At Depot" && incident.status !== "Closed") {
        return state; // Can only close from At Depot
      }
      
      const now = new Date().toISOString();
      incident.status = "Closed";
      incident.timestamps.closedAt = now;
      incident.etaSeconds = null;
      
      const newTimeline: TimelineEntry[] = [...incident.timeline];
      newTimeline.unshift({
        status: "Closed",
        ts: now,
        note: "Incident manually closed",
      });
      incident.timeline = newTimeline;
      
      return { incidents };
    });
  },
  
  updateIncidentReport: (incidentId, reportUpdate) => {
    set((state) => {
      const incidents = [...state.incidents];
      const incident = incidents.find((i) => i.incidentId === incidentId);
      if (!incident) return state;
      
      incident.report = { ...incident.report, ...reportUpdate };
      
      return { incidents };
    });
  },
  
  dispatchOTTOW: (vehicleId, city, type, summary) => {
    const newIncident = createIncident(vehicleId, city, type, "Dispatched", summary);
    
    set((state) => ({
      incidents: [newIncident, ...state.incidents],
      selectedIncidentId: newIncident.incidentId,
    }));
    
    return newIncident.incidentId;
  },
  
  startTimers: () => {
    if (timerInterval) return; // Already running
    
    timerInterval = setInterval(() => {
      get().tick();
    }, TICK_INTERVAL);
  },
  
  stopTimers: () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  },
  
  tick: () => {
    set((state) => {
      const incidents = [...state.incidents];
      let updated = false;
      
      incidents.forEach((incident) => {
        if (incident.etaSeconds !== null && incident.etaSeconds > 0) {
          incident.etaSeconds = Math.max(0, incident.etaSeconds - 15);
          updated = true;
          
          if (incident.etaSeconds === 0) {
            // Trigger status advance
            setTimeout(() => {
              get().advanceIncidentStatus(incident.incidentId);
            }, 0);
          }
        }
      });
      
      return updated ? { incidents } : state;
    });
  },
}));

// Initialize on mount
if (typeof window !== 'undefined') {
  const store = useIncidentsStore.getState();
  if (store.incidents.length === 0) {
    store.initializeIncidents();
  }
}
