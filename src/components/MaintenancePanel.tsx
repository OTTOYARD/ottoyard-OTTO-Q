import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Wrench, 
  ChevronDown, 
  Brain, 
  Calendar, 
  CheckCircle2, 
  Sparkles,
  MapPin
} from "lucide-react";
import { OTTOQScheduleDialog } from "./OTTOQScheduleDialog";
import { OEMVehicleIcon } from "./OEMVehicleIcon";
import {
  predictiveMaintenanceData,
  PredictedMaintenance,
  getServicePrice
} from "@/types/incidents";
import { toast } from "sonner";

import { CartItem } from "@/components/CartButton";

interface MaintenancePanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  cityId: string;
  onAddToCart?: (items: CartItem[]) => void;
}

export function MaintenancePanel({ isOpen, onOpenChange, cityId, onAddToCart }: MaintenancePanelProps) {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedVehicleForSchedule, setSelectedVehicleForSchedule] = useState<any>(null);
  const [selectedServiceType, setSelectedServiceType] = useState<string>("MAINTENANCE");

  // All predictions are now auto-scheduled
  const autoScheduledCount = predictiveMaintenanceData.length;

  const handleViewDetails = (prediction: PredictedMaintenance) => {
    setSelectedVehicleForSchedule({
      id: prediction.vehicleId,
      external_ref: prediction.vehicleName,
      oem: prediction.oem,
      predictedService: prediction.predictedService
    });
    setSelectedServiceType(prediction.predictedService);
    setScheduleDialogOpen(true);
  };

  const handleScheduleSuccess = () => {
    // Add to cart if callback provided
    if (onAddToCart && selectedVehicleForSchedule) {
      const price = getServicePrice(selectedServiceType);
      const cartItem: CartItem = {
        id: `maint-${Date.now()}`,
        vehicleId: selectedVehicleForSchedule.id,
        vehicleName: selectedVehicleForSchedule.external_ref || selectedVehicleForSchedule.id,
        service: selectedServiceType,
        serviceName: selectedServiceType,
        price: price,
        date: new Date().toLocaleDateString(),
        time: "Scheduled",
      };
      onAddToCart([cartItem]);
      toast.success(`Added to cart - $${price}`);
    }
    
    setScheduleDialogOpen(false);
    setSelectedVehicleForSchedule(null);
    toast.success("Scheduling complete! Service has been booked.");
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return "text-success";
    if (score >= 75) return "text-warning";
    return "text-destructive";
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <Button
            className="w-full min-h-14 h-auto py-2 bg-gradient-to-r from-success/80 to-success hover:from-success hover:to-success/90 text-white font-semibold justify-between group"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 items-start">
              <div className="flex items-center">
                <Brain className="w-5 h-5 mr-2 shrink-0" />
                <span className="text-sm sm:text-base">Intelligent Maintenance</span>
              </div>
              <div className="flex gap-2 sm:ml-3">
                <Badge className="bg-white/20 text-white border-0 text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {autoScheduledCount} Auto-Scheduled
                </Badge>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 animate-accordion-down">
          {/* Auto-Scheduled Maintenance Section (Merged AI Predictions + Queue) */}
          <Card className="border-success/30 bg-success/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center">
                <Brain className="w-5 h-5 mr-2 text-success" />
                Auto-Scheduled by OTTO-Q
                <Sparkles className="w-4 h-4 ml-2 text-success animate-pulse" />
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                AI-predicted maintenance automatically scheduled to optimal time slots
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {predictiveMaintenanceData.map((prediction) => (
                    <Card 
                      key={prediction.id} 
                      className="p-3 border-success/30 bg-success/5"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <OEMVehicleIcon name={prediction.oem} size="sm" />
                          <div>
                            <p className="text-sm font-medium">{prediction.vehicleName}</p>
                            <p className="text-xs text-muted-foreground">{prediction.oem}</p>
                          </div>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      </div>
                      
                      <div className="space-y-1 mb-3">
                        <p className="text-sm font-medium text-foreground">{prediction.predictedService}</p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Confidence:</span>
                          <span className={`font-medium ${getConfidenceColor(prediction.confidenceScore)}`}>
                            {prediction.confidenceScore}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Health Score:</span>
                          <span className="font-medium">{prediction.healthScore}/100</span>
                        </div>
                      </div>

                      <div className="text-xs p-2 bg-success/10 rounded border border-success/20">
                        <div className="flex items-center text-success mb-1">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Scheduled
                        </div>
                        <div className="flex items-center text-muted-foreground">
                          <MapPin className="w-3 h-3 mr-1" />
                          {prediction.depotName} • {prediction.scheduledTime}
                        </div>
                        <p className="text-muted-foreground mt-1">{prediction.predictedDate}</p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2 border-success/40 text-success hover:bg-success/10"
                        onClick={() => handleViewDetails(prediction)}
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        View Details
                      </Button>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Schedule Dialog */}
      <OTTOQScheduleDialog
        vehicle={selectedVehicleForSchedule}
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        cityId={cityId}
        onSuccess={handleScheduleSuccess}
      />
    </>
  );
}
