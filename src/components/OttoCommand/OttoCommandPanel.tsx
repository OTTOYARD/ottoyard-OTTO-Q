// src/components/OttoCommand/OttoCommandPanel.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// OttoCommand AI — Flagship Chat Interface
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageRenderer } from "@/components/MessageRenderer";
import { useIncidentsStore } from "@/stores/incidentsStore";
import { useFleetContext } from "@/hooks/useFleetContext";
import { ottoqInvoke } from "@/lib/otto-q-api";
import { useOttoResponseBridge } from "@/hooks/useOttoResponseBridge";
import { useOttoCommandStore } from "@/stores/ottoCommandStore";
import { QuickActionsGrid, QuickAction } from "./QuickActions";
import { OttoCommandContextPanel } from "./OttoCommandContextPanel";
import { ProactiveIntelligence } from "./ProactiveIntelligence";
import { cn } from "@/lib/utils";
import {
  Bot,
  Send,
  Loader2,
  X,
  PanelRightOpen,
  PanelRightClose,
  RotateCcw,
  Sparkles,
  Cpu,
  ChevronDown,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface OttoCommandPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The owner scope the page is showing (OperatorScope); null is every owner. */
  fleetOperatorId?: string | null;
  mode?: "av" | "ev";
  evContext?: {
    subscriber: any;
    vehicle: any;
    serviceRecords: any[];
    amenityAvailability: any;
    amenityReservations: any[];
    depotStages: any;
  };
  currentCity?: {
    name: string;
    coordinates: [number, number];
    country: string;
  };
  vehicles?: any[];
  depots?: any[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCROLL-TO-BOTTOM HOOK
// ═══════════════════════════════════════════════════════════════════════════════

function useAutoScroll(deps: unknown[]) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    if (isAtBottom) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const threshold = 80;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
  }, []);

  return { bottomRef, scrollAreaRef, scrollToBottom, isAtBottom, handleScroll };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPING INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

const TypingIndicator: React.FC = () => (
  <div className="flex items-start gap-2 px-1">
    <div className="flex items-center gap-1.5 bg-card/80 border border-border/50 rounded-xl px-4 py-3">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
    <span className="text-[10px] text-muted-foreground mt-2">OttoCommand is thinking…</span>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════════════════════════

const MessageBubble: React.FC<{
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: {
    intent?: string;
    toolsUsed?: string[];
    executionTimeMs?: number;
  };
  isStreaming?: boolean;
}> = ({ role, content, timestamp, metadata, isStreaming }) => {
  const isUser = role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl shadow-sm transition-all duration-200 text-sm",
          isUser
            ? "bg-gradient-primary text-primary-foreground p-3 sm:p-4 glow-soft"
            : "bg-card/80 text-foreground border border-border/50 backdrop-blur-sm p-3 sm:p-4"
        )}
      >
        <MessageRenderer content={content} role={role} />

        {isStreaming && (
          <span className="inline-block h-3 w-1 bg-primary/60 animate-pulse ml-0.5" />
        )}

        {/* Footer: timestamp + metadata */}
        <div
          className={cn(
            "flex items-center gap-2 text-[10px] mt-2 pt-2 border-t",
            isUser
              ? "border-primary-foreground/20 text-primary-foreground/70"
              : "border-border/30 text-muted-foreground"
          )}
        >
          {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}

          {metadata?.toolsUsed && metadata.toolsUsed.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-0.5 cursor-help">
                    <Cpu className="h-2.5 w-2.5" />
                    {metadata.toolsUsed.length} tool{metadata.toolsUsed.length > 1 ? "s" : ""}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[200px]">
                  <p className="font-medium mb-1">Tools executed:</p>
                  {metadata.toolsUsed.map((t) => (
                    <p key={t} className="text-muted-foreground">
                      • {t}
                    </p>
                  ))}
                  {metadata.executionTimeMs && (
                    <p className="text-muted-foreground mt-1">
                      Completed in {metadata.executionTimeMs}ms
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const OttoCommandPanel: React.FC<OttoCommandPanelProps> = ({
  open,
  onOpenChange,
  mode = "av",
  evContext,
  currentCity,
  vehicles = [],
  depots = [],
  fleetOperatorId = null,
}) => {
  // Fleet context from the live twin run (the owner's projection when a scope is set)
  const fleetContext = useFleetContext(fleetOperatorId);
  const incidents = useIncidentsStore((state) => state.incidents);
  const bridge = useOttoResponseBridge();

  // OttoCommand store
  const store = useOttoCommandStore();
  const session = store.getActiveSession();
  const messages = session?.messages ?? [];

  // Local UI state
  const [showQuickActions, setShowQuickActions] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { bottomRef, scrollAreaRef, scrollToBottom, isAtBottom, handleScroll } = useAutoScroll([
    messages.length,
    store.isLoading,
    open,
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SYNC MODE
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && mode !== store.currentMode) {
      store.setMode(mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  // Auto-create session on open
  useEffect(() => {
    if (open && !store.activeSessionId) {
      store.createSession(mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || store.isLoading) return;

      store.addUserMessage(text);
      store.setLoading(true);
      setShowQuickActions(false);

      const startTime = Date.now();

      try {
        const conversationHistory = store
          .getConversationHistory(10)
          .map((m) => ({ role: m.role, content: m.content }));

        // AV/ops chat now runs on the FRONTIER brain (otto-q-core `ottoq-ottocommand` v4) — role-scoped
        // (manager), and self-sufficient: its tools read live OTTO-Q state and drive the real frontier
        // controls (energy dial, look-ahead, self-improve). EV concierge stays on its legacy function.
        let data: any;
        if (mode === "ev") {
          const res = await supabase.functions.invoke("ottocommand-ai-chat", {
            body: { message: text, mode: "ev", conversationHistory, currentCity, vehicles, depots, evContext },
          });
          if (res.error) throw res.error;
          data = res.data;
        } else {
          data = await ottoqInvoke("ottoq-ottocommand", {
            message: text,
            role: "manager",
            history: conversationHistory,
          });
        }

        // Extract content
        let content = data.content || data.reply || data.message || "";

        // Handle OTTOW dispatch
        if (data.action_block?.action === "ottow_dispatched" || data.success === true) {
          const details = data.action_block?.details || data;
          if (details.incidentId && details.vehicleId && details.city) {
            const dispatchOTTOW = useIncidentsStore.getState().dispatchOTTOW;
            const incidentId = dispatchOTTOW(
              details.vehicleId,
              details.city,
              details.type || "malfunction",
              details.summary || "Incident reported via OttoCommand AI"
            );
            toast.success(`OTTOW dispatched! Incident ${incidentId} created.`, {
              description: `Vehicle ${details.vehicleId} in ${details.city}`,
            });
          }
        }

        // Handle OTTO-Response intelligence actions
        if (data.action === "open_otto_response" || data.action_block?.action === "open_otto_response") {
          bridge.handleToolResult(data.action_block?.details || data);
        }
        if (data.action === "fleet_safe_pullover" || data.action_block?.action === "fleet_safe_pullover") {
          const d = data.action_block?.details || data;
          toast.success(`Safe pullover issued: ${d.affectedVehicles || 0} vehicles in ${d.city || "unknown"}`, {
            description: d.reason || "Fleet safety command",
          });
        }
        if (data.action === "fleet_recall_to_depot" || data.action_block?.action === "fleet_recall_to_depot") {
          const d = data.action_block?.details || data;
          toast.success(`Recall issued: ${d.affectedVehicles || 0} vehicles in ${d.city || "unknown"}`, {
            description: `Scope: ${d.scope || "all"} — ${d.reason || ""}`,
          });
        }

        // Fallback content
        if (!content.trim()) {
          if (data.action_block || data.function_calls?.length) {
            content = `Completed the requested action. How else can I help?`;
          } else {
            content = "I encountered an issue processing your request. Please try again.";
          }
        }

        const executionTimeMs = Date.now() - startTime;

        store.addAssistantMessage(content, {
          executionTimeMs,
          toolsUsed: data.action_block?.details?.ran || [],
        });
      } catch (error) {
        console.error("OttoCommand error:", error);
        toast.error("Failed to get AI response");
        store.addAssistantMessage(
          "I'm experiencing technical difficulties. Please try again in a moment."
        );
      } finally {
        store.setLoading(false);
      }
    },
    [store, fleetContext, incidents, mode, evContext, currentCity, vehicles, depots]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // INPUT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSend = () => {
    sendMessage(store.inputDraft);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.prompt);
  };

  const handleAlertAction = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleContextPrompt = (prompt: string) => {
    store.setInputDraft(prompt);
    inputRef.current?.focus();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col [&>button]:hidden text-sm p-0 gap-0",
          store.isContextPanelOpen
            ? "sm:max-w-5xl h-[100dvh] sm:h-[750px] max-h-[850px]"
            : "sm:max-w-3xl h-[100dvh] sm:h-[720px] max-h-[800px]"
        )}
      >
        {/* ─────────────── HEADER ─────────────── */}
        <DialogHeader className="px-4 py-3 border-b border-border/30 flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">OttoCommand</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {mode === "ev" ? "EV Concierge" : "Fleet Ops"}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 mt-0.5">
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      store.isLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                    )}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {store.isLoading ? "Processing…" : "Online"}
                  </span>
                  {currentCity && (
                    <span className="text-[10px] text-muted-foreground">
                      • {currentCity.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Context panel toggle (desktop) */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden sm:flex h-8 w-8 p-0"
                      onClick={() => store.toggleContextPanel()}
                    >
                      {store.isContextPanelOpen ? (
                        <PanelRightClose className="h-4 w-4" />
                      ) : (
                        <PanelRightOpen className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {store.isContextPanelOpen ? "Close context panel" : "Open context panel"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* New chat */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        store.clearCurrentSession();
                        setShowQuickActions(true);
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New conversation</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Close */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            OttoCommand AI Assistant for{" "}
            {mode === "ev" ? "EV subscriber concierge" : "fleet management operations"}
          </DialogDescription>
        </DialogHeader>

        {/* ─────────────── BODY ─────────────── */}
        <div className="flex-1 min-h-0 flex">
          {/* Chat Column */}
          <div className="flex-1 min-w-0 flex flex-col relative">
            <div
              ref={scrollAreaRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 overflow-y-auto"
            >
              <div className="p-4 space-y-4">
                {/* Proactive Alerts */}
                <ProactiveIntelligence
                  mode={mode}
                  fleetMetrics={mode === "av" ? fleetContext.fleetMetrics : undefined}
                  depotMetrics={mode === "av" ? fleetContext.depotMetrics : undefined}
                  incidentMetrics={mode === "av" ? fleetContext.incidentMetrics : undefined}
                  evVehicle={mode === "ev" && evContext?.vehicle ? evContext.vehicle : undefined}
                  onAlertAction={handleAlertAction}
                />

                {/* Quick Actions (collapsible) */}
                {showQuickActions && messages.length <= 1 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Quick Actions
                      </span>
                    </div>
                    <QuickActionsGrid
                      onSelect={handleQuickAction}
                      disabled={store.isLoading}
                      currentCity={currentCity?.name}
                      mode={mode}
                    />
                  </div>
                )}

                {/* Messages */}
                <div className="space-y-4">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      role={message.role as "user" | "assistant"}
                      content={message.content}
                      timestamp={message.timestamp}
                      metadata={message.metadata}
                      isStreaming={message.isStreaming}
                    />
                  ))}

                  {store.isLoading && <TypingIndicator />}
                </div>

                <div ref={bottomRef} />
              </div>
            </div>

            {/* Scroll-to-bottom fab */}
            {!isAtBottom && (
              <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10">
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full shadow-lg text-xs gap-1"
                  onClick={scrollToBottom}
                >
                  <ChevronDown className="h-3 w-3" />
                  New messages
                </Button>
              </div>
            )}

            {/* ─────────────── INPUT ─────────────── */}
            <div className="flex-shrink-0 p-3 border-t border-border/30">
              {/* Collapsed quick action chips (after first message) */}
              {!showQuickActions && messages.length > 1 && (
                <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] shrink-0"
                    onClick={() => setShowQuickActions(true)}
                  >
                    <Sparkles className="h-2.5 w-2.5 mr-1" />
                    Quick Actions
                  </Button>
                  {(mode === "ev"
                    ? [
                        { label: "Vehicle Status", prompt: "What's my vehicle status?" },
                        { label: "Book Amenity", prompt: "What amenities are available right now?" },
                        { label: "Depot Queue", prompt: "Show my depot queue status" },
                      ]
                    : [
                        { label: "Fleet Status", prompt: "What's the current fleet status?" },
                        { label: "Charging Needs", prompt: "Which vehicles need charging soon?" },
                        { label: "Depot Resources", prompt: "Show depot resource availability" },
                      ]
                  ).map((chip) => (
                    <Badge
                      key={chip.label}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted/50 text-[10px] shrink-0 transition-colors"
                      onClick={() => sendMessage(chip.prompt)}
                    >
                      {chip.label}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <Textarea
                  ref={inputRef}
                  placeholder={
                    mode === "ev"
                      ? "Ask about your vehicle, amenities, services…"
                      : "Ask about fleet status, analytics, operations…"
                  }
                  value={store.inputDraft}
                  rows={1}
                  spellCheck={true}
                  autoComplete="on"
                  autoCorrect="on"
                  onChange={(e) => {
                    store.setInputDraft(e.target.value);
                    e.currentTarget.style.height = "auto";
                    e.currentTarget.style.height =
                      Math.min(e.currentTarget.scrollHeight, 96) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-background/80 backdrop-blur-sm resize-none max-h-24 min-h-[40px] leading-5 text-sm border border-border/50 focus:border-primary/50 transition-all duration-200 rounded-xl"
                />
                <Button
                  onClick={handleSend}
                  disabled={!store.inputDraft.trim() || store.isLoading}
                  className="h-10 w-10 p-0 rounded-xl bg-gradient-primary hover:opacity-90 transition-opacity"
                >
                  {store.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
                OttoCommand AI • Powered by OTTOYARD Fleet Command
              </p>
            </div>
          </div>

          {/* ─────────────── CONTEXT SIDEBAR ─────────────── */}
          {store.isContextPanelOpen && (
            <>
              <Separator orientation="vertical" className="hidden sm:block opacity-30" />
              <div className="hidden sm:flex flex-col w-[260px] shrink-0 min-h-0">
                <div className="px-3 py-2 border-b border-border/30">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {mode === "ev" ? "Vehicle Context" : "Fleet Context"}
                  </span>
                </div>
                <OttoCommandContextPanel
                  mode={mode}
                  fleetContext={
                    mode === "av"
                      ? {
                          fleetMetrics: fleetContext.fleetMetrics,
                          depotMetrics: fleetContext.depotMetrics,
                          incidentMetrics: fleetContext.incidentMetrics,
                        }
                      : undefined
                  }
                  evContext={
                    mode === "ev" && evContext
                      ? {
                          subscriber: evContext.subscriber,
                          vehicle: evContext.vehicle,
                        }
                      : undefined
                  }
                  onPromptSuggestion={handleContextPrompt}
                />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OttoCommandPanel;
