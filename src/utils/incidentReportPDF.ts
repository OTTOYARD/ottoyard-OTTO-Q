import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Incident } from '@/types/incidents';
import { IncidentReportData, generateIncidentReportData } from '@/types/incidentReport';
import { supabase } from '@/integrations/supabase/client';

interface GeneratePDFOptions {
  incident: Incident;
  narrative?: string;
}

// Format date for display
function formatDate(isoString: string | null): string {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatShortDate(isoString: string | null): string {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Load logo as base64
async function loadLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch('/ottoyard-logo-report.png');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load logo:', error);
    return null;
  }
}

// Generate AI narrative via edge function
async function generateNarrative(incident: Incident, reportData: IncidentReportData): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-incident-report', {
      body: {
        incident: {
          incidentId: incident.incidentId,
          vehicleId: incident.vehicleId,
          city: incident.city,
          type: incident.type,
          summary: incident.summary,
          location: incident.location,
          timestamps: incident.timestamps,
          tow: incident.tow,
          timeline: incident.timeline,
          report: incident.report,
          reportData: {
            vehicle: reportData.vehicle,
            depot: reportData.depot,
            repair: reportData.repair,
            insurance: reportData.insurance,
            responseMetrics: reportData.responseMetrics,
            thirdPartyInvolved: reportData.thirdPartyInvolved,
            thirdPartyDetails: reportData.thirdPartyDetails,
            policeReportFiled: reportData.policeReportFiled,
            policeReportNumber: reportData.policeReportNumber,
            dashcamFootageAvailable: reportData.dashcamFootageAvailable,
            photosCollected: reportData.photosCollected,
          },
        },
      },
    });

    if (error) {
      console.error('Error generating narrative:', error);
      return generateFallbackNarrative(incident, reportData);
    }

    return data?.narrative || generateFallbackNarrative(incident, reportData);
  } catch (error) {
    console.error('Failed to generate AI narrative:', error);
    return generateFallbackNarrative(incident, reportData);
  }
}

// Fallback narrative if AI fails
function generateFallbackNarrative(incident: Incident, reportData: IncidentReportData): string {
  const typeLabels: Record<string, string> = {
    collision: 'collision incident',
    malfunction: 'technical malfunction',
    interior: 'interior incident',
    vandalism: 'vandalism incident',
  };

  return `This incident report documents ${typeLabels[incident.type] || 'incident'} ${incident.incidentId} involving autonomous vehicle ${incident.vehicleId} (${reportData.vehicle.make} ${reportData.vehicle.model}, VIN: ${reportData.vehicle.vin}).

The incident was reported on ${formatDate(incident.timestamps.reportedAt)} at ${incident.location.addr}. ${incident.summary}

OTTOW recovery services were dispatched with truck ${incident.tow.truckId || 'N/A'} operated by ${incident.tow.driver || 'N/A'}. The vehicle was secured and transported to ${reportData.depot.depotName} (${reportData.depot.address}), arriving at stall ${reportData.depot.stallNumber}.

${reportData.repair.requiresRepair ? `The vehicle requires ${reportData.repair.severity} repairs with an estimated downtime of ${reportData.repair.estimatedDowntimeHours} hours and repair cost of $${reportData.repair.estimatedCost.toLocaleString()}.` : 'No significant repairs are required.'}

${reportData.policeReportFiled ? `A police report was filed (Report #: ${reportData.policeReportNumber}).` : ''} ${reportData.dashcamFootageAvailable ? 'Dashcam footage is available for review.' : ''} ${reportData.photosCollected} photos were collected at the scene.

This report is provided for insurance and regulatory purposes. All information is accurate as of the incident closure date.`;
}

export async function generateIncidentPDF({ incident }: GeneratePDFOptions): Promise<void> {
  // Generate report data
  const reportData = generateIncidentReportData(
    incident.vehicleId,
    incident.city,
    incident.type,
    incident.timestamps
  );

  // Load logo and generate narrative in parallel
  const [logoBase64, narrative] = await Promise.all([
    loadLogoBase64(),
    generateNarrative(incident, reportData),
  ]);

  // Create PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Add logo
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, yPos, 40, 40);
      yPos += 12;
    } catch (e) {
      console.error('Failed to add logo to PDF:', e);
    }
  }

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('INCIDENT REPORT', pageWidth / 2 + 10, yPos + 8, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Autonomous Fleet Management Division', pageWidth / 2 + 10, yPos + 16, { align: 'center' });
  doc.text(`Report Generated: ${formatDate(new Date().toISOString())}`, pageWidth / 2 + 10, yPos + 22, { align: 'center' });
  
  yPos += 45;

  // Incident ID and Status Banner
  doc.setFillColor(200, 50, 50);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 12, 'F');
  doc.setTextColor(255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`INCIDENT: ${incident.incidentId}`, margin + 5, yPos + 8);
  doc.text(`STATUS: CLOSED`, pageWidth - margin - 5, yPos + 8, { align: 'right' });
  
  yPos += 20;
  doc.setTextColor(0);

  // Incident Summary Section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('INCIDENT SUMMARY', margin, yPos);
  yPos += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  const summaryData = [
    ['Incident Type:', incident.type.charAt(0).toUpperCase() + incident.type.slice(1)],
    ['Description:', incident.summary],
    ['Location:', incident.location.addr],
    ['Coordinates:', `${incident.location.lat.toFixed(6)}, ${incident.location.lon.toFixed(6)}`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: summaryData,
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin },
    styles: { fontSize: 9, cellPadding: 1.5 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Vehicle Information Section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('VEHICLE INFORMATION', margin, yPos);
  yPos += 6;

  const vehicleData = [
    ['Vehicle ID:', reportData.vehicle.vehicleId],
    ['Make/Model:', `${reportData.vehicle.make} ${reportData.vehicle.model} (${reportData.vehicle.year})`],
    ['VIN:', reportData.vehicle.vin],
    ['License Plate:', reportData.vehicle.licensePlate],
    ['Odometer:', `${reportData.vehicle.odometerKm.toLocaleString()} km`],
    ['Last Service:', reportData.vehicle.lastServiceDate],
    ['Battery Health:', `${reportData.vehicle.batteryHealth}%`],
    ['Sensor Status:', reportData.vehicle.sensorStatus.toUpperCase()],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: vehicleData,
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin },
    styles: { fontSize: 9, cellPadding: 1.5 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Timeline Section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('INCIDENT TIMELINE', margin, yPos);
  yPos += 6;

  const timelineData = [
    ['Reported:', formatDate(incident.timestamps.reportedAt)],
    ['Dispatched:', formatDate(incident.timestamps.dispatchedAt)],
    ['Secured:', formatDate(incident.timestamps.securedAt)],
    ['At Depot:', formatDate(incident.timestamps.atDepotAt)],
    ['Closed:', formatDate(incident.timestamps.closedAt)],
    ['Total Response Time:', `${reportData.responseMetrics.totalResponseMinutes} minutes`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: timelineData,
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin },
    styles: { fontSize: 9, cellPadding: 1.5 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Check if we need a new page
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }

  // Recovery Operations Section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RECOVERY OPERATIONS', margin, yPos);
  yPos += 6;

  const recoveryData = [
    ['Provider:', incident.tow.provider],
    ['Truck ID:', incident.tow.truckId || 'N/A'],
    ['Driver:', incident.tow.driver || 'N/A'],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: recoveryData,
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin },
    styles: { fontSize: 9, cellPadding: 1.5 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Current Vehicle Location Section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CURRENT VEHICLE LOCATION', margin, yPos);
  yPos += 6;

  const depotData = [
    ['Depot:', reportData.depot.depotName],
    ['Address:', `${reportData.depot.address}, ${reportData.depot.city}`],
    ['Stall Number:', reportData.depot.stallNumber],
    ['Stall Type:', reportData.depot.stallType.charAt(0).toUpperCase() + reportData.depot.stallType.slice(1)],
    ['Arrival Time:', formatDate(reportData.depot.arrivalTime)],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: depotData,
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin },
    styles: { fontSize: 9, cellPadding: 1.5 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Check if we need a new page
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  // Repair Assessment Section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('REPAIR ASSESSMENT', margin, yPos);
  yPos += 6;

  const repairSummaryData = [
    ['Requires Repair:', reportData.repair.requiresRepair ? 'Yes' : 'No'],
    ['Severity:', reportData.repair.severity.toUpperCase()],
    ['Estimated Downtime:', `${reportData.repair.estimatedDowntimeHours} hours`],
    ['Estimated Cost:', `$${reportData.repair.estimatedCost.toLocaleString()}`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: repairSummaryData,
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin },
    styles: { fontSize: 9, cellPadding: 1.5 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 4;

  // Repair Items Table
  if (reportData.repair.repairItems.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Repair Items:', margin, yPos + 4);
    yPos += 6;

    const repairItemsTableData = reportData.repair.repairItems.map(item => [
      item.component,
      item.issue,
      item.priority.toUpperCase(),
      `${item.estimatedHours} hrs`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Component', 'Issue', 'Priority', 'Est. Hours']],
      body: repairItemsTableData,
      theme: 'striped',
      headStyles: { fillColor: [80, 80, 80], fontSize: 8 },
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 4;
  }

  // Technician Notes
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Technician Notes:', margin, yPos + 4);
  yPos += 8;
  
  doc.setFont('helvetica', 'italic');
  const techNotes = doc.splitTextToSize(reportData.repair.technicianNotes, pageWidth - 2 * margin);
  doc.text(techNotes, margin, yPos);
  yPos += techNotes.length * 4 + 8;

  // Check if we need a new page for narrative
  if (yPos > 160) {
    doc.addPage();
    yPos = 20;
  }

  // Additional Information Section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ADDITIONAL INFORMATION', margin, yPos);
  yPos += 6;

  const additionalData = [
    ['Third Party Involved:', reportData.thirdPartyInvolved ? 'Yes' : 'No'],
    ...(reportData.thirdPartyDetails ? [['Third Party Details:', reportData.thirdPartyDetails]] : []),
    ['Police Report Filed:', reportData.policeReportFiled ? 'Yes' : 'No'],
    ...(reportData.policeReportNumber ? [['Police Report #:', reportData.policeReportNumber]] : []),
    ['Dashcam Footage:', reportData.dashcamFootageAvailable ? 'Available' : 'Not Available'],
    ['Photos Collected:', `${reportData.photosCollected}`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: additionalData as [string, string][],
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin },
    styles: { fontSize: 9, cellPadding: 1.5 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Insurance Information
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('INSURANCE INFORMATION', margin, yPos);
  yPos += 6;

  const insuranceData = [
    ['Provider:', reportData.insurance.provider],
    ['Policy Number:', reportData.insurance.policyNumber],
    ['Coverage Type:', reportData.insurance.coverageType],
    ...(reportData.insurance.claimNumber ? [['Claim Number:', reportData.insurance.claimNumber]] : []),
    ['Deductible:', `$${reportData.insurance.deductible.toLocaleString()}`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: insuranceData as [string, string][],
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin },
    styles: { fontSize: 9, cellPadding: 1.5 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Check if we need a new page for narrative
  if (yPos > 140) {
    doc.addPage();
    yPos = 20;
  }

  // Narrative Summary Section
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('INCIDENT NARRATIVE', margin + 3, yPos + 6);
  yPos += 12;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const narrativeLines = doc.splitTextToSize(narrative, pageWidth - 2 * margin);
  
  // Check if narrative needs new page
  const narrativeHeight = narrativeLines.length * 4;
  if (yPos + narrativeHeight > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.text(narrativeLines, margin, yPos);
  yPos += narrativeHeight + 10;

  // Event Log Section
  if (incident.timeline.length > 0) {
    // Check if we need a new page
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('EVENT LOG', margin, yPos);
    yPos += 6;

    const eventLogData = incident.timeline.map(entry => [
      formatShortDate(entry.ts),
      entry.status,
      entry.note,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Timestamp', 'Status', 'Description']],
      body: eventLogData,
      theme: 'striped',
      headStyles: { fillColor: [80, 80, 80], fontSize: 8 },
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
        2: { cellWidth: 'auto' },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128);
    
    // Footer line
    doc.setDrawColor(200);
    doc.line(margin, doc.internal.pageSize.getHeight() - 15, pageWidth - margin, doc.internal.pageSize.getHeight() - 15);
    
    // Footer text
    doc.text(
      `OTTOYARD Incident Report | ${incident.incidentId} | Confidential`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    );
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'right' }
    );
  }

  // Save the PDF
  const fileName = `OTTOYARD_Incident_Report_${incident.incidentId}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
