export interface IncidentReportData {
  incidentId: string;
  reportDate: string;
  narrative: string;
  recommendations: string[];
  [key: string]: any;
}

export function generateIncidentReportData(incident: any, ...args: any[]): IncidentReportData {
  return {
    incidentId: incident?.id || 'unknown',
    reportDate: new Date().toISOString(),
    narrative: 'Report pending — data not available',
    recommendations: [],
  };
}
