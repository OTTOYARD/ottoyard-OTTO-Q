// Fleet intelligence stub — formerly imported from mock data.
// Replaced with honest empty state. Wire to real API as data becomes available.

export interface FleetIntelligence {
  vehicles: any[];
  stalls: any[];
  schedule: { assignments: any[] };
  energyAnalytics: any;
}

export const fleetIntelligence: FleetIntelligence = {
  vehicles: [],
  stalls: [],
  schedule: { assignments: [] },
  energyAnalytics: {},
};
