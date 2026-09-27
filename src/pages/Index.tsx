import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveOverview } from "@/components/live/LiveOverview";
import { FleetPanel } from "@/components/live/FleetPanel";
import { DepotPanel } from "@/components/live/DepotPanel";
import { EnergyPanel } from "@/components/live/EnergyPanel";
import { IncidentsPanel } from "@/components/live/IncidentsPanel";
import { PerformancePanel } from "@/components/live/PerformancePanel";
import { PlanPanel } from "@/components/live/PlanPanel";
import { OperatorScopePicker, ScopedDecisionFeed, useOperatorScope } from "@/components/live/OperatorScope";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Battery, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { City } from "@/components/CitySearchBar";
import { AddVehiclePopup, TrackVehiclePopup, VehicleDetailsPopup, MaintenancePopup } from "@/components/VehiclePopups";
import { OttoCommandPanel } from "@/components/OttoCommand";
import { CartItem } from "@/components/CartButton";
import { PendingOemGatesBanner } from "@/components/PendingOemGatesBanner";
import { OttoResponsePanel } from "@/components/OttoResponse";
import { AppHeader } from "@/components/shared/AppHeader";

import { ottoQFetch, ottoqInvoke } from "@/lib/otto-q-api";

const Index = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [fleetOperatorId, setFleetOperatorId] = useOperatorScope();
  const [currentCity, setCurrentCity] = useState<City>({
    name: "Nashville",
    coordinates: [-86.7816, 36.1627],
    country: "USA"
  });
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [depots, setDepots] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Popup states
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [trackVehicleOpen, setTrackVehicleOpen] = useState(false);
  const [vehicleDetailsOpen, setVehicleDetailsOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [aiAgentOpen, setAiAgentOpen] = useState(false);
  const [showDueSoonSummary, setShowDueSoonSummary] = useState(false);
  const [popupVehicle, setPopupVehicle] = useState<typeof vehicles[0] | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  
  // Checkout success handling
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkoutSuccessOpen, setCheckoutSuccessOpen] = useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    
    if (checkout === 'success' && sessionId) {
      // Store session ID and open dialog BEFORE cleaning URL
      setCheckoutSessionId(sessionId);
      setCheckoutSuccessOpen(true);
      // Clear cart on successful checkout
      setCartItems([]);
      
      // Delay URL cleanup to ensure state is captured
      setTimeout(() => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('checkout');
        newParams.delete('session_id');
        setSearchParams(newParams, { replace: true });
      }, 100);
    } else if (checkout === 'cancelled') {
      toast.info('Checkout cancelled');
      // Clean up cancelled URL immediately
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('checkout');
      setSearchParams(newParams, { replace: true });
    }
  }, []);
  const handleTrackVehicle = (vehicle: typeof vehicles[0]) => {
    setPopupVehicle(vehicle);
    setTrackVehicleOpen(true);
  };
  const handleVehicleDetails = (vehicle: typeof vehicles[0]) => {
    setPopupVehicle(vehicle);
    setVehicleDetailsOpen(true);
  };
  const handleMaintenanceSchedule = (vehicle: typeof vehicles[0]) => {
    setPopupVehicle(vehicle);
    setMaintenanceOpen(true);
  };
  const handleSendToOtto = (vehicle: typeof vehicles[0]) => {
    // Add logic to send vehicle to OTTOYARD depot
    console.log(`Sending ${vehicle.name} to OTTOYARD depot for charging/staging`);
    // You could add a toast notification here
  };
  const handleAddToCart = (items: CartItem[]) => {
    setCartItems(prev => [...prev, ...items]);
  };
  const handleRemoveFromCart = (itemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  };
  const handleCheckout = () => {
    console.log('Processing checkout for items:', cartItems);
    // Add checkout logic here
    setCartItems([]);
  };

  // Enhanced city coordinates mapping for all 9 supported cities
  const cityCoordinates: { [key: string]: { lat: number; lng: number } } = {
    'Nashville': { lat: 36.1627, lng: -86.7816 },
    'Austin': { lat: 30.2672, lng: -97.7431 },
    'LA': { lat: 34.0522, lng: -118.2437 },
    'Los Angeles': { lat: 34.0522, lng: -118.2437 },
    'San Francisco': { lat: 37.7749, lng: -122.4194 },
    'Seattle': { lat: 47.6062, lng: -122.3321 },
    'Denver': { lat: 39.7392, lng: -104.9903 },
    'Chicago': { lat: 41.8781, lng: -87.6298 },
    'New York': { lat: 40.7128, lng: -74.0060 },
    'Miami': { lat: 25.7617, lng: -80.1918 },
  };

  // Fetch real vehicles and depots from database with enhanced fallbacks
  const fetchCityData = async (cityName: string) => {
    setLoadingData(true);
    try {
      // Get city coordinates
      const cityCenter = cityCoordinates[cityName] || {
        lat: 36.1627,
        lng: -86.7816
      };

      // Get city ID
      // Vehicles from the shared OTTO-Q brain (otto-q-core) — same fleet OTTO-PULSE sees
      const vehResp: any = await ottoqInvoke("ottoq-fleet-vehicles", { city: cityName, limit: 100 });
      const vehiclesData: any[] = vehResp?.vehicles ?? [];

      // Map OTTO-Q vehicle_state -> chart-friendly status
      const mapStatus = (state: string): string => {
        const s = (state || "").toLowerCase();
        if (s.includes("charging")) return "charging";
        if (s.includes("wash_bay") || s.includes("detail_bay") || s.includes("service_bay")) return "maintenance";
        if (s === "deployed" || s === "departed" || s.includes("en_route")) return "active";
        return "idle";
      };
      const transformedVehicles = vehiclesData.map((v: any, index: number) => {
        const mappedStatus = mapStatus(v.state);
        return {
          id: v.display_name ? String(v.display_name).split("-").slice(-1)[0] : String(v.id).slice(0, 5),
          name: v.display_name || String(v.id).slice(0, 8),
          status: mappedStatus,
          battery: Math.round(Number(v.soc) || 0),
          location: {
            lat: cityCenter.lat + (Math.random() - 0.5) * 0.15,
            lng: cityCenter.lng + (Math.random() - 0.5) * 0.20
          },
          route: ['Downtown Route', 'Express Line', 'Airport Shuttle', 'City Loop', 'Suburban Connect'][index % 5],
          chargingTime: mappedStatus === 'charging' ? 'Charging' : 'N/A',
          nextMaintenance: mappedStatus === 'maintenance' ? 'In Progress' : '—',
          city: cityName
        };
      });
      console.log(`Loaded ${transformedVehicles.length} OTTO-Q vehicles for ${cityName}`);
      setVehicles(transformedVehicles);

      // Depots from the shared brain fleet summary (same depots OTTO-PULSE sees)
      const summary: any = await ottoQFetch("/fleet/summary");
      const allDepots: any[] = summary?.depots ?? [];
      const cityDepots = allDepots.filter((d: any) => !cityName || String(d.city || "").toLowerCase() === cityName.toLowerCase());
      const depotOffsets = [{ lat: 0.02, lng: 0.03 }, { lat: -0.02, lng: -0.03 }, { lat: 0.01, lng: -0.04 }, { lat: -0.01, lng: 0.04 }];
      const depotsWithResources = cityDepots.map((depot: any, index: number) => {
        const offset = depotOffsets[index % depotOffsets.length];
        const totalStalls = depot.stalls_total ?? 0;
        const availableStalls = depot.stalls_available ?? Math.max(0, totalStalls - (depot.stalls_occupied ?? 0));
        return {
          id: depot.id,
          name: depot.name,
          location: { lat: cityCenter.lat + offset.lat, lng: cityCenter.lng + offset.lng },
          energyGenerated: 0, // fleet energy comes from the real 24h history summary, not per-depot synthetics
          energyReturned: 0,
          vehiclesCharging: depot.charging ?? depot.stalls_occupied ?? 0,
          totalStalls,
          availableStalls,
          status: availableStalls > 2 ? 'optimal' : availableStalls > 0 ? 'busy' : 'full',
          city: cityName
        };
      });
      console.log(`Loaded ${depotsWithResources.length} OTTO-Q depots for ${cityName}`);
      setDepots(depotsWithResources);
    } catch (error) {
      console.error("Error fetching city data:", error);
      toast.error("Failed to load city data");
      setVehicles([]);
      setDepots([]);
    } finally {
      setLoadingData(false);
    }
  };

  // Load initial data
  useEffect(() => {
    fetchCityData("Nashville");
  }, []);

  

  return <div className="min-h-screen bg-background">
      {/* Header - Shared AppHeader with Interface Toggle */}
      <AppHeader
        appName="OrchestraAV1"
        currentCity={currentCity}
        onOpenAI={() => setAiAgentOpen(true)}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <div className="flex justify-center overflow-x-auto">
            <TabsList className="w-auto flex-shrink-0 max-w-xl">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="fleet">Fleet</TabsTrigger>
              <TabsTrigger value="depots">Depots</TabsTrigger>
              <TabsTrigger value="energy">Energy</TabsTrigger>
              <TabsTrigger value="incidents">Incidents</TabsTrigger>
              <TabsTrigger value="analytics">Performance</TabsTrigger>
            </TabsList>
          </div>
          <div className="flex justify-end">
            <OperatorScopePicker value={fleetOperatorId} onChange={setFleetOperatorId} />
          </div>

          <TabsContent value="overview" className="space-y-6">
            <LiveOverview fleetOperatorId={fleetOperatorId} scopeLabel={fleetOperatorId ? "your fleet" : "all owners"} onOpen={(t) => setSelectedTab(t === "decisions" ? "fleet" : t === "depot" ? "depots" : t)} />
          </TabsContent>

          <TabsContent value="fleet" className="space-y-6">
            <FleetPanel fleetOperatorId={fleetOperatorId} showOperatorFilter={!fleetOperatorId} scopeLabel={fleetOperatorId ? "your fleet" : "all owners"} />
            <ScopedDecisionFeed fleetOperatorId={fleetOperatorId} />
            <PendingOemGatesBanner />
          </TabsContent>

          <TabsContent value="depots" className="space-y-6">
            <DepotPanel fleetOperatorId={fleetOperatorId} scopeLabel={fleetOperatorId ? "your reservations; stall use is depot-wide" : "all owners"} />
          </TabsContent>

          <TabsContent value="energy" className="space-y-6">
            <EnergyPanel fleetOperatorId={fleetOperatorId} scopeLabel={fleetOperatorId ? "site power is depot-wide; charging list is yours" : "all owners"} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <PerformancePanel scopeLabel="the five KPIs are depot-wide" />
            <PlanPanel fleetOperatorId={fleetOperatorId} scopeLabel={fleetOperatorId ? "your inbound vehicles; the power plan is depot-wide" : "all owners"} />
          </TabsContent>

          {/* Incidents Tab */}
          <TabsContent value="incidents" className="space-y-6">
            <IncidentsPanel fleetOperatorId={fleetOperatorId} scopeLabel={fleetOperatorId ? "your vehicles; depot conditions are depot-wide" : "all owners"} />
          </TabsContent>
        </Tabs>
        
        {/* Popup Components */}
        <AddVehiclePopup open={addVehicleOpen} onOpenChange={setAddVehicleOpen} />
        <TrackVehiclePopup open={trackVehicleOpen} onOpenChange={setTrackVehicleOpen} vehicle={popupVehicle} />
        <VehicleDetailsPopup open={vehicleDetailsOpen} onOpenChange={setVehicleDetailsOpen} vehicle={popupVehicle} />
        <MaintenancePopup open={maintenanceOpen} onOpenChange={setMaintenanceOpen} vehicle={popupVehicle} depots={depots} onAddToCart={handleAddToCart} />
          <OttoCommandPanel open={aiAgentOpen} onOpenChange={setAiAgentOpen} currentCity={currentCity} vehicles={vehicles} depots={depots} fleetOperatorId={fleetOperatorId} />

        {/* Due Soon Summary Dialog */}
        <Dialog open={showDueSoonSummary} onOpenChange={setShowDueSoonSummary}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle className="flex items-center text-base sm:text-lg">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-warning" />
                Due Soon Summary
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              <div className="grid grid-cols-1 gap-3">
                {vehicles.slice(0, 3).map((vehicle, index) => <div key={vehicle.id} className="p-3 border border-warning/20 rounded-lg bg-warning/5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm sm:text-base">{vehicle.name}</h3>
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                        Due Soon
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs sm:text-sm">
                      <p><span className="font-medium">Due:</span> {vehicle.nextMaintenance}</p>
                      <p><span className="font-medium">Battery:</span> {vehicle.battery}% | <span className="font-medium">Status:</span> {vehicle.status}</p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="default" className="text-xs px-2 py-1 h-7" onClick={() => {
                    setPopupVehicle(vehicle);
                    setMaintenanceOpen(true);
                    setShowDueSoonSummary(false);
                  }}>
                        Schedule
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs px-2 py-1 h-7" onClick={() => {
                    setPopupVehicle(vehicle);
                    setVehicleDetailsOpen(true);
                    setShowDueSoonSummary(false);
                  }}>
                        Details
                      </Button>
                    </div>
                  </div>)}
              </div>
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex gap-2 flex-wrap justify-center">
                  <Button variant="outline" size="sm" className="text-xs px-3 py-1 h-7" onClick={() => {
                  vehicles.slice(0, 3).forEach(vehicle => {
                    setPopupVehicle(vehicle);
                    setMaintenanceOpen(true);
                  });
                  setShowDueSoonSummary(false);
                }}>
                    Schedule All
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs px-3 py-1 h-7" onClick={() => setShowDueSoonSummary(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
      
      {/* OTTO-RESPONSE Panel */}
      <OttoResponsePanel vehicles={vehicles} depots={depots} />
    </div>;
};
export default Index;