import React, { useState } from 'react';
import { View } from 'react-native';
import { uid, useStore } from '../store';
import { Banner, Btn, Card, Empty, FormModal, Muted, Page, Row, T, theme } from '../ui/kit.tsx';
import { Payroll } from '../domain/types.ts';
import { payrollNet } from '../domain/accounting.ts';
import { formatMXN, parseMoney } from '../domain/money.ts';
import { TABLES_2026, calcPayroll } from '../domain/fiscal.ts';
import { clientName, clientOptions, Role, thisPeriod } from './common.ts';

export default function Nominas({ role }: { role: Role }) {
  const { view, data, upsert, remove } = useStore();
  const [edit, setEdit] = useState<Payroll | 'new' | null>(null);

  const save = (v: Record<string, string>) => {
    const perceptions = parseMoney(v.perceptions)!;
    if (perceptions < 0) throw new Error('Las percepciones no pueden ser negativas');
    const base = { id: edit && edit !== 'new' ? edit.id : uid(), employee: v.employee.trim(), clientId: v.clientId || '', period: v.period, perceptionsCents: perceptions };
    let p: Payroll;
    if (v.mode === 'auto') {
      const daily = parseMoney(v.daily || '');
      if (daily === null || daily <= 0) throw new Error('Captura el salario diario para calcular el IMSS');
      const days = Number(v.days || '30');
      if (!Number.isInteger(days) || days < 1 || days > 31) throw new Error('Días del periodo: entre 1 y 31');
      const factor = v.factor ? Number(v.factor) : undefined;
      if (factor !== undefined && !(factor >= 1 && factor < 2)) throw new Error('Factor de integración entre 1 y 2');
      const other = parseMoney(v.other || '0');
      if (other === null || other < 0) throw new Error('Otras deducciones inválidas');
      const r = calcPayroll({ perceptionsCents: perceptions, dailySalaryCents: daily, days, integrationFactor: factor, otherDeductionsCents: other });
      p = { ...base, deductionsCents: r.deductionsTotal, subsidyPaidCents: r.subsidyPaid, calc: { isrCents: r.isrWithheld, imssCents: r.imss, subsidyAppliedCents: r.subsidyApplied, otherCents: r.other, tablesYear: r.tablesYear } };
    } else {
      const ded = parseMoney(v.deductions || '0');
      if (ded === null || ded < 0) throw new Error('Deducciones inválidas');
      p = { ...base, deductionsCents: ded };
    }
    upsert('payrolls', p, x => x.id === p.id); setEdit(null);
  };

  return (
    <Page title="Nóminas" actions={role === 'propietario' ? <Btn label="+ Nómina" onPress={() => setEdit('new')} /> : undefined}>
      <Banner tone="warn">
        Cálculo automático (sueldos y salarios, periodo mensual): ISR con la tarifa del Art. 96 LISR {TABLES_2026.year}, subsidio para el empleo e IMSS cuota obrera, con las tablas {TABLES_2026.year}. Esas cifras NO están validadas por un contador: confírmalas antes de usarlas. No cubre periodos quincenales/semanales, prestaciones exentas, ajuste anual, cuotas patronales ni la amortización de INFONAVIT (captúrala como «otras deducciones»).
      </Banner>
      {view.payrolls.length === 0 && <Empty>Sin nóminas capturadas.</Empty>}
      {view.payrolls.map(p => (
        <Card key={p.id}>
          <Row><T bold>{p.employee}</T><T bold style={{ color: theme.primary }}>Neto {formatMXN(payrollNet(p))}</T></Row>
          <Muted>{p.period} · {clientName(data, p.clientId)} · Percepciones {formatMXN(p.perceptionsCents)} − Deducciones {formatMXN(p.deductionsCents)}{p.subsidyPaidCents ? ` + Subsidio entregado ${formatMXN(p.subsidyPaidCents)}` : ''}</Muted>
          {p.calc ? <Muted>Calculado ({p.calc.tablesYear}): ISR retenido {formatMXN(p.calc.isrCents)} (subsidio aplicado {formatMXN(p.calc.subsidyAppliedCents)}) · IMSS obrero {formatMXN(p.calc.imssCents)} · Otras {formatMXN(p.calc.otherCents)}</Muted> : <Muted>Capturado manualmente</Muted>}
          {role === 'propietario' && <View style={{ flexDirection: 'row', gap: 6 }}><Btn small kind="ghost" label="Editar" onPress={() => setEdit(p)} /><Btn small kind="danger" label="Eliminar" onPress={() => remove('payrolls', x => x.id === p.id)} /></View>}
        </Card>
      ))}
      {edit && <FormModal title={edit === 'new' ? 'Nueva nómina' : 'Editar nómina'} onClose={() => setEdit(null)} onSubmit={save}
        initial={edit === 'new' ? { period: thisPeriod(), mode: 'auto', days: '30' } : { ...edit, mode: edit.calc ? 'auto' : 'manual', perceptions: (edit.perceptionsCents / 100).toFixed(2), deductions: (edit.deductionsCents / 100).toFixed(2), other: edit.calc ? (edit.calc.otherCents / 100).toFixed(2) : '', days: '30' }}
        fields={[
          { key: 'employee', label: 'Empleado', required: true },
          { key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions(data, true) },
          { key: 'period', label: 'Periodo', type: 'period', required: true },
          { key: 'perceptions', label: 'Percepciones gravadas del mes (MXN)', type: 'money', required: true },
          { key: 'mode', label: 'Deducciones', type: 'select', options: [{ value: 'auto', label: 'Calcular ISR e IMSS' }, { value: 'manual', label: 'Capturar manualmente' }] },
          { key: 'daily', label: 'Automático · Salario diario (MXN)', type: 'money', hint: 'Base del IMSS (se integra con el factor).' },
          { key: 'days', label: 'Automático · Días del periodo' },
          { key: 'factor', label: 'Automático · Factor de integración', hint: `Vacío = ${TABLES_2026.defaultIntegrationFactor} (mínimos de ley).` },
          { key: 'other', label: 'Automático · Otras deducciones (INFONAVIT, pensión…)', type: 'money' },
          { key: 'deductions', label: 'Manual · Deducciones totales (MXN)', type: 'money' },
        ]} />}
    </Page>
  );
}
