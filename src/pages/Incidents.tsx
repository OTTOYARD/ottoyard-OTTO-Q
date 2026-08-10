import { useEffect } from "react";
import { Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIncidentsStore } from "@/stores/incidentsStore";
import { IncidentCard } from "@/components/IncidentCard";
import { IncidentDetails } from "@/components/IncidentDetails";
import { OTTOWDispatchDialog } from "@/components/OTTOWDispatchDialog";
import { IncidentStatus } from "@/types/incidents";

const allStatuses: IncidentStatus[] = ["Reported", "Dispatched", "Secured", "At Depot", "Closed"];

export default function Incidents() {
  const {
    incidents,
    selectedIncidentId,
    statusFilter,
    cityFilter,
    selectIncident,
    setStatusFilter,
    setCityFilter,
    refreshIncidents,
  } = useIncidentsStore();
  
  // Filter incidents
  const filteredIncidents = incidents.filter((incident) => {
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(incident.status);
    const matchesCity = cityFilter === "All Cities" || incident.city === cityFilter;
    return matchesStatus && matchesCity;
  });
  
  // Sort: Open incidents first (by status priority then ETA), then Closed
  const sortedIncidents = [...filteredIncidents].sort((a, b) => {
    if (a.status === "Closed" && b.status !== "Closed") return 1;
    if (a.status !== "Closed" && b.status === "Closed") return -1;
    
    const statusOrder = { "Reported": 1, "Dispatched": 2, "Secured": 3, "At Depot": 4, "Closed": 5 };
    const aOrder = statusOrder[a.status];
    const bOrder = statusOrder[b.status];
    
    if (aOrder !== bOrder) return aOrder - bOrder;
    
    // Within same status, sort by ETA (shortest first)
    if (a.etaSeconds !== null && b.etaSeconds !== null) {
      return a.etaSeconds - b.etaSeconds;
    }
    if (a.etaSeconds !== null) return -1;
    if (b.etaSeconds !== null) return 1;
    
    return 0;
  });
  
  const selectedIncident = incidents.find((i) => i.incidentId === selectedIncidentId);
  
  const toggleStatusFilter = (status: IncidentStatus) => {
    if (statusFilter.includes(status)) {
      setStatusFilter(statusFilter.filter((s) => s !== status));
    } else {
      setStatusFilter([...statusFilter, status]);
    }
  };
  
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b p-3 md:p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <h1 className="text-lg md:text-2xl font-bold">Incidents</h1>
          </div>
          
          {/* Buttons stacked vertically on the right */}
          <div className="flex flex-col gap-1.5 w-[110px] shrink-0">
            <OTTOWDispatchDialog />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 w-full text-xs">
                  <Filter className="w-2.5 h-2.5 md:mr-2" />
                  <span className="hidden md:inline">Filters</span>
                  {(statusFilter.length > 0 || cityFilter !== "All Cities") && (
                    <span className="ml-1 md:ml-2 px-1 md:px-1.5 py-0.5 text-[10px] md:text-xs bg-primary text-primary-foreground rounded-full">
                      {statusFilter.length + (cityFilter !== "All Cities" ? 1 : 0)}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Status</Label>
                    <div className="space-y-2">
                      {allStatuses.map((status) => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox
                            id={`status-${status}`}
                            checked={statusFilter.includes(status)}
                            onCheckedChange={() => toggleStatusFilter(status)}
                          />
                          <label
                            htmlFor={`status-${status}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {status}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">City</Label>
                    <Select value={cityFilter} onValueChange={setCityFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All Cities">All Cities</SelectItem>
                        <SelectItem value="Nashville">Nashville</SelectItem>
                        <SelectItem value="Austin">Austin</SelectItem>
                        <SelectItem value="LA">Los Angeles</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setStatusFilter([]);
                      setCityFilter("All Cities");
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={refreshIncidents} className="h-6 w-full text-xs">
              <RefreshCw className="w-2.5 h-2.5 md:mr-2" />
              <span className="hidden md:inline">Refresh</span>
            </Button>
          </div>
        </div>
        
        <p className="text-[10px] md:text-sm text-muted-foreground">
          {sortedIncidents.length} incident{sortedIncidents.length !== 1 ? 's' : ''} • Live auto-rotation
        </p>
      </div>
      
      {/* Main Content: Responsive Layout */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop: Two Column Layout */}
        <div className="hidden md:flex h-full">
          {/* Left: Incident Queue */}
          <div className="w-1/2 border-r">
            <ScrollArea className="h-full p-4">
              <div className="space-y-3">
                {sortedIncidents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No incidents match your filters.</p>
                  </div>
                ) : (
                  sortedIncidents.map((incident) => (
                    <IncidentCard
                      key={incident.incidentId}
                      incident={incident}
                      isSelected={incident.incidentId === selectedIncidentId}
                      onSelect={() => selectIncident(incident.incidentId)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Right: Details Panel */}
          <div className="w-1/2">
            <ScrollArea className="h-full p-4">
              {selectedIncident ? (
                <IncidentDetails incident={selectedIncident} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Select an incident to view details</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
        
        {/* Mobile: Single Column with Inline Details */}
        <ScrollArea className="md:hidden h-full p-2">
          <div className="space-y-2">
            {sortedIncidents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <p>No incidents match your filters.</p>
              </div>
            ) : (
              sortedIncidents.map((incident) => {
                const isSelected = incident.incidentId === selectedIncidentId;
                return (
                  <div 
                    key={incident.incidentId} 
                    className="relative"
                    id={`incident-${incident.incidentId}`}
                  >
                    <IncidentCard
                      incident={incident}
                      isSelected={isSelected}
                      onSelect={() => {
                        const newId = isSelected ? null : incident.incidentId;
                        selectIncident(newId);
                        // Scroll to selected incident after a brief delay
                        if (newId) {
                          setTimeout(() => {
                            document.getElementById(`incident-${newId}`)?.scrollIntoView({ 
                              behavior: 'smooth', 
                              block: 'start' 
                            });
                          }, 150);
                        }
                      }}
                    />
                    {/* Show details inline on mobile when selected */}
                    {isSelected && (
                      <div className="mt-3 mb-4 border-l-4 border-primary pl-3 bg-background">
                        <IncidentDetails incident={incident} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
