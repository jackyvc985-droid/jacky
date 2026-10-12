export type Id = string;

export type Client = { id: Id; name: string; rfc: string; email: string; phone: string; status: 'Activo' | 'Inactivo'; notes: string };

export const DOC_CATEGORIES = [
  'Constancia de situación fiscal', 'Opinión de cumplimiento', 'Declaración', 'Acuse',
  'Comprobante de pago', 'CFDI/Factura', 'Nómina', 'Contrato',
] as const;
export type DocStatus = 'Pendiente' | 'En revisión' | 'Completo';
export type Doc = {
  id: Id; clientId: Id; category: string; period: string; name: string; mime: string; size: number;
  fileKey: string; status: DocStatus; createdAt: string; uploadedBy: 'despacho' | 'cliente';
};

export type Task = { id: Id; title: string; clientId: Id | ''; projectId: Id | ''; due: string; done: boolean };
export type Project = { id: Id; name: string; clientId: Id; status: 'Planeado' | 'En curso' | 'Terminado'; description: string };

export type MovementType = 'ingreso' | 'gasto';
export type Movement = { id: Id; date: string; type: MovementType; concept: string; category: string; amountCents: number; clientId: Id | '' };
export type Budget = { category: string; clientId: Id | ''; period: string; limitCents: number };
export type Payroll = { id: Id; employee: string; clientId: Id | ''; period: string; perceptionsCents: number; deductionsCents: number };
export type ObligationStatus = 'Pendiente' | 'Presentada' | 'Pagada';
export type Obligation = { id: Id; name: string; clientId: Id | ''; dueDate: string; amountCents: number; status: ObligationStatus };
export type Invite = { email: string; clientId: Id; createdAt: string };
export type Proposal = { plan: string; priceMXN: number; createdAt: string };

export type Data = {
  clients: Client[]; docs: Doc[]; tasks: Task[]; projects: Project[]; movements: Movement[];
  budgets: Budget[]; payrolls: Payroll[]; obligations: Obligation[]; invites: Invite[]; proposals: Proposal[];
};
export const emptyData = (): Data => ({
  clients: [], docs: [], tasks: [], projects: [], movements: [], budgets: [], payrolls: [], obligations: [], invites: [], proposals: [],
});
export type Mode = 'demo' | 'local';
