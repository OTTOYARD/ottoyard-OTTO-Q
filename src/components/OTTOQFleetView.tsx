import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ottoqInvoke } from "@/lib/otto-q-api";
import { Battery, Zap, Wrench, MapPin, Activity, RefreshCw, Car, Calendar, Heart, Download, Clock, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Sparkles, Flag, History } from "lucide-react";
import { toast } from "sonner";
import { OTTOQScheduleDialog } from "./OTTOQScheduleDialog";
import { VehicleHealthCard } from "./VehicleHealthCard";
import { useVehicleHealth } from "@/hooks/useVehicleHealth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { OEMVehicleIcon } from "@/components/OEMVehicleIcon";
import { MaintenancePanel } from "./MaintenancePanel";
import { OemMidFlowFlagDialog } from "./OemMidFlowFlagDialog";
import { VisitReportCard } from "./VisitReportCard";
import { OttoQSequenceCard } from "./OttoQSequenceCard";
import { useVehicleVisitHistory } from "@/hooks/use-orchestra-progression";
import { 
  predictiveMaintenanceData, 
  upcomingMaintenance, 
  upcomingDetailing,
  getServicePrice
} from "@/data/maintenance-mock";

interface Vehicle {
  id: string;
  external_ref: string;
  oem: string;
  vin: string | null;
  plate: string | null;
  soc: number;
  odometer_km: number;
  status: string;
  city: string;
  last_telemetry_at: string | null;
  assignment?: {
    job_id: string;
    job_type: string;
    state: string;
    depot: {
      id: string;
      name: string;
      address: string;
    };
    resource?: {
      type: string;
      index: number;
      label: string;
    };
    eta_seconds?: number;
    completion_at?: string;
    scheduled_start_at?: string;
  };
}

interface City {
  id: string;
  name: string;
  tz: string;
}

import { CartItem } from "@/components/CartButton";

interface OTTOQFleetViewProps {
  selectedCityName?: string;
  highlightedVehicleId?: string | null;
  onAddToCart?: (items: CartItem[]) => void;
}

export const OTTOQFleetView = ({ selectedCityName, highlightedVehicleId, onAddToCart }: OTTOQFleetViewProps) => {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [maintenancePanelOpen, setMaintenancePanelOpen] = useState(false);
  const [manualScheduleOpen, setManualScheduleOpen] = useState(false);
  const [upcomingServicesOpen, setUpcomingServicesOpen] = useState(false);
  const [manualVehicleId, setManualVehicleId] = useState<string>("");
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [flagVehicle, setFlagVehicle] = useState<Vehicle | null>(null);
  const { loading: healthLoading, healthData, fetchHealthScore } = useVehicleHealth();

  // Sync the selected city to the prop coming from the parent dashboard.
  // The shared otto-q-core brain is queried by city NAME (no cities table),
  // so selectedCity now holds the city name string (still a string for the
  // sibling MaintenancePanel / OTTOQScheduleDialog cityId props).
  useEffect(() => {
    const name = selectedCityName || "Nashville";
    const display = { id: name, name, tz: "" };
    setCities([display]);
    setSelectedCity(name);
  }, [selectedCityName]);

  useEffect(() => {
    if (selectedCity) {
      fetchVehiclesForCity(selectedCity);
    }
  }, [selectedCity]);

  // Map an otto-q-core vehicle_state to the legacy status vocab the card render
  // keys off ("IDLE" => Available badge; otherwise a humanized label) and, when
  // the vehicle is at the depot, synthesize a minimal assignment so the richer
  // card body (Location / Time Remaining) still renders.
  const mapOttoqVehicle = (v: any): Vehicle => {
    const state = String(v.state || "").toLowerCase();
    const atDepot =
      state.startsWith("charging") ||
      state.includes("wash_bay") ||
      state.includes("detail_bay") ||
      state.includes("service_bay") ||
      state === "staged_awaiting_service" ||
      state === "arrived_at_gate" ||
      state === "awaiting_departure";
    const enRoute = state.includes("en_route");

    let status = "IDLE";
    let assignment: Vehicle["assignment"] = undefined;

    if (state.startsWith("charging")) {
      status = "CHARGING";
      assignment = {
        job_id: v.id,
        job_type: "CHARGE",
        state: "ACTIVE",
        depot: { id: v.depot_id || "", name: v.depot_name || "Depot", address: v.city || "" },
      };
    } else if (state.includes("wash_bay") || state.includes("detail_bay") || state.includes("service_bay")) {
      status = "MAINTENANCE";
      assignment = {
        job_id: v.id,
        job_type: "MAINTENANCE",
        state: "ACTIVE",
        depot: { id: v.depot_id || "", name: v.depot_name || "Depot", address: v.city || "" },
      };
    } else if (enRoute) {
      status = "ENROUTE_DEPOT";
      assignment = {
        job_id: v.id,
        job_type: "CHARGE",
        state: "SCHEDULED",
        depot: { id: v.depot_id || "", name: v.depot_name || "Depot", address: v.city || "" },
      };
    } else if (atDepot) {
      status = "IDLE";
    } else {
      // deployed / departed / offline / out_of_service etc. -> show raw label
      status = state ? state.replace(/_/g, " ").toUpperCase() : "IDLE";
    }

    return {
      id: String(v.id),
      external_ref: v.display_name || String(v.id).slice(0, 8),
      oem: v.oem || "",
      vin: v.vin ?? null,
      plate: v.plate ?? null,
      soc: (Number(v.soc) || 0) / 100, // otto-q-core soc is 0-100 int; card expects 0-1
      odometer_km: 0,
      status,
      last_telemetry_at: v.soc_updated_at ?? null,
      city: v.city || selectedCityName || "Unknown",
      assignment,
    };
  };

  const fetchVehiclesForCity = async (cityName: string) => {
    setLoading(true);
    try {
      const resp: any = await ottoqInvoke("ottoq-fleet-vehicles", { city: cityName, limit: 50 });
      const vehiclesData: any[] = resp?.vehicles ?? [];
      setVehicles(vehiclesData.map(mapOttoqVehicle));
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      toast.error("Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (selectedCity) {
      setRefreshing(true);
      await fetchVehiclesForCity(selectedCity);
      setRefreshing(false);
      toast.success("Fleet data refreshed");
    }
  };

  const getStatusBadge = (vehicle: Vehicle) => {
    if (vehicle.assignment) {
      const { state, job_type } = vehicle.assignment;
      
      if (state === "ACTIVE") {
        if (job_type === "CHARGE") {
          return (
            <Badge className="bg-energy-grid/20 text-energy-grid border-energy-grid/40">
              <Zap className="w-3 h-3 mr-1" />
              Charging
            </Badge>
          );
        } else if (job_type === "MAINTENANCE") {
          return (
            <Badge className="bg-warning/20 text-warning border-warning/40">
              <Wrench className="w-3 h-3 mr-1" />
              In Maintenance
            </Badge>
          );
        }
        return (
          <Badge className="bg-primary/20 text-primary border-primary/40">
            <Activity className="w-3 h-3 mr-1" />
            {job_type}
          </Badge>
        );
      } else if (state === "SCHEDULED") {
        return (
          <Badge className="bg-muted/20 text-muted-foreground border-muted/40">
            <MapPin className="w-3 h-3 mr-1" />
            En Route
          </Badge>
        );
      }
    }

    if (vehicle.status === "IDLE") {
      return (
        <Badge variant="outline" className="border-success/40 text-success">
          Available
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-muted-foreground">
        {vehicle.status}
      </Badge>
    );
  };

  const getBatteryColor = (soc: number) => {
    if (soc >= 0.8) return "text-success";
    if (soc >= 0.5) return "text-warning";
    return "text-destructive";
  };

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleScheduleClick = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setScheduleDialogOpen(true);
  };

  const handleScheduleSuccess = () => {
    // Refresh vehicles after successful scheduling
    if (selectedCity) {
      fetchVehiclesForCity(selectedCity);
    }
  };

  const handleHealthClick = async (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setHealthDialogOpen(true);
    await fetchHealthScore(vehicle.id);
  };

  const handleExportHealthReport = () => {
    if (!healthData?.health_score || !selectedVehicle) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text("OTTO-Q Vehicle Health Report", pageWidth / 2, 20, { align: "center" });
    
    // Vehicle Info
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    const vehicleInfo = `Vehicle: ${selectedVehicle.external_ref || selectedVehicle.id.slice(0, 8)} | ${selectedVehicle.oem || "Unknown OEM"}`;
    doc.text(vehicleInfo, pageWidth / 2, 30, { align: "center" });
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, pageWidth / 2, 37, { align: "center" });
    
    // Overall Health Score
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text("Overall Health Score", 14, 50);
    
    doc.setFontSize(32);
    const scoreColor = healthData.health_score.overall_score >= 90 ? [34, 197, 94] :
                       healthData.health_score.overall_score >= 75 ? [34, 197, 94] :
                       healthData.health_score.overall_score >= 60 ? [234, 179, 8] : [239, 68, 68];
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.text(`${healthData.health_score.overall_score}`, 14, 65);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Status: ${healthData.health_score.status.toUpperCase()}`, 14, 72);
    
    // Active Alerts Section
    let yPosition = 85;
    if (healthData.health_score.alerts.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text("Active Alerts", 14, yPosition);
      yPosition += 7;
      
      const alertsData = healthData.health_score.alerts.map(alert => [
        alert.component,
        alert.severity.toUpperCase(),
        alert.message
      ]);
      
      autoTable(doc, {
        startY: yPosition,
        head: [["Component", "Severity", "Message"]],
        body: alertsData,
        theme: "striped",
        headStyles: { fillColor: [239, 68, 68] },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 25 },
          2: { cellWidth: 'auto' }
        }
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Component Health Section
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text("Component Health Details", 14, yPosition);
    yPosition += 7;
    
    const componentsData = healthData.health_score.components.map(comp => [
      comp.component,
      `${comp.score}%`,
      comp.status.toUpperCase(),
      comp.trend.toUpperCase(),
      comp.next_service_km ? `${comp.next_service_km.toLocaleString()} km` : "N/A"
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [["Component", "Score", "Status", "Trend", "Next Service"]],
      body: componentsData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 }
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 10;
    
    // Cost Projections Section
    if (healthData.cost_projections && yPosition < 250) {
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text("Cost Projections", 14, yPosition);
      yPosition += 7;
      
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total Estimated Cost: $${healthData.cost_projections.total_estimated_cost}`, 14, yPosition);
      yPosition += 7;
      
      if (healthData.cost_projections.breakdown) {
        const breakdownData = Object.entries(healthData.cost_projections.breakdown).map(([key, value]) => [
          key,
          `$${value}`
        ]);
        
        autoTable(doc, {
          startY: yPosition,
          head: [["Item", "Cost"]],
          body: breakdownData,
          theme: "plain",
          styles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 'auto', halign: 'right' }
          }
        });
      }
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Generated by OTTO-Q Fleet Management System", pageWidth / 2, 285, { align: "center" });
    
    // Save the PDF
    const fileName = `health-report-${selectedVehicle.external_ref || selectedVehicle.id.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    toast.success("Health report exported successfully");
  };

  const currentCity = cities.find(c => c.id === selectedCity);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Autonomous Fleet - {currentCity?.name || ''}</h2>
          <p className="text-sm text-muted-foreground">
            {vehicles.length} vehicles
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Intelligent Maintenance Panel Button (Top, Centered) */}
      <MaintenancePanel 
        isOpen={maintenancePanelOpen}
        onOpenChange={setMaintenancePanelOpen}
        cityId={selectedCity}
        onAddToCart={onAddToCart}
      />

      {/* Manual Schedule & Upcoming Services - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Manual Schedule Collapsible */}
        <Collapsible open={manualScheduleOpen} onOpenChange={setManualScheduleOpen}>
          <CollapsibleTrigger asChild>
            <Button
              className="w-full min-h-12 h-auto py-2 bg-primary/80 hover:bg-primary text-white font-semibold justify-between"
            >
              <div className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                <span className="text-sm">Manual Schedule</span>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${manualScheduleOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 animate-accordion-down">
            <Card className="border-primary/30">
              <CardContent className="pt-4">
                <div className="flex flex-col gap-3">
                  <Select value={manualVehicleId} onValueChange={setManualVehicleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vehicle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {predictiveMaintenanceData.map((p) => (
                        <SelectItem key={p.vehicleId} value={p.vehicleId}>
                          <div className="flex items-center">
                            <Car className="w-4 h-4 mr-2" />
                            {p.vehicleName} ({p.oem})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => {
                      if (manualVehicleId) {
                        const vehicle = predictiveMaintenanceData.find(p => p.vehicleId === manualVehicleId);
                        if (vehicle) {
                          setSelectedVehicle({
                            id: vehicle.vehicleId,
                            external_ref: vehicle.vehicleName,
                            oem: vehicle.oem,
                            vin: null,
                            plate: null,
                            soc: 0.8,
                            odometer_km: 15000,
                            status: "IDLE",
                            city: "",
                            last_telemetry_at: null
                          });
                          setScheduleDialogOpen(true);
                        }
                      }
                    }}
                    disabled={!manualVehicleId}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Wrench className="w-4 h-4 mr-2" />
                    Schedule Service
                  </Button>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Upcoming Services Collapsible */}
        <Collapsible open={upcomingServicesOpen} onOpenChange={setUpcomingServicesOpen}>
          <CollapsibleTrigger asChild>
            <Button
              className="w-full min-h-12 h-auto py-2 bg-warning/80 hover:bg-warning text-white font-semibold justify-between"
            >
              <div className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                <span className="text-sm">Upcoming Services</span>
                <Badge className="ml-2 bg-white/20 text-white border-0 text-xs">
                  {upcomingMaintenance.length + upcomingDetailing.length}
                </Badge>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${upcomingServicesOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 animate-accordion-down">
            <Card className="border-warning/30">
              <CardContent className="pt-4">
                <Tabs defaultValue="maintenance" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-3">
                    <TabsTrigger value="maintenance" className="text-xs">
                      <Wrench className="w-3 h-3 mr-1" />
                      Maintenance ({upcomingMaintenance.length})
                    </TabsTrigger>
                    <TabsTrigger value="detailing" className="text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Detailing ({upcomingDetailing.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="maintenance">
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {upcomingMaintenance.map((service) => (
                          <div 
                            key={service.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-border/50"
                          >
                            <div className="flex items-center space-x-3">
                              <AlertTriangle className="w-4 h-4 text-warning" />
                              <div>
                                <p className="text-sm font-medium">{service.vehicleName}</p>
                                <p className="text-xs text-muted-foreground">{service.serviceType}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground mb-1">{service.scheduledDate}</p>
                              <Badge 
                                variant="outline" 
                                className={
                                  service.status === "scheduled" 
                                    ? "bg-primary/10 text-primary border-primary/30"
                                    : service.status === "in_progress"
                                    ? "bg-warning/20 text-warning border-warning/40"
                                    : "bg-success/20 text-success border-success/40"
                                }
                              >
                                {service.status === "scheduled" ? "Scheduled" : service.status === "in_progress" ? "In Progress" : "Completed"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="detailing">
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {upcomingDetailing.map((service) => (
                          <div 
                            key={service.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-border/50"
                          >
                            <div className="flex items-center space-x-3">
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                              <div>
                                <p className="text-sm font-medium">{service.vehicleName}</p>
                                <p className="text-xs text-muted-foreground">{service.serviceType}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground mb-1">{service.scheduledDate}</p>
                              <Badge 
                                variant="outline" 
                                className={
                                  service.status === "scheduled" 
                                    ? "bg-primary/10 text-primary border-primary/30"
                                    : service.status === "in_progress"
                                    ? "bg-warning/20 text-warning border-warning/40"
                                    : "bg-success/20 text-success border-success/40"
                                }
                              >
                                {service.status === "scheduled" ? "Scheduled" : service.status === "in_progress" ? "In Progress" : "Completed"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {selectedCity && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
                  {vehicles.map((vehicle) => (
                    <Card
                      key={vehicle.id}
                      id={`vehicle-${vehicle.id}`}
                      className={`hover:shadow-glow transition-all duration-500 border-border/50 futuristic-card ${
                        highlightedVehicleId === vehicle.id ? 'ring-4 ring-primary shadow-fleet-xl bg-primary/5' : ''
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <OEMVehicleIcon name={vehicle.oem || vehicle.external_ref || ''} size="md" withBackground />
                            <div>
                              <CardTitle className="text-base">
                                {vehicle.external_ref || vehicle.id.slice(0, 8)}
                              </CardTitle>
                              {vehicle.oem && (
                                <p className="text-xs text-muted-foreground">{vehicle.oem}</p>
                              )}
                            </div>
                          </div>
                          {getStatusBadge(vehicle)}
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        {/* Battery Level */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground flex items-center">
                              <Battery className="w-4 h-4 mr-1" />
                              Battery
                            </span>
                            <span className={`font-medium ${getBatteryColor(vehicle.soc)}`}>
                              {Math.round(vehicle.soc * 100)}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                vehicle.soc >= 0.8
                                  ? "bg-success"
                                  : vehicle.soc >= 0.5
                                  ? "bg-warning"
                                  : "bg-destructive"
                              }`}
                              style={{ width: `${vehicle.soc * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Assignment Info */}
                        {vehicle.assignment && (
                          <div className="p-3 rounded-lg bg-muted/30 space-y-2 border border-border/50">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                Location
                              </span>
                              <span className="text-xs font-medium">
                                {vehicle.assignment.depot.name}
                              </span>
                            </div>

                            {vehicle.assignment.resource && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Position
                                </span>
                                <span className="text-xs font-medium">
                                  {vehicle.assignment.resource.label}
                                </span>
                              </div>
                            )}

                            {vehicle.assignment.state === "ACTIVE" &&
                              vehicle.assignment.eta_seconds && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    Time Remaining
                                  </span>
                                  <span className="text-xs font-medium text-primary">
                                    {formatTimeRemaining(vehicle.assignment.eta_seconds)}
                                  </span>
                                </div>
                              )}

                            {vehicle.assignment.state === "SCHEDULED" && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Status
                                </span>
                                <span className="text-xs font-medium text-warning">
                                  En Route to Depot
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* OTTO-Q Sequence */}
                        <OttoQSequenceCard vehicleId={vehicle.id} />

                        {/* Vehicle Details */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {vehicle.plate && (
                            <div>
                              <span className="text-muted-foreground">Plate:</span>
                              <span className="ml-1 font-medium">{vehicle.plate}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">ODO:</span>
                            <span className="ml-1 font-medium">
                              {vehicle.odometer_km.toLocaleString()} km
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleHealthClick(vehicle)}
                          >
                            <Heart className="w-4 h-4 mr-1.5" />
                            Health
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                            onClick={() => {
                              setFlagVehicle(vehicle);
                              setFlagDialogOpen(true);
                            }}
                            title="OEM Admin only — sequester vehicle for inspection"
                          >
                            <Flag className="w-4 h-4" />
                            Flag
                            <Badge
                              variant="outline"
                              className="ml-0.5 h-4 px-1 text-[9px] font-medium border-destructive/30 bg-destructive/5 text-destructive"
                            >
                              OEM Admin
                            </Badge>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {/* Schedule Dialog */}
        <OTTOQScheduleDialog
          vehicle={selectedVehicle}
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          cityId={selectedCity}
          onSuccess={handleScheduleSuccess}
        />

        {/* Health Score Dialog */}
        <Dialog open={healthDialogOpen} onOpenChange={setHealthDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>
                  Vehicle Health Analysis - {selectedVehicle?.external_ref || selectedVehicle?.id.slice(0, 8)}
                </DialogTitle>
                {healthData?.health_score && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportHealthReport}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
                )}
              </div>
            </DialogHeader>
            {healthLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Tabs defaultValue="health" className="space-y-4 pb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="health">
                    <Heart className="w-3.5 h-3.5 mr-1.5" />
                    Health
                  </TabsTrigger>
                  <TabsTrigger value="visits">
                    <History className="w-3.5 h-3.5 mr-1.5" />
                    Visit History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="health" className="space-y-4">
                  {healthData?.health_score ? (
                    <>
                      <VehicleHealthCard
                        overallScore={healthData.health_score.overall_score}
                        status={healthData.health_score.status}
                        components={healthData.health_score.components}
                        alerts={healthData.health_score.alerts}
                      />
                      {healthData.cost_projections && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Cost Projections</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Estimated Cost:</span>
                              <span className="font-medium">${healthData.cost_projections.total_estimated_cost}</span>
                            </div>
                            {healthData.cost_projections.breakdown && (
                              <div className="space-y-1 mt-3">
                                <p className="text-xs text-muted-foreground font-medium">Breakdown:</p>
                                {Object.entries(healthData.cost_projections.breakdown).map(([key, value]) => (
                                  <div key={key} className="flex justify-between text-xs pl-3">
                                    <span className="text-muted-foreground">{key}:</span>
                                    <span>${value as number}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No health data available</p>
                  )}
                </TabsContent>

                <TabsContent value="visits">
                  <VisitHistoryPanel vehicleId={selectedVehicle?.id ?? null} />
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* OEM Mid-Flow Flag Dialog */}
        <OemMidFlowFlagDialog
          vehicleId={flagVehicle?.id ?? null}
          vehicleLabel={flagVehicle ? `${flagVehicle.external_ref ?? flagVehicle.id.slice(0, 8)}${flagVehicle.oem ? ` · ${flagVehicle.oem}` : ""}` : ""}
          open={flagDialogOpen}
          onOpenChange={setFlagDialogOpen}
        />
    </div>
  );
};

// Visit history sub-panel (rendered inside Health dialog tab)
const VisitHistoryPanel = ({ vehicleId }: { vehicleId: string | null }) => {
  const { data, isLoading } = useVehicleVisitHistory(vehicleId, 20);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!data || data.count === 0) {
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">
        No visits completed yet for this vehicle.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {data.reports.map((r) => {
        const isOpen = expanded === r.id;
        const start = new Date(r.visit_started_at);
        const dur = r.actual_duration_min ?? r.planned_duration_min;
        const openAbnormality = r.abnormalities.some((a) => !a.resolved_at);
        return (
          <div key={r.id} className="border border-border/50 rounded-md">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : r.id)}
              className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                  {start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  {dur !== null && ` (${dur} min)`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.actual_sequence.length} services · {r.overrides_applied.length} overrides ·{" "}
                  {r.oem_interactions.length} OEM ·{" "}
                  {r.audit_trail_complete ? (
                    <span className="text-success">✓ audit complete</span>
                  ) : (
                    <span className="text-warning">in progress</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.deviation_count > 0 && (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                      ⚠ {r.deviation_count} deviation{r.deviation_count !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {openAbnormality && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                      ⚑ open abnormality
                    </Badge>
                  )}
                </div>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 flex-shrink-0" />}
            </button>
            {isOpen && (
              <div className="border-t border-border/50 p-3">
                <VisitReportCard report={r} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
