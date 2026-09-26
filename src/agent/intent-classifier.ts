// src/agent/intent-classifier.ts
// Intent classification system for OttoCommand AI
// Routes user queries to appropriate tools and response strategies

import { ToolName, Tools, ToolCategories } from "./tools";

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type QueryIntent =
  | "fleet_status"        // "How many vehicles are charging?"
  | "vehicle_specific"    // "What's the SOC on VEH-001?"
  | "depot_query"         // "Show Nashville depot availability"
  | "incident_triage"     // "Any critical incidents?"
  | "predictive"          // "Which vehicles need charging soon?"
  | "optimization"        // "Optimize Nashville charging schedule"
  | "comparison"          // "Compare Austin vs Nashville efficiency"
  | "scheduling"          // "Schedule VEH-005 for maintenance"
  | "ottow_dispatch"      // "Dispatch OTTOW to downtown"
  | "analytics"           // "Generate weekly utilization report"
  | "automation"          // "Auto-queue low battery vehicles"
  | "general_knowledge"   // "What is L4 autonomy?"
  | "conversation"        // "Thanks!" / casual chat
  | "unknown";            // Needs clarification

export type ResponseMode =
  | "direct"              // Simple factual answer
  | "tool_required"       // Needs tool execution
  | "multi_tool"          // Multiple tool calls needed
  | "conversational"      // Casual response
  | "clarification";      // Need more info from user

export interface ExtractedEntities {
  vehicleIds?: string[];
  depotIds?: string[];
  cities?: string[];
  timeRange?: { start?: string; end?: string; relative?: string };
  metrics?: string[];
  thresholds?: Array<{
    metric: string;
    operator: "<" | ">" | "=" | "between" | "below" | "above";
    value: number | [number, number];
  }>;
  actionType?: "charge" | "maintenance" | "detailing" | "staging" | "dispatch" | "schedule";
  oems?: string[];
  statuses?: string[];
  incidentTypes?: string[];
  urgency?: "immediate" | "urgent" | "standard";
}

export interface ClassifiedIntent {
  intent: QueryIntent;
  confidence: number;
  entities: ExtractedEntities;
  responseMode: ResponseMode;
  suggestedTools: ToolName[];
  reasoning: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

interface IntentPattern {
  intent: QueryIntent;
  patterns: RegExp[];
  keywords: string[];
  suggestedTools: ToolName[];
  responseMode: ResponseMode;
}

const intentPatterns: IntentPattern[] = [
  // Fleet Status Queries
  {
    intent: "fleet_status",
    patterns: [
      /how many (vehicles?|cars?)/i,
      /fleet (status|overview|summary)/i,
      /show (me )?(all |the )?vehicles?/i,
      /what('s| is) the (fleet|vehicle) (status|count)/i,
      /vehicles? (that are |are |)(charging|idle|active|maintenance)/i,
      /list (all )?(vehicles?|fleet)/i,
    ],
    keywords: ["fleet", "vehicles", "how many", "status", "overview", "charging", "idle", "active"],
    suggestedTools: ["query_vehicles", "generate_fleet_snapshot"],
    responseMode: "tool_required"
  },

  // Vehicle Specific Queries
  {
    intent: "vehicle_specific",
    patterns: [
      /what('s| is) (the )?(soc|battery|status|health|location) (of |on |for )?[A-Z]{2,3}-[\w-]+/i,
      /[A-Z]{2,3}-[\w-]+ (soc|battery|status|health|info|details)/i,
      /show (me )?vehicle [A-Z]{2,3}-[\w-]+/i,
      /find vehicle/i,
      /where is [A-Z]{2,3}-[\w-]+/i,
    ],
    keywords: ["vehicle", "soc", "battery", "health", "location", "where is"],
    suggestedTools: ["query_vehicles"],
    responseMode: "tool_required"
  },

  // Depot Queries
  {
    intent: "depot_query",
    patterns: [
      /depot (status|availability|capacity|utilization)/i,
      /show (me )?(the )?(nashville|austin|la|san francisco|seattle) depot/i,
      /(stalls?|bays?) (available|open|status)/i,
      /what('s| is) (available|open) at/i,
      /depot-[\w-]+/i,
    ],
    keywords: ["depot", "stall", "bay", "capacity", "availability", "Nashville", "Austin", "LA"],
    suggestedTools: ["query_depot_deep", "list_stalls"],
    responseMode: "tool_required"
  },

  // Incident Triage
  {
    intent: "incident_triage",
    patterns: [
      /(any |show |list )?(critical |active |open )?incidents?/i,
      /incident (status|summary|triage|overview)/i,
      /what incidents/i,
      /(collision|malfunction|vandalism) (report|incidents?)/i,
      /triage/i,
    ],
    keywords: ["incident", "collision", "malfunction", "triage", "critical", "emergency"],
    suggestedTools: ["triage_incidents", "query_incidents"],
    responseMode: "tool_required"
  },

  // Predictive Queries
  {
    intent: "predictive",
    patterns: [
      /which vehicles? (will |need |should )?(need |require )?(charging|charge|maintenance)/i,
      /predict(ion|ive|ed)?/i,
      /(charging|maintenance|incident) (prediction|forecast|risk)/i,
      /vehicles? (that will |about to |going to )(need|require)/i,
      /forecast/i,
      /at risk/i,
      /what will need/i,
    ],
    keywords: ["predict", "forecast", "will need", "risk", "soon", "upcoming"],
    suggestedTools: ["predict_charging_needs", "predict_maintenance_risks", "predict_incident_likelihood"],
    responseMode: "tool_required"
  },

  // Optimization
  {
    intent: "optimization",
    patterns: [
      /optimize (the )?(charging|schedule|fleet|depot)/i,
      /optimization/i,
      /best (way to |)(charge|schedule|assign)/i,
      /improve (efficiency|utilization)/i,
      /maximize (throughput|uptime)/i,
      /minimize (wait|cost|time)/i,
    ],
    keywords: ["optimize", "optimization", "improve", "maximize", "minimize", "efficiency"],
    suggestedTools: ["optimize_schedule", "auto_queue_charging"],
    responseMode: "tool_required"
  },

  // Comparison
  {
    intent: "comparison",
    patterns: [
      /compare (the )?(\w+) (vs|versus|to|with|and) (\w+)/i,
      /(\w+) vs (\w+)/i,
      /difference between/i,
      /how does (\w+) compare/i,
      /which (depot|city|oem) (is |has |performs? )(better|best|worse|worst)/i,
    ],
    keywords: ["compare", "comparison", "vs", "versus", "difference", "better", "worse"],
    suggestedTools: ["compare_metrics"],
    responseMode: "tool_required"
  },

  // Scheduling
  {
    intent: "scheduling",
    patterns: [
      /schedule (a |the )?(vehicle|[A-Z]{2,3}-[\w-]+) (for |to )/i,
      /assign (a |the )?(vehicle|[A-Z]{2,3}-[\w-]+)/i,
      /book (a |the )?(stall|bay|slot)/i,
      /create (a )?(schedule|appointment|booking)/i,
    ],
    keywords: ["schedule", "assign", "book", "appointment", "reservation"],
    suggestedTools: ["schedule_vehicle", "create_otto_q_job", "bulk_schedule"],
    responseMode: "tool_required"
  },

  // OTTOW Dispatch
  {
    intent: "ottow_dispatch",
    patterns: [
      /dispatch (ottow|tow|roadside|assistance)/i,
      /send (ottow|tow|help|assistance)/i,
      /ottow (dispatch|send|request)/i,
      /roadside assistance/i,
      /vehicle (stuck|stranded|broken down|needs help)/i,
      /emergency (dispatch|response)/i,
    ],
    keywords: ["dispatch", "ottow", "tow", "roadside", "emergency", "stranded"],
    suggestedTools: ["quick_dispatch_ottow"],
    responseMode: "tool_required"
  },

  // Analytics
  {
    intent: "analytics",
    patterns: [
      /generate (a |the )?(report|analytics|analysis)/i,
      /(daily|weekly|monthly) (report|summary|analytics)/i,
      /utilization (report|metrics|stats)/i,
      /fleet (report|analytics|metrics|stats)/i,
      /show (me )?metrics/i,
      /kpi|dashboard/i,
    ],
    keywords: ["report", "analytics", "metrics", "statistics", "kpi", "dashboard", "utilization"],
    suggestedTools: ["generate_fleet_snapshot", "utilization_report", "compare_metrics"],
    responseMode: "tool_required"
  },

  // Automation
  {
    intent: "automation",
    patterns: [
      /auto(-| )?(queue|schedule|assign)/i,
      /automatically (queue|schedule|charge|maintain)/i,
      /queue (all |)(low battery|vehicles? (with|below|under))/i,
      /rebalance (the )?fleet/i,
      /automation/i,
    ],
    keywords: ["auto", "automatic", "automation", "queue", "rebalance"],
    suggestedTools: ["auto_queue_charging", "auto_queue_maintenance", "auto_rebalance_fleet"],
    responseMode: "tool_required"
  },

  // General Knowledge
  {
    intent: "general_knowledge",
    patterns: [
      /what (is|are) (L[345]|autonomy|disengagement|soc|av|autonomous)/i,
      /explain (what |)(is |are |)(L[345]|autonomy|disengagement|charging)/i,
      /how (does|do) [\w\s-]+ work/i, // a subject of any length: "How does DC fast charging work?"
      /definition of/i,
      /tell me about/i,
    ],
    keywords: ["what is", "explain", "how does", "definition", "L4", "L5", "autonomy", "disengagement"],
    suggestedTools: ["explain_concept", "search_knowledge_base"],
    responseMode: "tool_required"
  },

  // Conversational
  {
    intent: "conversation",
    patterns: [
      /^(hi|hello|hey|thanks|thank you|bye|goodbye|ok|okay|sure|great|got it)$/i,
      /^(good|nice|awesome|perfect|cool)$/i,
    ],
    keywords: ["hi", "hello", "thanks", "thank you", "bye", "ok"],
    suggestedTools: [],
    responseMode: "conversational"
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

const extractEntities = (query: string): ExtractedEntities => {
  const entities: ExtractedEntities = {};

  // Extract vehicle IDs (patterns like WM-PAC-05, ZX-GEN1-19, etc.)
  const vehicleIdPattern = /\b([A-Z]{2,3}-[\w]+-?\d*)\b/gi;
  const vehicleMatches = query.match(vehicleIdPattern);
  if (vehicleMatches) {
    entities.vehicleIds = [...new Set(vehicleMatches.map(v => v.toUpperCase()))];
  }

  // Extract depot IDs
  const depotIdPattern = /depot-[\w-]+/gi;
  const depotMatches = query.match(depotIdPattern);
  if (depotMatches) {
    entities.depotIds = [...new Set(depotMatches.map(d => d.toLowerCase()))];
  }

  // Extract cities
  const cityPatterns = ["nashville", "austin", "la", "los angeles", "san francisco", "seattle"];
  const foundCities = cityPatterns.filter(city =>
    query.toLowerCase().includes(city)
  );
  if (foundCities.length > 0) {
    entities.cities = foundCities.map(c => {
      if (c === "los angeles") return "LA";
      return c.charAt(0).toUpperCase() + c.slice(1);
    });
  }

  // Extract OEMs
  const oemPatterns = ["waymo", "zoox", "cruise", "aurora", "motional", "tesla", "nuro", "uber", "lyft"];
  const foundOems = oemPatterns.filter(oem =>
    query.toLowerCase().includes(oem)
  );
  if (foundOems.length > 0) {
    entities.oems = foundOems.map(o => o.charAt(0).toUpperCase() + o.slice(1));
  }

  // Extract statuses
  const statusPatterns = ["idle", "charging", "active", "maintenance", "en_route", "en route"];
  const foundStatuses = statusPatterns.filter(status =>
    query.toLowerCase().includes(status)
  );
  if (foundStatuses.length > 0) {
    entities.statuses = foundStatuses.map(s => s.replace(" ", "_"));
  }

  // Extract incident types
  const incidentTypes = ["collision", "malfunction", "interior", "vandalism"];
  const foundIncidents = incidentTypes.filter(type =>
    query.toLowerCase().includes(type)
  );
  if (foundIncidents.length > 0) {
    entities.incidentTypes = foundIncidents;
  }

  // Extract thresholds (e.g., "below 30%", "under 20%", "less than 50%")
  const thresholdPatterns = [
    { pattern: /(below|under|less than)\s*(\d+)\s*%?/gi, operator: "<" as const },
    { pattern: /(above|over|more than|greater than)\s*(\d+)\s*%?/gi, operator: ">" as const },
    { pattern: /(\d+)\s*%?\s*(or less|or below)/gi, operator: "<" as const },
    { pattern: /(\d+)\s*%?\s*(or more|or above)/gi, operator: ">" as const },
  ];

  for (const { pattern, operator } of thresholdPatterns) {
    const match = pattern.exec(query);
    if (match) {
      const value = parseInt(match[2] || match[1]);
      entities.thresholds = entities.thresholds || [];
      // Determine metric based on context
      let metric = "soc";
      if (query.toLowerCase().includes("health")) metric = "health_score";
      if (query.toLowerCase().includes("utilization")) metric = "utilization";
      entities.thresholds.push({ metric, operator, value });
    }
  }

  // Extract time ranges
  const timePatterns = [
    { pattern: /last (\d+) (hour|day|week)s?/i, type: "relative" },
    { pattern: /next (\d+) (hour|day|week)s?/i, type: "relative" },
    { pattern: /today|tonight|tomorrow/i, type: "relative" },
    { pattern: /this (week|month)/i, type: "relative" },
  ];

  for (const { pattern } of timePatterns) {
    const match = query.match(pattern);
    if (match) {
      entities.timeRange = { relative: match[0].toLowerCase() };
      break;
    }
  }

  // Extract action types
  if (/charg(e|ing)/i.test(query)) entities.actionType = "charge";
  else if (/mainten(ance|ing)/i.test(query)) entities.actionType = "maintenance";
  else if (/detail(ing)?/i.test(query)) entities.actionType = "detailing";
  else if (/stag(e|ing)/i.test(query)) entities.actionType = "staging";
  else if (/dispatch/i.test(query)) entities.actionType = "dispatch";
  else if (/schedul(e|ing)/i.test(query)) entities.actionType = "schedule";

  // Extract urgency
  if (/immediate(ly)?|emergency|critical|urgent/i.test(query)) {
    entities.urgency = "immediate";
  } else if (/urgent|asap|soon|quick/i.test(query)) {
    entities.urgency = "urgent";
  }

  return entities;
};

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT CLASSIFIER
// ═══════════════════════════════════════════════════════════════════════════════

export class IntentClassifier {

  /**
   * Classify user query intent and extract relevant entities
   */
  static classify(query: string): ClassifiedIntent {
    const normalizedQuery = query.trim().toLowerCase();
    const entities = extractEntities(query);

    // Score each intent pattern
    const scores: Array<{ pattern: IntentPattern; score: number }> = [];

    for (const pattern of intentPatterns) {
      let score = 0;

      // Check regex patterns
      for (const regex of pattern.patterns) {
        if (regex.test(query)) {
          score += 3; // Strong match
        }
      }

      // Check keywords
      for (const keyword of pattern.keywords) {
        if (normalizedQuery.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }

      // Boost score based on extracted entities relevance
      if (pattern.intent === "vehicle_specific" && entities.vehicleIds?.length) {
        score += 2;
      }
      if (pattern.intent === "depot_query" && (entities.depotIds?.length || entities.cities?.length)) {
        score += 2;
      }
      if (pattern.intent === "ottow_dispatch" && entities.urgency) {
        score += 2;
      }
      if (pattern.intent === "comparison" && entities.cities && entities.cities.length >= 2) {
        score += 2;
      }

      scores.push({ pattern, score });
    }

    // Sort by score and get best match
    scores.sort((a, b) => b.score - a.score);
    const bestMatch = scores[0];
    const secondBest = scores[1];

    // Calculate confidence
    let confidence = 0;
    if (bestMatch.score > 0) {
      confidence = Math.min(1, bestMatch.score / 8); // Normalize to 0-1

      // Reduce confidence if second best is close
      if (secondBest && secondBest.score > 0) {
        const gap = bestMatch.score - secondBest.score;
        if (gap < 2) {
          confidence *= 0.8;
        }
      }
    }

    // Determine final intent
    let intent: QueryIntent = "unknown";
    let suggestedTools: ToolName[] = [];
    let responseMode: ResponseMode = "clarification";
    let reasoning = "";

    if (bestMatch.score >= 2) {
      intent = bestMatch.pattern.intent;
      suggestedTools = bestMatch.pattern.suggestedTools;
      responseMode = bestMatch.pattern.responseMode;
      reasoning = `Matched intent "${intent}" with score ${bestMatch.score}`;
    } else if (bestMatch.score === 1) {
      intent = bestMatch.pattern.intent;
      suggestedTools = bestMatch.pattern.suggestedTools;
      responseMode = "tool_required";
      confidence *= 0.7;
      reasoning = `Weak match for "${intent}" - may need clarification`;
    } else {
      // Check if it's a general question we can handle
      if (/\?$/.test(query.trim()) || /^(what|how|why|when|where|who|which|can|do|is|are)/i.test(query)) {
        intent = "general_knowledge";
        suggestedTools = ["explain_concept", "search_knowledge_base"];
        responseMode = "tool_required";
        confidence = 0.5;
        reasoning = "Appears to be a general question";
      } else {
        reasoning = "No clear intent pattern matched";
      }
    }

    // Adjust tools based on entities
    if (intent === "fleet_status" && entities.cities?.length === 1) {
      // Add city filter to query
      reasoning += ` - filtered to ${entities.cities[0]}`;
    }

    // Check if multiple tools might be needed
    if (entities.thresholds?.length && entities.actionType) {
      responseMode = "multi_tool";
      reasoning += " - may require multiple tool calls";
    }

    return {
      intent,
      confidence: Math.round(confidence * 100) / 100,
      entities,
      responseMode,
      suggestedTools,
      reasoning
    };
  }

  /**
   * Get tools for a specific category
   */
  static getToolsForCategory(category: keyof typeof ToolCategories): ToolName[] {
    return ToolCategories[category] as unknown as ToolName[];
  }

  /**
   * Check if query likely needs database/API access
   */
  static requiresDataAccess(intent: QueryIntent): boolean {
    const dataIntents: QueryIntent[] = [
      "fleet_status",
      "vehicle_specific",
      "depot_query",
      "incident_triage",
      "predictive",
      "analytics",
      "comparison"
    ];
    return dataIntents.includes(intent);
  }

  /**
   * Check if query is an action request (vs read-only)
   */
  static isActionRequest(intent: QueryIntent): boolean {
    const actionIntents: QueryIntent[] = [
      "scheduling",
      "ottow_dispatch",
      "automation",
      "optimization"
    ];
    return actionIntents.includes(intent);
  }

  /**
   * Get follow-up question suggestions based on intent
   */
  static getSuggestedFollowUps(intent: QueryIntent, entities: ExtractedEntities): string[] {
    const followUps: string[] = [];

    switch (intent) {
      case "fleet_status":
        followUps.push("Show vehicles that need charging");
        followUps.push("Compare depot utilization");
        if (entities.cities?.length) {
          followUps.push(`Show maintenance predictions for ${entities.cities[0]}`);
        }
        break;
      case "vehicle_specific":
        if (entities.vehicleIds?.length) {
          followUps.push(`Schedule ${entities.vehicleIds[0]} for charging`);
          followUps.push(`Show maintenance history for ${entities.vehicleIds[0]}`);
        }
        break;
      case "incident_triage":
        followUps.push("Dispatch OTTOW for critical incidents");
        followUps.push("Show incident trends this week");
        break;
      case "predictive":
        followUps.push("Auto-queue predicted vehicles");
        followUps.push("Show detailed risk factors");
        break;
      case "depot_query":
        followUps.push("Optimize depot schedule");
        followUps.push("Show charging queue");
        break;
    }

    return followUps;
  }
}

export default IntentClassifier;
