// src/components/OttoCommand/OttoCommandContextPanel.tsx
// Live context sidebar showing fleet or EV data alongside the chat

import React from "react";
import {
  Battery,
  Car,
  MapPin,
  Wrench,
  AlertTriangle,
  Activity,
  Zap,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface FleetContextData {
  fleetMetrics?: {
    totalVehicles: number;
    activeVehicles: number;
    chargingVehicles: number;
    idleVehicles: number;
    maintenanceVehicles: number;
    avgSoc: number;
    lowBatteryCount: number;
    criticalBatteryCount: number;
    avgHealthScore: number | null;
  };
  depotMetrics?: {
    totalDepots: number;
    availableChargeStalls: number;
    totalChargeStalls: number;
    chargeStallUtilization: number;
    activeJobs: number;
    pendingJobs: number;
  };
  incidentMetrics?: {
    totalIncidents: number;
    activeIncidents: number;
    pendingIncidents: number;
  };
}

interface EVContextData {
  subscriber?: {
    firstName: string;
    lastName: string;
    membershipTier: string;
    subscriptionStatus: string;
  };
  vehicle?: {
    make: string;
    model: string;
    year: number;
    currentSoc: number;
    currentStatus: string;
    healthScore: number;
    estimatedRangeMiles: number;
    currentStallId: string | null;
    batteryHealthPct: number;
    odometerMiles: number;
  };
}

interface OttoCommandContextPanelProps {
  mode: "av" | "ev";
  fleetContext?: FleetContextData;
  evContext?: EVContextData;
  className?: string;
  onPromptSuggestion?: (prompt: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const MetricRow: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  status?: "good" | "warning" | "critical" | "neutral";
  onClick?: () => void;
}> = ({ icon: Icon, label, value, subValue, status = "neutral", onClick }) => {
  const statusColors = {
    good: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-red-400",
    neutral: "text-foreground",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center justify-between w-full py-1.5 px-2 rounded-md text-left transition-colors",
        onClick ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={cn("text-xs font-medium", statusColors[status])}>
          {value}
        </span>
        {subValue && (
          <span className="text-[10px] text-muted-foreground">{subValue}</span>
        )}
      </div>
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// FLEET (AV) CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const FleetContextView: React.FC<{
  data: FleetContextData;
  onPrompt?: (prompt: string) => void;
}> = ({ data, onPrompt }) => {
  const fleet = data.fleetMetrics;
  const depot = data.depotMetrics;
  const incidents = data.incidentMetrics;

  if (!fleet) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        Loading fleet data…
      </div>
    );
  }

  const socStatus = fleet.avgSoc >= 60 ? "good" : fleet.avgSoc >= 35 ? "warning" : "critical";
  const healthStatus =
    fleet.avgHealthScore === null ? "warning" : fleet.avgHealthScore >= 90 ? "good" : fleet.avgHealthScore >= 75 ? "warning" : "critical";

  return (
    <div className="space-y-3">
      {/* Fleet Summary */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
          Fleet Overview
        </p>
        <MetricRow
          icon={Car}
          label="Total Vehicles"
          value={fleet.totalVehicles}
          subValue={`${fleet.activeVehicles} active`}
          onClick={onPrompt ? () => onPrompt("Show me a complete fleet status overview") : undefined}
        />
        <MetricRow
          icon={Zap}
          label="Charging"
          value={fleet.chargingVehicles}
          status="neutral"
          onClick={
            onPrompt ? () => onPrompt("Which vehicles are currently charging?") : undefined
          }
        />
        <MetricRow icon={Clock} label="Idle" value={fleet.idleVehicles} />
        <MetricRow icon={Wrench} label="Maintenance" value={fleet.maintenanceVehicles} />
      </div>

      <Separator />

      {/* Battery & Health */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
          Battery & Health
        </p>
        <MetricRow icon={Battery} label="Avg SOC" value={`${fleet.avgSoc}%`} status={socStatus} />
        <div className="px-2">
          <Progress value={fleet.avgSoc} className="h-1.5" />
        </div>
        <MetricRow icon={Activity} label="Battery Health" value={fleet.avgHealthScore === null ? "n/a" : `${fleet.avgHealthScore}%`} status={healthStatus} />
        <MetricRow
          icon={AlertTriangle}
          label="Low Battery"
          value={fleet.lowBatteryCount}
          status={fleet.lowBatteryCount > 0 ? "warning" : "good"}
          onClick={
            fleet.lowBatteryCount > 0 && onPrompt
              ? () => onPrompt("Show all vehicles with low battery and recommend charging actions")
              : undefined
          }
        />
        {fleet.criticalBatteryCount > 0 && (
          <MetricRow
            icon={AlertTriangle}
            label="Critical Battery"
            value={fleet.criticalBatteryCount}
            status="critical"
            onClick={
              onPrompt
                ? () =>
                    onPrompt(
                      "URGENT: Show critical battery vehicles and auto-queue them for charging"
                    )
                : undefined
            }
          />
        )}
      </div>

      <Separator />

      {/* Depot Operations */}
      {depot && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
            Depot Operations
          </p>
          <MetricRow
            icon={MapPin}
            label="Stall Utilization"
            value={`${depot.chargeStallUtilization}%`}
            subValue={`${depot.availableChargeStalls}/${depot.totalChargeStalls} avail`}
            status={
              depot.chargeStallUtilization > 85
                ? "critical"
                : depot.chargeStallUtilization > 65
                ? "warning"
                : "good"
            }
            onClick={
              onPrompt ? () => onPrompt("Show depot resource availability across all locations") : undefined
            }
          />
          <MetricRow icon={Activity} label="Active Jobs" value={depot.activeJobs} />
          <MetricRow icon={Clock} label="Pending Jobs" value={depot.pendingJobs} />
        </div>
      )}

      {/* Incidents */}
      {incidents && incidents.totalIncidents > 0 && (
        <>
          <Separator />
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
              Incidents
            </p>
            <MetricRow
              icon={AlertTriangle}
              label="Active"
              value={incidents.activeIncidents}
              subValue={`${incidents.pendingIncidents} pending`}
              status={incidents.activeIncidents > 0 ? "warning" : "good"}
              onClick={
                incidents.activeIncidents > 0 && onPrompt
                  ? () => onPrompt("Triage all active incidents and show priority ranking")
                  : undefined
              }
            />
            <MetricRow icon={Activity} label="Total" value={incidents.totalIncidents} />
          </div>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// EV CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const EVContextView: React.FC<{
  data: EVContextData;
  onPrompt?: (prompt: string) => void;
}> = ({ data, onPrompt }) => {
  const { subscriber, vehicle } = data;

  if (!vehicle) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        Loading vehicle data…
      </div>
    );
  }

  const socPct =
    typeof vehicle.currentSoc === "number"
      ? vehicle.currentSoc > 1
        ? vehicle.currentSoc
        : Math.round(vehicle.currentSoc * 100)
      : 0;

  const socStatus = socPct >= 60 ? "good" : socPct >= 30 ? "warning" : "critical";
  const healthStatus =
    vehicle.healthScore >= 90 ? "good" : vehicle.healthScore >= 75 ? "warning" : "critical";

  const statusLabels: Record<string, string> = {
    at_home: "At Home",
    en_route_depot: "En Route",
    at_depot: "At Depot",
    in_service: "In Service",
    charging: "Charging",
    ready: "Ready",
  };

  return (
    <div className="space-y-3">
      {/* Vehicle Hero */}
      <div className="px-2">
        <p className="text-xs font-semibold">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </p>
        <Badge variant="outline" className="text-[10px] mt-1">
          {statusLabels[vehicle.currentStatus] || vehicle.currentStatus}
        </Badge>
      </div>

      <Separator />

      {/* Battery */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
          Battery
        </p>
        <MetricRow
          icon={Battery}
          label="State of Charge"
          value={`${socPct}%`}
          status={socStatus}
          onClick={onPrompt ? () => onPrompt("What's my vehicle's full battery and charging status?") : undefined}
        />
        <div className="px-2">
          <Progress value={socPct} className="h-1.5" />
        </div>
        <MetricRow icon={MapPin} label="Range" value={`${vehicle.estimatedRangeMiles} mi`} />
        <MetricRow
          icon={Activity}
          label="Battery Health"
          value={`${vehicle.batteryHealthPct}%`}
          status={vehicle.batteryHealthPct >= 90 ? "good" : "warning"}
        />
        {vehicle.currentStallId && (
          <MetricRow icon={Zap} label="Stall" value={vehicle.currentStallId} />
        )}
      </div>

      <Separator />

      {/* Health & Diagnostics */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
          Health
        </p>
        <MetricRow
          icon={Activity}
          label="Health Score"
          value={`${vehicle.healthScore}/100`}
          status={healthStatus}
          onClick={
            onPrompt
              ? () => onPrompt("Give me a full vehicle health breakdown with any maintenance recommendations")
              : undefined
          }
        />
        <MetricRow icon={Car} label="Odometer" value={`${vehicle.odometerMiles.toLocaleString()} mi`} />
      </div>

      {/* Subscriber */}
      {subscriber && (
        <>
          <Separator />
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
              Membership
            </p>
            <MetricRow icon={Activity} label="Tier" value={subscriber.membershipTier} />
            <MetricRow icon={Activity} label="Status" value={subscriber.subscriptionStatus} />
          </div>
        </>
      )}

      {/* Quick Suggestions */}
      {onPrompt && (
        <>
          <Separator />
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
              Suggestions
            </p>
            <div className="space-y-0.5">
              {[
                { label: "Book sim golf bay", prompt: "What sim golf bays are available today?" },
                { label: "Schedule detailing", prompt: "I'd like to schedule a full detail for my vehicle" },
                { label: "Check depot queue", prompt: "Show my depot queue status and estimated completion" },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => onPrompt(s.prompt)}
                  className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  {s.label}
                  <ChevronRight className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const OttoCommandContextPanel: React.FC<OttoCommandContextPanelProps> = ({
  mode,
  fleetContext,
  evContext,
  className,
  onPromptSuggestion,
}) => {
  return (
    <div className={cn("h-full", className)}>
      <ScrollArea className="h-full">
        <div className="py-3">
          {mode === "ev" && evContext ? (
            <EVContextView data={evContext} onPrompt={onPromptSuggestion} />
          ) : fleetContext ? (
            <FleetContextView data={fleetContext} onPrompt={onPromptSuggestion} />
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No context data available
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default OttoCommandContextPanel;
