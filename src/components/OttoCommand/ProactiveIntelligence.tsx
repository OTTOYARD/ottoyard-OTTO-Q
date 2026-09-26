// src/components/OttoCommand/ProactiveIntelligence.tsx
// Smart alert bar that surfaces charging, maintenance, and incident predictions
// Integrates with the OttoCommand store to drive proactive suggestions

import React, { useEffect, useRef } from "react";
import { useIntelligenceStore } from "@/stores/intelligenceStore";
import {
  AlertTriangle,
  BatteryWarning,
  Wrench,
  Zap,
  Activity,
  CalendarClock,
  X,
  ChevronRight,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useOttoCommandStore, ProactiveAlert, AlertSeverity } from "@/stores/ottoCommandStore";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface FleetMetricsForAlerts {
  lowBatteryCount?: number;
  criticalBatteryCount?: number;
  avgSoc?: number;
  maintenanceVehicles?: number;
  avgHealthScore?: number;
}

interface DepotMetricsForAlerts {
  chargeStallUtilization?: number;
  availableChargeStalls?: number;
  totalChargeStalls?: number;
  pendingJobs?: number;
}

interface IncidentMetricsForAlerts {
  activeIncidents?: number;
  pendingIncidents?: number;
}

interface ProactiveIntelligenceProps {
  mode: "av" | "ev";
  fleetMetrics?: FleetMetricsForAlerts;
  depotMetrics?: DepotMetricsForAlerts;
  incidentMetrics?: IncidentMetricsForAlerts;
  evVehicle?: {
    currentSoc: number;
    healthScore: number;
    brakeWearPct?: { front: number; rear: number };
    batteryHealthPct?: number;
  };
  className?: string;
  onAlertAction?: (prompt: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT GENERATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function generateFleetAlerts(
  fleet?: FleetMetricsForAlerts,
  depot?: DepotMetricsForAlerts,
  incidents?: IncidentMetricsForAlerts
): Omit<ProactiveAlert, "id" | "timestamp" | "dismissed">[] {
  const alerts: Omit<ProactiveAlert, "id" | "timestamp" | "dismissed">[] = [];

  if (!fleet) return alerts;

  // Critical battery alert
  if ((fleet.criticalBatteryCount ?? 0) > 0) {
    alerts.push({
      severity: "critical",
      title: `${fleet.criticalBatteryCount} vehicle${(fleet.criticalBatteryCount ?? 0) > 1 ? "s" : ""} critically low`,
      message: `SOC below 15% — immediate charging required to prevent service disruption.`,
      suggestedAction: "Auto-queue for urgent charging",
      suggestedPrompt:
        "Auto-queue all critical battery vehicles for urgent charging using the urgent_first strategy",
      source: "charging",
      relatedEntityType: "vehicle",
    });
  }

  // Low battery alert
  if ((fleet.lowBatteryCount ?? 0) >= 3 && (fleet.criticalBatteryCount ?? 0) === 0) {
    alerts.push({
      severity: "high",
      title: `${fleet.lowBatteryCount} vehicles below 30% SOC`,
      message: `Fleet average SOC is ${fleet.avgSoc}%. Consider proactive charging to prevent shortfalls.`,
      suggestedAction: "View charging predictions",
      suggestedPrompt:
        "Predict which vehicles will need charging in the next 4 hours and show recommended actions",
      source: "charging",
    });
  }

  // Depot capacity alert
  if (depot && (depot.chargeStallUtilization ?? 0) > 85) {
    alerts.push({
      severity: "high",
      title: "Chargers nearly all taken",
      message: `${depot.chargeStallUtilization}% of chargers have a car or a hold; ${depot.availableChargeStalls} of ${depot.totalChargeStalls} are open.`,
      suggestedAction: "View depot demand forecast",
      suggestedPrompt: "Predict depot demand for the next 8 hours and recommend load balancing",
      source: "depot",
    });
  }

  // Active incidents
  if (incidents && (incidents.activeIncidents ?? 0) > 0) {
    alerts.push({
      severity: (incidents.activeIncidents ?? 0) >= 3 ? "high" : "medium",
      title: `${incidents.activeIncidents} active incident${(incidents.activeIncidents ?? 0) > 1 ? "s" : ""}`,
      message: `${incidents.pendingIncidents ?? 0} depot-wide condition${(incidents.pendingIncidents ?? 0) === 1 ? "" : "s"} holding. Review them in Incidents.`,
      suggestedAction: "Triage incidents",
      suggestedPrompt: "Triage all active incidents and show priority ranking with recommended actions",
      source: "incident",
    });
  }

  // Health score degradation
  if ((fleet.avgHealthScore ?? 100) < 85) {
    alerts.push({
      severity: "medium",
      title: "Fleet health score declining",
      message: `Average health at ${fleet.avgHealthScore}/100. Predictive maintenance review recommended.`,
      suggestedAction: "View maintenance risks",
      suggestedPrompt: "Identify all vehicles with elevated maintenance risk and recommend scheduling",
      source: "maintenance",
    });
  }

  // Maintenance backlog
  if ((fleet.maintenanceVehicles ?? 0) >= 3) {
    alerts.push({
      severity: "medium",
      title: `${fleet.maintenanceVehicles} vehicles in maintenance`,
      message: "Elevated maintenance count may impact fleet availability.",
      suggestedAction: "Review maintenance queue",
      suggestedPrompt: "Show all vehicles currently in maintenance with estimated completion times",
      source: "maintenance",
    });
  }

  return alerts;
}

function generateEVAlerts(
  vehicle?: ProactiveIntelligenceProps["evVehicle"]
): Omit<ProactiveAlert, "id" | "timestamp" | "dismissed">[] {
  const alerts: Omit<ProactiveAlert, "id" | "timestamp" | "dismissed">[] = [];
  if (!vehicle) return alerts;

  const socPct =
    typeof vehicle.currentSoc === "number"
      ? vehicle.currentSoc > 1
        ? vehicle.currentSoc
        : Math.round(vehicle.currentSoc * 100)
      : 0;

  if (socPct < 20) {
    alerts.push({
      severity: "critical",
      title: "Battery critically low",
      message: `Your vehicle is at ${socPct}% — consider scheduling a charge soon.`,
      suggestedAction: "Schedule charge",
      suggestedPrompt: "Schedule a charging session for my vehicle as soon as possible",
      source: "charging",
    });
  } else if (socPct < 35) {
    alerts.push({
      severity: "medium",
      title: "Battery getting low",
      message: `Your vehicle is at ${socPct}%. Plan a charge to keep your range healthy.`,
      suggestedAction: "Check charging options",
      suggestedPrompt: "What are my charging options and when is the best time to charge?",
      source: "charging",
    });
  }

  if (vehicle.brakeWearPct && vehicle.brakeWearPct.front <= 40) {
    alerts.push({
      severity: "high",
      title: "Brake pads wearing thin",
      message: `Front brake pads at ${vehicle.brakeWearPct.front}% — schedule inspection.`,
      suggestedAction: "Schedule brake inspection",
      suggestedPrompt: "Schedule a brake inspection for my vehicle",
      source: "maintenance",
    });
  }

  if (vehicle.healthScore < 80) {
    alerts.push({
      severity: "medium",
      title: "Health score below optimal",
      message: `Vehicle health at ${vehicle.healthScore}/100. A diagnostic check is recommended.`,
      suggestedAction: "Schedule diagnostic",
      suggestedPrompt: "Schedule a full battery and vehicle diagnostic for my car",
      source: "maintenance",
    });
  }

  if (vehicle.batteryHealthPct && vehicle.batteryHealthPct < 85) {
    alerts.push({
      severity: "medium",
      title: "Battery degradation detected",
      message: `Battery health at ${vehicle.batteryHealthPct}%. Consider a battery diagnostic.`,
      suggestedAction: "Schedule battery check",
      suggestedPrompt: "Schedule a battery diagnostic. My battery health is showing degradation.",
      source: "maintenance",
    });
  }

  return alerts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const severityConfig: Record<
  AlertSeverity,
  { bg: string; border: string; icon: React.ElementType; dot: string }
> = {
  critical: { bg: "bg-red-500/10", border: "border-red-500/30", icon: AlertTriangle, dot: "bg-red-500" },
  high: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: BatteryWarning, dot: "bg-amber-500" },
  medium: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: Activity, dot: "bg-yellow-500" },
  low: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: CalendarClock, dot: "bg-blue-500" },
  info: { bg: "bg-muted/50", border: "border-border/50", icon: Zap, dot: "bg-muted-foreground" },
};

const AlertCard: React.FC<{
  alert: ProactiveAlert;
  onAction?: (prompt: string) => void;
  onDismiss?: () => void;
}> = ({ alert, onAction, onDismiss }) => {
  const config = severityConfig[alert.severity];

  // Map source to icon override
  const sourceIcons: Record<string, React.ElementType> = {
    charging: Zap,
    maintenance: Wrench,
    incident: AlertTriangle,
    depot: Activity,
    anomaly: AlertTriangle,
    schedule: CalendarClock,
  };
  const SourceIcon = sourceIcons[alert.source] || config.icon;

  return (
    <div className={cn("rounded-lg border p-3", config.bg, config.border)}>
      <div className="flex gap-2">
        <div className={cn("h-2 w-2 rounded-full mt-1.5 flex-shrink-0", config.dot)} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start gap-1.5">
            <SourceIcon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span className="text-xs font-medium leading-tight">{alert.title}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">{alert.message}</p>
          {alert.suggestedAction && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-primary hover:text-primary"
              onClick={() => alert.suggestedPrompt && onAction?.(alert.suggestedPrompt)}
            >
              {alert.suggestedAction}
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 flex-shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const ProactiveIntelligence: React.FC<ProactiveIntelligenceProps> = ({
  mode,
  fleetMetrics,
  depotMetrics,
  incidentMetrics,
  evVehicle,
  className,
  onAlertAction,
}) => {
  const { pushAlert, getActiveAlerts, dismissAlert } = useOttoCommandStore();
  const lastGenerationRef = useRef("");

  // Generate alerts on metric changes (debounced by content hash)
  useEffect(() => {
    const newAlerts =
      mode === "ev"
        ? generateEVAlerts(evVehicle)
        : generateFleetAlerts(fleetMetrics, depotMetrics, incidentMetrics);

    // Add intelligence threat alerts (AV mode only)
    if (mode === "av") {
      const intelligenceEvents = useIntelligenceStore.getState().events;
      const highThreatEvents = intelligenceEvents
        .filter((e) => e.threatScore >= 60)
        .slice(0, 2); // Limit to top 2

      for (const event of highThreatEvents) {
        newAlerts.push({
          severity: event.severity === "critical" ? "critical" : "high",
          title: event.title,
          message: `${event.city || "Unknown"} — Threat score ${event.threatScore}/100. ${event.vehiclesAffected} vehicles affected.`,
          suggestedAction: "View intelligence",
          suggestedPrompt: `Get the intelligence summary for ${event.city || "all cities"} and show me the '${event.title}' threat details with recommended actions`,
          source: "incident",
        });
      }
    }

    // Simple content hash to avoid re-pushing identical alerts
    const hash = JSON.stringify(newAlerts.map((a) => a.title).sort());
    if (hash === lastGenerationRef.current) return;
    lastGenerationRef.current = hash;

    for (const alert of newAlerts) {
      pushAlert(alert);
    }
  }, [mode, fleetMetrics, depotMetrics, incidentMetrics, evVehicle, pushAlert]);

  const activeAlerts = getActiveAlerts();

  if (activeAlerts.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 px-1">
        <Bell className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Proactive Insights
        </span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {activeAlerts.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {activeAlerts.slice(0, 3).map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onAction={onAlertAction}
            onDismiss={() => dismissAlert(alert.id)}
          />
        ))}
      </div>

      {activeAlerts.length > 3 && (
        <p className="text-[10px] text-center text-muted-foreground">
          +{activeAlerts.length - 3} more alerts
        </p>
      )}
    </div>
  );
};

export default ProactiveIntelligence;
