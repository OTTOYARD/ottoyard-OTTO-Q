// Hook for managing AV orchestrator state and simulation

import { useState, useCallback, useRef, useEffect } from "react";
import { AVOrchestrator, type ServicePipeline, type DemandWindow, type EnergyArbitrageResult, type TransitionEvent } from "@/services/ottoq-av-orchestrator";
import { ThresholdEngine } from "@/services/ottoq-engine";
import type { OttoQVehicle, OttoQDepotStall, OttoQServiceThreshold, OttoQEnergyPricing, ServiceType } from "@/types/ottoq";
import { ottoqRpc, ottoqInvoke } from "@/lib/otto-q-api";

export function useAVOrchestrator() {
  const [pipelines, setPipelines] = useState<ServicePipeline[]>([]);
  const [events, setEvents] = useState<TransitionEvent[]>([]);
  const [demandForecast, setDemandForecast] = useState<DemandWindow[]>([]);
  const [energyResult, setEnergyResult] = useState<EnergyArbitrageResult | null>(null);
  const [isSurge, setIsSurge] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const engineRef = useRef<ThresholdEngine | null>(null);
  const orchestratorRef = useRef<AVOrchestrator | null>(null);
  const arrivalCountRef = useRef(0);

  const durationMap = useRef(new Map<ServiceType, number>());
  
  const refresh = useCallback(() => {
    const o = orchestratorRef.current;
    setPipelines(o.getPipelines());
    setEvents(o.getEvents().slice(0, 50));
    setDemandForecast(o.getDemandForecast(isSurge));
    setEnergyResult(o.computeEnergyArbitrage(o.getPipelines().length || 5));
  }, [isSurge]);

  // Initialize the orchestrator with real data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch real service thresholds
        const thresholds = await ottoqRpc<OttoQServiceThreshold[]>('ottoq_service_thresholds', { depot_id: 'depot-1' });
        
        // Fetch real energy pricing
        const pricing = await ottoqRpc<OttoQEnergyPricing[]>('ottoq_energy_pricing', { depot_id: 'depot-1' });
        
        // Update duration map with real threshold data
        durationMap.current.clear();
        for (const t of thresholds) {
          durationMap.current.set(t.service_type, t.estimated_duration_minutes);
        }
        
        // Initialize the engine and orchestrator with real data
        const engine = new ThresholdEngine(thresholds, pricing);
        const orchestrator = new AVOrchestrator(engine);
        
        engineRef.current = engine;
        orchestratorRef.current = orchestrator;
        
        // Refresh to load initial state
        refresh();
        
      } catch (error) {
        console.error('Failed to load AV orchestrator:', error);
        
        // Fallback to empty arrays for honest empty state
        const engine = new ThresholdEngine([], []);
        const orchestrator = new AVOrchestrator(engine);
        
        engineRef.current = engine;
        orchestratorRef.current = orchestrator;
        
        // Refresh to load initial state
        refresh();
      }
    };
    
    loadData();
    
    // Set up polling every 30 seconds
    const interval = setInterval(loadData, 30000);
    
    return () => clearInterval(interval);
    
  }, [refresh]);

  const [mockStalls, setMockStalls] = useState<OttoQDepotStall[]>([]);

  // Fetch real stalls from the API
  useEffect(() => {
    const loadStalls = async () => {
      try {
        const stalls = await ottoqRpc<OttoQDepotStall[]>('ottoq_depot_cards', { depot_id: 'depot-1' });
        setMockStalls(stalls);
      } catch (error) {
        console.error('Failed to load stalls:', error);
        // Fallback to empty array for honest empty state
        setMockStalls([]);
      }
    };
    
    loadStalls();
    
    // Set up polling every 30 seconds
    const interval = setInterval(loadStalls, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const triggerArrival = useCallback(async () => {
    try {
      // Fetch a real vehicle from the API
      const vehicles = await ottoqInvoke<{ vehicles: OttoQVehicle[] }>('ottoq-fleet-vehicles');
      
      if (vehicles && vehicles.vehicles && vehicles.vehicles.length > 0) {
        // Use the first vehicle from the fleet
        const vehicle = vehicles.vehicles[0];
        
        if (orchestratorRef.current && durationMap.current && mockStalls) {
          orchestratorRef.current.triggerArrival(vehicle, mockStalls, durationMap.current);
        }
      }
    } catch (error) {
      console.error('Failed to fetch vehicle for arrival:', error);
      // Use fallback if API call fails
    }
    
    refresh();
  }, [refresh]);

  const fastForward = useCallback(() => {
    orchestratorRef.current.simulateProgress();
    refresh();
  }, [refresh]);

  const toggleSurge = useCallback(() => {
    const next = !isSurge;
    setIsSurge(next);
    orchestratorRef.current.setSurgeMultiplier(next ? 2 : 1);
  }, [isSurge]);

  const resetSim = useCallback(() => {
    orchestratorRef.current.resetSimulation();
    arrivalCountRef.current = 0;
    refresh();
  }, [refresh]);

  // Auto-tick when running
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      orchestratorRef.current.simulateProgress();
      refresh();
    }, 2000);
    return () => clearInterval(id);
  }, [isRunning, refresh]);

  // Initial forecast
  useEffect(() => { refresh(); }, [refresh]);

  return {
    pipelines,
    events,
    demandForecast,
    energyResult,
    isSurge,
    isRunning,
    triggerArrival,
    fastForward,
    toggleSurge,
    resetSim,
    setIsRunning,
    stagedCount: orchestratorRef.current.getStagedCount(),
    inServiceCount: orchestratorRef.current.getInServiceCount(),
    deployedCount: orchestratorRef.current.getDeployedCount(),
  };
}
