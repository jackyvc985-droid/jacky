import React, { useState } from 'react';
import { View } from 'react-native';
import { uid, useStore } from '../store';
import { Banner, Btn, Card, Empty, FormModal, Muted, Page, Row, T, notify, theme } from '../ui/kit.tsx';
import { Payroll, PayrollCalc } from '../domain/types.ts';
import { payrollNet } from '../domain/accounting.ts';
import { formatMXN, parseMoney } from '../domain/money.ts';
import { TABLES_2026, calcPayroll } from '../domain/fiscal.ts';
import { toCSV } from '../domain/csv.ts';
import { exportText } from '../files';
import { clientName, clientOptions, Role, thisPeriod } from './common.ts';

const pct = (bp: number) => { let t = (bp / 100).toFixed(3); if (t.endsWith('0')) t = t.slice(0, -1); return `${t} %`; };

type Line = { label: string; value?: string; sub?: boolean; bold?: boolean; tone?: 'ok' | 'bad' };

/** Líneas del recibo, compartidas por la pantalla y la exportación CSV. */
export function stubLines(p: Payroll): { title: string; lines: Line[] }[] {
  const c = p.calc;
  const d = c?.detail;
  const m = formatMXN;
  const out: { title: string; lines: Line[] }[] = [];
  if (d && c) {
    out.push({ title: 'Percepciones', lines: [
      { label: 'Sueldo del periodo', value: m(d.salaryCents) },
      { label: 'Otras percepciones gravadas', value: m(d.otherTaxableCents) },
      { label: 'Percepciones exentas', value: m(d.exemptCents) },
      { label: 'Total de percepciones', value: m(p.perceptionsCents), bold: true },
    ] });
    out.push({ title: 'ISR (Art. 96 LISR, tarifa mensual ' + c.tablesYear + ')', lines: [
      { label: 'Base gravable (sueldo + otras gravadas)', value: m(d.taxableCents) },
      { label: `Tramo aplicable: de ${m(d.isr.lowerCents)} a ${d.isr.upperCents === null ? 'en adelante' : m(d.isr.upperCents)}`, sub: true },
      { label: '− Límite inferior del tramo', value: m(d.isr.lowerCents), sub: true },
      { label: '= Excedente sobre el límite inferior', value: m(d.isr.excessCents), sub: true },
      { label: `× Tasa sobre excedente (${pct(d.isr.rateBp)})`, value: m(d.isr.marginalCents), sub: true },
      { label: '+ Cuota fija del tramo', value: m(d.isr.fixedCents), sub: true },
      { label: '= ISR causado', value: m(d.isr.causedCents), bold: true },
      { label: `− Subsidio para el empleo aplicado${c.subsidyAppliedCents ? '' : ` (no aplica: ingreso mayor a ${m(d.subsidyLimitCents)})`}`, value: m(c.subsidyAppliedCents) },
      { label: '= ISR a retener', value: m(c.isrCents), bold: true },
      ...(p.subsidyPaidCents ? [{ label: 'Subsidio que excede el ISR (se entrega al trabajador)', value: m(p.subsidyPaidCents), tone: 'ok' as const }] : []),
    ] });
    out.push({ title: 'IMSS · cuota obrera ' + c.tablesYear, lines: [
      { label: `Salario diario ${m(d.dailySalaryCents)} × factor de integración ${d.integrationFactor} = SBC diario (tope 25 UMA)`, value: m(d.sbcDailyCents), sub: true },
      { label: `UMA diaria ${m(d.umaDailyCents)} · ${d.days} días del periodo`, sub: true },
      ...d.imssItems.map(i => ({ label: `${i.label} (${pct(i.rateBp)} sobre ${m(i.baseCents)})`, value: m(i.cents) })),
      { label: 'Total IMSS a retener', value: m(c.imssCents), bold: true },
    ] });
    out.push({ title: 'Otras deducciones', lines: [{ label: 'INFONAVIT / pensión alimenticia / otras (capturadas)', value: m(c.otherCents) }] });
    out.push({ title: 'Resumen', lines: [
      { label: 'Total de percepciones', value: m(p.perceptionsCents) },
      { label: `− ISR a retener`, value: m(c.isrCents) },
      { label: `− IMSS`, value: m(c.imssCents) },
      { label: `− Otras deducciones`, value: m(c.otherCents) },
      ...(p.subsidyPaidCents ? [{ label: '+ Subsidio entregado', value: m(p.subsidyPaidCents) }] : []),
      { label: 'NETO A PAGAR', value: m(payrollNet(p)), bold: true },
    ] });
  } else {
    out.push({ title: c ? 'Resumen (cálculo anterior, sin desglose por paso)' : 'Resumen (captura manual)', lines: [
      { label: 'Total de percepciones', value: m(p.perceptionsCents) },
      ...(c ? [{ label: 'ISR retenido', value: m(c.isrCents) }, { label: 'IMSS obrero', value: m(c.imssCents) }, { label: 'Otras deducciones', value: m(c.otherCents) }] : [{ label: 'Deducciones capturadas', value: m(p.deductionsCents) }]),
      ...(p.subsidyPaidCents ? [{ label: '+ Subsidio entregado', value: m(p.subsidyPaidCents) }] : []),
      { label: 'NETO A PAGAR', value: m(payrollNet(p)), bold: true },
    ] });
  }
  return out;
}

function Stub({ p }: { p: Payroll }) {
  return (
    <View style={{ gap: 10, marginTop: 6 }}>
      {stubLines(p).map(sec => (
        <View key={sec.title}>
          <T bold style={{ color: theme.primary, marginBottom: 2 }}>{sec.title}</T>
          {sec.lines.map((l, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 3, paddingLeft: l.sub ? 12 : 0, borderBottomWidth: l.bold ? 1 : 0, borderBottomColor: theme.line }}>
              <T style={{ flex: 1, fontSize: l.sub ? 13 : 14, color: l.sub ? theme.muted : theme.text, fontWeight: l.bold ? '700' : '400' }}>{l.label}</T>
              {l.value !== undefined && <T bold={l.bold} style={{ fontSize: 14, color: l.tone === 'ok' ? theme.ok : theme.text }}>{l.value}</T>}
            </View>
          ))}
        </View>
      ))}
      <Muted>Cálculo con tablas {TABLES_2026.year} sin validar por un contador. No incluye cuotas patronales, ISN ni retenciones especiales.</Muted>
    </View>
  );
}

export default function Nominas({ role }: { role: Role }) {
  const { view, data, upsert, remove } = useStore();
  const [edit, setEdit] = useState<Payroll | 'new' | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const save = (v: Record<string, string>) => {
    const money = (k: string, label: string, required = false) => {
      const raw = (v[k] ?? '').trim();
      if (!raw) { if (required) throw new Error(`Falta: ${label}`); return 0; }
      const c = parseMoney(raw);
      if (c === null || c < 0) throw new Error(`${label}: importe inválido`);
      return c;
    };
    const salary = money('salary', 'Sueldo del periodo', true), extra = money('extra', 'Otras percepciones gravadas'), exempt = money('exempt', 'Percepciones exentas');
    const base = { id: edit && edit !== 'new' ? edit.id : uid(), employee: v.employee.trim(), clientId: v.clientId || '', period: v.period, perceptionsCents: salary + extra + exempt };
    let p: Payroll;
    if (v.mode === 'auto') {
      const daily = money('daily', 'Salario diario', true);
      if (daily <= 0) throw new Error('Captura el salario diario para calcular el IMSS');
      const days = Number(v.days || '30');
      if (!Number.isInteger(days) || days < 1 || days > 31) throw new Error('Días del periodo: entre 1 y 31');
      const factor = v.factor ? Number(v.factor) : undefined;
      if (factor !== undefined && !(factor >= 1 && factor < 2)) throw new Error('Factor de integración entre 1 y 2');
      const r = calcPayroll({ salaryCents: salary, otherTaxableCents: extra, exemptCents: exempt, dailySalaryCents: daily, days, integrationFactor: factor, otherDeductionsCents: money('other', 'Otras deducciones') });
      const calc: PayrollCalc = { isrCents: r.isrWithheld, imssCents: r.imss, subsidyAppliedCents: r.subsidyApplied, otherCents: r.other, tablesYear: r.tablesYear, detail: r.detail };
      p = { ...base, deductionsCents: r.deductionsTotal, subsidyPaidCents: r.subsidyPaid, calc };
    } else {
      p = { ...base, deductionsCents: money('deductions', 'Deducciones') };
    }
    upsert('payrolls', p, x => x.id === p.id); setEdit(null);
  };

  const exportCsv = (p: Payroll) => {
    const rows: (string | number)[][] = [['seccion', 'concepto', 'importe'], ['', 'empleado', p.employee], ['', 'periodo', p.period]];
    for (const sec of stubLines(p)) for (const l of sec.lines) rows.push([sec.title, l.label, l.value ?? '']);
    exportText(`nomina-${p.employee.replace(/\W+/g, '_')}-${p.period}.csv`, toCSV(rows)).catch(e => notify(e.message));
  };

  const initial = (e: Payroll | 'new') => {
    if (e === 'new') return { period: thisPeriod(), mode: 'auto', days: '30' };
    const d = e.calc?.detail;
    const f = (c: number) => (c ? (c / 100).toFixed(2) : '');
    return {
      ...e, mode: e.calc ? 'auto' : 'manual',
      salary: f(d ? d.salaryCents : e.perceptionsCents), extra: f(d?.otherTaxableCents ?? 0), exempt: f(d?.exemptCents ?? 0),
      daily: f(d?.dailySalaryCents ?? 0), days: String(d?.days ?? 30), factor: d ? String(d.integrationFactor) : '',
      other: f(e.calc?.otherCents ?? 0), deductions: f(e.deductionsCents),
    };
  };

  return (
    <Page title="Nóminas" actions={role === 'propietario' ? <Btn label="+ Nómina" onPress={() => setEdit('new')} /> : undefined}>
      <Banner tone="warn">
        Cálculo automático (sueldos y salarios, periodo mensual): ISR con la tarifa del Art. 96 LISR {TABLES_2026.year}, subsidio para el empleo e IMSS cuota obrera, con las tablas {TABLES_2026.year}. Esas cifras NO están validadas por un contador: confírmalas antes de usarlas. No cubre periodos quincenales/semanales, ajuste anual, cuotas patronales ni la amortización de INFONAVIT (captúrala como «otras deducciones»).
      </Banner>
      {view.payrolls.length === 0 && <Empty>Sin nóminas capturadas.</Empty>}
      {view.payrolls.map(p => (
        <Card key={p.id}>
          <Row><T bold>{p.employee}</T><T bold style={{ color: theme.primary }}>Neto {formatMXN(payrollNet(p))}</T></Row>
          <Muted>{p.period} · {clientName(data, p.clientId)} · Percepciones {formatMXN(p.perceptionsCents)} − Deducciones {formatMXN(p.deductionsCents)}{p.subsidyPaidCents ? ` + Subsidio entregado ${formatMXN(p.subsidyPaidCents)}` : ''}</Muted>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Btn small kind={open[p.id] ? 'primary' : 'ghost'} label={open[p.id] ? 'Ocultar desglose' : 'Ver desglose'} onPress={() => setOpen(o => ({ ...o, [p.id]: !o[p.id] }))} />
            <Btn small kind="ghost" label="Exportar desglose (CSV)" onPress={() => exportCsv(p)} />
            {role === 'propietario' && <><Btn small kind="ghost" label="Editar" onPress={() => setEdit(p)} /><Btn small kind="danger" label="Eliminar" onPress={() => remove('payrolls', x => x.id === p.id)} /></>}
          </View>
          {open[p.id] && <Stub p={p} />}
        </Card>
      ))}
      {edit && <FormModal title={edit === 'new' ? 'Nueva nómina' : 'Editar nómina'} onClose={() => setEdit(null)} onSubmit={save} initial={initial(edit)}
        fields={[
          { key: 'employee', label: 'Empleado', required: true },
          { key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions(data, true) },
          { key: 'period', label: 'Periodo', type: 'period', required: true },
          { key: 'salary', label: 'Sueldo del periodo (MXN)', type: 'money', required: true },
          { key: 'extra', label: 'Otras percepciones gravadas (bonos, comisiones…)', type: 'money' },
          { key: 'exempt', label: 'Percepciones exentas', type: 'money', hint: 'No entran a la base de ISR ni de IMSS; se suman al neto.' },
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
