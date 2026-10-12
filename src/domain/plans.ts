/** Planes mensuales propuestos. Precios SIN IVA (supuesto a confirmar). No hay cobro ni suscripción activa. */
export const IVA_RATE_BP = 1600; // 16 %

export type Plan = {
  id: 'esencial' | 'profesional' | 'empresarial'; name: string; priceCents: number; fromPrice?: boolean;
  limits: { clients: number | null; staff: number; workers: number | null; storageGB: number };
  features: string[];
};

export const PLANS: Plan[] = [
  { id: 'esencial', name: 'Esencial', priceCents: 49900, limits: { clients: 10, staff: 1, workers: 15, storageGB: 2 },
    features: ['Expedientes, documentos, tareas y proyectos', 'Movimientos, CSV y estados de cuenta', 'Portal de clientes (documentos y pendientes)'] },
  { id: 'profesional', name: 'Profesional', priceCents: 99900, limits: { clients: 50, staff: 5, workers: 100, storageGB: 10 },
    features: ['Todo lo de Esencial', 'Planeación, estadísticas y presupuestos', 'Nómina: trabajadores, desglose y recibos timbrados', 'Roles de equipo y permisos por módulo'] },
  { id: 'empresarial', name: 'Empresarial', priceCents: 199900, fromPrice: true, limits: { clients: null, staff: 15, workers: null, storageGB: 50 },
    features: ['Todo lo de Profesional', 'Clientes y trabajadores sin tope fijo (uso razonable)', 'Más usuarios y almacenamiento', 'Soporte prioritario'] },
];

export const ivaCents = (priceCents: number) => Math.round((priceCents * IVA_RATE_BP) / 10000);
export const totalWithIva = (priceCents: number) => priceCents + ivaCents(priceCents);
export const limitLabel = (n: number | null) => (n === null ? 'sin tope fijo' : String(n));
