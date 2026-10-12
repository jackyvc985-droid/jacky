export type Id = string;

export type Client = { id: Id; name: string; rfc: string; email: string; phone: string; status: 'Activo' | 'Inactivo'; notes: string };

export const DOC_CATEGORIES = [
  'Constancia de situación fiscal', 'Opinión de cumplimiento', 'Declaración', 'Acuse',
  'Comprobante de pago', 'CFDI/Factura', 'Nómina', 'Contrato', 'Estado de cuenta',
] as const;
export type DocStatus = 'Pendiente' | 'En revisión' | 'Completo';
export type Doc = {
  id: Id; clientId: Id; category: string; period: string; name: string; mime: string; size: number;
  fileKey: string; status: DocStatus; createdAt: string; uploadedBy: 'despacho' | 'cliente';
  sha256?: string; // huella calculada por el servidor al recibir el archivo
};

export type Task = { id: Id; title: string; clientId: Id | ''; projectId: Id | ''; due: string; done: boolean };
export type Project = { id: Id; name: string; clientId: Id; status: 'Planeado' | 'En curso' | 'Terminado'; description: string };

export type MovementType = 'ingreso' | 'gasto';
export type Movement = { id: Id; date: string; type: MovementType; concept: string; category: string; amountCents: number; clientId: Id | '' };
export type Budget = { category: string; clientId: Id | ''; period: string; limitCents: number };
export type PayrollDetail = {
  salaryCents: number; otherTaxableCents: number; exemptCents: number; taxableCents: number;
  isr: { lowerCents: number; upperCents: number | null; excessCents: number; rateBp: number; marginalCents: number; fixedCents: number; causedCents: number };
  subsidyLimitCents: number;
  dailySalaryCents: number; sbcDailyCents: number; integrationFactor: number; days: number; umaDailyCents: number;
  imssItems: { label: string; baseCents: number; rateBp: number; cents: number }[];
};
export type PayrollCalc = {
  isrCents: number; imssCents: number; subsidyAppliedCents: number; otherCents: number; tablesYear: number;
  detail?: PayrollDetail; // desglose paso a paso (nóminas calculadas antes de esta versión no lo tienen)
};
export type Payroll = {
  id: Id; employee: string; clientId: Id | ''; period: string; perceptionsCents: number; deductionsCents: number;
  /** Subsidio para el empleo que excede el ISR y se entrega al trabajador (solo cálculo automático). */
  subsidyPaidCents?: number;
  calc?: PayrollCalc; // presente cuando se calculó con las tablas
};
export type ObligationStatus = 'Pendiente' | 'Presentada' | 'Pagada';
export type Obligation = { id: Id; name: string; clientId: Id | ''; dueDate: string; amountCents: number; status: ObligationStatus };
/** Cobro o pago esperado. Previsión, no saldo bancario ni movimiento registrado. */
export type ForecastStatus = 'Pendiente' | 'Liquidado' | 'Cancelado';
export type Forecast = { id: Id; concept: string; kind: 'cobro' | 'pago'; amountCents: number; dueDate: string; clientId: Id | ''; category: string; status: ForecastStatus; note: string };
export type Invite = { email: string; clientId: Id; createdAt: string };
export type Proposal = { plan: string; priceMXN: number; createdAt: string };

export type Data = {
  clients: Client[]; docs: Doc[]; tasks: Task[]; projects: Project[]; movements: Movement[];
  budgets: Budget[]; payrolls: Payroll[]; obligations: Obligation[]; forecasts: Forecast[]; invites: Invite[]; proposals: Proposal[];
};
export const emptyData = (): Data => ({
  clients: [], docs: [], tasks: [], projects: [], movements: [], budgets: [], payrolls: [], obligations: [], forecasts: [], invites: [], proposals: [],
});
export type Mode = 'demo' | 'local' | 'cloud';
