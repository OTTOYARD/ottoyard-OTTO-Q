// Enhanced Fleet Scheduling Service for OttoCommand AI
import { fleetIntelligence } from "./fleetIntelligence";
import { Vehicle, Stall, ChargingAssignment } from "../agent/tools";

export class FleetSchedulingService {
  
  // Intelligent vehicle scheduling with conflict prevention
  static scheduleVehicle(vehicleId: string, stallId: string, start: string, end: string): {
    success: boolean;
    assignment?: ChargingAssignment;
    conflicts?: string[];
    recommendations?: string[];
  } {
    const { vehicles, stalls, schedule } = fleetIntelligence;
    
    // Find vehicle and stall
    const vehicle = vehicles.find(v => v.id === vehicleId);
    const stall = stalls.find(s => s.id === stallId);
    
    if (!vehicle || !stall) {
      return {
        success: false,
        conflicts: [`Vehicle ${vehicleId} or Stall ${stallId} not found`]
      };
    }

    // Check for scheduling conflicts
    const conflicts = this.checkSchedulingConflicts(stallId, start, end);
    if (conflicts.length > 0) {
      const alternatives = this.findAlternativeStalls(stall.depotId, start, end);
      return {
        success: false,
        conflicts,
        recommendations: alternatives.map(alt => 
          `Alternative: ${alt.id} (${alt.powerKW}kW) available`
        )
      };
    }

    // Calculate optimal charging parameters
    const chargingParams = this.calculateChargingParameters(vehicle, stall, start, end);
    
    // Create assignment
    const assignment: ChargingAssignment = {
      vehicleId,
      stallId,
      start,
      end,
      chargingType: chargingParams.chargingType,
      priority: this.calculatePriority(vehicle),
      estimatedCost: chargingParams.estimatedCost
    };

    // Add to schedule
    schedule.assignments.push(assignment);
    
    return {
      success: true,
      assignment,
      recommendations: [
        `Estimated charge time: ${chargingParams.estimatedMinutes} minutes`,
        `Energy delivery: ${chargingParams.estimatedkWh.toFixed(1)} kWh`,
        `Final SOC: ${(chargingParams.finalSOC * 100).toFixed(1)}%`
      ]
    };
  }

  // Advanced conflict detection
  private static checkSchedulingConflicts(stallId: string, start: string, end: string): string[] {
    const conflicts: string[] = [];
    const startTime = new Date(start);
    const endTime = new Date(end);
    
    for (const assignment of fleetIntelligence.schedule.assignments) {
      if (assignment.stallId === stallId) {
        const assignmentStart = new Date(assignment.start);
        const assignmentEnd = new Date(assignment.end);
        
        if (
          (startTime >= assignmentStart && startTime < assignmentEnd) ||
          (endTime > assignmentStart && endTime <= assignmentEnd) ||
          (startTime <= assignmentStart && endTime >= assignmentEnd)
        ) {
          conflicts.push(`Stall ${stallId} already assigned to ${assignment.vehicleId} from ${assignment.start} to ${assignment.end}`);
        }
      }
    }
    
    return conflicts;
  }

  // Intelligent alternative stall finder
  private static findAlternativeStalls(depotId: string, start: string, end: string): Stall[] {
    const availableStalls = fleetIntelligence.stalls
      .filter(stall => 
        stall.depotId === depotId && 
        stall.status === "open" &&
        this.checkSchedulingConflicts(stall.id, start, end).length === 0
      )
      .sort((a, b) => (b.powerKW || 0) - (a.powerKW || 0)); // Prefer higher power

    return availableStalls.slice(0, 3); // Top 3 alternatives
  }

  // Smart charging parameter calculation
  private static calculateChargingParameters(vehicle: Vehicle, stall: Stall, start: string, end: string) {
    const duration = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60); // minutes
    const batteryCapacity = vehicle.batteryCapacity || 200; // kWh default
    const currentSOC = vehicle.soc || 0.2;
    const chargingPower = Math.min(stall.powerKW, batteryCapacity * 0.5); // Conservative charging rate
    
    const maxChargeableEnergy = batteryCapacity * (0.95 - currentSOC); // To 95% max
    const timeBasedEnergy = (chargingPower * duration) / 60; // kWh in available time
    const actualEnergy = Math.min(maxChargeableEnergy, timeBasedEnergy);
    
    const finalSOC = Math.min(0.95, currentSOC + (actualEnergy / batteryCapacity));
    const estimatedMinutes = Math.min(duration, (actualEnergy / chargingPower) * 60);
    
    // Determine charging type based on power and duration
    let chargingType = "standard";
    if (chargingPower >= 150) chargingType = "fast";
    if (chargingPower >= 250) chargingType = "ultra_fast";
    if (duration > 480) chargingType = "overnight"; // 8+ hours
    
    return {
      estimatedkWh: actualEnergy,
      finalSOC,
      estimatedMinutes,
      chargingType,
      estimatedCost: actualEnergy * 0.12 // $0.12/kWh
    };
  }

  // Priority calculation based on vehicle status and SOC
  private static calculatePriority(vehicle: Vehicle): string {
    const soc = vehicle.soc || 0;
    const status = vehicle.status;
    
    if (soc < 0.15 || status === "maintenance") return "critical";
    if (soc < 0.30 || status === "active") return "high";
    if (soc < 0.50) return "medium";
    return "low";
  }

  // Fleet-wide optimization insights
  static getOptimizationInsights(depotId?: string): {
    utilizationScore: number;
    recommendations: string[];
    criticalAlerts: string[];
    efficiencyMetrics: Record<string, number>;
  } {
    const { vehicles, stalls, energyAnalytics } = fleetIntelligence;
    
    const relevantVehicles = depotId 
      ? vehicles.filter(v => v.currentDepotId === depotId)
      : vehicles;
    
    const relevantStalls = depotId
      ? stalls.filter(s => s.depotId === depotId) 
      : stalls;

    // Calculate utilization metrics
    const activeVehicles = relevantVehicles.filter(v => v.status === "active").length;
    const chargingVehicles = relevantVehicles.filter(v => v.status === "charging").length;
    const lowBatteryVehicles = relevantVehicles.filter(v => (v.soc || 0) < 0.25).length;
    const availableStalls = relevantStalls.filter(s => s.status === "open").length;
    
    const utilizationScore = Math.round(
      ((activeVehicles + chargingVehicles) / relevantVehicles.length) * 100
    );

    const recommendations: string[] = [];
    const criticalAlerts: string[] = [];

    // Generate intelligent recommendations
    if (lowBatteryVehicles > 0) {
      criticalAlerts.push(`${lowBatteryVehicles} vehicles below 25% SOC - immediate charging required`);
    }
    
    if (utilizationScore < 60) {
      recommendations.push("Fleet utilization below optimal - consider route consolidation");
    }
    
    if (availableStalls < relevantVehicles.length * 0.2) {
      recommendations.push("Charging infrastructure at capacity - schedule optimization needed");
    }

    const idleRate = relevantVehicles.filter(v => v.status === "idle").length / relevantVehicles.length;
    if (idleRate > 0.3) {
      recommendations.push("High idle rate detected - reassign vehicles to active routes");
    }

    return {
      utilizationScore,
      recommendations,
      criticalAlerts,
      efficiencyMetrics: {
        fleetUtilization: utilizationScore / 100,
        chargingCapacityUsed: chargingVehicles / relevantStalls.length,
        averageSOC: relevantVehicles.reduce((sum, v) => sum + (v.soc || 0), 0) / relevantVehicles.length,
        maintenanceCompliance: 0.94, // From mock data
        energyEfficiency: energyAnalytics.renewableEnergyUsage
      }
    };
  }

  // Real-time charging queue management
  static getChargingQueue(depotId: string): {
    queueLength: number;
    estimatedWaitTime: number;
    priorityVehicles: Array<{vehicleId: string; soc: number; priority: string}>;
  } {
    const { vehicles } = fleetIntelligence;
    const queueVehicles = vehicles
      .filter(v => 
        v.currentDepotId === depotId && 
        (v.status === "idle" || v.status === "charging") &&
        (v.soc || 0) < 0.8
      )
      .map(v => ({
        vehicleId: v.id,
        soc: v.soc || 0,
        priority: this.calculatePriority(v)
      }))
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority as keyof typeof priorityOrder] || 4) - 
               (priorityOrder[b.priority as keyof typeof priorityOrder] || 4);
      });

    const avgChargingTime = 120; // minutes average
    const estimatedWaitTime = queueVehicles.length * (avgChargingTime / 2); // Rough estimate

    return {
      queueLength: queueVehicles.length,
      estimatedWaitTime,
      priorityVehicles: queueVehicles.slice(0, 5) // Top 5 priority
    };
  }
}