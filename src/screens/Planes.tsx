import React from 'react';
import { useStore } from '../store.tsx';
import { Banner, Btn, Card, H2, Muted, notify, Page, T } from '../ui/kit.tsx';
import { formatMXN } from '../domain/money.ts';

const PLANS = [
  { name: 'Esencial', price: 499, items: ['Hasta 15 clientes', 'Documentos y tareas', 'Exportación CSV'] },
  { name: 'Profesional', price: 999, items: ['Clientes ilimitados', 'Presupuestos y nóminas', 'Portal de clientes'] },
  { name: 'Empresarial', price: 1999, items: ['Todo Profesional', 'Múltiples usuarios', 'Soporte prioritario'] },
];

export default function Planes() {
  const { data, upsert } = useStore();
  const last = data.proposals[data.proposals.length - 1];
  return (
    <Page title="Planes">
      <Banner tone="info">Planes orientativos. Seleccionar uno guarda una propuesta; no cobra ni activa ninguna suscripción. Precios, impuestos, servicios, límites y proveedor requieren aprobación y activación comercial.</Banner>
      {PLANS.map(p => (
        <Card key={p.name}>
          <H2>{p.name} · {formatMXN(p.price * 100)} MXN/mes</H2>
          {p.items.map(i => <T key={i}>• {i}</T>)}
          <Btn small kind={last?.plan === p.name ? 'primary' : 'ghost'} label={last?.plan === p.name ? '✓ Propuesta guardada' : 'Guardar propuesta'}
            onPress={() => { upsert('proposals', { plan: p.name, priceMXN: p.price, createdAt: new Date().toISOString() }, () => false); notify(`Propuesta «${p.name}» guardada. No se realizó ningún cobro.`); }} />
        </Card>
      ))}
      {last && <Muted>Última propuesta: {last.plan} ({last.createdAt.slice(0, 10)})</Muted>}
    </Page>
  );
}
