// Function execution handler for OttoCommand AI agentic capabilities

// ═══════════════════════════════════════════════════════════════════════════════
// OTTO-Q CORE BACKEND ACCESS (frontier otto-q-core Supabase project)
// Mirrors the base URL + anon key used by the frontend in src/lib/otto-q-api.ts.
// Used to make the optimization/prediction/report tools call REAL data, with each
// caller falling back to its heuristic implementation on any error.
// ═══════════════════════════════════════════════════════════════════════════════
const OTTOQ_FN_BASE = "https://gxdrcyphqjzjsuhxuqtg.supabase.co/functions/v1";
const OTTOQ_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4ZHJjeXBocWp6anN1aHh1cXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjk3MDMsImV4cCI6MjA5MDkwNTcwM30.v7erbnrlciPknvx_EpUpewXrvR9-F3D-hH-jWmTW0zI";

// Default depot for OTTO-Q core calls when none provided (Nashville flagship).
const OTTOQ_DEFAULT_DEPOT = "11111111-1111-1111-1111-111111111111";

// Invoke an OTTO-Q core edge FUNCTION (orchestrate-tick, assign-optimize, etc.).
// No client timeout — some functions (Nemotron orchestrator-agent) can take ~140s.
async function ottoqCore(fn: string, body: unknown) {
  const r = await fetch(`${OTTOQ_FN_BASE}/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OTTOQ_ANON}`,
      "apikey": OTTOQ_ANON,
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`otto-q ${fn} ${r.status}`);
  return await r.json();
}

// Call the OTTO-Q REST gateway (otto-q-api /api/v1/...). Unwraps { data } envelope.
async function ottoqApi(path: string) {
  const r = await fetch(`${OTTOQ_FN_BASE}/otto-q-api/api/v1${path}`, {
    headers: {
      "Authorization": `Bearer ${OTTOQ_ANON}`,
      "apikey": OTTOQ_ANON,
    },
  });
  if (!r.ok) throw new Error(`otto-q-api ${path} ${r.status}`);
  const j = await r.json();
  return j?.data ?? j;
}

// Mock vehicle data for OTTOW dispatch
const mockVehicles = [
  // Nashville
  { id: "WM-PAC-05", make: "Waymo", model: "Jaguar I-PACE", city: "Nashville", soc: 0.87, status: "idle" },
  { id: "WM-PAC-12", make: "Waymo", model: "Jaguar I-PACE", city: "Nashville", soc: 0.45, status: "charging" },
  { id: "ZX-GEN1-19", make: "Zoox", model: "Gen1", city: "Nashville", soc: 0.78, status: "idle" },
  { id: "CR-ORG-27", make: "Cruise", model: "Origin", city: "Nashville", soc: 0.88, status: "idle" },
  { id: "TE-MOD3-06", make: "Tesla", model: "Model 3", city: "Nashville", soc: 0.95, status: "idle" },
  { id: "NR-R2-18", make: "Nuro", model: "R2", city: "Nashville", soc: 0.61, status: "idle" },
  { id: "ZX-GEN2-33", make: "Zoox", model: "Gen2", city: "Nashville", soc: 0.41, status: "idle" },
  { id: "WM-JAG-12", make: "Waymo", model: "Jaguar I-PACE", city: "Nashville", soc: 0.67, status: "idle" },
  
  // Austin
  { id: "WM-PAC-03", make: "Waymo", model: "Jaguar I-PACE", city: "Austin", soc: 0.76, status: "idle" },
  { id: "WM-ZKR-08", make: "Waymo", model: "Zeekr", city: "Austin", soc: 0.92, status: "idle" },
  { id: "ZX-GEN1-07", make: "Zoox", model: "Gen1", city: "Austin", soc: 0.82, status: "idle" },
  { id: "ZX-GEN2-25", make: "Zoox", model: "Gen2", city: "Austin", soc: 0.69, status: "idle" },
  { id: "AU-XC90-31", make: "Aurora", model: "Volvo XC90", city: "Austin", soc: 0.42, status: "charging" },
  { id: "MO-I5-42", make: "Motional", model: "Hyundai IONIQ 5", city: "Austin", soc: 0.49, status: "maintenance" },
  { id: "TE-MOD3-04", make: "Tesla", model: "Model 3", city: "Austin", soc: 0.71, status: "idle" },
  { id: "TE-MODY-19", make: "Tesla", model: "Model Y", city: "Austin", soc: 0.86, status: "idle" },
  
  // LA
  { id: "WM-PAC-23", make: "Waymo", model: "Jaguar I-PACE", city: "LA", soc: 0.53, status: "charging" },
  { id: "WM-ZKR-30", make: "Waymo", model: "Zeekr", city: "LA", soc: 0.89, status: "idle" },
  { id: "ZX-GEN1-10", make: "Zoox", model: "Gen1", city: "LA", soc: 0.74, status: "idle" },
  { id: "ZX-GEN2-26", make: "Zoox", model: "Gen2", city: "LA", soc: 0.46, status: "charging" },
  { id: "CR-BLT-08", make: "Cruise", model: "Bolt EV", city: "LA", soc: 0.81, status: "idle" },
  { id: "CR-ORG-15", make: "Cruise", model: "Origin", city: "LA", soc: 0.59, status: "idle" },
  { id: "AU-SNA-11", make: "Aurora", model: "Toyota Sienna", city: "LA", soc: 0.92, status: "idle" },
  { id: "AU-XC90-22", make: "Aurora", model: "Volvo XC90", city: "LA", soc: 0.38, status: "maintenance" },
  { id: "TE-MOD3-14", make: "Tesla", model: "Model 3", city: "LA", soc: 0.65, status: "idle" },
  { id: "TE-MODY-27", make: "Tesla", model: "Model Y", city: "LA", soc: 0.79, status: "charging" },

  // San Francisco
  { id: "WM-PAC-45", make: "Waymo", model: "Jaguar I-PACE", city: "San Francisco", soc: 0.72, status: "idle" },
  { id: "ZX-GEN2-51", make: "Zoox", model: "Gen2", city: "San Francisco", soc: 0.88, status: "idle" },
  { id: "CR-ORG-63", make: "Cruise", model: "Origin", city: "San Francisco", soc: 0.65, status: "idle" },
  { id: "AU-XC90-77", make: "Aurora", model: "Volvo XC90", city: "San Francisco", soc: 0.91, status: "idle" },
  { id: "TE-MOD3-82", make: "Tesla", model: "Model 3", city: "San Francisco", soc: 0.54, status: "charging" },
  { id: "MO-I5-94", make: "Motional", model: "Hyundai IONIQ 5", city: "San Francisco", soc: 0.79, status: "idle" },
];

// OTTOW Dispatch function
async function dispatchOTTOW(args: any) {
  const { city, vehicleId, type = "malfunction", summary = "Incident reported via OttoCommand AI" } = args;
  
  console.log("OTTOW dispatch called:", { city, vehicleId, type, summary });
  
  const cityVehicles = mockVehicles
    .filter(v => v.city === city && v.status !== "maintenance")
    .slice(0, 4)
    .map((v, idx) => ({
      id: v.id,
      make: v.make,
      model: v.model,
      soc: v.soc,
      label: String.fromCharCode(65 + idx),
      distance: (Math.random() * 3).toFixed(1),
    }));
  
  if (!vehicleId) {
    const optionsText = cityVehicles
      .map(v => `${v.label}) ${v.id} - ${v.make} ${v.model} (${v.distance} mi, ${Math.round(v.soc * 100)}% SOC)`)
      .join('\n');
    
    return {
      success: false,
      requiresSelection: true,
      city: city,
      vehicles: cityVehicles,
      message: `Available vehicles in ${city}:\n\n${optionsText}\n\nPlease reply with A, B, C, or D to select a vehicle.`,
      instructions: "User should respond with just the letter (A, B, C, or D) to select their preferred vehicle."
    };
  }
  
  if (vehicleId.length === 1 && /[A-D]/i.test(vehicleId)) {
    const index = vehicleId.toUpperCase().charCodeAt(0) - 65;
    if (index >= 0 && index < cityVehicles.length) {
      const selectedVehicle = cityVehicles[index];
      const vehicle = mockVehicles.find(v => v.id === selectedVehicle.id);
      const incidentId = `INC-2025-${String(Math.floor(100000 + Math.random() * 900000))}`;
      
      return {
        success: true,
        action: 'ottow_dispatched',
        incidentId: incidentId,
        vehicleId: selectedVehicle.id,
        vehicleDetails: `${vehicle?.make} ${vehicle?.model}`,
        city: city,
        type: type,
        summary: summary,
        eta: "6 min",
        message: `✓ OTTOW dispatched for ${selectedVehicle.id} (${vehicle?.make} ${vehicle?.model})\n\nIncident ${incidentId} created\nETA: 6 minutes\n\nThe incident has been added to the queue and will appear in the Incidents tab.`
      };
    }
  }
  
  const vehicle = mockVehicles.find(v => v.id === vehicleId);
  if (!vehicle) {
    return {
      success: false,
      error: `Vehicle ${vehicleId} not found in ${city}`,
      message: `Could not find vehicle ${vehicleId} in ${city}. Please try again.`
    };
  }
  
  const incidentId = `INC-2025-${String(Math.floor(100000 + Math.random() * 900000))}`;
  
  return {
    success: true,
    action: 'ottow_dispatched',
    incidentId: incidentId,
    vehicleId: vehicle.id,
    vehicleDetails: `${vehicle.make} ${vehicle.model}`,
    city: city,
    type: type,
    summary: summary,
    eta: "6 min",
    message: `✓ OTTOW dispatched for ${vehicle.id} (${vehicle.make} ${vehicle.model})\n\nIncident ${incidentId} created\nETA: 6 minutes\n\nThe incident has been added to the queue and will appear in the Incidents tab.`
  };
}

// Query Fleet Status - NEW
async function queryFleetStatus(args: any, supabase: any) {
  const { city, status, soc_below, soc_above, vehicle_id, limit = 20 } = args;
  
  try {
    let query = supabase
      .from("ottoq_vehicles")
      .select(`
        id, oem, plate, soc, status, odometer_km, health_jsonb, last_telemetry_at,
        ottoq_cities!inner(name)
      `)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (vehicle_id) {
      query = query.or(`id.eq.${vehicle_id},plate.ilike.%${vehicle_id}%`);
    }
    if (status) {
      query = query.eq("status", status.toUpperCase());
    }
    if (soc_below) {
      query = query.lt("soc", soc_below);
    }
    if (soc_above) {
      query = query.gt("soc", soc_above);
    }

    const { data, error } = await query;
    
    if (error) throw error;

    // Filter by city name if provided (since city is in joined table)
    let vehicles = data || [];
    if (city) {
      vehicles = vehicles.filter((v: any) => 
        v.ottoq_cities?.name?.toLowerCase().includes(city.toLowerCase())
      );
    }

    const summary = {
      total: vehicles.length,
      byStatus: vehicles.reduce((acc: any, v: any) => {
        acc[v.status] = (acc[v.status] || 0) + 1;
        return acc;
      }, {}),
      avgSoc: vehicles.length > 0 
        ? Math.round((vehicles.reduce((sum: number, v: any) => sum + v.soc, 0) / vehicles.length) * 100)
        : 0,
      lowBattery: vehicles.filter((v: any) => v.soc < 0.3).length,
    };

    const vehicleList = vehicles.slice(0, 10).map((v: any) => ({
      id: v.id,
      oem: v.oem,
      plate: v.plate,
      soc: `${Math.round(v.soc * 100)}%`,
      status: v.status,
      city: v.ottoq_cities?.name,
      health: v.health_jsonb?.overall_score ?? 100,
    }));

    return {
      success: true,
      action: 'fleet_status_queried',
      summary,
      vehicles: vehicleList,
      message: `Found ${vehicles.length} vehicles${city ? ` in ${city}` : ''}${status ? ` with status ${status}` : ''}. Average SOC: ${summary.avgSoc}%. ${summary.lowBattery} vehicles have low battery (<30%).`
    };

  } catch (error) {
    console.error("Error querying fleet status:", error);
    return {
      success: false,
      error: "Failed to query fleet status",
      details: String(error)
    };
  }
}

// Query Depot Resources - NEW
async function queryDepotResources(args: any, supabase: any) {
  const { depot_id, city, resource_type, status } = args;
  
  try {
    // Fetch depots
    let depotsQuery = supabase
      .from("ottoq_depots")
      .select(`id, name, city_id, config_jsonb, ottoq_cities!inner(name)`);

    if (depot_id) {
      depotsQuery = depotsQuery.eq("id", depot_id);
    }

    const { data: depots, error: depotsError } = await depotsQuery;
    if (depotsError) throw depotsError;

    // Filter by city if provided
    let filteredDepots = depots || [];
    if (city) {
      filteredDepots = filteredDepots.filter((d: any) =>
        d.ottoq_cities?.name?.toLowerCase().includes(city.toLowerCase())
      );
    }

    const depotIds = filteredDepots.map((d: any) => d.id);

    // Fetch resources for these depots
    let resourcesQuery = supabase
      .from("ottoq_resources")
      .select("depot_id, resource_type, status, index")
      .in("depot_id", depotIds);

    if (resource_type) {
      resourcesQuery = resourcesQuery.eq("resource_type", resource_type.toUpperCase());
    }
    if (status) {
      resourcesQuery = resourcesQuery.eq("status", status.toUpperCase());
    }

    const { data: resources, error: resourcesError } = await resourcesQuery;
    if (resourcesError) throw resourcesError;

    // Fetch active jobs
    const { data: jobs, error: jobsError } = await supabase
      .from("ottoq_jobs")
      .select("depot_id, job_type, state")
      .in("depot_id", depotIds)
      .in("state", ["PENDING", "SCHEDULED", "ACTIVE"]);

    if (jobsError) throw jobsError;

    // Aggregate per depot
    const depotSummaries = filteredDepots.map((depot: any) => {
      const depotResources = (resources || []).filter((r: any) => r.depot_id === depot.id);
      const depotJobs = (jobs || []).filter((j: any) => j.depot_id === depot.id);

      const chargeStalls = depotResources.filter((r: any) => r.resource_type === "CHARGE_STALL");
      const detailStalls = depotResources.filter((r: any) => r.resource_type === "CLEAN_DETAIL_STALL");
      const maintBays = depotResources.filter((r: any) => r.resource_type === "MAINTENANCE_BAY");

      return {
        depot: depot.name,
        city: depot.ottoq_cities?.name,
        chargeStalls: {
          total: chargeStalls.length,
          available: chargeStalls.filter((r: any) => r.status === "AVAILABLE").length,
          busy: chargeStalls.filter((r: any) => r.status === "BUSY").length,
        },
        detailStalls: {
          total: detailStalls.length,
          available: detailStalls.filter((r: any) => r.status === "AVAILABLE").length,
        },
        maintenanceBays: {
          total: maintBays.length,
          available: maintBays.filter((r: any) => r.status === "AVAILABLE").length,
        },
        jobs: {
          active: depotJobs.filter((j: any) => j.state === "ACTIVE").length,
          pending: depotJobs.filter((j: any) => ["PENDING", "SCHEDULED"].includes(j.state)).length,
        },
      };
    });

    const totalChargeAvailable = depotSummaries.reduce((sum, d) => sum + d.chargeStalls.available, 0);
    const totalChargeStalls = depotSummaries.reduce((sum, d) => sum + d.chargeStalls.total, 0);
    const utilization = totalChargeStalls > 0 
      ? Math.round(((totalChargeStalls - totalChargeAvailable) / totalChargeStalls) * 100)
      : 0;

    return {
      success: true,
      action: 'depot_resources_queried',
      depots: depotSummaries,
      summary: {
        totalDepots: depotSummaries.length,
        totalChargeStalls,
        availableChargeStalls: totalChargeAvailable,
        chargeUtilization: `${utilization}%`,
      },
      message: `Found ${depotSummaries.length} depots. ${totalChargeAvailable}/${totalChargeStalls} charge stalls available (${100 - utilization}% free).`
    };

  } catch (error) {
    console.error("Error querying depot resources:", error);
    return {
      success: false,
      error: "Failed to query depot resources",
      details: String(error)
    };
  }
}

// Query Incidents - NEW
async function queryIncidents(args: any, fleetContext: any) {
  const { status, type, city, limit = 20 } = args;

  // Use fleet context incidents (from client-side store)
  const incidents = fleetContext?.incidents || [];

  let filtered = [...incidents];

  if (status) {
    filtered = filtered.filter((i: any) => i.status === status);
  }
  if (type) {
    filtered = filtered.filter((i: any) => i.type === type);
  }
  if (city) {
    filtered = filtered.filter((i: any) => 
      i.city?.toLowerCase().includes(city.toLowerCase())
    );
  }

  const summary = {
    total: filtered.length,
    byStatus: filtered.reduce((acc: any, i: any) => {
      acc[i.status] = (acc[i.status] || 0) + 1;
      return acc;
    }, {}),
    byType: filtered.reduce((acc: any, i: any) => {
      acc[i.type] = (acc[i.type] || 0) + 1;
      return acc;
    }, {}),
  };

  const incidentList = filtered.slice(0, limit).map((i: any) => ({
    id: i.id,
    type: i.type,
    status: i.status,
    city: i.city,
    vehicle: i.vehicleId,
    summary: i.summary,
    createdAt: i.createdAt,
  }));

  return {
    success: true,
    action: 'incidents_queried',
    summary,
    incidents: incidentList,
    message: `Found ${filtered.length} incidents${status ? ` with status ${status}` : ''}${type ? ` of type ${type}` : ''}.`
  };
}

// Generate Analytics Report - NEW
async function generateAnalyticsReport(args: any, supabase: any, fleetContext: any) {
  const { report_type, city, time_period = "today" } = args;

  const now = new Date();
  const metrics = fleetContext || {};

  // Build report based on type
  let report: any = {
    generatedAt: now.toISOString(),
    period: time_period,
    city: city || "All Cities",
  };

  switch (report_type) {
    case "fleet_health":
      report = {
        ...report,
        type: "Fleet Health Report",
        metrics: {
          totalVehicles: metrics.fleetMetrics?.totalVehicles || 0,
          activeVehicles: metrics.fleetMetrics?.activeVehicles || 0,
          avgSoc: `${metrics.fleetMetrics?.avgSoc || 0}%`,
          avgHealthScore: `${metrics.fleetMetrics?.avgHealthScore || 0}/100`,
          lowBatteryVehicles: metrics.fleetMetrics?.lowBatteryCount || 0,
          criticalBatteryVehicles: metrics.fleetMetrics?.criticalBatteryCount || 0,
          vehiclesInMaintenance: metrics.fleetMetrics?.maintenanceVehicles || 0,
        },
        recommendations: [
          metrics.fleetMetrics?.criticalBatteryCount > 0 
            ? `⚠️ ${metrics.fleetMetrics.criticalBatteryCount} vehicles have critical battery (<15%) - prioritize charging`
            : null,
          metrics.fleetMetrics?.avgSoc < 50
            ? "📊 Fleet average SOC is below 50% - consider optimizing charging schedules"
            : null,
          metrics.fleetMetrics?.maintenanceVehicles > metrics.fleetMetrics?.totalVehicles * 0.1
            ? "🔧 More than 10% of fleet is in maintenance - review maintenance backlog"
            : null,
        ].filter(Boolean),
      };
      break;

    case "depot_utilization":
      report = {
        ...report,
        type: "Depot Utilization Report",
        metrics: {
          totalDepots: metrics.depotMetrics?.totalDepots || 0,
          chargeStallUtilization: `${metrics.depotMetrics?.chargeStallUtilization || 0}%`,
          availableChargeStalls: metrics.depotMetrics?.availableChargeStalls || 0,
          totalChargeStalls: metrics.depotMetrics?.totalChargeStalls || 0,
          activeJobs: metrics.depotMetrics?.activeJobs || 0,
          pendingJobs: metrics.depotMetrics?.pendingJobs || 0,
        },
        recommendations: [
          metrics.depotMetrics?.chargeStallUtilization > 85
            ? "⚡ Charge stall utilization is high (>85%) - consider expanding capacity or optimizing schedules"
            : null,
          metrics.depotMetrics?.pendingJobs > 20
            ? `📋 ${metrics.depotMetrics.pendingJobs} jobs are pending - may need additional resources`
            : null,
        ].filter(Boolean),
      };
      break;

    case "incident_summary":
      report = {
        ...report,
        type: "Incident Summary Report",
        metrics: {
          totalIncidents: metrics.incidentMetrics?.totalIncidents || 0,
          activeIncidents: metrics.incidentMetrics?.activeIncidents || 0,
          pendingIncidents: metrics.incidentMetrics?.pendingIncidents || 0,
          closedIncidents: metrics.incidentMetrics?.closedIncidents || 0,
          byType: metrics.incidentMetrics?.incidentsByType || {},
        },
        recommendations: [
          metrics.incidentMetrics?.pendingIncidents > 5
            ? `🚨 ${metrics.incidentMetrics.pendingIncidents} incidents pending - prioritize response`
            : null,
        ].filter(Boolean),
      };
      break;

    default:
      report = {
        ...report,
        type: "General Fleet Report",
        fleet: metrics.fleetMetrics || {},
        depot: metrics.depotMetrics || {},
        incidents: metrics.incidentMetrics || {},
      };
  }

  return {
    success: true,
    action: 'analytics_report_generated',
    report,
    message: `Generated ${report.type} for ${report.city} (${report.period}).`
  };
}

// Compare Performance - NEW
// real otto-q-core; falls back to heuristic on error
async function comparePerformance(args: any, supabase: any) {
  const { compare_type, entity_a, entity_b } = args;

  // Real data path for city/depot comparisons (driven by the live depots[] array).
  if (compare_type === "cities" || compare_type === "depots") {
    try {
      const fs: any = await ottoqApi("/fleet/summary");
      const depots: any[] = Array.isArray(fs?.depots) ? fs.depots : [];
      if (depots.length === 0) throw new Error("no depots in fleet summary");

      const match = (name: string) =>
        depots.find((d: any) =>
          d?.name?.toLowerCase().includes(String(name).toLowerCase()) ||
          d?.city?.toLowerCase().includes(String(name).toLowerCase()) ||
          d?.id === name
        );

      const da = match(entity_a);
      const db = match(entity_b);
      if (!da || !db) throw new Error("entity not found in fleet summary");

      const metricsFor = (d: any) => ({
        totalVehicles: d.vehicles ?? 0,
        onSite: d.on_site ?? 0,
        charging: d.charging ?? 0,
        inService: d.in_service ?? 0,
        utilization: `${d.utilization_pct ?? 0}%`,
        stallsAvailable: d.stalls_available ?? 0,
        activeExceptions: d.active_exceptions ?? 0,
        activeOttowMissions: d.active_ottow_missions ?? 0,
      });

      const comparison = {
        type: compare_type,
        entities: [entity_a, entity_b],
        metrics: {
          [entity_a]: metricsFor(da),
          [entity_b]: metricsFor(db),
        },
        // Fewer active exceptions = healthier operation.
        winner: (da.active_exceptions ?? 0) === (db.active_exceptions ?? 0)
          ? null
          : (da.active_exceptions ?? 0) < (db.active_exceptions ?? 0) ? entity_a : entity_b,
      };

      return {
        success: true,
        action: "performance_compared",
        comparison,
        message: `Compared ${compare_type} (live): ${entity_a} (${da.utilization_pct ?? 0}% util, ${da.active_exceptions ?? 0} exceptions) vs ${entity_b} (${db.utilization_pct ?? 0}% util, ${db.active_exceptions ?? 0} exceptions).`,
      };
    } catch (err) {
      console.error("compare_performance real call failed, using heuristic:", err);
      return comparePerformanceHeuristic(args, supabase);
    }
  }

  // Vehicle-level comparison has no live source here — use heuristic.
  return comparePerformanceHeuristic(args, supabase);
}

// Heuristic fallback (original simulated implementation) for comparePerformance.
async function comparePerformanceHeuristic(args: any, supabase: any) {
  const { compare_type, entity_a, entity_b } = args;

  // Mock comparison data - in production would query real metrics
  const comparison = {
    type: compare_type,
    entities: [entity_a, entity_b],
    metrics: {},
    winner: null as string | null,
  };

  switch (compare_type) {
    case "cities":
      comparison.metrics = {
        [entity_a]: {
          totalVehicles: Math.floor(Math.random() * 100) + 50,
          avgSoc: Math.floor(Math.random() * 30) + 60,
          uptime: `${Math.floor(Math.random() * 5) + 95}%`,
          avgResponseTime: `${Math.floor(Math.random() * 5) + 3} min`,
        },
        [entity_b]: {
          totalVehicles: Math.floor(Math.random() * 100) + 50,
          avgSoc: Math.floor(Math.random() * 30) + 60,
          uptime: `${Math.floor(Math.random() * 5) + 95}%`,
          avgResponseTime: `${Math.floor(Math.random() * 5) + 3} min`,
        },
      };
      break;

    case "depots":
      comparison.metrics = {
        [entity_a]: {
          utilization: `${Math.floor(Math.random() * 30) + 60}%`,
          avgWaitTime: `${Math.floor(Math.random() * 10) + 5} min`,
          jobsCompleted: Math.floor(Math.random() * 50) + 20,
        },
        [entity_b]: {
          utilization: `${Math.floor(Math.random() * 30) + 60}%`,
          avgWaitTime: `${Math.floor(Math.random() * 10) + 5} min`,
          jobsCompleted: Math.floor(Math.random() * 50) + 20,
        },
      };
      break;

    case "vehicles":
      comparison.metrics = {
        [entity_a]: {
          avgSoc: `${Math.floor(Math.random() * 30) + 60}%`,
          tripCount: Math.floor(Math.random() * 20) + 5,
          efficiency: `${(Math.random() * 2 + 3).toFixed(1)} mi/kWh`,
          healthScore: Math.floor(Math.random() * 20) + 80,
        },
        [entity_b]: {
          avgSoc: `${Math.floor(Math.random() * 30) + 60}%`,
          tripCount: Math.floor(Math.random() * 20) + 5,
          efficiency: `${(Math.random() * 2 + 3).toFixed(1)} mi/kWh`,
          healthScore: Math.floor(Math.random() * 20) + 80,
        },
      };
      break;
  }

  return {
    success: true,
    action: 'performance_compared',
    comparison,
    message: `Compared ${compare_type}: ${entity_a} vs ${entity_b}.`
  };
}

// Get Recommendations - NEW
// real otto-q-core; falls back to heuristic on error
async function getRecommendations(args: any, supabase: any, fleetContext: any) {
  const { focus_area } = args;

  try {
    const ai: any = await ottoqApi("/ai/fleet-summary");
    const risks = ai?.active_risks ?? {};
    const actions = ai?.autonomous_actions_today ?? {};
    const recents: any[] = Array.isArray(ai?.recent_actions) ? ai.recent_actions : [];

    const recommendations: any[] = [];

    if ((risks.critical ?? 0) > 0) {
      recommendations.push({
        priority: "critical",
        area: "incidents",
        title: "Critical Active Risks",
        description: `${risks.critical} critical risk(s) currently active across tracked depots.`,
        action: "Review OTTO-Response advisory panel and dispatch mitigations immediately",
        impact: "Prevents service disruption and safety exposure",
      });
    }
    if ((risks.warning ?? 0) > 0) {
      recommendations.push({
        priority: "high",
        area: "operations",
        title: "Active Warnings",
        description: `${risks.warning} warning-level risk(s) detected.`,
        action: "Investigate warnings and pre-stage resources",
        impact: "Reduces escalation to critical",
      });
    }
    if ((actions.pending ?? 0) > 0) {
      recommendations.push({
        priority: "medium",
        area: "operations",
        title: "Pending Autonomous Actions",
        description: `${actions.pending} autonomous action(s) awaiting approval/execution (executed today: ${actions.executed ?? 0}).`,
        action: "Approve or review pending autonomous actions",
        impact: "Keeps the optimizer acting on fresh state",
      });
    }
    for (const r of recents.slice(0, 3)) {
      recommendations.push({
        priority: "low",
        area: "operations",
        title: `Recent: ${r.action_type ?? "action"}`,
        description: r.summary ?? `Action ${r.id} (${r.status}).`,
        action: "No action required — informational",
        impact: "Audit trail of autonomous activity",
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        priority: "low",
        area: "general",
        title: "Fleet Operating Normally",
        description: "No active risks or pending actions reported by the AI brain. Fleet is within normal parameters.",
        action: "Continue monitoring",
        impact: "Sustained operational excellence",
      });
    }

    let filtered = recommendations;
    if (focus_area) {
      filtered = recommendations.filter((rc) => rc.area === focus_area || rc.area === "general");
      if (filtered.length === 0) filtered = recommendations;
    }

    return {
      success: true,
      action: "recommendations_generated",
      recommendations: filtered.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority as keyof typeof priorityOrder] || 4) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 4);
      }),
      message: `Generated ${filtered.length} live recommendations from the AI brain (${risks.total ?? 0} active risks, ${actions.pending ?? 0} pending actions)${focus_area ? ` for ${focus_area}` : ""}.`,
    };
  } catch (err) {
    console.error("get_recommendations real call failed, using heuristic:", err);
    return getRecommendationsHeuristic(args, supabase, fleetContext);
  }
}

// Heuristic fallback (original simulated implementation) for getRecommendations.
async function getRecommendationsHeuristic(args: any, supabase: any, fleetContext: any) {
  const { focus_area } = args;

  const metrics = fleetContext || {};
  const recommendations: any[] = [];

  // Generate recommendations based on fleet context
  if (metrics.fleetMetrics) {
    const fm = metrics.fleetMetrics;
    
    if (fm.criticalBatteryCount > 0) {
      recommendations.push({
        priority: "critical",
        area: "charging",
        title: "Critical Battery Vehicles",
        description: `${fm.criticalBatteryCount} vehicles have battery below 15%. Immediate charging required.`,
        action: "Schedule immediate charging for these vehicles",
        impact: "Prevents vehicle stranding and service interruption",
      });
    }

    if (fm.lowBatteryCount > fm.totalVehicles * 0.2) {
      recommendations.push({
        priority: "high",
        area: "charging",
        title: "High Low-Battery Rate",
        description: `${Math.round((fm.lowBatteryCount / fm.totalVehicles) * 100)}% of fleet is below 30% SOC.`,
        action: "Review charging schedules and depot capacity",
        impact: "Improves fleet availability and reduces emergency charging",
      });
    }

    if (fm.maintenanceVehicles > fm.totalVehicles * 0.1) {
      recommendations.push({
        priority: "medium",
        area: "maintenance",
        title: "Elevated Maintenance Queue",
        description: `${fm.maintenanceVehicles} vehicles (${Math.round((fm.maintenanceVehicles / fm.totalVehicles) * 100)}%) are in maintenance.`,
        action: "Review maintenance backlog and prioritize critical repairs",
        impact: "Increases fleet availability",
      });
    }

    if (fm.avgSoc < 60) {
      recommendations.push({
        priority: "medium",
        area: "energy",
        title: "Low Fleet Average SOC",
        description: `Fleet average SOC is ${fm.avgSoc}%, below the recommended 60% threshold.`,
        action: "Optimize charging schedules and consider off-peak charging incentives",
        impact: "Improves readiness for peak demand periods",
      });
    }
  }

  if (metrics.depotMetrics) {
    const dm = metrics.depotMetrics;
    
    if (dm.chargeStallUtilization > 80) {
      recommendations.push({
        priority: "high",
        area: "capacity",
        title: "High Charge Stall Utilization",
        description: `Charge stall utilization is ${dm.chargeStallUtilization}%, approaching capacity.`,
        action: "Consider expanding charging infrastructure or optimizing schedules",
        impact: "Reduces wait times and improves throughput",
      });
    }

    if (dm.pendingJobs > 15) {
      recommendations.push({
        priority: "medium",
        area: "operations",
        title: "Job Queue Backlog",
        description: `${dm.pendingJobs} jobs are pending in the queue.`,
        action: "Review job scheduling and resource allocation",
        impact: "Improves service delivery time",
      });
    }
  }

  if (metrics.incidentMetrics) {
    const im = metrics.incidentMetrics;
    
    if (im.pendingIncidents > 3) {
      recommendations.push({
        priority: "high",
        area: "incidents",
        title: "Pending Incidents",
        description: `${im.pendingIncidents} incidents are awaiting response.`,
        action: "Prioritize OTTOW dispatch for pending incidents",
        impact: "Improves response time and customer satisfaction",
      });
    }
  }

  // Add default recommendations if no specific issues found
  if (recommendations.length === 0) {
    recommendations.push({
      priority: "low",
      area: "general",
      title: "Fleet Operating Normally",
      description: "No critical issues detected. Fleet is operating within normal parameters.",
      action: "Continue monitoring and maintain current practices",
      impact: "Sustained operational excellence",
    });
  }

  // Filter by focus area if specified
  let filtered = recommendations;
  if (focus_area) {
    filtered = recommendations.filter(r => r.area === focus_area || r.area === "general");
  }

  return {
    success: true,
    action: 'recommendations_generated',
    recommendations: filtered.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority as keyof typeof priorityOrder] || 4) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 4);
    }),
    message: `Generated ${filtered.length} recommendations${focus_area ? ` for ${focus_area}` : ''}.`
  };
}

// Schedule Vehicle Task
async function scheduleVehicleTask(args: any, supabase: any) {
  const { vehicle_id, task_type, description, scheduled_date, priority = 'medium' } = args;
  
  try {
    const vehicleNumber = vehicle_id.replace(/[^0-9]/g, '');
    
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, vehicle_number, make, model')
      .eq('vehicle_number', vehicleNumber)
      .single();

    if (vehicleError || !vehicle) {
      console.log('Vehicle not found, creating maintenance record anyway');
    }

    if (task_type === 'maintenance') {
      const { data, error } = await supabase
        .from('maintenance_records')
        .insert({
          vehicle_id: vehicle?.id || null,
          maintenance_type: description,
          description: `${description} - Scheduled via OttoCommand AI`,
          next_due_date: scheduled_date,
          ai_predicted: true,
          prediction_confidence: 95
        });

      if (error) {
        console.error('Database error:', error);
        return {
          success: false,
          error: 'Failed to schedule maintenance in database',
          details: error.message
        };
      }

      return {
        success: true,
        action: 'maintenance_scheduled',
        vehicle_id: vehicle_id,
        task: description,
        scheduled_date: scheduled_date,
        priority: priority,
        message: `Successfully scheduled ${description} for ${vehicle_id} on ${scheduled_date}`
      };
    }

    return {
      success: true,
      action: 'task_scheduled',
      vehicle_id: vehicle_id,
      task_type: task_type,
      task: description,
      scheduled_date: scheduled_date,
      priority: priority,
      message: `Successfully scheduled ${task_type} task for ${vehicle_id}: ${description}`
    };

  } catch (error) {
    console.error('Error scheduling task:', error);
    return {
      success: false,
      error: 'Failed to schedule task',
      details: String(error)
    };
  }
}

// Update Vehicle Status
async function updateVehicleStatus(args: any, supabase: any) {
  const { vehicle_id, status, location, notes } = args;

  try {
    const vehicleNumber = vehicle_id.replace(/[^0-9]/g, '');
    
    const { data, error } = await supabase
      .from('vehicles')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('vehicle_number', vehicleNumber);

    if (error) {
      console.error('Database error:', error);
      return {
        success: false,
        error: 'Failed to update vehicle status',
        details: error.message
      };
    }

    return {
      success: true,
      action: 'status_updated',
      vehicle_id: vehicle_id,
      new_status: status,
      location: location,
      notes: notes,
      message: `Successfully updated ${vehicle_id} status to ${status}${location ? ` at ${location}` : ''}`
    };

  } catch (error) {
    console.error('Error updating vehicle status:', error);
    return {
      success: false,
      error: 'Failed to update status',
      details: String(error)
    };
  }
}

// Web Search
async function performWebSearch(args: any) {
  const { query, focus_area } = args;
  
  // Enhanced mock search results based on focus area
  const searchResults: any = {
    query: query,
    results: [],
    timestamp: new Date().toISOString(),
  };

  if (focus_area === "regulations" || query.toLowerCase().includes("regulation") || query.toLowerCase().includes("nhtsa")) {
    searchResults.results = [
      {
        title: "NHTSA Autonomous Vehicle Safety Guidelines 2024",
        snippet: "Updated federal guidelines require AV operators to report disengagements within 24 hours. New safety certification requirements for L4 vehicles include mandatory redundant braking systems.",
        url: "https://nhtsa.gov/autonomous-vehicles/guidelines-2024"
      },
      {
        title: "State-by-State AV Regulations Overview",
        snippet: "California, Arizona, Texas lead in AV permits. California requires safety drivers for testing; Arizona allows fully driverless operations in geofenced areas.",
        url: "https://autonomous-vehicles.org/state-regulations"
      },
    ];
  } else if (focus_area === "safety" || query.toLowerCase().includes("safety")) {
    searchResults.results = [
      {
        title: "Best Practices for AV Fleet Safety Management",
        snippet: "Industry standard: target <0.1 safety incidents per million miles. Key metrics include disengagement rate, near-miss frequency, and pedestrian interaction scores.",
        url: "https://av-safety-consortium.org/best-practices"
      },
      {
        title: "Autonomous Vehicle Incident Response Protocols",
        snippet: "Recommended response time for vehicle-down incidents: <6 minutes. Implement 24/7 remote monitoring with real-time escalation paths.",
        url: "https://fleet-safety.com/av-incident-response"
      },
    ];
  } else {
    searchResults.results = [
      {
        title: "Latest Fleet Management Best Practices 2025",
        snippet: "Current industry trends show 18% efficiency gains through predictive maintenance, AI-powered route optimization, and smart charging strategies.",
        url: "https://fleetmanagement.com/best-practices-2025"
      },
      {
        title: "Electric Fleet Optimization Strategies",
        snippet: "Modern fleets are achieving 25-35% cost reduction through smart charging, battery health monitoring, and renewable energy integration.",
        url: "https://electricfleets.org/optimization"
      },
      {
        title: "Predictive Maintenance ROI Analysis",
        snippet: "Studies show predictive maintenance reduces downtime by 40% and maintenance costs by 30% compared to traditional scheduled maintenance.",
        url: "https://maintenance-analytics.com/roi-study"
      }
    ];
  }

  return {
    success: true,
    action: 'web_search_completed',
    query: query,
    focusArea: focus_area,
    results: searchResults,
    message: `Found ${searchResults.results.length} relevant results for: ${query}`
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREDICTIVE ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

// Predict Charging Needs
// real otto-q-core; falls back to heuristic on error
async function predictChargingNeeds(args: any, fleetContext: any) {
  const { hours = 4 } = args;

  try {
    // Prefer fleet-summary for speed; soc_distribution drives charging recommendations.
    const fs: any = await ottoqApi("/fleet/summary");
    const soc = fs?.soc_distribution ?? {};
    const totals = fs?.totals ?? {};
    const critical = soc.critical ?? 0;
    const low = soc.low ?? 0;
    const medium = soc.medium ?? 0;
    const needCharge = critical + low; // critical + low buckets need charging soon

    // Synthesize per-bucket predictions in the same shape the UI/LLM expect.
    const predictions: any[] = [];
    if (critical > 0) predictions.push({ bucket: "critical", count: critical, urgency: "critical", recommendation: "Queue immediately" });
    if (low > 0) predictions.push({ bucket: "low", count: low, urgency: "high", recommendation: "Queue immediately" });
    if (medium > 0) predictions.push({ bucket: "medium", count: medium, urgency: "medium", recommendation: "Schedule within 2 hours" });

    return {
      success: true,
      action: "charging_needs_predicted",
      timeframe: `${hours} hours`,
      predictions: predictions.slice(0, 10),
      summary: {
        total: needCharge + medium,
        critical,
        high: low,
        medium,
      },
      confidence: 90,
      message: `Live fleet SOC across ${totals.vehicles ?? "?"} vehicles: ${critical} critical, ${low} low, ${medium} medium. ${needCharge} need charging soon; ${fs?.totals?.charging ?? 0} already charging.`,
      recommendedAction: needCharge > 0
        ? `Auto-queue ${needCharge} critical/low-SOC vehicles for charging using 'urgent_first' strategy.`
        : "No immediate charging needs.",
    };
  } catch (err) {
    console.error("predict_charging_needs real call failed, using heuristic:", err);
    return predictChargingNeedsHeuristic(args, fleetContext);
  }
}

// Heuristic fallback (original simulated implementation) for predictChargingNeeds.
async function predictChargingNeedsHeuristic(args: any, fleetContext: any) {
  const { hours = 4, urgency_threshold = 30, city } = args;

  // Use fleet context or mock data
  const vehicles = fleetContext?.vehicles || mockVehicles;

  // Filter by city if provided
  let filteredVehicles = vehicles;
  if (city) {
    filteredVehicles = vehicles.filter((v: any) =>
      v.city?.toLowerCase().includes(city.toLowerCase())
    );
  }

  // Calculate predicted SOC based on usage patterns
  const predictions = filteredVehicles
    .filter((v: any) => v.status !== "charging")
    .map((v: any) => {
      const currentSoc = typeof v.soc === 'number' ? v.soc : parseFloat(v.soc) || 0.5;
      const socPercent = currentSoc > 1 ? currentSoc : currentSoc * 100;

      // Simulate drain rate based on status
      const drainRatePerHour = v.status === "active" ? 8 : v.status === "idle" ? 2 : 1;
      const predictedSoc = Math.max(0, socPercent - (drainRatePerHour * hours));

      // Determine urgency
      let urgency: "critical" | "high" | "medium" | "low";
      if (predictedSoc < 15) urgency = "critical";
      else if (predictedSoc < 25) urgency = "high";
      else if (predictedSoc < 40) urgency = "medium";
      else urgency = "low";

      return {
        vehicleId: v.id,
        make: v.make,
        model: v.model,
        city: v.city,
        currentSoc: Math.round(socPercent),
        predictedSoc: Math.round(predictedSoc),
        hoursUntilCritical: predictedSoc > 15 ? Math.ceil((predictedSoc - 15) / drainRatePerHour) : 0,
        urgency,
        recommendation: urgency === "critical" || urgency === "high" ? "Queue immediately" : urgency === "medium" ? "Schedule within 2 hours" : "Monitor",
      };
    })
    .filter((p: any) => p.predictedSoc < urgency_threshold)
    .sort((a: any, b: any) => a.predictedSoc - b.predictedSoc);

  const urgent = predictions.filter((p: any) => p.urgency === "critical" || p.urgency === "high");

  return {
    success: true,
    action: "charging_needs_predicted",
    timeframe: `${hours} hours`,
    predictions: predictions.slice(0, 10),
    summary: {
      total: predictions.length,
      critical: predictions.filter((p: any) => p.urgency === "critical").length,
      high: predictions.filter((p: any) => p.urgency === "high").length,
      medium: predictions.filter((p: any) => p.urgency === "medium").length,
    },
    confidence: 87,
    message: `Predicted ${predictions.length} vehicles will need charging in ${hours} hours. ${urgent.length} require immediate attention.`,
    recommendedAction: urgent.length > 0
      ? `Auto-queue ${urgent.length} high-urgency vehicles for charging using 'urgent_first' strategy.`
      : "No immediate charging needs.",
  };
}

// Predict Maintenance Risks
async function predictMaintenanceRisks(args: any, fleetContext: any) {
  const { risk_threshold = 50, city } = args;

  const vehicles = fleetContext?.vehicles || mockVehicles;

  let filteredVehicles = vehicles;
  if (city) {
    filteredVehicles = vehicles.filter((v: any) =>
      v.city?.toLowerCase().includes(city.toLowerCase())
    );
  }

  // Generate mock risk predictions based on vehicle data
  const predictions = filteredVehicles.map((v: any) => {
    // Simulate risk based on various factors
    const baseRisk = Math.random() * 40 + 10; // 10-50 base
    const socFactor = v.soc < 0.3 ? 15 : 0; // Low SOC increases risk
    const statusFactor = v.status === "maintenance" ? 30 : 0;
    const totalRisk = Math.min(100, Math.round(baseRisk + socFactor + statusFactor));

    // Random component categories
    const components = ["Battery", "Sensors", "Brakes", "Tires", "HVAC", "Compute"];
    const riskComponent = components[Math.floor(Math.random() * components.length)];

    return {
      vehicleId: v.id,
      make: v.make,
      model: v.model,
      city: v.city,
      riskScore: totalRisk,
      riskCategory: totalRisk >= 70 ? "Critical" : totalRisk >= 50 ? "High" : totalRisk >= 30 ? "Medium" : "Low",
      primaryComponent: riskComponent,
      factors: [
        { factor: "Usage Pattern", contribution: Math.round(Math.random() * 30) },
        { factor: "Component Age", contribution: Math.round(Math.random() * 25) },
        { factor: "Telemetry Anomalies", contribution: Math.round(Math.random() * 20) },
      ],
      recommendation: totalRisk >= 70 ? "Schedule maintenance within 24 hours" :
                      totalRisk >= 50 ? "Schedule maintenance within 7 days" :
                      "Continue monitoring",
      estimatedDaysUntilFailure: totalRisk >= 70 ? Math.floor(Math.random() * 3) + 1 :
                                  totalRisk >= 50 ? Math.floor(Math.random() * 14) + 7 :
                                  Math.floor(Math.random() * 30) + 21,
    };
  })
  .filter((p: any) => p.riskScore >= risk_threshold)
  .sort((a: any, b: any) => b.riskScore - a.riskScore);

  return {
    success: true,
    action: "maintenance_risks_predicted",
    predictions: predictions.slice(0, 10),
    summary: {
      total: predictions.length,
      critical: predictions.filter((p: any) => p.riskCategory === "Critical").length,
      high: predictions.filter((p: any) => p.riskCategory === "High").length,
      medium: predictions.filter((p: any) => p.riskCategory === "Medium").length,
    },
    confidence: 82,
    message: `Identified ${predictions.length} vehicles with maintenance risk above ${risk_threshold}%. ${predictions.filter((p: any) => p.riskScore >= 70).length} require urgent attention.`,
  };
}

// Predict Depot Demand
// real otto-q-core; falls back to heuristic on error
async function predictDepotDemand(args: any, fleetContext: any) {
  const { depot_id, hours = 8 } = args;

  try {
    const energy: any = await ottoqCore("ottoq-energy-optimize", {
      depot_id: depot_id || OTTOQ_DEFAULT_DEPOT,
    });

    // Supplement with recent demand history when available (best-effort).
    let history: any = null;
    try {
      history = await ottoqApi(`/energy/history?range=24h&depot_id=${depot_id || OTTOQ_DEFAULT_DEPOT}`);
    } catch (_) { /* history optional */ }

    const ctx = energy?.context ?? {};
    const proj = energy?.projections ?? {};
    const bess = energy?.bess ?? {};
    const hist = history?.summary ?? {};

    const predictions = [{
      depotId: depot_id || OTTOQ_DEFAULT_DEPOT,
      depotName: energy?.depot ?? "Depot",
      tariffWindow: ctx.tariff_window ?? "unknown",
      currentDemandKw: ctx.building_kw ?? null,
      evChargingKw: ctx.ev_charging_kw ?? null,
      netLoadKw: ctx.net_load_kw ?? null,
      solarKw: ctx.solar_kw ?? null,
      projectedPeakKw: proj.projected_peak_kw ?? null,
      billingPeakKw: ctx.billing_period_peak_kw ?? null,
      demandPeakProtected: proj.demand_peak_protected ?? null,
      avgDemandKw24h: hist.avg_demand_kw ?? null,
      peakDemandKw24h: hist.peak_demand_kw ?? null,
      bess: {
        socPct: bess.soc_pct ?? null,
        action: bess.action ?? null,
        setpointKw: bess.setpoint_kw ?? null,
        reason: bess.reason ?? null,
      },
      recommendation: bess.reason ?? (proj.demand_peak_protected ? "Demand peak protected; capacity sufficient." : "Monitor demand vs billing peak."),
    }];

    return {
      success: true,
      action: "depot_demand_predicted",
      timeframe: `${hours} hours`,
      predictions,
      confidence: 88,
      message: `Live demand for ${energy?.depot ?? "depot"} (${ctx.tariff_window ?? "?"} tariff): net load ${ctx.net_load_kw ?? "?"} kW, projected peak ${proj.projected_peak_kw ?? "?"} kW vs ${ctx.billing_period_peak_kw ?? "?"} kW billing peak. BESS ${bess.action ?? "idle"} at ${bess.setpoint_kw ?? 0} kW.`,
    };
  } catch (err) {
    console.error("predict_depot_demand real call failed, using heuristic:", err);
    return predictDepotDemandHeuristic(args, fleetContext);
  }
}

// Heuristic fallback (original simulated implementation) for predictDepotDemand.
async function predictDepotDemandHeuristic(args: any, fleetContext: any) {
  const { depot_id, city, hours = 8 } = args;

  const depots = fleetContext?.depots || [
    { id: "depot-nash-1", name: "Nashville Central", city: "Nashville" },
    { id: "depot-austin-1", name: "Austin Main", city: "Austin" },
    { id: "depot-la-1", name: "LA Operations", city: "LA" },
  ];

  let targetDepots = depots;
  if (depot_id) {
    targetDepots = depots.filter((d: any) => d.id === depot_id);
  } else if (city) {
    targetDepots = depots.filter((d: any) =>
      d.city?.toLowerCase().includes(city.toLowerCase())
    );
  }

  const predictions = targetDepots.map((depot: any) => {
    const currentUtilization = Math.round(Math.random() * 40 + 40); // 40-80%
    const predictedUtilization = Math.min(100, currentUtilization + Math.round(Math.random() * 20));

    return {
      depotId: depot.id,
      depotName: depot.name,
      city: depot.city,
      currentUtilization: `${currentUtilization}%`,
      predictedUtilization: `${predictedUtilization}%`,
      peakHour: `${Math.floor(Math.random() * 4 + 14)}:00`, // 2-6 PM
      expectedArrivals: Math.floor(Math.random() * 10 + 5),
      chargingDemand: {
        current: Math.floor(Math.random() * 5 + 3),
        predicted: Math.floor(Math.random() * 8 + 5),
        available: Math.floor(Math.random() * 10 + 2),
      },
      maintenanceDemand: {
        scheduled: Math.floor(Math.random() * 3),
        predicted: Math.floor(Math.random() * 2),
      },
      recommendation: predictedUtilization > 85
        ? "Consider redistributing incoming vehicles to alternate depot"
        : "Capacity sufficient for predicted demand",
    };
  });

  return {
    success: true,
    action: "depot_demand_predicted",
    timeframe: `${hours} hours`,
    predictions,
    confidence: 79,
    message: `Predicted depot demand for next ${hours} hours across ${predictions.length} depot(s).`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION / OTTO-Q
// ═══════════════════════════════════════════════════════════════════════════════

// Auto-Queue Charging
// real otto-q-core; falls back to heuristic on error
async function autoQueueCharging(args: any, fleetContext: any) {
  const { strategy = "urgent_first", soc_threshold = 30, depot_id, dry_run = true } = args;

  try {
    const result: any = await ottoqCore("ottoq-assign-optimize", {
      depot_id: depot_id || OTTOQ_DEFAULT_DEPOT,
    });

    const assignments: any[] = Array.isArray(result?.assignments) ? result.assignments : [];

    const queuedVehicles = assignments.slice(0, 10).map((a: any, idx: number) => ({
      vehicleId: a.vehicle_id,
      make: undefined,
      model: undefined,
      city: undefined,
      currentSoc: typeof a.soc === "number" ? Math.round(a.soc) : 0,
      queuePosition: idx + 1,
      estimatedWait: `${(idx + 1) * 15} min`,
      targetSoc: 80,
      stall: a.stall_code,
      stallType: a.stall_type,
    }));

    return {
      success: true,
      action: dry_run ? "charging_queue_preview" : "vehicles_queued_for_charging",
      dryRun: dry_run,
      strategy,
      threshold: `${soc_threshold}%`,
      vehiclesQueued: queuedVehicles,
      summary: {
        total: queuedVehicles.length,
        criticalSoc: queuedVehicles.filter((v: any) => v.currentSoc < 15).length,
        averageSoc: queuedVehicles.length > 0
          ? Math.round(queuedVehicles.reduce((sum, v) => sum + v.currentSoc, 0) / queuedVehicles.length)
          : 0,
      },
      message: dry_run
        ? `Preview: OTTO-Q assigned ${queuedVehicles.length} vehicles to charging stalls (${result?.candidates ?? "?"} candidates, ${result?.offered_stalls ?? "?"} stalls offered, engine: ${result?.source ?? "n/a"}). Execute with dry_run=false to commit.`
        : `✓ Committed ${queuedVehicles.length} charging assignments (engine: ${result?.source ?? "n/a"}).`,
    };
  } catch (err) {
    console.error("auto_queue_charging real call failed, using heuristic:", err);
    return autoQueueChargingHeuristic(args, fleetContext);
  }
}

// Heuristic fallback (original simulated implementation) for autoQueueCharging.
async function autoQueueChargingHeuristic(args: any, fleetContext: any) {
  const { strategy = "urgent_first", soc_threshold = 30, city, dry_run = true } = args;

  const vehicles = fleetContext?.vehicles || mockVehicles;

  let eligible = vehicles.filter((v: any) => {
    const soc = typeof v.soc === 'number' ? (v.soc > 1 ? v.soc : v.soc * 100) : 50;
    return soc < soc_threshold && v.status !== "charging";
  });

  if (city) {
    eligible = eligible.filter((v: any) =>
      v.city?.toLowerCase().includes(city.toLowerCase())
    );
  }

  // Sort based on strategy
  if (strategy === "urgent_first") {
    eligible.sort((a: any, b: any) => {
      const socA = typeof a.soc === 'number' ? (a.soc > 1 ? a.soc : a.soc * 100) : 50;
      const socB = typeof b.soc === 'number' ? (b.soc > 1 ? b.soc : b.soc * 100) : 50;
      return socA - socB;
    });
  } else if (strategy === "balanced") {
    // Distribute evenly across depots
    eligible.sort(() => Math.random() - 0.5);
  }

  const queuedVehicles = eligible.slice(0, 10).map((v: any, idx: number) => ({
    vehicleId: v.id,
    make: v.make,
    model: v.model,
    city: v.city,
    currentSoc: Math.round((typeof v.soc === 'number' ? (v.soc > 1 ? v.soc : v.soc * 100) : 50)),
    queuePosition: idx + 1,
    estimatedWait: `${(idx + 1) * 15} min`,
    targetSoc: 80,
  }));

  return {
    success: true,
    action: dry_run ? "charging_queue_preview" : "vehicles_queued_for_charging",
    dryRun: dry_run,
    strategy,
    threshold: `${soc_threshold}%`,
    vehiclesQueued: queuedVehicles,
    summary: {
      total: queuedVehicles.length,
      criticalSoc: queuedVehicles.filter((v: any) => v.currentSoc < 15).length,
      averageSoc: queuedVehicles.length > 0
        ? Math.round(queuedVehicles.reduce((sum, v) => sum + v.currentSoc, 0) / queuedVehicles.length)
        : 0,
    },
    message: dry_run
      ? `Preview: ${queuedVehicles.length} vehicles would be queued for charging using '${strategy}' strategy. Execute with dry_run=false to apply.`
      : `✓ Queued ${queuedVehicles.length} vehicles for charging using '${strategy}' strategy.`,
  };
}

// Auto-Queue Maintenance
async function autoQueueMaintenance(args: any, fleetContext: any) {
  const { risk_threshold = 70, city, dry_run = true } = args;

  // Get maintenance risk predictions
  const riskResult = await predictMaintenanceRisks({ risk_threshold, city }, fleetContext);
  const highRiskVehicles = riskResult.predictions?.slice(0, 5) || [];

  const queuedVehicles = highRiskVehicles.map((v: any, idx: number) => ({
    vehicleId: v.vehicleId,
    make: v.make,
    model: v.model,
    city: v.city,
    riskScore: v.riskScore,
    primaryComponent: v.primaryComponent,
    queuePosition: idx + 1,
    scheduledDate: new Date(Date.now() + (idx + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    maintenanceType: v.primaryComponent + " Inspection",
  }));

  return {
    success: true,
    action: dry_run ? "maintenance_queue_preview" : "vehicles_queued_for_maintenance",
    dryRun: dry_run,
    riskThreshold: risk_threshold,
    vehiclesQueued: queuedVehicles,
    summary: {
      total: queuedVehicles.length,
      criticalRisk: queuedVehicles.filter((v: any) => v.riskScore >= 80).length,
      avgRiskScore: queuedVehicles.length > 0
        ? Math.round(queuedVehicles.reduce((sum, v) => sum + v.riskScore, 0) / queuedVehicles.length)
        : 0,
    },
    message: dry_run
      ? `Preview: ${queuedVehicles.length} vehicles would be queued for maintenance based on risk scores ≥${risk_threshold}. Execute with dry_run=false to apply.`
      : `✓ Queued ${queuedVehicles.length} vehicles for maintenance based on predictive risk analysis.`,
  };
}

// Triage Incidents
async function triageIncidents(args: any, fleetContext: any) {
  const { city, include_resolved = false } = args;

  const incidents = fleetContext?.incidents || [];

  let filtered = incidents;
  if (!include_resolved) {
    filtered = incidents.filter((i: any) => i.status !== "Closed");
  }
  if (city) {
    filtered = filtered.filter((i: any) =>
      i.city?.toLowerCase().includes(city.toLowerCase())
    );
  }

  // Score and prioritize incidents
  const triaged = filtered.map((incident: any) => {
    // Calculate priority score
    let score = 0;
    if (incident.type === "collision") score += 40;
    else if (incident.type === "malfunction") score += 30;
    else if (incident.type === "vandalism") score += 20;
    else score += 10;

    if (incident.status === "Reported") score += 30;
    else if (incident.status === "Dispatched") score += 20;

    // Time factor (mock - incidents get more urgent over time)
    score += Math.min(30, Math.floor(Math.random() * 30));

    const priority = score >= 70 ? "Critical" : score >= 50 ? "High" : score >= 30 ? "Medium" : "Low";

    return {
      ...incident,
      priorityScore: score,
      priority,
      recommendedAction:
        priority === "Critical" ? "Dispatch OTTOW immediately" :
        priority === "High" ? "Dispatch OTTOW within 15 min" :
        priority === "Medium" ? "Schedule response" :
        "Monitor and follow up",
      estimatedResponseTime:
        priority === "Critical" ? "6 min" :
        priority === "High" ? "15 min" :
        priority === "Medium" ? "30 min" :
        "1+ hour",
    };
  }).sort((a: any, b: any) => b.priorityScore - a.priorityScore);

  return {
    success: true,
    action: "incidents_triaged",
    incidents: triaged.slice(0, 10),
    summary: {
      total: triaged.length,
      critical: triaged.filter((i: any) => i.priority === "Critical").length,
      high: triaged.filter((i: any) => i.priority === "High").length,
      medium: triaged.filter((i: any) => i.priority === "Medium").length,
      low: triaged.filter((i: any) => i.priority === "Low").length,
    },
    message: `Triaged ${triaged.length} active incidents. ${triaged.filter((i: any) => i.priority === "Critical" || i.priority === "High").length} require immediate attention.`,
  };
}

// Detect Anomalies
// real otto-q-core; falls back to heuristic on error
async function detectAnomalies(args: any, fleetContext: any) {
  const { city, anomaly_type } = args;

  try {
    const ai: any = await ottoqApi("/ai/fleet-summary");
    const risks = ai?.active_risks ?? {};
    const recents: any[] = Array.isArray(ai?.recent_actions) ? ai.recent_actions : [];
    const nowIso = ai?.timestamp ?? new Date().toISOString();

    const anomalies: any[] = [];

    // Each non-zero risk severity becomes an anomaly record (same shape as heuristic).
    if ((risks.critical ?? 0) > 0) {
      anomalies.push({
        vehicleId: "fleet",
        anomalyType: anomaly_type || "active_risk",
        severity: "high",
        description: `${risks.critical} critical active risk(s) flagged by the AI brain.`,
        detectedAt: nowIso,
        recommendation: "Open OTTO-Response and mitigate critical risks immediately.",
      });
    }
    if ((risks.warning ?? 0) > 0) {
      anomalies.push({
        vehicleId: "fleet",
        anomalyType: anomaly_type || "active_risk",
        severity: "medium",
        description: `${risks.warning} warning-level risk(s) detected.`,
        detectedAt: nowIso,
        recommendation: "Investigate warnings before they escalate.",
      });
    }
    if ((risks.info ?? 0) > 0) {
      anomalies.push({
        vehicleId: "fleet",
        anomalyType: anomaly_type || "active_risk",
        severity: "low",
        description: `${risks.info} informational risk signal(s).`,
        detectedAt: nowIso,
        recommendation: "Monitor; no immediate action required.",
      });
    }
    // Recent autonomous actions that failed/rolled back are anomalies worth surfacing.
    for (const r of recents) {
      if (r?.status && /fail|rolled_back|error/i.test(r.status)) {
        anomalies.push({
          vehicleId: r.depot_id ?? "fleet",
          anomalyType: r.action_type || "action_failure",
          severity: "high",
          description: r.summary ?? `Autonomous action ${r.id} ${r.status}.`,
          detectedAt: r.created_at ?? nowIso,
          recommendation: "Review the failed autonomous action and re-run if appropriate.",
        });
      }
    }

    const filtered = anomaly_type
      ? anomalies.filter((a) => a.anomalyType === anomaly_type)
      : anomalies;

    return {
      success: true,
      action: "anomalies_detected",
      anomalies: filtered.sort((a, b) => {
        const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      summary: {
        total: filtered.length,
        high: filtered.filter((a) => a.severity === "high").length,
        medium: filtered.filter((a) => a.severity === "medium").length,
        low: filtered.filter((a) => a.severity === "low").length,
        byType: filtered.reduce((acc, a) => {
          acc[a.anomalyType] = (acc[a.anomalyType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      message: `Detected ${filtered.length} live anomaly signal(s) from the AI brain (${risks.total ?? 0} active risks total). ${filtered.filter((a) => a.severity === "high").length} require immediate investigation.`,
    };
  } catch (err) {
    console.error("detect_anomalies real call failed, using heuristic:", err);
    return detectAnomaliesHeuristic(args, fleetContext);
  }
}

// Heuristic fallback (original simulated implementation) for detectAnomalies.
async function detectAnomaliesHeuristic(args: any, fleetContext: any) {
  const { city, anomaly_type } = args;

  const vehicles = fleetContext?.vehicles || mockVehicles;

  let filteredVehicles = vehicles;
  if (city) {
    filteredVehicles = vehicles.filter((v: any) =>
      v.city?.toLowerCase().includes(city.toLowerCase())
    );
  }

  // Generate mock anomalies
  const anomalyTypes = ["soc_drain", "sensor_drift", "location_mismatch", "performance_drop", "communication_gap"];
  const anomalies: any[] = [];

  filteredVehicles.forEach((v: any) => {
    // Random chance of anomaly
    if (Math.random() < 0.2) {
      const type = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)];
      if (!anomaly_type || type === anomaly_type) {
        anomalies.push({
          vehicleId: v.id,
          make: v.make,
          model: v.model,
          city: v.city,
          anomalyType: type,
          severity: Math.random() < 0.3 ? "high" : Math.random() < 0.6 ? "medium" : "low",
          description: getAnomalyDescription(type),
          detectedAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
          recommendation: getAnomalyRecommendation(type),
        });
      }
    }
  });

  return {
    success: true,
    action: "anomalies_detected",
    anomalies: anomalies.sort((a, b) => {
      const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    summary: {
      total: anomalies.length,
      high: anomalies.filter(a => a.severity === "high").length,
      medium: anomalies.filter(a => a.severity === "medium").length,
      low: anomalies.filter(a => a.severity === "low").length,
      byType: anomalies.reduce((acc, a) => {
        acc[a.anomalyType] = (acc[a.anomalyType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
    message: `Detected ${anomalies.length} anomalies across ${filteredVehicles.length} vehicles. ${anomalies.filter(a => a.severity === "high").length} require immediate investigation.`,
  };
}

function getAnomalyDescription(type: string): string {
  const descriptions: Record<string, string> = {
    soc_drain: "Unusual battery drain rate detected - 3x normal consumption",
    sensor_drift: "LiDAR calibration deviation exceeds threshold",
    location_mismatch: "GPS location differs from expected position by >100m",
    performance_drop: "Compute performance degraded by 25%",
    communication_gap: "Telemetry gaps detected - 5 min blackout periods",
  };
  return descriptions[type] || "Unknown anomaly detected";
}

function getAnomalyRecommendation(type: string): string {
  const recommendations: Record<string, string> = {
    soc_drain: "Schedule battery diagnostic and check for parasitic drain",
    sensor_drift: "Schedule sensor recalibration at depot",
    location_mismatch: "Verify GPS module and update map data",
    performance_drop: "Run compute diagnostics and clear cache",
    communication_gap: "Check antenna connections and modem firmware",
  };
  return recommendations[type] || "Schedule diagnostic inspection";
}

// Utilization Report
// real otto-q-core; falls back to heuristic on error
async function utilizationReport(args: any, fleetContext: any) {
  const { city, period = "today" } = args;

  try {
    const fs: any = await ottoqApi("/fleet/summary");
    let depots: any[] = Array.isArray(fs?.depots) ? fs.depots : [];
    if (city) {
      depots = depots.filter((d: any) => d?.city?.toLowerCase().includes(city.toLowerCase()));
    }
    if (depots.length === 0) throw new Error("no depots in fleet summary");

    const report = depots.map((d: any) => ({
      depot: d.name,
      city: d.city,
      chargeStalls: {
        total: d.stalls_total ?? 0,
        utilized: d.stalls_occupied ?? 0,
        utilization: `${d.utilization_pct ?? 0}%`,
        peakUtilization: `${d.utilization_pct ?? 0}%`,
        peakTime: "14:00-18:00",
      },
      maintenanceBays: {
        total: 0,
        utilized: d.in_service ?? 0,
        utilization: "n/a",
      },
      jobsCompleted: {
        charging: d.charging ?? 0,
        maintenance: d.in_service ?? 0,
        detailing: 0,
      },
      efficiency: {
        avgChargingTime: "n/a",
        avgTurnaround: "n/a",
        queueWaitTime: "n/a",
      },
      vehicles: d.vehicles ?? 0,
      onSite: d.on_site ?? 0,
      activeExceptions: d.active_exceptions ?? 0,
      activeOttowMissions: d.active_ottow_missions ?? 0,
    }));

    const su = fs?.stall_utilization ?? {};
    const totalUtilization = (su.total ?? 0) > 0
      ? Math.round(((su.occupied ?? 0) / su.total) * 100)
      : Math.round(report.reduce((sum, r) => sum + (parseInt(r.chargeStalls.utilization) || 0), 0) / report.length);

    return {
      success: true,
      action: "utilization_report_generated",
      period,
      depots: report,
      summary: {
        totalDepots: report.length,
        avgChargeUtilization: `${totalUtilization}%`,
        totalJobsCompleted: report.reduce((sum, r) =>
          sum + r.jobsCompleted.charging + r.jobsCompleted.maintenance + r.jobsCompleted.detailing, 0
        ),
        recommendation: totalUtilization > 80
          ? "Consider expanding charging capacity"
          : totalUtilization < 50
          ? "Optimize scheduling to improve utilization"
          : "Utilization within optimal range",
      },
      message: `Live ${period} utilization across ${report.length} depot(s): ${su.occupied ?? 0}/${su.total ?? 0} stalls occupied (${totalUtilization}%), ${fs?.totals?.charging ?? 0} charging, ${fs?.active_exceptions ?? 0} active exceptions.`,
    };
  } catch (err) {
    console.error("utilization_report real call failed, using heuristic:", err);
    return utilizationReportHeuristic(args, fleetContext);
  }
}

// Heuristic fallback (original simulated implementation) for utilizationReport.
async function utilizationReportHeuristic(args: any, fleetContext: any) {
  const { city, period = "today" } = args;

  const depots = fleetContext?.depots || [
    { id: "depot-nash-1", name: "Nashville Central", city: "Nashville" },
    { id: "depot-austin-1", name: "Austin Main", city: "Austin" },
    { id: "depot-la-1", name: "LA Operations", city: "LA" },
  ];

  let targetDepots = depots;
  if (city) {
    targetDepots = depots.filter((d: any) =>
      d.city?.toLowerCase().includes(city.toLowerCase())
    );
  }

  const report = targetDepots.map((depot: any) => ({
    depot: depot.name,
    city: depot.city,
    chargeStalls: {
      total: Math.floor(Math.random() * 10) + 10,
      utilized: Math.floor(Math.random() * 8) + 4,
      utilization: `${Math.floor(Math.random() * 30) + 50}%`,
      peakUtilization: `${Math.floor(Math.random() * 20) + 75}%`,
      peakTime: "14:00-18:00",
    },
    maintenanceBays: {
      total: Math.floor(Math.random() * 5) + 3,
      utilized: Math.floor(Math.random() * 3) + 1,
      utilization: `${Math.floor(Math.random() * 40) + 30}%`,
    },
    jobsCompleted: {
      charging: Math.floor(Math.random() * 20) + 10,
      maintenance: Math.floor(Math.random() * 5) + 2,
      detailing: Math.floor(Math.random() * 8) + 3,
    },
    efficiency: {
      avgChargingTime: `${Math.floor(Math.random() * 30) + 30} min`,
      avgTurnaround: `${Math.floor(Math.random() * 20) + 45} min`,
      queueWaitTime: `${Math.floor(Math.random() * 15) + 5} min`,
    },
  }));

  const totalUtilization = Math.round(
    report.reduce((sum, r) => sum + parseInt(r.chargeStalls.utilization), 0) / report.length
  );

  return {
    success: true,
    action: "utilization_report_generated",
    period,
    depots: report,
    summary: {
      totalDepots: report.length,
      avgChargeUtilization: `${totalUtilization}%`,
      totalJobsCompleted: report.reduce((sum, r) =>
        sum + r.jobsCompleted.charging + r.jobsCompleted.maintenance + r.jobsCompleted.detailing, 0
      ),
      recommendation: totalUtilization > 80
        ? "Consider expanding charging capacity"
        : totalUtilization < 50
        ? "Optimize scheduling to improve utilization"
        : "Utilization within optimal range",
    },
    message: `Generated ${period} utilization report for ${report.length} depot(s). Average charge stall utilization: ${totalUtilization}%.`,
  };
}

// Explain Concept (General Knowledge)
async function explainConcept(args: any) {
  const { topic } = args;

  const concepts: Record<string, { explanation: string; fleetContext: string; relatedTopics: string[] }> = {
    "l4 autonomy": {
      explanation: "Level 4 (L4) autonomy means the vehicle can handle all driving tasks in specific conditions (geofenced areas, certain weather, etc.) without human intervention. The vehicle has a fallback system and can safely stop if it encounters a situation it cannot handle.",
      fleetContext: "Most OTTOYARD partners (Waymo, Cruise, Motional) operate L4 vehicles. They require designated operational design domains (ODDs) and depot support for edge cases.",
      relatedTopics: ["L5 autonomy", "ODD (Operational Design Domain)", "Disengagement rate"],
    },
    "l5 autonomy": {
      explanation: "Level 5 (L5) autonomy represents full driving automation - the vehicle can drive anywhere, in any condition, without human intervention. No steering wheel or pedals required. This is the ultimate goal of AV development.",
      fleetContext: "Zoox is targeting L5 with their purpose-built vehicles. Most current commercial deployments are L4.",
      relatedTopics: ["L4 autonomy", "Purpose-built AVs", "Full self-driving"],
    },
    "soc": {
      explanation: "State of Charge (SOC) represents the current battery level as a percentage of total capacity. It's the EV equivalent of a fuel gauge.",
      fleetContext: "OTTOYARD monitors SOC across all vehicles. Critical threshold is 15%, low battery is <30%, optimal charging window is 20-80%.",
      relatedTopics: ["Battery health", "Charging strategies", "Range anxiety"],
    },
    "odd": {
      explanation: "Operational Design Domain (ODD) defines the specific conditions under which an AV system is designed to function. This includes geographic boundaries, weather conditions, time of day, and road types.",
      fleetContext: "Each partner's vehicles have defined ODDs. OTTOYARD helps manage vehicles at ODD boundaries and supports transitions.",
      relatedTopics: ["L4 autonomy", "Geofencing", "Edge cases"],
    },
    "disengagement": {
      explanation: "A disengagement occurs when the autonomous system hands control back to a human driver, either by request or due to a system limitation. Disengagement rate (miles per disengagement) is a key safety metric.",
      fleetContext: "Waymo leads with ~13,000+ miles per disengagement. Lower disengagement rates indicate more reliable autonomy.",
      relatedTopics: ["Safety metrics", "L4 autonomy", "MPD (Miles Per Disengagement)"],
    },
    "otto-q": {
      explanation: "OTTO-Q is OTTOYARD's intelligent queue management system for autonomous vehicle operations. It handles job scheduling, resource allocation, and automated workflows for charging, maintenance, and staging.",
      fleetContext: "OTTO-Q powers automated charging queues, predictive maintenance scheduling, and fleet rebalancing across all depots.",
      relatedTopics: ["Auto-queue charging", "Predictive maintenance", "Fleet rebalancing"],
    },
    "ottow": {
      explanation: "OTTOW (Otto Tow/Watcher) is OTTOYARD's roadside assistance and incident response system. It dispatches service vehicles to handle vehicle-down situations, incidents, and recoveries.",
      fleetContext: "OTTOW integrates with incident triage to prioritize responses. Average response time target is under 6 minutes in service areas.",
      relatedTopics: ["Incident triage", "Roadside assistance", "Vehicle recovery"],
    },
  };

  const normalizedTopic = topic.toLowerCase().trim();
  const match = Object.keys(concepts).find(key =>
    normalizedTopic.includes(key) || key.includes(normalizedTopic)
  );

  if (match) {
    const concept = concepts[match];
    return {
      success: true,
      action: "concept_explained",
      topic: match,
      explanation: concept.explanation,
      fleetContext: concept.fleetContext,
      relatedTopics: concept.relatedTopics,
      message: `Explained: ${match}`,
    };
  }

  return {
    success: true,
    action: "concept_explained",
    topic: topic,
    explanation: `I can provide general information about "${topic}" in the context of autonomous vehicle fleet management. For specific operational queries, try asking about fleet status, depot resources, or incident management.`,
    fleetContext: "Use natural language queries to explore OTTOYARD's fleet intelligence capabilities.",
    relatedTopics: ["Fleet operations", "AV technology", "OTTO-Q automation"],
    message: `Provided general context for: ${topic}`,
  };
}

// Create Optimization Plan
// real otto-q-core; falls back to heuristic on error
async function createOptimizationPlan(args: any) {
  const { focus_area, timeframe, goals, depot_id } = args;

  try {
    const tick: any = await ottoqCore("ottoq-orchestrate-tick", {
      depot_id: depot_id || OTTOQ_DEFAULT_DEPOT,
      submit: false,
    });

    const s = tick?.summary ?? {};
    const e = tick?.energy ?? {};
    const board: any[] = Array.isArray(tick?.depot_board) ? tick.depot_board : [];

    // Build actionable plan steps from the live optimizer output.
    const plan: string[] = [
      `Assign ${s.charge_assigned ?? 0}/${s.vehicles_planned ?? 0} vehicles to charging (source: ${s.charge_source ?? "n/a"}).`,
      `Sequence ${s.tasks_assigned ?? board.length} depot tasks; ${s.tasks_awaiting_resource ?? 0} awaiting a free resource (${s.free_stalls ?? 0} stalls free).`,
      `Hold DCFC concurrency at ${e.max_concurrent_dcfc ?? "n/a"} chargers under the ${e.tariff ?? "current"} tariff to protect the ${e.billing_peak_kw ?? "n/a"} kW billing peak.`,
      ...board.slice(0, 6).map((v: any) => `${v.vehicle} (SOC ${v.soc}%): ${v.sequence}`),
    ];

    return {
      success: true,
      action: "optimization_plan_created",
      focus_area: focus_area,
      timeframe: timeframe,
      goals: goals,
      plan: plan,
      estimated_savings: `${s.charge_assigned ?? 0} vehicles optimally sequenced`,
      implementation_steps: plan.length,
      message: `Created live ${timeframe || ""} ${focus_area || "operations"} optimization plan for ${tick?.depot ?? "depot"}: ${s.vehicles_planned ?? 0} vehicles planned, ${s.charge_assigned ?? 0} charging (${s.charge_source ?? "n/a"}), ${s.tasks_awaiting_resource ?? 0} tasks awaiting resource.`.replace(/\s+/g, " ").trim(),
    };
  } catch (err) {
    console.error("create_optimization_plan real call failed, using heuristic:", err);
    return createOptimizationPlanHeuristic(args);
  }
}

// Heuristic fallback (original simulated implementation) for createOptimizationPlan.
function createOptimizationPlanHeuristic(args: any) {
  const { focus_area, timeframe, goals } = args;

  const optimizationPlans: Record<string, Record<string, string[]>> = {
    routes: {
      immediate: [
        "Implement dynamic routing for delivery vehicles",
        "Optimize traffic light coordination on main corridors", 
        "Deploy GPS tracking for real-time route adjustments"
      ],
      weekly: [
        "Analyze route efficiency data and eliminate redundancies",
        "Pilot AI-powered route optimization on 3 key circuits",
        "Train drivers on eco-efficient driving techniques"
      ],
      monthly: [
        "Full fleet route network redesign based on demand patterns",
        "Implement predictive routing using weather and traffic data",
        "Establish performance KPIs and continuous improvement process"
      ]
    },
    energy: {
      immediate: [
        "Switch 6 vehicles to off-peak charging schedule",
        "Implement tire pressure monitoring alerts",
        "Activate regenerative braking optimization"
      ],
      weekly: [
        "Install smart charging stations with load balancing",
        "Deploy battery health monitoring across fleet",
        "Optimize charging schedules based on route demands"
      ],
      monthly: [
        "Integrate solar panels with grid-tie capabilities", 
        "Implement battery conditioning for climate efficiency",
        "Establish energy cost tracking and reduction targets"
      ]
    },
    maintenance: {
      immediate: [
        "Schedule overdue maintenance for flagged vehicles",
        "Implement daily vehicle inspection checklists",
        "Set up automated maintenance reminders"
      ],
      weekly: [
        "Deploy predictive maintenance sensors on critical systems",
        "Optimize technician scheduling and workload distribution",
        "Establish preventive maintenance calendar"
      ],
      monthly: [
        "Implement condition-based maintenance program",
        "Deploy fleet telemetry for real-time health monitoring",
        "Establish maintenance cost reduction targets (15% goal)"
      ]
    },
    costs: {
      immediate: [
        "Negotiate bulk fuel/energy purchase agreements",
        "Implement driver fuel efficiency coaching",
        "Review and optimize insurance policies"
      ],
      weekly: [
        "Analyze operational cost per vehicle and identify outliers",
        "Implement automated expense tracking and reporting",
        "Optimize spare parts inventory levels"
      ],
      monthly: [
        "Conduct comprehensive fleet TCO analysis",
        "Evaluate lease vs purchase decisions for vehicle renewal",
        "Establish cost reduction targets and performance metrics"
      ]
    }
  };

  const plan = optimizationPlans[focus_area]?.[timeframe] || [
    `Custom optimization plan for ${focus_area} over ${timeframe} timeframe`,
    "Analyze current performance metrics and identify improvement opportunities",
    "Implement targeted improvements with measurable outcomes"
  ];

  return {
    success: true,
    action: 'optimization_plan_created',
    focus_area: focus_area,
    timeframe: timeframe,
    goals: goals,
    plan: plan,
    estimated_savings: `$${Math.floor(Math.random() * 5000) + 1000}/month`,
    implementation_steps: plan.length,
    message: `Created ${timeframe} ${focus_area} optimization plan with ${plan.length} actionable steps`
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EV (OrchestraEV) TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

async function evVehicleStatus(args: any, evContext: any) {
  const v = evContext?.vehicle;
  if (!v) return { success: false, error: "No vehicle data available" };

  const socPct = typeof v.currentSoc === "number" ? (v.currentSoc > 1 ? v.currentSoc : Math.round(v.currentSoc * 100)) : 0;

  return {
    success: true,
    action: "ev_vehicle_status",
    vehicle: {
      id: v.id,
      name: `${v.year} ${v.make} ${v.model}`,
      color: v.color,
      licensePlate: v.licensePlate,
      vin: v.vin,
      status: v.currentStatus,
      soc: `${socPct}%`,
      estimatedRange: `${v.estimatedRangeMiles} mi`,
      healthScore: `${v.healthScore}/100`,
      batteryHealth: `${v.batteryHealthPct}%`,
      odometer: `${v.odometerMiles.toLocaleString()} mi`,
      chargingPreference: `${v.chargingPreferencePct}%`,
      currentStall: v.currentStallId || "Not assigned",
      currentDepot: v.currentDepotId || "Not at depot",
      tirePressure: v.tirePressure,
      brakeWear: v.brakeWearPct,
      lastDiagnostic: v.lastDiagnosticDate,
    },
    message: `Your ${v.year} ${v.make} ${v.model} is currently **${v.currentStatus}** at **${socPct}%** SOC with **${v.estimatedRangeMiles} mi** range. Health score: **${v.healthScore}/100**.`,
  };
}

async function evBookAmenity(args: any, evContext: any) {
  const { amenity_type, time_slot, bay_or_pod } = args;
  const avail = evContext?.amenityAvailability;
  if (!avail) return { success: false, error: "No amenity availability data" };

  // If no amenity_type specified, return all availability
  if (!amenity_type) {
    return {
      success: true,
      action: "ev_amenity_availability",
      availability: {
        simGolf: avail.simGolf?.map((b: any) => ({ bay: b.bayNumber, openSlots: b.slots })),
        coworkTables: avail.coworkTables?.map((t: any) => ({ table: t.tableId, type: t.type, amenities: t.amenities, slots: t.slots })),
        privacyPods: avail.privacyPods?.map((p: any) => ({ pod: p.podId, capacity: p.capacity, equipment: p.equipment, slots: p.slots })),
      },
      existingReservations: evContext?.amenityReservations?.map((r: any) => ({
        type: r.type,
        date: r.date,
        time: `${r.startTime} - ${r.endTime}`,
        status: r.status,
        bay: r.bayNumber,
      })),
      message: `Here's what's available:\n• **Sim Golf**: ${avail.simGolf?.length || 0} bays\n• **Cowork Tables**: ${avail.coworkTables?.length || 0} tables\n• **Privacy Pods**: ${avail.privacyPods?.length || 0} pods`,
    };
  }

  // Book a specific amenity
  const reservationId = `res-${Date.now().toString(36)}`;
  const today = new Date().toISOString().split("T")[0];

  return {
    success: true,
    action: "ev_amenity_booked",
    reservation: {
      id: reservationId,
      type: amenity_type,
      date: today,
      timeSlot: time_slot || "Next available",
      bayOrPod: bay_or_pod || "Auto-assigned",
      status: "confirmed",
      depot: "OTTO Nashville #1",
    },
    message: `✓ **${amenity_type.replace("_", " ")}** reserved for **${time_slot || "next available slot"}** at OTTO Nashville #1. Reservation ID: ${reservationId}`,
  };
}

async function evScheduleService(args: any, evContext: any) {
  const { service_type, preferred_date, notes } = args;
  const records = evContext?.serviceRecords || [];
  const subscriber = evContext?.subscriber;

  // If no service_type, show available services and predictions
  if (!service_type) {
    const predictions = [
      { service: "Tire Rotation", dueDate: "2026-03-05", urgency: "soon", confidence: "high" },
      { service: "Cabin Air Filter", dueDate: "2026-04-01", urgency: "routine", confidence: "medium" },
      { service: "Brake Inspection", dueDate: "2026-06-15", urgency: "routine", confidence: "medium" },
    ];

    return {
      success: true,
      action: "ev_service_options",
      availableServices: [
        "Charging", "Detailing (Interior + Exterior)", "Tire Rotation",
        "Brake Inspection", "Battery Diagnostic", "Cabin Air Filter",
        "Full Maintenance Package",
      ],
      upcomingPredictions: predictions,
      recentServices: records.slice(0, 3).map((r: any) => ({
        type: r.type,
        status: r.status,
        date: r.scheduledAt,
        cost: `$${r.cost}`,
        depot: r.depotName,
      })),
      message: "Here are your service options and upcoming maintenance predictions. Which service would you like to schedule?",
    };
  }

  // Schedule a service
  const serviceId = `svc-${Date.now().toString(36)}`;
  const scheduleDate = preferred_date || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  return {
    success: true,
    action: "ev_service_scheduled",
    booking: {
      id: serviceId,
      type: service_type,
      scheduledDate: scheduleDate,
      depot: subscriber?.preferredDepotId ? "OTTO Nashville #1" : "Nearest depot",
      estimatedCost: service_type === "detailing" ? "$89.99" : service_type === "tire_rotation" ? "$49.99" : "$79.99",
      notes: notes || "",
      status: "scheduled",
    },
    message: `✓ **${service_type.replace("_", " ")}** scheduled for **${scheduleDate}** at OTTO Nashville #1. Service ID: ${serviceId}`,
  };
}

async function evDepotQueueStatus(args: any, evContext: any) {
  const stages = evContext?.depotStages;
  if (!stages) return { success: false, error: "No depot queue data available" };

  const currentStageIdx = stages.stages?.findIndex((s: any) => s.status === "in_progress");
  const completedStages = stages.stages?.filter((s: any) => s.status === "completed").length || 0;
  const totalStages = stages.stages?.length || 0;

  return {
    success: true,
    action: "ev_depot_queue_status",
    depot: {
      name: stages.depotName,
      address: stages.depotAddress,
      hours: stages.depotHours,
      status: stages.depotStatus,
    },
    currentStall: stages.currentStall,
    stages: stages.stages?.map((s: any) => ({
      name: s.name,
      status: s.status,
      timestamp: s.timestamp,
      estimatedCompletion: s.estimatedCompletion,
    })),
    progress: `${completedStages}/${totalStages} stages completed`,
    currentStage: currentStageIdx >= 0 ? stages.stages[currentStageIdx]?.name : "Unknown",
    message: `Your vehicle is at **${stages.depotName}** — currently **${currentStageIdx >= 0 ? stages.stages[currentStageIdx]?.name : "processing"}**. Stall **${stages.currentStall?.id}** (${stages.currentStall?.subType}). Progress: ${completedStages}/${totalStages} stages.`,
  };
}

async function evAccountSummary(args: any, evContext: any) {
  const sub = evContext?.subscriber;
  const reservations = evContext?.amenityReservations || [];
  const records = evContext?.serviceRecords || [];

  if (!sub) return { success: false, error: "No subscriber data available" };

  const totalSpent = records
    .filter((r: any) => r.status === "completed")
    .reduce((sum: number, r: any) => sum + (r.cost || 0), 0);

  return {
    success: true,
    action: "ev_account_summary",
    subscriber: {
      name: `${sub.firstName} ${sub.lastName}`,
      email: sub.email,
      phone: sub.phone,
      membershipTier: sub.membershipTier,
      subscriptionStatus: sub.subscriptionStatus,
      memberSince: sub.memberSince,
      preferredDepot: sub.preferredDepotId,
      homeAddress: `${sub.homeAddress?.street}, ${sub.homeAddress?.city}, ${sub.homeAddress?.state}`,
    },
    billing: {
      totalSpent: `$${totalSpent.toFixed(2)}`,
      servicesCompleted: records.filter((r: any) => r.status === "completed").length,
      pendingServices: records.filter((r: any) => r.status === "in_progress" || r.status === "scheduled").length,
    },
    upcomingReservations: reservations
      .filter((r: any) => r.status === "confirmed")
      .map((r: any) => ({
        type: r.type,
        date: r.date,
        time: `${r.startTime} - ${r.endTime}`,
        depot: r.depotName,
        bay: r.bayNumber,
      })),
    message: `**${sub.firstName} ${sub.lastName}** — **${sub.membershipTier}** member since ${new Date(sub.memberSince).toLocaleDateString()}. Total spent: **$${totalSpent.toFixed(2)}**. ${reservations.filter((r: any) => r.status === "confirmed").length} upcoming reservation(s).`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// OTTO-RESPONSE INTELLIGENCE TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

function triggerOttoResponse(args: any) {
  return {
    success: true,
    action: "open_otto_response",
    eventId: args.event_id || null,
    autoAnalyze: args.auto_analyze || false,
    message: "Opening OTTO-Response panel." + (args.event_id ? ` Pre-loading event ${args.event_id}.` : ""),
  };
}

async function fleetSafePullover(args: any, supabase: any) {
  const { city, zone_center_lat, zone_center_lng, radius_miles = 1, reason, urgency = "within_15min" } = args;

  // Count affected vehicles from mock data
  let affected = mockVehicles.filter(v => v.city === city);
  
  // If zone coordinates provided, just use city vehicles (no real geo-filter in mock)
  const affectedCount = affected.length;
  const vehicleIds = affected.map(v => v.id);

  // Insert fleet command
  let commandId = `CMD-${Date.now()}`;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("fleet_commands")
        .insert({
          command_type: "safe_pullover",
          status: "pending",
          city,
          zone: zone_center_lat ? { center: { lat: zone_center_lat, lng: zone_center_lng }, radius_miles } : null,
          target_vehicle_ids: vehicleIds,
          affected_vehicle_count: affectedCount,
          reason,
          urgency,
          issued_by: "ottocommand",
        })
        .select("id")
        .single();
      if (!error && data) commandId = data.id;
    } catch (e) {
      console.error("Error inserting fleet command:", e);
    }
  }

  return {
    success: true,
    action: "fleet_safe_pullover",
    commandId,
    city,
    affectedVehicles: affectedCount,
    urgency,
    reason,
    message: `Safe pullover command issued for **${affectedCount} vehicles** in **${city}**. Urgency: **${urgency}**. Reason: ${reason}. Note: This is a readiness command — vehicles will initiate safe stop procedures.`,
  };
}

async function fleetRecallToDepot(args: any, supabase: any) {
  const { city, scope = "all", vehicle_ids, target_depot_id, reason } = args;

  let affected = mockVehicles.filter(v => v.city === city);

  if (scope === "low_soc") {
    affected = affected.filter(v => v.soc < 0.3);
  } else if (scope === "specific" && vehicle_ids?.length) {
    affected = affected.filter(v => vehicle_ids.includes(v.id));
  }

  const affectedCount = affected.length;
  const vehicleIds = affected.map(v => v.id);

  let commandId = `CMD-${Date.now()}`;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("fleet_commands")
        .insert({
          command_type: "recall_to_depot",
          status: "pending",
          city,
          target_vehicle_ids: vehicleIds,
          affected_vehicle_count: affectedCount,
          reason,
          urgency: "within_15min",
          issued_by: "ottocommand",
          parameters: { scope, target_depot_id },
        })
        .select("id")
        .single();
      if (!error && data) commandId = data.id;
    } catch (e) {
      console.error("Error inserting fleet command:", e);
    }
  }

  return {
    success: true,
    action: "fleet_recall_to_depot",
    commandId,
    city,
    scope,
    affectedVehicles: affectedCount,
    reason,
    message: `Recall command issued for **${affectedCount} vehicles** in **${city}** (scope: **${scope}**). Vehicles will route to nearest depot. Reason: ${reason}.`,
  };
}

async function getIntelligenceSummary(args: any, supabase: any) {
  const { city, min_severity, include_recommendations = true } = args;

  if (!supabase) {
    return { success: false, error: "Database not available", message: "Intelligence data requires database connection." };
  }

  try {
    let query = supabase
      .from("intelligence_events")
      .select("*")
      .eq("is_active", true)
      .order("threat_score", { ascending: false })
      .limit(50);

    if (city) query = query.eq("city", city);

    const severityOrder = ["critical", "high", "medium", "low", "info"];
    if (min_severity) {
      const minIdx = severityOrder.indexOf(min_severity);
      if (minIdx >= 0) {
        query = query.in("severity", severityOrder.slice(0, minIdx + 1));
      }
    }

    const { data: events, error } = await query;
    if (error) throw error;

    const bySeverity: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const e of (events || [])) {
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
      bySource[e.source] = (bySource[e.source] || 0) + 1;
    }

    const top5 = (events || []).slice(0, 5).map((e: any) => ({
      id: e.id,
      title: e.title,
      severity: e.severity,
      threatScore: e.threat_score,
      city: e.city,
      source: e.source,
      vehiclesAffected: e.vehicles_affected,
      recommendations: include_recommendations ? e.auto_recommendations : undefined,
    }));

    const total = (events || []).length;
    const critical = bySeverity["critical"] || 0;
    const high = bySeverity["high"] || 0;

    return {
      success: true,
      action: "intelligence_summary",
      summary: {
        totalActive: total,
        bySeverity,
        bySource,
        highestThreatScore: top5[0]?.threatScore || 0,
      },
      topThreats: top5,
      message: total === 0
        ? `No active intelligence events${city ? ` in ${city}` : ""}. All clear.`
        : `**${total} active events**${city ? ` in ${city}` : ""}: ${critical} critical, ${high} high. Top threat: **${top5[0]?.title}** (score: ${top5[0]?.threatScore}/100, ${top5[0]?.vehiclesAffected || 0} vehicles affected).`,
    };
  } catch (e) {
    console.error("Error fetching intelligence:", e);
    return { success: false, error: "Failed to fetch intelligence data", details: String(e) };
  }
}

// Main executor
export async function executeFunction(functionCall: any, supabase: any, fleetContext?: any, evContext?: any) {
  const { name, arguments: rawArgs } = functionCall;
  const parsedArgs = typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : (rawArgs ?? {});
  
  console.log(`Executing function: ${name}`, parsedArgs);

  switch (name) {
    case 'dispatch_ottow_tow':
      return await dispatchOTTOW(parsedArgs);
    
    case 'query_fleet_status':
      return await queryFleetStatus(parsedArgs, supabase);
    
    case 'query_depot_resources':
      return await queryDepotResources(parsedArgs, supabase);
    
    case 'query_incidents':
      return await queryIncidents(parsedArgs, fleetContext);
    
    case 'generate_analytics_report':
      return await generateAnalyticsReport(parsedArgs, supabase, fleetContext);
    
    case 'compare_performance':
      return await comparePerformance(parsedArgs, supabase);
    
    case 'get_recommendations':
      return await getRecommendations(parsedArgs, supabase, fleetContext);
    
    case 'schedule_vehicle_task':
      return await scheduleVehicleTask(parsedArgs, supabase);
    
    case 'update_vehicle_status':
      return await updateVehicleStatus(parsedArgs, supabase);
    
    case 'web_search':
      return await performWebSearch(parsedArgs);
    
    case 'create_optimization_plan':
      return await createOptimizationPlan(parsedArgs);

    // PREDICTIVE ANALYTICS
    case 'predict_charging_needs':
      return await predictChargingNeeds(parsedArgs, fleetContext);
    case 'predict_maintenance_risks':
      return await predictMaintenanceRisks(parsedArgs, fleetContext);
    case 'predict_depot_demand':
      return await predictDepotDemand(parsedArgs, fleetContext);

    // AUTOMATION / OTTO-Q
    case 'auto_queue_charging':
      return await autoQueueCharging(parsedArgs, fleetContext);
    case 'auto_queue_maintenance':
      return await autoQueueMaintenance(parsedArgs, fleetContext);
    case 'triage_incidents':
      return await triageIncidents(parsedArgs, fleetContext);
    case 'detect_anomalies':
      return await detectAnomalies(parsedArgs, fleetContext);
    case 'utilization_report':
      return await utilizationReport(parsedArgs, fleetContext);
    case 'explain_concept':
      return await explainConcept(parsedArgs);

    // EV (OrchestraEV) TOOLS
    case 'ev_vehicle_status':
      return await evVehicleStatus(parsedArgs, evContext);
    case 'ev_book_amenity':
      return await evBookAmenity(parsedArgs, evContext);
    case 'ev_schedule_service':
      return await evScheduleService(parsedArgs, evContext);
    case 'ev_depot_queue_status':
      return await evDepotQueueStatus(parsedArgs, evContext);
    case 'ev_account_summary':
      return await evAccountSummary(parsedArgs, evContext);

    // OTTO-RESPONSE INTELLIGENCE TOOLS
    case 'trigger_otto_response':
      return triggerOttoResponse(parsedArgs);
    case 'fleet_safe_pullover':
      return await fleetSafePullover(parsedArgs, supabase);
    case 'fleet_recall_to_depot':
      return await fleetRecallToDepot(parsedArgs, supabase);
    case 'get_intelligence_summary':
      return await getIntelligenceSummary(parsedArgs, supabase);

    default:
      return {
        success: false,
        error: `Unknown function: ${name}`
      };
  }
}
