import { useState } from "react";
import { MapPin, FileText, Download, Loader2 } from "lucide-react";
import { Incident } from "@/types/incidents";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateIncidentPDF } from "@/utils/incidentReportPDF";
import { useToast } from "@/hooks/use-toast";
import { OEMVehicleIcon } from "@/components/OEMVehicleIcon";

interface IncidentCardProps {
  incident: Incident;
  isSelected: boolean;
  onSelect: () => void;
}

const statusColors = {
  Reported: "bg-muted text-muted-foreground",
  Dispatched: "bg-blue-500 text-white",
  Secured: "bg-orange-500 text-white",
  "At Depot": "bg-purple-500 text-white",
  Closed: "bg-green-500 text-white",
};

const typeLabels = {
  collision: "Collision",
  malfunction: "Malfunction",
  interior: "Interior",
  vandalism: "Vandalism",
};

function formatETA(seconds: number | null): string {
  if (seconds === null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function IncidentCard({ incident, isSelected, onSelect }: IncidentCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleDownloadReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGenerating(true);
    toast({
      title: "Generating Report",
      description: "Please wait while we generate your incident report...",
    });
    try {
      await generateIncidentPDF({ incident });
      toast({
        title: "Report Downloaded",
        description: `Incident report ${incident.incidentId} has been downloaded.`,
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card
      className={`p-2 md:p-4 cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-primary glow-border animate-pulse-border" : ""
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2 md:gap-3">
        {/* Left: Vehicle Icon */}
        <div className="flex-shrink-0">
          <OEMVehicleIcon 
            name={incident.vehicleId} 
            size="md" 
            className="w-8 h-8 md:w-12 md:h-12" 
            withBackground 
          />
        </div>
        
        {/* Middle: Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 md:gap-2 mb-0.5 md:mb-1">
            <span className="font-semibold text-xs md:text-sm truncate">{incident.vehicleId}</span>
            <Badge variant="outline" className="text-[9px] md:text-xs whitespace-nowrap">
              {incident.city}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-2">
            <Badge className={`text-[9px] md:text-xs ${statusColors[incident.status]}`}>
              {incident.status}
            </Badge>
            <span className="text-[9px] md:text-xs text-muted-foreground truncate">
              {typeLabels[incident.type]}
            </span>
          </div>
          
          <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-1 md:line-clamp-2 mb-1 md:mb-2">
            {incident.summary}
          </p>
          
          <div className="flex items-center gap-2 md:gap-3 text-[9px] md:text-xs text-muted-foreground">
            <span className="whitespace-nowrap">{formatTimestamp(incident.timestamps.reportedAt)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 md:h-5 px-0.5 md:px-1 hidden md:inline-flex"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 md:h-5 px-0.5 md:px-1 hidden md:inline-flex"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
            >
              <FileText className="w-2.5 h-2.5 md:w-3 md:h-3" />
            </Button>
            {incident.status === "Closed" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 md:h-5 px-0.5 md:px-1 text-primary hover:text-primary/80"
                onClick={handleDownloadReport}
                disabled={isGenerating}
                title="Download Incident Report PDF"
              >
                {isGenerating ? (
                  <Loader2 className="w-2.5 h-2.5 md:w-3 md:h-3 animate-spin" />
                ) : (
                  <Download className="w-2.5 h-2.5 md:w-3 md:h-3" />
                )}
              </Button>
            )}
          </div>
        </div>
        
        {/* Right: ETA */}
        <div className="flex-shrink-0 text-right pr-2 md:pr-3">
          <div className="text-sm md:text-lg font-mono font-semibold">
            {formatETA(incident.etaSeconds)}
          </div>
          {incident.etaSeconds !== null && (
            <div className="text-[9px] md:text-xs text-muted-foreground whitespace-nowrap">
              {incident.status === "Dispatched" ? "Pickup" : incident.status === "Secured" ? "Return" : "ETA"}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
