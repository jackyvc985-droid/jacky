import React, { useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../store';
import { Badge, Banner, Btn, Card, Empty, H2, Muted, Page, Row, T, notify } from '../ui/kit.tsx';
import { StubBody } from './Nominas';
import { useDocFiles } from '../docs';
import { formatMXN } from '../domain/money.ts';
import { payrollNet } from '../domain/accounting.ts';
import { maskClabe } from '../domain/employees.ts';

/** Acceso del trabajador: solo su ficha, sus nóminas y sus recibos. El servidor no le envía nada más. */
export default function MisRecibos() {
  const { view } = useStore();
  const files = useDocFiles();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const e = view.employees[0];
  const pays = [...view.payrolls].sort((a, b) => b.period.localeCompare(a.period));
  const doc = (id?: string) => (id ? view.docs.find(d => d.id === id) : undefined);
  const row = (l: string, v: string) => <Row><Muted>{l}</Muted><T>{v || '—'}</T></Row>;
  return (
    <Page title="Mis recibos">
      <Banner tone="info">Aquí ves solo tu información y tus recibos de nómina. Si algún dato tuyo está mal, avísalo a quien administra tu nómina.</Banner>
      {e && (
        <Card>
          <H2>{e.name}</H2>
          {row('Puesto', e.puesto)}{row('Ingreso', e.hireDate)}{row('RFC', e.rfc)}{row('CURP', e.curp)}{row('NSS', e.nss)}{row('Empresa', view.clients[0]?.name ?? '')}{row('CLABE', e.clabe ? maskClabe(e.clabe) : '')}
        </Card>
      )}
      {pays.length === 0 && <Empty>Aún no hay recibos disponibles.</Empty>}
      {pays.map(p => {
        const x = doc(p.cfdi?.xmlDocId), f = doc(p.cfdi?.pdfDocId);
        return (
          <Card key={p.id}>
            <Row><T bold>{p.period}</T><T bold>Neto {formatMXN(payrollNet(p))}</T></Row>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge tone={p.cfdi ? 'ok' : 'warn'} label={p.cfdi ? 'Recibo timbrado' : 'Recibo timbrado pendiente'} />
              <Btn small kind={open[p.id] ? 'primary' : 'ghost'} label={open[p.id] ? 'Ocultar desglose' : 'Ver desglose'} onPress={() => setOpen(o => ({ ...o, [p.id]: !o[p.id] }))} />
              {f && <Btn small kind="ghost" label="Descargar PDF" onPress={() => files.open(f).catch(err => notify(err.message))} />}
              {x && <Btn small kind="ghost" label="Descargar XML" onPress={() => files.open(x).catch(err => notify(err.message))} />}
            </View>
            {open[p.id] && <StubBody p={p} />}
          </Card>
        );
      })}
    </Page>
  );
}
