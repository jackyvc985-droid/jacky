/**
 * Cálculo de nómina mensual (sueldos y salarios) con tablas 2026.
 * Fuentes: Anexo 8 RMF 2026 (DOF 28-12-2025) para la tarifa mensual del Art. 96 LISR;
 * UMA 2026 (INEGI, vigente 1-feb-2026); Subsidio para el empleo 2026 (15.02 % de la UMA mensual);
 * cuotas obrero-patronales IMSS 2026.
 * Las cifras se tomaron de publicaciones secundarias cotejadas entre sí (no del DOF directamente):
 * un contador debe validarlas antes de usarlas en una operación formal.
 * Importes en centavos; porcentajes en puntos base (1 % = 100 pb).
 */
export type IsrRow = { lower: number; upper: number; fixed: number; rateBp: number };

export const TABLES_2026 = {
  year: 2026,
  validatedByAccountant: false,
  umaDaily: 11731,
  isrMonthly: [
    { lower: 1, upper: 84459, fixed: 0, rateBp: 192 },
    { lower: 84460, upper: 716851, fixed: 1622, rateBp: 640 },
    { lower: 716852, upper: 1259802, fixed: 42095, rateBp: 1088 },
    { lower: 1259803, upper: 1464464, fixed: 101168, rateBp: 1600 },
    { lower: 1464465, upper: 1753364, fixed: 133914, rateBp: 1792 },
    { lower: 1753365, upper: 3536283, fixed: 185684, rateBp: 2136 },
    { lower: 3536284, upper: 5573668, fixed: 566516, rateBp: 2352 },
    { lower: 5573669, upper: 10641050, fixed: 1045709, rateBp: 3000 },
    { lower: 10641051, upper: 14188066, fixed: 2565923, rateBp: 3200 },
    { lower: 14188067, upper: 42564199, fixed: 3700969, rateBp: 3400 },
    { lower: 42564200, upper: Infinity, fixed: 13348854, rateBp: 3500 },
  ] as IsrRow[],
  /** Subsidio para el empleo mensual (feb–dic): 15.02 % de la UMA mensual; aplica si el ingreso mensual ≤ límite. */
  subsidioMonthly: 53565,
  subsidioIncomeLimit: 1149266,
  imss: {
    excedente3UmaBp: 40,        // 0.40 % sobre (SBC − 3 UMA)
    fixedObreroBp: 25 + 37.5 + 62.5 + 112.5, // prestaciones en dinero 0.25 + gastos médicos pensionados 0.375 + invalidez y vida 0.625 + cesantía y vejez 1.125 = 2.375 %
    sbcCapUma: 25,
  },
  defaultIntegrationFactor: 1.0493, // 15 días aguinaldo, 12 días vacaciones, 25 % prima vacacional (mínimos de ley)
};

export const isrRow = (base: number, rows = TABLES_2026.isrMonthly): IsrRow => {
  let r = rows[0];
  for (const x of rows) if (base >= x.lower) r = x;
  return r;
};

/** ISR mensual antes de subsidio: cuota fija + (base − límite inferior) × tasa. */
export function isrMonthly(baseCents: number): number {
  if (baseCents <= 0) return 0;
  const r = isrRow(baseCents);
  return r.fixed + Math.round(((baseCents - r.lower) * r.rateBp) / 10000);
}

export type PayrollInput = {
  perceptionsCents: number;     // percepciones gravadas del mes
  dailySalaryCents: number;     // salario diario (para SBC)
  days: number;                 // días del periodo (IMSS)
  integrationFactor?: number;
  otherDeductionsCents?: number; // INFONAVIT/pensión alimenticia/etc. capturadas
};
export type PayrollBreakdown = {
  isrBeforeSubsidy: number; subsidyApplied: number; isrWithheld: number; subsidyPaid: number;
  imss: number; sbcDaily: number; other: number; deductionsTotal: number; net: number; tablesYear: number;
};

export function calcPayroll(i: PayrollInput): PayrollBreakdown {
  const T = TABLES_2026;
  const isr = isrMonthly(i.perceptionsCents);
  const sub = i.perceptionsCents > 0 && i.perceptionsCents <= T.subsidioIncomeLimit ? T.subsidioMonthly : 0;
  const isrWithheld = Math.max(0, isr - sub);
  const subsidyPaid = Math.max(0, sub - isr); // excedente de subsidio que se entrega al trabajador
  const factor = i.integrationFactor ?? T.defaultIntegrationFactor;
  const sbcDaily = Math.min(Math.round(i.dailySalaryCents * factor), T.imss.sbcCapUma * T.umaDaily);
  const excess = Math.max(0, sbcDaily - 3 * T.umaDaily);
  const imss = Math.round((excess * T.imss.excedente3UmaBp * i.days) / 10000) + Math.round((sbcDaily * T.imss.fixedObreroBp * i.days) / 10000);
  const other = i.otherDeductionsCents ?? 0;
  const deductionsTotal = isrWithheld + imss + other;
  return { isrBeforeSubsidy: isr, subsidyApplied: sub, isrWithheld, subsidyPaid, imss, sbcDaily, other, deductionsTotal, net: i.perceptionsCents - deductionsTotal + subsidyPaid, tablesYear: T.year };
}
