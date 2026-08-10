import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck } from "lucide-react";
import { useIncidentsStore } from "@/stores/incidentsStore";
import { IncidentType } from "@/types/incidents";
import { vehicles } from "@/types/incidents";
import { useToast } from "@/hooks/use-toast";

export function OTTOWDispatchDialog() {
  const { toast } = useToast();
  const dispatchOTTOW = useIncidentsStore((state) => state.dispatchOTTOW);
  const cityFilter = useIncidentsStore((state) => state.cityFilter);
  
  const [open, setOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState(cityFilter === "All Cities" ? "Nashville" : cityFilter);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [incidentType, setIncidentType] = useState<IncidentType>("collision");
  const [summary, setSummary] = useState("");
  
  // Get vehicles for selected city using the city property
  const cityVehicles = vehicles
    .filter((v: any) => v.city === selectedCity && v.status !== "maintenance")
    .slice(0, 20); // Limit to 20 for performance
  
  const handleSubmit = () => {
    if (!selectedVehicle || !summary.trim()) {
      toast({
        title: "Missing information",
        description: "Please select a vehicle and provide a summary.",
        variant: "destructive",
      });
      return;
    }
    
    const incidentId = dispatchOTTOW(selectedVehicle, selectedCity, incidentType, summary);
    
    toast({
      title: "OTTOW Dispatched",
      description: `Tow dispatched for ${selectedVehicle}. Incident ${incidentId} created.`,
    });
    
    setOpen(false);
    setSelectedVehicle("");
    setSummary("");
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 w-full text-sm px-3">
          <Truck className="w-4 h-4 mr-2" />
          <span>OTTOW Dispatch</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Dispatch OTTOW Tow Service</DialogTitle>
          <DialogDescription>
            Select a vehicle and provide incident details to dispatch a tow truck.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label>City</Label>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Nashville">Nashville</SelectItem>
                <SelectItem value="Austin">Austin</SelectItem>
                <SelectItem value="LA">Los Angeles</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Vehicle</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select vehicle..." />
              </SelectTrigger>
              <SelectContent>
                {cityVehicles.map((vehicle: any) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.id} — {vehicle.make} {vehicle.model} — {((vehicle.soc || 0) * 100).toFixed(0)}% SOC
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Showing vehicles in {selectedCity}
            </p>
          </div>
          
          <div>
            <Label>Incident Type</Label>
            <Select value={incidentType} onValueChange={(val) => setIncidentType(val as IncidentType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="collision">Collision</SelectItem>
                <SelectItem value="malfunction">Malfunction</SelectItem>
                <SelectItem value="interior">Interior Issue</SelectItem>
                <SelectItem value="vandalism">Vandalism</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Short Summary</Label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief description of the incident..."
              className="mt-1"
            />
          </div>
        </div>
        
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Dispatch Tow
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
