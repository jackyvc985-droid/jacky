import React, { useState } from 'react';
import { View } from 'react-native';
import { uid, useStore } from '../store.tsx';
import { Banner, Btn, Card, Empty, FormModal, Muted, Page, Row, T, theme } from '../ui/kit.tsx';
import { Payroll } from '../domain/types.ts';
import { payrollNet } from '../domain/accounting.ts';
import { formatMXN, parseMoney } from '../domain/money.ts';
import { clientName, clientOptions, Role, thisPeriod } from './common.ts';

export default function Nominas({ role }: { role: Role }) {
  const { view, data, upsert, remove } = useStore();
  const [edit, setEdit] = useState<Payroll | 'new' | null>(null);
  const save = (v: Record<string, string>) => {
    const p: Payroll = { id: edit && edit !== 'new' ? edit.id : uid(), employee: v.employee.trim(), clientId: v.clientId || '', period: v.period, perceptionsCents: parseMoney(v.perceptions)!, deductionsCents: parseMoney(v.deductions || '0')! };
    if (p.perceptionsCents < 0 || p.deductionsCents < 0) throw new Error('Los importes no pueden ser negativos');
    upsert('payrolls', p, x => x.id === p.id); setEdit(null);
  };
  return (
    <Page title="Nóminas" actions={role === 'propietario' ? <Btn label="+ Nómina" onPress={() => setEdit('new')} /> : undefined}>
      <Banner tone="warn">El neto se calcula solo con las percepciones y deducciones capturadas. No calcula ISR, subsidio, IMSS ni INFONAVIT.</Banner>
      {view.payrolls.length === 0 && <Empty>Sin nóminas capturadas.</Empty>}
      {view.payrolls.map(p => (
        <Card key={p.id}>
          <Row><T bold>{p.employee}</T><T bold style={{ color: theme.primary }}>Neto {formatMXN(payrollNet(p))}</T></Row>
          <Muted>{p.period} · {clientName(data, p.clientId)} · Percepciones {formatMXN(p.perceptionsCents)} − Deducciones {formatMXN(p.deductionsCents)}</Muted>
          {role === 'propietario' && <View style={{ flexDirection: 'row', gap: 6 }}><Btn small kind="ghost" label="Editar" onPress={() => setEdit(p)} /><Btn small kind="danger" label="Eliminar" onPress={() => remove('payrolls', x => x.id === p.id)} /></View>}
        </Card>
      ))}
      {edit && <FormModal title={edit === 'new' ? 'Nueva nómina' : 'Editar nómina'} onClose={() => setEdit(null)} onSubmit={save}
        initial={edit === 'new' ? { period: thisPeriod() } : { ...edit, perceptions: (edit.perceptionsCents / 100).toFixed(2), deductions: (edit.deductionsCents / 100).toFixed(2) }}
        fields={[
          { key: 'employee', label: 'Empleado', required: true },
          { key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions(data, true) },
          { key: 'period', label: 'Periodo', type: 'period', required: true },
          { key: 'perceptions', label: 'Percepciones (MXN)', type: 'money', required: true },
          { key: 'deductions', label: 'Deducciones capturadas (MXN)', type: 'money' },
        ]} />}
    </Page>
  );
}
