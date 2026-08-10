import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/shared/AppHeader";
import { OttoCommandPanel } from "@/components/OttoCommand";
import { EVOverview } from "@/components/orchestra-ev/EVOverview";
import { EVDepotQ } from "@/components/orchestra-ev/EVDepotQ";
import { EVServices } from "@/components/orchestra-ev/EVServices";
import { EVTowing } from "@/components/orchestra-ev/EVTowing";

import { EVReports } from "@/components/orchestra-ev/EVReports";
import { LayoutDashboard, Building2, Wrench, Truck, BarChart3 } from "lucide-react";
import { ottoqInvoke } from "@/lib/otto-q-api";

import type { City } from "@/components/CitySearchBar";

// Default city for OrchestraEV (subscriber's home city)
const defaultCity: City = {
  name: "Nashville",
  coordinates: [-86.7816, 36.1627],
  country: "USA",
};

// Type definitions for real data
interface Subscriber {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  membershipTier: string;
  subscriptionStatus: string;
  memberSince: string;
  homeAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
  };
  preferredDepotId: string;
}

interface SubscriberVehicle {
  id: string;
  subscriberId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vin: string;
  licensePlate: string;
  batteryCapacityKwh: number;
  currentSoc: number;
  currentStatus: string;
  currentLocation: { lat: number; lng: number };
  currentDepotId: string;
  currentStallId: string;
  healthScore: number;
  odometerMiles: number;
  chargingPreferencePct: number;
  estimatedRangeMiles: number;
  tirePressure: { fl: number; fr: number; rl: number; rr: number; unit: string };
  brakeWearPct: { front: number; rear: number };
  batteryHealthPct: number;
  lastDiagnosticDate: string;
}

interface ServiceRecord {
  id: string;
  type: string;
  status: string;
  depotName: string;
  scheduledAt: string;
  startedAt: string;
  completedAt: string;
  cost: number;
  notes: string;
  technicianName: string;
}

interface MaintenancePrediction {
  id: string;
  serviceType: string;
  label: string;
  predictedDueDate: string;
  confidence: string;
  urgency: string;
  reasoning: string;
  mileageTrigger: number;
}

interface TowRequest {
  id: string;
  status: string;
  pickupLocation: { lat: number; lng: number; address: string };
  destinationDepot: string;
  issueType: string;
  issueDescription: string;
  driverName: string;
  driverVehicle: string;
  driverPhone: string;
  requestedAt: string;
  completedAt: string;
}

interface AmenityReservation {
  id: string;
  type: string;
  depotName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: string;
  bayNumber: string;
}

interface DepotServiceStages {
  vehicleId: string;
  depotName: string;
  depotAddress: string;
  depotHours: string;
  depotStatus: string;
  stages: {
    name: string;
    status: string;
    timestamp: string;
    estimatedCompletion: string;
  }[];
  currentStall: {
    id: string;
    type: string;
    subType: string;
    power: string;
    currentRate: string;
    energyConsumed: number;
  };
}

interface EVNotification {
  id: string;
  message: string;
  time: string;
  type: string;
  read: boolean;
}

interface EVEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  rsvpd: boolean;
}

interface AmenityAvailability {
  simGolf: { bayNumber: string; slots: string[] }[];
  coworkTables: { tableId: string; type: string; amenities: string[]; slots: string[] }[];
  privacyPods: { podId: string; capacity: number; equipment: string[]; slots: string[] }[];
}

const tabItems = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "depot-q", label: "Depot", icon: Building2 },
  { value: "services", label: "Services", icon: Wrench },
  { value: "towing", label: "OTTOW", icon: Truck },
  { value: "reports", label: "Reports", icon: BarChart3 },
] as const;

const OrchestraEV = () => {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [aiAgentOpen, setAiAgentOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Shared Header */}
      <AppHeader
        appName="OrchestraEV1"
        currentCity={defaultCity}
        onOpenAI={() => setAiAgentOpen(true)}
      />

      {/* Main Content */}
      <div className="px-3 pb-3">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <div className="flex justify-center mb-3">
            <div className="surface-luxury rounded-2xl p-1 md:p-1.5 w-auto">
              <TabsList className="flex overflow-x-auto scrollbar-hide flex-nowrap md:grid md:grid-cols-5 w-full bg-transparent h-auto p-0">
                {tabItems.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex-shrink-0 flex items-center justify-center rounded-lg px-1 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[10px] font-medium tracking-normal md:tracking-wide uppercase text-muted-foreground bg-transparent transition-all duration-300 ease-out hover:bg-muted/30 hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary-foreground data-[state=active]:font-semibold data-[state=active]:border data-[state=active]:border-primary/25 data-[state=active]:shadow-[0_0_12px_hsl(var(--primary)/0.1)] relative"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          <TabsContent value="overview" className="animate-fade-in-up">
            <EVOverview subscriber={mockSubscriber} vehicle={mockVehicle} serviceRecords={mockServiceRecords} notifications={mockNotifications} events={mockEvents} predictions={mockMaintenancePredictions} amenityAvailability={mockAmenityAvailability} amenityReservations={mockAmenityReservations} onTabChange={setSelectedTab} />
          </TabsContent>

          <TabsContent value="depot-q" className="animate-fade-in-up">
            <EVDepotQ depotStages={mockDepotServiceStages} vehicle={mockVehicle} />
          </TabsContent>

          <TabsContent value="services" className="animate-fade-in-up">
            <EVServices serviceRecords={mockServiceRecords} predictions={mockMaintenancePredictions} />
          </TabsContent>

          <TabsContent value="towing" className="animate-fade-in-up">
            <EVTowing towRequests={mockTowRequests} />
          </TabsContent>

          <TabsContent value="reports" className="animate-fade-in-up">
            <EVReports serviceRecords={mockServiceRecords} />
          </TabsContent>

        </Tabs>
      </div>

      {/* OttoCommand AI Agent */}
      <OttoCommandPanel
        open={aiAgentOpen}
        onOpenChange={setAiAgentOpen}
        mode="ev"
        evContext={{
          subscriber: mockSubscriber,
          vehicle: mockVehicle,
          serviceRecords: mockServiceRecords,
          amenityAvailability: mockAmenityAvailability,
          amenityReservations: mockAmenityReservations,
          depotStages: mockDepotServiceStages,
        }}
        currentCity={defaultCity}
      />
    </div>
  );
};

export default OrchestraEV;
