import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Bot, Activity, Sparkles } from "lucide-react";
import { WeatherButton } from "@/components/WeatherButton";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import SettingsHub from "@/components/SettingsHub";
import { CartItem } from "@/components/CartButton";
import { InterfaceToggle } from "@/components/shared/InterfaceToggle";
import type { City } from "@/components/CitySearchBar";

interface AppHeaderProps {
  appName: string;
  currentCity: City;
  cartItems?: CartItem[];
  onRemoveFromCart?: (itemId: string) => void;
  onCheckout?: () => void;
  onOpenAI?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  appName,
  currentCity,
  cartItems = [],
  onRemoveFromCart = () => {},
  onCheckout = () => {},
  onOpenAI,
}) => {
  const [showShimmer, setShowShimmer] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowShimmer(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Format app name with separator dot
  const formatAppName = (name: string) => {
    if (name.startsWith("Orchestra")) {
      const suffix = name.replace("Orchestra", "");
      return (
        <>
          Orchestra<span className="mx-0.5 opacity-50">•</span>{suffix}
        </>
      );
    }
    return name;
  };

  return (
    <div className="px-3 pb-1 overflow-hidden" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))' }}>
      <div
        className={`surface-luxury rounded-2xl border border-border/50 px-3 py-2 overflow-hidden ${
          showShimmer ? "animate-shimmer-luxury-bg" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          {/* Logo area — staggered entrance */}
          <InterfaceToggle>
            <div
              className="flex items-center gap-0.5 cursor-pointer min-w-0 animate-fade-in-up"
              style={{ animationDelay: "0ms", animationFillMode: "backwards" }}
            >
              {/* Logo with floating glow */}
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-xl" />
                <img
                  src="/ottoyard-logo-new.png"
                  alt="OTTOYARD"
                  className="w-[76px] h-[76px] object-contain relative z-10"
                />
              </div>
              <div className="flex flex-col items-center min-w-0 mt-1.5 gap-0.5">
                <span className="text-base font-bold tracking-wide text-foreground truncate text-luxury">
                  OTTOYARD
                </span>
                {/* Decorative brand line */}
                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <span className="text-label-uppercase text-orchestra leading-tight truncate text-[9px] md:text-[10px]">
                  {formatAppName(appName)}
                </span>
                <div className="mt-0.5 min-w-0 scale-[0.84] origin-center">
                  <WeatherButton city={currentCity} />
                </div>
              </div>
            </div>
          </InterfaceToggle>

          {/* Right side actions — staggered entrance */}
          <div
            className="flex flex-col items-end gap-1 flex-shrink-0 animate-fade-in-up"
            style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
          >
            <div className="flex items-center gap-1">
              <NotificationsPanel />
              <SettingsHub
                cartItems={cartItems}
                onRemoveFromCart={onRemoveFromCart}
                onCheckout={onCheckout}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-1.5 gap-1 glass-button rounded-xl [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:min-w-9"
                >
                  <Settings className="h-4 w-4" />
                  {cartItems.length > 0 && (
                    <Badge variant="destructive" className="h-4 min-w-4 text-[10px] px-1">
                      {cartItems.length}
                    </Badge>
                  )}
                </Button>
              </SettingsHub>
            </div>

            {/* Premium OttoCommand button */}
            <Button
              size="sm"
              className="h-7 md:h-8 [@media(pointer:coarse)]:h-9 px-2 md:px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold shadow-[0_4px_12px_hsl(var(--primary)/0.25)] hover:shadow-[0_6px_16px_hsl(var(--primary)/0.35)] transition-all duration-200 hover:-translate-y-0.5"
              onClick={onOpenAI}
            >
              <span className="text-[10px] md:text-xs font-semibold">OttoCommand</span>
            </Button>

            {/* Online badge with breathing green dot */}
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 gap-1"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Online</span>
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};
