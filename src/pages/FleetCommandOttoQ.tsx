import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/shared/AppHeader";
import { OperationsOverview, ThroughputAnalytics, EnergyDashboard, PredictionPerformance, FleetComms, AlertsConfigPanel } from "@/components/FleetCommand/OttoQIntelligence";
import DepotFloorPlan from "@/components/OttoQ/DepotMap/DepotFloorPlan";
import QueueManager from "@/components/OttoQ/QueueManager";
import { AVPipelineView } from "@/components/OttoQ/AVCommand";
import { useAVOrchestrator } from "@/hooks/useAVOrchestrator";
import { Activity, BarChart3, Zap, Target, Map, Bot, ListOrdered, Radio, Settings } from "lucide-react";
import type { City } from "@/components/CitySearchBar";

const defaultCity: City = { name: "Nashville", coordinates: [-86.7816, 36.1627], country: "USA" };

const tabs = [
  { value: "overview", label: "Operations", icon: Activity },
  { value: "throughput", label: "Throughput", icon: BarChart3 },
  { value: "energy", label: "Energy", icon: Zap },
  { value: "predictions", label: "Predictions", icon: Target },
  { value: "depot-map", label: "Depot Map", icon: Map },
  { value: "av-command", label: "AV Command", icon: Bot },
  { value: "comms", label: "Comms", icon: Radio },
  { value: "queue", label: "Queue", icon: ListOrdered },
  { value: "settings", label: "Settings", icon: Settings },
] as const;

const FleetCommandOttoQ = () => {
  const [selectedTab, setSelectedTab] = useState("overview");
  const av = useAVOrchestrator();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader appName="Fleet Command — OTTO-Q Intelligence" currentCity={defaultCity} />

      <div className="px-3 pb-3">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <div className="flex justify-center mb-3">
            <div className="surface-luxury rounded-2xl p-1 md:p-1.5 max-w-full w-full mx-auto">
              <TabsList className="flex overflow-x-auto scrollbar-hide flex-nowrap w-full bg-transparent h-auto p-0">
                {tabs.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value}
                    className="flex-shrink-0 flex items-center justify-center rounded-xl px-2 md:px-3 py-2 text-[10px] md:text-xs font-medium tracking-wide uppercase text-muted-foreground bg-transparent transition-all duration-300 hover:bg-muted/30 hover:text-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border data-[state=active]:border-primary/25">
                    <tab.icon className="h-3.5 w-3.5 mr-1 hidden md:block" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          <TabsContent value="overview" className="animate-fade-in-up"><OperationsOverview /></TabsContent>
          <TabsContent value="throughput" className="animate-fade-in-up"><ThroughputAnalytics /></TabsContent>
          <TabsContent value="energy" className="animate-fade-in-up"><EnergyDashboard /></TabsContent>
          <TabsContent value="predictions" className="animate-fade-in-up"><PredictionPerformance /></TabsContent>
          <TabsContent value="depot-map" className="animate-fade-in-up"><DepotFloorPlan depotId="demo" /></TabsContent>
          <TabsContent value="av-command" className="animate-fade-in-up"><AVPipelineView pipelines={av.pipelines} /></TabsContent>
          <TabsContent value="comms" className="animate-fade-in-up"><FleetComms /></TabsContent>
          <TabsContent value="queue" className="animate-fade-in-up"><QueueManager /></TabsContent>
          <TabsContent value="settings" className="animate-fade-in-up"><AlertsConfigPanel /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FleetCommandOttoQ;
