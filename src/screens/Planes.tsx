import React from 'react';
import { useStore } from '../store';
import { Banner, Btn, Card, H2, Muted, notify, Page, Row, T } from '../ui/kit.tsx';
import { formatMXN } from '../domain/money.ts';
import { PLANS, ivaCents, limitLabel, totalWithIva } from '../domain/plans.ts';

export default function Planes() {
  const { data, upsert } = useStore();
  const last = data.proposals[data.proposals.length - 1];
  return (
    <Page title="Planes">
      <Banner tone="info">Tres planes mensuales propuestos para Grupo Canville. Los precios se muestran sin IVA (se suma el 16 %). Seleccionar uno solo guarda una propuesta: no cobra ni activa ninguna suscripción, y los límites todavía no se aplican automáticamente. Precios, impuestos, límites y proveedor de cobro requieren tu aprobación.</Banner>
      {PLANS.map(p => (
        <Card key={p.id}>
          <H2>{p.name}</H2>
          <T bold style={{ fontSize: 22 }}>{p.fromPrice ? 'Desde ' : ''}{formatMXN(p.priceCents)} <T style={{ fontSize: 13 }}>MXN al mes + IVA</T></T>
          <Muted>IVA {formatMXN(ivaCents(p.priceCents))} · Total {formatMXN(totalWithIva(p.priceCents))} al mes</Muted>
          <Row><T>Clientes</T><T bold>{limitLabel(p.limits.clients)}</T></Row>
          <Row><T>Usuarios del despacho</T><T bold>{p.limits.staff}</T></Row>
          <Row><T>Trabajadores en nómina</T><T bold>{limitLabel(p.limits.workers)}</T></Row>
          <Row><T>Almacenamiento</T><T bold>{p.limits.storageGB} GB</T></Row>
          {p.features.map(f => <T key={f}>• {f}</T>)}
          <Btn small kind={last?.plan === p.name ? 'primary' : 'ghost'} label={last?.plan === p.name ? '✓ Propuesta guardada' : 'Guardar propuesta'}
            onPress={() => { upsert('proposals', { plan: p.name, priceMXN: p.priceCents / 100, createdAt: new Date().toISOString() }, () => false); notify(`Propuesta «${p.name}» guardada. No se realizó ningún cobro.`); }} />
        </Card>
      ))}
      {last && <Muted>Última propuesta: {last.plan} ({last.createdAt.slice(0, 10)})</Muted>}
    </Page>
  );
}
