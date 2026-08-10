import { Incident } from "@/types/incidents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OEMVehicleIcon } from "@/components/OEMVehicleIcon";

interface IncidentDetailsProps {
  incident: Incident;
}

const statusColors = {
  Reported: "bg-muted text-muted-foreground",
  Dispatched: "bg-blue-500 text-white",
  Secured: "bg-orange-500 text-white",
  "At Depot": "bg-purple-500 text-white",
  Closed: "bg-green-500 text-white",
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatETA(seconds: number | null): string {
  if (seconds === null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

const incidentTypeLabels: Record<string, string> = {
  collision: "Collision",
  malfunction: "Malfunction",
  interior: "Interior",
  vandalism: "Vandalism",
};

const incidentTypeColors: Record<string, string> = {
  collision: "bg-destructive/15 text-destructive border-destructive/30",
  malfunction: "bg-warning/15 text-warning border-warning/30",
  interior: "bg-primary/15 text-primary border-primary/30",
  vandalism: "bg-orange-500/15 text-orange-500 border-orange-500/30",
};

export function IncidentDetails({ incident }: IncidentDetailsProps) {
  const { toast } = useToast();
  
  const handleCopyLocation = () => {
    navigator.clipboard.writeText(`${incident.location.lat}, ${incident.location.lon}`);
    toast({
      title: "Location copied",
      description: "Coordinates copied to clipboard.",
    });
  };
  
  return (
    <div className="space-y-2 md:space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <OEMVehicleIcon name={incident.vehicleId} size="lg" withBackground />
              <div>
                <CardTitle className="text-sm md:text-lg truncate">{incident.incidentId}</CardTitle>
                <p className="text-[10px] md:text-sm text-muted-foreground mt-0.5 md:mt-1 truncate">
                  Vehicle: <span className="font-semibold">{incident.vehicleId}</span> • {incident.city}
                </p>
              </div>
            </div>
            <Badge className={`${statusColors[incident.status]} text-[9px] md:text-xs whitespace-nowrap`}>
              {incident.status}
            </Badge>
          </div>
          <p className="text-[9px] md:text-xs text-muted-foreground mt-1 md:mt-2">
            Last updated: {formatTimestamp(incident.timestamps[
              incident.status === "Closed" ? "closedAt" :
              incident.status === "At Depot" ? "atDepotAt" :
              incident.status === "Secured" ? "securedAt" :
              incident.status === "Dispatched" ? "dispatchedAt" :
              "reportedAt"
            ])}
          </p>
        </CardHeader>
      </Card>
      
      {/* Timeline */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-xs md:text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
          <div className="space-y-2 md:space-y-3">
            {incident.timeline.slice(0, 3).map((entry, idx) => (
              <div key={idx} className="flex gap-2 md:gap-3">
                <div className="flex-shrink-0 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-primary mt-1 md:mt-1.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 md:gap-2 mb-0.5 md:mb-1">
                    <Badge variant="outline" className="text-[9px] md:text-xs whitespace-nowrap">
                      {entry.status}
                    </Badge>
                    <span className="text-[9px] md:text-xs text-muted-foreground">
                      {formatTimestamp(entry.ts)}
                    </span>
                  </div>
                  <p className="text-[10px] md:text-sm truncate md:whitespace-normal">{entry.note}</p>
                </div>
              </div>
            ))}
            {incident.timeline.length > 3 && (
              <p className="text-[9px] md:text-xs text-muted-foreground pl-4 md:pl-5">
                + {incident.timeline.length - 3} more events
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Live Tow Tracker */}
      {incident.tow.assigned && incident.status !== "Closed" && (
        <Card>
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-xs md:text-base">Live Tow Tracker</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="space-y-1 md:space-y-2 text-[10px] md:text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Driver:</span>
                <span className="font-semibold truncate ml-2">{incident.tow.driver}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Truck ID:</span>
                <span className="font-semibold">{incident.tow.truckId}</span>
              </div>
              {incident.status === "Dispatched" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pickup ETA:</span>
                  <span className="font-semibold">{formatETA(incident.etaSeconds)}</span>
                </div>
              )}
              {incident.status === "Secured" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Return ETA:</span>
                  <span className="font-semibold">{formatETA(incident.etaSeconds)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Incident Report — Read-Only */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-xs md:text-base">Incident Report</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
          <div className="rounded-lg bg-muted/30 border border-border/50 p-3 md:p-4 space-y-3 md:space-y-4">
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div>
                <span className="text-[9px] md:text-xs text-muted-foreground">Incident #</span>
                <p className="text-[10px] md:text-sm font-semibold mt-0.5">{incident.incidentId}</p>
              </div>
              <div>
                <span className="text-[9px] md:text-xs text-muted-foreground">Date/Time</span>
                <p className="text-[10px] md:text-sm font-medium mt-0.5">{formatTimestamp(incident.timestamps.reportedAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div>
                <span className="text-[9px] md:text-xs text-muted-foreground">Vehicle</span>
                <p className="text-[10px] md:text-sm font-medium mt-0.5">{incident.vehicleId}</p>
              </div>
              <div>
                <span className="text-[9px] md:text-xs text-muted-foreground">Type</span>
                <div className="mt-0.5">
                  <Badge variant="outline" className={`text-[9px] md:text-xs ${incidentTypeColors[incident.type] || ''}`}>
                    {incidentTypeLabels[incident.type] || incident.type}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[9px] md:text-xs text-muted-foreground">Summary</span>
              <p className="text-[10px] md:text-sm mt-0.5">{incident.report.shortSummary}</p>
            </div>

            {incident.report.comments && (
              <div>
                <span className="text-[9px] md:text-xs text-muted-foreground">Comments</span>
                <p className="text-[10px] md:text-sm mt-0.5">{incident.report.comments}</p>
              </div>
            )}

            <div>
              <span className="text-[9px] md:text-xs text-muted-foreground">Location</span>
              <div className="flex items-center gap-1 md:gap-2 mt-0.5">
                <p className="text-[10px] md:text-sm">{incident.location.addr}</p>
                <Button variant="ghost" size="icon" onClick={handleCopyLocation} className="h-5 w-5 md:h-7 md:w-7 shrink-0">
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-[9px] md:text-xs text-muted-foreground mt-0.5">
                {incident.location.lat.toFixed(4)}° N, {incident.location.lon.toFixed(4)}° W
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}