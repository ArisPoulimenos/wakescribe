import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface CharterReportData {
  brokerageName: string;
  charterCode: string;
  clientName: string;
  vesselName: string;
  lengthMeters: number;
  grossTonnage: number;
  fuelType: string;
  departurePort: string;
  arrivalPort: string;
  charterDays: number;
  distanceNm: number;
  cruisingSpeed: number;
  mainEngineLiters?: number;
  generatorLiters?: number;
  totalLiters: number;
  fuelConsumedMt: number;
  fuelPricePerLiter: number;
  estimatedFuelCost: number;
  co2EmissionsMt: number;
  carbonIntensityKgNm: number;
  carbonPrice: number;
  carbonCostEur: number;
  isMandatoryEuEts: boolean;
  apaReceived: number;
  expenses: { id: number; category: string; vendor: string; amount: number }[];
  apaBalance: number;
  ecoTipCategory: string;
  ecoTipText: string;
}

const fmtEur = (n: number) =>
  `EUR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function generateCharterPdf(data: CharterReportData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const navy: [number, number, number] = [10, 22, 40];
  const slateDark: [number, number, number] = [30, 41, 59];
  const slateMuted: [number, number, number] = [100, 116, 139];
  const gold: [number, number, number] = [197, 160, 89];
  const teal: [number, number, number] = [13, 148, 136];
  const indigo: [number, number, number] = [79, 70, 229];
  const lightBg: [number, number, number] = [248, 250, 252];

  const totalOtherExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalSpent = data.estimatedFuelCost + totalOtherExpenses;

  // =========================================================================
  // PAGE 1: EXECUTIVE APA & BUNKER SETTLEMENT STATEMENT
  // =========================================================================
  doc.setFillColor(...navy);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setFillColor(...gold);
  doc.rect(0, 36, 210, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text((data.brokerageName || 'CHARTER MANAGEMENT').toUpperCase(), 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text('ADVANCE PROVISIONING ALLOWANCE (APA) & BUNKER SETTLEMENT', 14, 24);
  doc.text('OFFICIAL FINANCIAL STATEMENT FOR CHARTERER & OWNER', 14, 30);

  doc.setTextColor(...gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`REF: ${data.charterCode}`, 196, 16, { align: 'right' });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    196,
    23,
    { align: 'right' }
  );
  doc.text('Currency: EUR', 196, 29, { align: 'right' });

  // 4 KPI Cards
  const kpis = [
    { label: 'APA RECEIVED', value: fmtEur(data.apaReceived), accent: navy },
    { label: 'BUNKER & FUEL', value: fmtEur(data.estimatedFuelCost), accent: teal },
    { label: 'PORT & OPS COSTS', value: fmtEur(totalOtherExpenses), accent: indigo },
    {
      label: data.apaBalance >= 0 ? 'CLIENT REFUND DUE' : 'BALANCE PAYABLE',
      value: fmtEur(Math.abs(data.apaBalance)),
      accent: data.apaBalance >= 0 ? teal : ([185, 28, 28] as [number, number, number]),
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * 46.5;
    doc.setFillColor(...lightBg);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 43, 43.5, 19, 1.5, 1.5, 'FD');
    doc.setFillColor(...kpi.accent);
    doc.rect(x, 43, 43.5, 1.5, 'F');

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slateMuted);
    doc.text(kpi.label, x + 3, 49.5);

    doc.setFontSize(9.2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.accent);
    doc.text(kpi.value, x + 3, 57.5);
  });

  // Visual APA Allocation Bar
  const barY = 67;
  const barW = 182;
  const safeTotal = Math.max(data.apaReceived, totalSpent, 1);
  const fuelW = (data.estimatedFuelCost / safeTotal) * barW;
  const opsW = (totalOtherExpenses / safeTotal) * barW;
  const remW = Math.max(0, barW - fuelW - opsW);

  doc.setFillColor(226, 232, 240);
  doc.roundedRect(14, barY, barW, 4, 1, 1, 'F');
  if (fuelW > 0) {
    doc.setFillColor(...teal);
    doc.rect(14, barY, fuelW, 4, 'F');
  }
  if (opsW > 0) {
    doc.setFillColor(...indigo);
    doc.rect(14 + fuelW, barY, opsW, 4, 'F');
  }
  if (remW > 0) {
    doc.setFillColor(203, 213, 225);
    doc.rect(14 + fuelW + opsW, barY, remW, 4, 'F');
  }

  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateMuted);
  doc.text(
    `APA Allocation: Fuel ${((data.estimatedFuelCost / safeTotal) * 100).toFixed(0)}%  |  Marinas & Ops ${((totalOtherExpenses / safeTotal) * 100).toFixed(0)}%  |  Unspent Balance ${((Math.max(0, data.apaBalance) / safeTotal) * 100).toFixed(0)}%`,
    14,
    barY + 8
  );

  // 1. Vessel & Voyage Particulars
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...navy);
  doc.text('1. VESSEL & VOYAGE PARTICULARS', 14, 83);

  autoTable(doc, {
    startY: 86,
    theme: 'grid',
    styles: { fontSize: 8.2, cellPadding: 2.6, lineColor: [226, 232, 240], textColor: slateDark },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: lightBg, cellWidth: 34 },
      1: { cellWidth: 57 },
      2: { fontStyle: 'bold', fillColor: lightBg, cellWidth: 34 },
      3: { cellWidth: 57 },
    },
    body: [
      ['Yacht Name', data.vesselName, 'Charterer', data.clientName],
      ['Dimensions', `${data.lengthMeters}m LOA | ${data.grossTonnage} GT`, 'Duration', `${data.charterDays} Days (${data.distanceNm} NM)`],
      ['Route', `${data.departurePort} to ${data.arrivalPort}`, 'Avg. Speed', `${data.cruisingSpeed} Knots`],
      ['Fuel Spec', data.fuelType === 'HVO_Biofuel' ? 'HVO100 Biofuel' : 'Marine Gas Oil (MGO)', 'Fuel Rate', `EUR ${data.fuelPricePerLiter.toFixed(2)} / Liter`],
    ],
  });

  // 2. Itemized APA Disbursements
  const yAfterMeta = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...navy);
  doc.text('2. ITEMIZED APA DISBURSEMENTS & BUNKER ACCOUNT', 14, yAfterMeta);

  const ledgerRows = [
    [
      '01',
      'Bunker & Fuel',
      `Main Engines & Generators (${Math.round(data.totalLiters).toLocaleString()} L @ EUR ${data.fuelPricePerLiter.toFixed(2)}/L)`,
      fmtEur(data.estimatedFuelCost),
    ],
    ...data.expenses.map((exp, i) => [
      String(i + 2).padStart(2, '0'),
      exp.category.replace('_', ' '),
      exp.vendor,
      fmtEur(exp.amount),
    ]),
  ];

  autoTable(doc, {
    startY: yAfterMeta + 3,
    head: [['#', 'Category', 'Supplier / Description', 'Amount']],
    body: ledgerRows,
    theme: 'striped',
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontSize: 8.2, fontStyle: 'bold' },
    styles: { fontSize: 8.2, cellPadding: 2.8, textColor: slateDark },
    alternateRowStyles: { fillColor: lightBg },
    columnStyles: {
      0: { cellWidth: 11, halign: 'center' },
      1: { cellWidth: 38, fontStyle: 'bold' },
      2: { cellWidth: 95 },
      3: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
    },
  });

  // Settlement Totals Box
  const yAfterLedger = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: yAfterLedger,
    margin: { left: 100 },
    theme: 'grid',
    styles: { fontSize: 8.8, cellPadding: 2.8, lineColor: [203, 213, 225] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: lightBg, textColor: slateDark },
      1: { halign: 'right', fontStyle: 'bold', textColor: navy },
    },
    body: [
      ['Total APA Received', fmtEur(data.apaReceived)],
      ['Total Disbursements', fmtEur(totalSpent)],
      [
        data.apaBalance >= 0 ? 'Net Refund to Charterer' : 'Net Balance Due',
        fmtEur(Math.abs(data.apaBalance)),
      ],
    ],
  });

  // Dynamic Sign-off Section (always safely below totals table)
  const yAfterTotals = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  const signY = Math.min(Math.max(yAfterTotals, 235), 265);
  doc.setDrawColor(148, 163, 184);
  doc.line(14, signY, 86, signY);
  doc.line(124, signY, 196, signY);

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...slateMuted);
  doc.text('APPROVED BY: MASTER / CAPTAIN', 14, signY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.text(data.vesselName, 14, signY + 8.5);

  doc.setFont('helvetica', 'bold');
  doc.text('ACKNOWLEDGED BY: CHARTERER / BROKER', 124, signY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientName, 124, signY + 8.5);

  doc.setFontSize(7.5);
  doc.text(`Page 1 of 2  |  ${data.brokerageName}  |  Ref: ${data.charterCode}`, 105, 287, { align: 'center' });

  // =========================================================================
  // PAGE 2: VOYAGE SUSTAINABILITY & CARBON FOOTPRINT CERTIFICATE
  // =========================================================================
  doc.addPage();

  doc.setFillColor(...navy);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setFillColor(...teal);
  doc.rect(0, 36, 210, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text((data.brokerageName || 'CHARTER MANAGEMENT').toUpperCase(), 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(94, 234, 212);
  doc.text('VOYAGE GREENHOUSE GAS (GHG) & SUSTAINABILITY CERTIFICATE', 14, 24);
  doc.setTextColor(203, 213, 225);
  doc.text('ALIGNED WITH IMO MEPC, EU MRV & ISO 14064-1 FRAMEWORKS', 14, 30);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`CERT: ESG-${data.charterCode}`, 196, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Vessel: ${data.vesselName} (${data.lengthMeters}m)`, 196, 23, { align: 'right' });
  doc.text(`${data.departurePort} to ${data.arrivalPort}`, 196, 29, { align: 'right' });

  // Benchmark Banner with Visual Comparison Bar
  const fleetBenchmarkKgNm = data.lengthMeters * 4.6;
  const diffPct =
    fleetBenchmarkKgNm > 0 ? ((fleetBenchmarkKgNm - data.carbonIntensityKgNm) / fleetBenchmarkKgNm) * 100 : 0;
  const isBetterThanBenchmark = diffPct >= 0;

  doc.setFillColor(...lightBg);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 44, 182, 30, 2, 2, 'FD');

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...slateMuted);
  doc.text('VOYAGE CARBON INTENSITY RATING', 20, 51);

  doc.setFontSize(14);
  doc.setTextColor(...(isBetterThanBenchmark ? teal : ([217, 119, 6] as [number, number, number])));
  doc.text(`${data.carbonIntensityKgNm.toFixed(1)} kg CO2 / NM`, 20, 60);

  // Visual Benchmark Gauge
  const maxGauge = Math.max(fleetBenchmarkKgNm * 1.3, data.carbonIntensityKgNm * 1.1, 1);
  const vesselBarW = (data.carbonIntensityKgNm / maxGauge) * 106;
  const benchMarkX = 82 + (fleetBenchmarkKgNm / maxGauge) * 106;

  doc.setFillColor(226, 232, 240);
  doc.roundedRect(82, 50, 106, 4.5, 1, 1, 'F');
  doc.setFillColor(...(isBetterThanBenchmark ? teal : ([217, 119, 6] as [number, number, number])));
  doc.roundedRect(82, 50, vesselBarW, 4.5, 1, 1, 'F');
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.6);
  doc.line(benchMarkX, 48.5, benchMarkX, 56);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateDark);
  const benchmarkText = isBetterThanBenchmark
    ? `${Math.abs(diffPct).toFixed(0)}% lower carbon intensity than Med ${data.lengthMeters}m class benchmark (${fleetBenchmarkKgNm.toFixed(1)} kg/NM).`
    : `Med ${data.lengthMeters}m class benchmark is ${fleetBenchmarkKgNm.toFixed(1)} kg/NM. Speed optimization cuts intensity by 12-18%.`;
  doc.text(benchmarkText, 82, 62, { maxWidth: 106 });

  // 1. GHG Inventory Table
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...navy);
  doc.text('1. VOYAGE ENERGY & GHG EMISSIONS INVENTORY', 14, 84);

  const mainL = data.mainEngineLiters ?? data.totalLiters * 0.6;
  const genL = data.generatorLiters ?? data.totalLiters * 0.4;
  const factor = data.fuelType === 'HVO_Biofuel' ? 0.48 : 3.206;

  autoTable(doc, {
    startY: 87,
    head: [['Emission Source', 'Fuel Consumed', 'CO2e Output', 'Operational Profile']],
    body: [
      [
        'Main Propulsion Engines',
        `${Math.round(mainL).toLocaleString()} L (${((mainL * 0.85) / 1000).toFixed(2)} MT)`,
        `${(((mainL * 0.85) / 1000) * factor).toFixed(2)} tCO2`,
        `${data.distanceNm} NM @ ${data.cruisingSpeed} knots`,
      ],
      [
        'Auxiliary Generators (Hotel Load)',
        `${Math.round(genL).toLocaleString()} L (${((genL * 0.85) / 1000).toFixed(2)} MT)`,
        `${(((genL * 0.85) / 1000) * factor).toFixed(2)} tCO2`,
        `${data.charterDays * 24} Operating Hours`,
      ],
      [
        'Total Voyage Footprint',
        `${Math.round(data.totalLiters).toLocaleString()} L (${data.fuelConsumedMt.toFixed(2)} MT)`,
        `${data.co2EmissionsMt.toFixed(2)} tCO2`,
        data.fuelType === 'HVO_Biofuel' ? '0.48 tCO2/t (HVO100)' : '3.206 tCO2/t (IMO MGO)',
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: teal, textColor: [255, 255, 255], fontSize: 8.2 },
    styles: { fontSize: 8.2, cellPadding: 2.8, textColor: slateDark },
    columnStyles: { 2: { fontStyle: 'bold' } },
  });

  // 2. Carbon Valuation & HVO Scenario
  const yAfterGhg = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...navy);
  doc.text('2. CARBON MARKET VALUATION & DECARBONIZATION SCENARIO', 14, yAfterGhg);

  const hvoSavingsMt = data.fuelType === 'MGO' ? data.fuelConsumedMt * (3.206 - 0.48) : 0;

  autoTable(doc, {
    startY: yAfterGhg + 3,
    head: [['Carbon Mechanism', 'Valuation / Impact', 'Regulatory & Charter Application']],
    body: [
      [
        data.isMandatoryEuEts ? 'EU ETS Liability (>=5,000 GT)' : 'Verified Carbon Offset',
        fmtEur(data.carbonCostEur),
        `Indexed to EU ETS (EUA) market rate of EUR ${data.carbonPrice.toFixed(2)} / tCO2`,
      ],
      [
        'HVO100 Biofuel Potential',
        data.fuelType === 'MGO' ? `-${hvoSavingsMt.toFixed(2)} tCO2 (-85%)` : 'Active (-85% CO2)',
        data.fuelType === 'MGO'
          ? 'Drop-in HVO100 renewable diesel eliminates 85% of lifecycle GHG emissions without engine modification.'
          : 'Voyage operated on HVO100 renewable fuel, achieving an 85% lifecycle carbon reduction.',
      ],
    ],
    theme: 'striped',
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontSize: 8.2 },
    styles: { fontSize: 8.2, cellPadding: 2.8, textColor: slateDark },
    columnStyles: { 1: { fontStyle: 'bold', textColor: teal, cellWidth: 42 } },
  });

  // Operational Efficiency Advisory
  const yAfterCarbon = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(...teal);
  doc.roundedRect(14, yAfterCarbon, 182, 24, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...teal);
  doc.text(`OPERATIONAL EFFICIENCY ADVISORY | ${data.ecoTipCategory.toUpperCase()}`, 18, yAfterCarbon + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(...slateDark);
  doc.text(data.ecoTipText, 18, yAfterCarbon + 13.5, { maxWidth: 174 });

  // Disclosures Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 255, 196, 255);
  doc.setFontSize(7.4);
  doc.setTextColor(...slateMuted);
  const disclaimers = [
    'METHODOLOGY & COMPLIANCE DISCLOSURES:',
    '- Fuel-to-CO2 factors follow IMO Fourth GHG Study / MEPC guidelines (3.206 tCO2/t for MGO/MDO; 0.48 tCO2/t lifecycle equivalent for HVO100).',
    '- Voluntary carbon offsetting and EU ETS cost allocations are benchmarked against European Union Allowance (EUA) market pricing.',
    `- Issued by ${data.brokerageName} Sustainability Desk  |  Certificate Ref: ESG-${data.charterCode}`,
  ];
  doc.text(disclaimers, 14, 260, { maxWidth: 182 });

  doc.text(`Page 2 of 2  |  ${data.brokerageName}`, 105, 287, { align: 'center' });

  doc.save(`${data.charterCode}_${data.vesselName.replace(/\s+/g, '_')}_Executive_Report.pdf`);
}
