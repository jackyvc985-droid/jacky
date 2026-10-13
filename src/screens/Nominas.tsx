import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { uid, useStore } from '../store';
import { Badge, Banner, Btn, Card, Empty, FormModal, H2, Muted, Page, Row, T, confirmAction, notify, theme } from '../ui/kit.tsx';
import { Payroll, PayrollCalc } from '../domain/types.ts';
import { payrollNet } from '../domain/accounting.ts';
import { formatMXN, parseMoney } from '../domain/money.ts';
import { TABLES_2026, calcPayroll } from '../domain/fiscal.ts';
import { toCSV } from '../domain/csv.ts';
import { exportText } from '../files';
import { api } from '../cloud';
import { useDocFiles } from '../docs';
import { payRuns, payrollSummary } from '../domain/payrollSummary.ts';
import RecibosImport from './RecibosImport';
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
    out.push({ title: p.source === 'cfdi' ? 'Resumen (según el recibo timbrado)' : c ? 'Resumen (cálculo anterior, sin desglose por paso)' : 'Resumen (captura manual)', lines: [
      { label: 'Total de percepciones', value: m(p.perceptionsCents) },
      ...(c ? [{ label: 'ISR retenido', value: m(c.isrCents) }, { label: 'IMSS obrero', value: m(c.imssCents) }, { label: 'Otras deducciones', value: m(c.otherCents) }] : [{ label: 'Deducciones capturadas', value: m(p.deductionsCents) }]),
      ...(p.subsidyPaidCents ? [{ label: '+ Subsidio entregado', value: m(p.subsidyPaidCents) }] : []),
      { label: 'NETO A PAGAR', value: m(payrollNet(p)), bold: true },
    ] });
  }
  if (p.cfdi) {
    const c2 = p.cfdi;
    if (!d) {
      const sect = (title: string, kind: 'percepcion' | 'deduccion' | 'otropago') => {
        const ls = c2.lines.filter(l => l.kind === kind);
        if (ls.length) out.splice(out.length - 1, 0, { title, lines: ls.map(l => ({ label: `${l.concepto || l.clave} (${l.tipo})${l.exentoCents ? ` · exento ${m(l.exentoCents)}` : ''}`, value: m(l.gravadoCents + l.exentoCents) })) });
      };
      sect('Percepciones (según el recibo timbrado)', 'percepcion'); sect('Deducciones (según el recibo timbrado)', 'deduccion'); sect('Otros pagos (según el recibo timbrado)', 'otropago');
    }
    out.push({ title: 'Recibo timbrado (CFDI de nómina)', lines: [
      { label: `Estado: ${c2.status}. Se cargó el XML emitido por el sistema de nómina; el estatus ante el SAT no se verificó en esta app.`, sub: true },
      { label: 'UUID', value: c2.uuid },
      { label: 'Fecha de pago', value: c2.fechaPago },
      { label: `Periodo pagado (${c2.diasPagados} días)`, value: `${c2.fechaInicial} a ${c2.fechaFinal}` },
      { label: 'RFC del emisor (patrón)', value: c2.emisorRfc },
      { label: 'RFC del receptor (trabajador)', value: c2.receptorRfc },
      { label: 'Total del CFDI', value: m(c2.totalCents), bold: true },
      ...c2.notes.map(n => ({ label: n, sub: true })),
    ] });
  }
  return out;
}

export function StubBody({ p }: { p: Payroll }) {
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

type Tab = 'resumen' | 'nominas' | 'recibos';

export default function Nominas({ role }: { role: Role }) {
  const [tab, setTab] = useState<Tab>('resumen');
  return (
    <Page title="Nóminas" actions={null}>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Btn small kind={tab === 'resumen' ? 'primary' : 'ghost'} label="Resumen del periodo" onPress={() => setTab('resumen')} />
        <Btn small kind={tab === 'nominas' ? 'primary' : 'ghost'} label="Nóminas y desglose" onPress={() => setTab('nominas')} />
        <Btn small kind={tab === 'recibos' ? 'primary' : 'ghost'} label="Recibos timbrados" onPress={() => setTab('recibos')} />
      </View>
      {tab === 'resumen' && <ResumenTab />}
      {tab === 'nominas' && <ListaTab role={role} />}
      {tab === 'recibos' && <RecibosTab role={role} />}
    </Page>
  );
}

const COLS: [string, number][] = [['Trabajador', 170], ['Percepciones', 105], ['ISR', 95], ['IMSS', 95], ['Otras deduc.', 100], ['Otros pagos', 100], ['Neto', 105], ['Recibo', 95]];
const Cell = ({ w, children, bold, right, tone }: { w: number; children: React.ReactNode; bold?: boolean; right?: boolean; tone?: string }) => (
  <View style={{ width: w, paddingVertical: 6, paddingHorizontal: 4 }}><T bold={bold} style={{ fontSize: 13, textAlign: right ? 'right' : 'left', color: tone ?? theme.text }}>{children}</T></View>
);

/** Desglose general de la nómina de un periodo: todos los trabajadores, con totales. */
function ResumenTab() {
  const { view, data } = useStore();
  const [period, setPeriod] = useState(thisPeriod());
  const [clientId, setClientId] = useState('');
  const [run, setRun] = useState('');
  const runs = payRuns(view.payrolls, { period, clientId });
  const sum = payrollSummary(view.payrolls, view.employees, { period, clientId, run: runs.some(r => r.key === run) ? run : '' });
  const fmtRun = (r: { from: string; to: string }) => `${r.from.slice(8)}/${r.from.slice(5, 7)} – ${r.to.slice(8)}/${r.to.slice(5, 7)}`;
  const shift = (n: number) => { const [y, m] = period.split('-').map(Number); setPeriod(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)); setRun(''); };
  const t = sum.totals;
  const exportCsv = () => exportText(`desglose-nomina-${period}.csv`, toCSV([
    ['trabajador', 'cliente', 'periodo', 'percepciones', 'isr', 'imss', 'otras_deducciones', 'otros_pagos', 'neto', 'recibo_timbrado', 'uuid'],
    ...sum.rows.map(r => [r.name, clientName(data, r.clientId) === '—' ? '' : clientName(data, r.clientId), r.period, (r.perceptions / 100).toFixed(2), (r.isr / 100).toFixed(2), (r.imss / 100).toFixed(2), (r.other / 100).toFixed(2), (r.subsidyPaid / 100).toFixed(2), (r.net / 100).toFixed(2), r.timbrado ? 'sí' : 'no', r.uuid]),
    ['TOTAL', '', period, (t.perceptions / 100).toFixed(2), (t.isr / 100).toFixed(2), (t.imss / 100).toFixed(2), (t.other / 100).toFixed(2), (t.subsidyPaid / 100).toFixed(2), (t.net / 100).toFixed(2), `${sum.timbrados}/${sum.rows.length}`, ''],
  ])).catch(e => notify(e.message));
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Btn small kind="ghost" label="◀" onPress={() => shift(-1)} /><T bold>{period}</T><Btn small kind="ghost" label="▶" onPress={() => shift(1)} />
        <Btn small kind={clientId ? 'ghost' : 'primary'} label="Todos los clientes" onPress={() => setClientId('')} />
        {view.clients.map(c => <Btn key={c.id} small kind={clientId === c.id ? 'primary' : 'ghost'} label={c.name} onPress={() => setClientId(c.id)} />)}
      </View>
      {runs.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Muted>Periodo de pago:</Muted>
          <Btn small kind={run ? 'ghost' : 'primary'} label="Todo el mes" onPress={() => setRun('')} />
          {runs.map(r => <Btn key={r.key} small kind={run === r.key ? 'primary' : 'ghost'} label={`${fmtRun(r)} · pago ${r.payDate.slice(8)}/${r.payDate.slice(5, 7)} (${r.count})`} onPress={() => setRun(r.key)} />)}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[['Percepciones', t.perceptions], ['Deducciones', t.deductions], ['Neto a pagar', t.net]].map(([l, v]) => (
          <Card key={l as string} style={{ flexGrow: 1, flexBasis: 170 }}><Muted>{l as string}</Muted><T bold style={{ fontSize: 20, color: theme.primary }}>{formatMXN(v as number)}</T></Card>
        ))}
        <Card style={{ flexGrow: 1, flexBasis: 170 }}><Muted>Recibos timbrados</Muted><T bold style={{ fontSize: 20, color: sum.pendientes ? theme.warn : theme.ok }}>{sum.timbrados} de {sum.rows.length}</T></Card>
      </View>
      {sum.rows.length === 0 ? <Empty>No hay nóminas en este periodo{clientId ? ' para este cliente' : ''}.</Empty> : (
        <Card>
          <ScrollView horizontal>
            <View>
              <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: theme.line }}>{COLS.map(([l, w]) => <Cell key={l} w={w} bold right={l !== 'Trabajador'}>{l}</Cell>)}</View>
              {sum.rows.map(r => (
                <View key={r.payrollId} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.line }}>
                  <Cell w={170}>{r.name}</Cell>
                  <Cell w={105} right>{formatMXN(r.perceptions)}</Cell>
                  <Cell w={95} right>{r.detailed ? formatMXN(r.isr) : '—'}</Cell>
                  <Cell w={95} right>{r.detailed ? formatMXN(r.imss) : '—'}</Cell>
                  <Cell w={100} right>{formatMXN(r.other)}</Cell>
                  <Cell w={100} right>{formatMXN(r.subsidyPaid)}</Cell>
                  <Cell w={105} right bold>{formatMXN(r.net)}</Cell>
                  <Cell w={95} right tone={r.timbrado ? theme.ok : theme.warn}>{r.timbrado ? 'Timbrado' : 'Pendiente'}</Cell>
                </View>
              ))}
              <View style={{ flexDirection: 'row', backgroundColor: theme.bg }}>
                <Cell w={170} bold>TOTAL</Cell><Cell w={105} right bold>{formatMXN(t.perceptions)}</Cell><Cell w={95} right bold>{formatMXN(t.isr)}</Cell><Cell w={95} right bold>{formatMXN(t.imss)}</Cell>
                <Cell w={100} right bold>{formatMXN(t.other)}</Cell><Cell w={100} right bold>{formatMXN(t.subsidyPaid)}</Cell><Cell w={105} right bold>{formatMXN(t.net)}</Cell><Cell w={95} right>{''}</Cell>
              </View>
            </View>
          </ScrollView>
          {sum.withoutDetail > 0 && <Muted>{sum.withoutDetail} nómina(s) capturadas a mano no tienen desglose de ISR e IMSS: todas sus deducciones aparecen en «Otras deduc.». Los «Otros pagos» incluyen el subsidio para el empleo entregado.</Muted>}
          <Btn small kind="ghost" label="Exportar resumen (CSV)" onPress={exportCsv} />
        </Card>
      )}
      <Muted>No incluye cuotas patronales ni ISN. Las cifras de recibos timbrados son las del CFDI cargado; el resto, las capturadas o calculadas en la app.</Muted>
    </>
  );
}

/** Nóminas individuales: captura/cálculo y recibo desglosado paso a paso. */
function ListaTab({ role }: { role: Role }) {
  const { view, data, upsert, remove } = useStore();
  const [edit, setEdit] = useState<Payroll | 'new' | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const save = (v: Record<string, string>) => {
    const emp = data.employees.find(x => x.id === v.employeeId);
    const money = (k: string, label: string, required = false) => {
      const raw = (v[k] ?? '').trim();
      if (!raw) { if (required) throw new Error(`Falta: ${label}`); return 0; }
      const c = parseMoney(raw);
      if (c === null || c < 0) throw new Error(`${label}: importe inválido`);
      return c;
    };
    const name = emp?.name ?? v.employee.trim();
    if (!name) throw new Error('Elige un trabajador o escribe el nombre.');
    const salary = money('salary', 'Sueldo del periodo', true), extra = money('extra', 'Otras percepciones gravadas'), exempt = money('exempt', 'Percepciones exentas');
    const base = { id: edit && edit !== 'new' ? edit.id : uid(), employee: name, employeeId: emp?.id, clientId: v.clientId || emp?.clientId || '', period: v.period, perceptionsCents: salary + extra + exempt, cfdi: edit && edit !== 'new' ? edit.cfdi : undefined };
    let p: Payroll;
    if (v.mode === 'auto') {
      const daily = v.daily ? money('daily', 'Salario diario') : emp?.dailySalaryCents ?? 0;
      if (daily <= 0) throw new Error('Captura el salario diario (o regístralo en la ficha del trabajador) para calcular el IMSS.');
      const days = Number(v.days || '30');
      if (!Number.isInteger(days) || days < 1 || days > 31) throw new Error('Días del periodo: entre 1 y 31');
      const factor = v.factor ? Number(v.factor) : undefined;
      if (factor !== undefined && !(factor >= 1 && factor < 2)) throw new Error('Factor de integración entre 1 y 2');
      const r = calcPayroll({ salaryCents: salary, otherTaxableCents: extra, exemptCents: exempt, dailySalaryCents: daily, days, integrationFactor: factor, otherDeductionsCents: money('other', 'Otras deducciones') });
      const calc: PayrollCalc = { isrCents: r.isrWithheld, imssCents: r.imss, subsidyAppliedCents: r.subsidyApplied, otherCents: r.other, tablesYear: r.tablesYear, detail: r.detail };
      p = { ...base, source: 'calculo', deductionsCents: r.deductionsTotal, subsidyPaidCents: r.subsidyPaid, calc };
    } else {
      p = { ...base, source: 'calculo', deductionsCents: money('deductions', 'Deducciones') };
    }
    upsert('payrolls', p, x => x.id === p.id); setEdit(null);
  };

  const exportCsv = (p: Payroll) => {
    const rows: (string | number)[][] = [['seccion', 'concepto', 'importe'], ['', 'empleado', p.employee], ['', 'periodo', p.period]];
    for (const sec of stubLines(p)) for (const l of sec.lines) rows.push([sec.title, l.label, l.value ?? '']);
    exportText(`nomina-${p.employee.replace(/\W+/g, '_')}-${p.period}.csv`, toCSV(rows)).catch(e => notify(e.message));
  };

  const initial = (e: Payroll | 'new') => {
    if (e === 'new') return { period: thisPeriod(), mode: 'auto', days: '30', employeeId: '' };
    const d = e.calc?.detail;
    const f = (c: number) => (c ? (c / 100).toFixed(2) : '');
    return {
      ...e, employeeId: e.employeeId ?? '', mode: e.calc?.detail ? 'auto' : 'manual',
      salary: f(d ? d.salaryCents : e.perceptionsCents), extra: f(d?.otherTaxableCents ?? 0), exempt: f(d?.exemptCents ?? 0),
      daily: f(d?.dailySalaryCents ?? 0), days: String(d?.days ?? 30), factor: d ? String(d.integrationFactor) : '',
      other: f(e.calc?.otherCents ?? 0), deductions: f(e.deductionsCents),
    };
  };

  return (
    <>
      {role === 'propietario' && <View style={{ alignSelf: 'flex-start' }}><Btn label="+ Nómina" onPress={() => setEdit('new')} /></View>}
      <Banner tone="warn">
        Cálculo automático (sueldos y salarios, periodo mensual): ISR con la tarifa del Art. 96 LISR {TABLES_2026.year}, subsidio para el empleo e IMSS cuota obrera, con las tablas {TABLES_2026.year}. Esas cifras NO están validadas por un contador: confírmalas antes de usarlas. Si el recibo se timbra en CONTPAQi, ese CFDI es la cifra oficial: cárgalo en «Recibos timbrados» y la app lo concilia con este cálculo.
      </Banner>
      {view.payrolls.length === 0 && <Empty>Sin nóminas capturadas.</Empty>}
      {view.payrolls.map(p => (
        <Card key={p.id}>
          <Row><T bold>{p.employee}</T><T bold style={{ color: theme.primary }}>Neto {formatMXN(payrollNet(p))}</T></Row>
          <Muted>{p.period} · {clientName(data, p.clientId)} · Percepciones {formatMXN(p.perceptionsCents)} − Deducciones {formatMXN(p.deductionsCents)}{p.subsidyPaidCents ? ` + ${p.source === 'cfdi' ? 'Otros pagos' : 'Subsidio entregado'} ${formatMXN(p.subsidyPaidCents)}` : ''}</Muted>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge tone={p.cfdi ? 'ok' : 'warn'} label={p.cfdi ? 'Recibo timbrado' : 'Sin recibo timbrado'} />
            <Btn small kind={open[p.id] ? 'primary' : 'ghost'} label={open[p.id] ? 'Ocultar desglose' : 'Ver desglose'} onPress={() => setOpen(o => ({ ...o, [p.id]: !o[p.id] }))} />
            <Btn small kind="ghost" label="Exportar desglose (CSV)" onPress={() => exportCsv(p)} />
            {role === 'propietario' && <>{p.source !== 'cfdi' && <Btn small kind="ghost" label="Editar" onPress={() => setEdit(p)} />}<Btn small kind="danger" label="Eliminar" onPress={() => remove('payrolls', x => x.id === p.id)} /></>}
          </View>
          {open[p.id] && <StubBody p={p} />}
        </Card>
      ))}
      {edit && <FormModal title={edit === 'new' ? 'Nueva nómina' : 'Editar nómina'} onClose={() => setEdit(null)} onSubmit={save} initial={initial(edit)}
        fields={[
          { key: 'employeeId', label: 'Trabajador', type: 'select', options: [{ value: '', label: 'Otro (captura manual)' }, ...data.employees.map(e => ({ value: e.id, label: e.name }))] },
          { key: 'employee', label: 'Nombre (si no eliges trabajador)' },
          { key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions(data, true) },
          { key: 'period', label: 'Periodo', type: 'period', required: true },
          { key: 'salary', label: 'Sueldo del periodo (MXN)', type: 'money', required: true },
          { key: 'extra', label: 'Otras percepciones gravadas (bonos, comisiones…)', type: 'money' },
          { key: 'exempt', label: 'Percepciones exentas', type: 'money', hint: 'No entran a la base de ISR ni de IMSS; se suman al neto.' },
          { key: 'mode', label: 'Deducciones', type: 'select', options: [{ value: 'auto', label: 'Calcular ISR e IMSS' }, { value: 'manual', label: 'Capturar manualmente' }] },
          { key: 'daily', label: 'Automático · Salario diario (MXN)', type: 'money', hint: 'Vacío = el de la ficha del trabajador.' },
          { key: 'days', label: 'Automático · Días del periodo' },
          { key: 'factor', label: 'Automático · Factor de integración', hint: `Vacío = ${TABLES_2026.defaultIntegrationFactor} (mínimos de ley).` },
          { key: 'other', label: 'Automático · Otras deducciones (INFONAVIT, pensión…)', type: 'money' },
          { key: 'deductions', label: 'Manual · Deducciones totales (MXN)', type: 'money' },
        ]} />}
    </>
  );
}

/** Recibos timbrados: se bajan de CONTPAQi y se suben aquí; se reconocen, se validan y quedan al alcance del cliente y del trabajador. */
function RecibosTab({ role }: { role: Role }) {
  const { view, data, upsert, remove, session, mode } = useStore();
  const files = useDocFiles();
  const [importing, setImporting] = useState(false);
  const [period, setPeriod] = useState(thisPeriod());
  const [sat, setSat] = useState<Record<string, string>>({});
  const rows = view.payrolls.filter(p => p.period === period);
  const withR = rows.filter(p => p.cfdi), without = rows.filter(p => !p.cfdi);
  const shift = (n: number) => { const [y, m] = period.split('-').map(Number); setPeriod(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)); };
  const doc = (id?: string) => (id ? data.docs.find(d => d.id === id) : undefined);

  const checkSat = async (p: Payroll) => {
    if (!p.cfdi || !session) return;
    setSat(x => ({ ...x, [p.id]: 'Consultando…' }));
    try {
      const r = await api<{ estado: string; codigo: string }>(session.apiUrl, session.token, 'POST', '/cfdi/status', { re: p.cfdi.emisorRfc, rr: p.cfdi.receptorRfc, total: (p.cfdi.totalCents / 100).toFixed(2), uuid: p.cfdi.uuid });
      setSat(x => ({ ...x, [p.id]: `SAT: ${r.estado} — ${r.codigo}` }));
    } catch (e) { setSat(x => ({ ...x, [p.id]: `No se pudo consultar al SAT: ${e instanceof Error ? e.message : 'error'}` })); }
  };

  const unlink = (p: Payroll) => confirmAction('¿Quitar este recibo timbrado de la nómina? Se eliminan sus archivos XML/PDF. Si la nómina se creó desde el recibo, también se elimina.', async () => {
    for (const id of [p.cfdi?.xmlDocId, p.cfdi?.pdfDocId]) { const d = doc(id); if (d) await files.delete(d); }
    if (p.source === 'cfdi') remove('payrolls', x => x.id === p.id); else upsert('payrolls', { ...p, cfdi: undefined }, x => x.id === p.id);
  });

  return (
    <>
      <Card>
        <H2>Cómo cargar los recibos timbrados</H2>
        <T>1. Timbra la nómina en CONTPAQi.</T>
        <T>2. Descarga los recibos: el XML de cada trabajador (y su PDF, si lo tienes).</T>
        <T>3. Súbelos aquí, todos juntos. La app reconoce al cliente por el RFC del emisor y al trabajador por su RFC o CURP, valida cada XML, evita duplicados por UUID y arma la nómina.</T>
        <T>4. El cliente los ve si tiene el módulo «Nóminas»; cada trabajador ve solo el suyo si tiene acceso.</T>
        {role === 'propietario' && <View style={{ alignSelf: 'flex-start', marginTop: 6 }}><Btn label="Subir recibos de CONTPAQi" onPress={() => setImporting(true)} /></View>}
        <Muted>Esta app no timbra: el CFDI lo emite CONTPAQi. Aquí se carga, se valida su coherencia interna y se concilia con el cálculo; no se verifica el sello ni el estatus ante el SAT salvo que lo consultes (requiere nube).</Muted>
      </Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Btn small kind="ghost" label="◀" onPress={() => shift(-1)} /><T bold>{period}</T><Btn small kind="ghost" label="▶" onPress={() => shift(1)} />
        <Badge tone={without.length ? 'warn' : 'ok'} label={`${withR.length} con recibo · ${without.length} pendientes`} />
      </View>
      {rows.length === 0 && <Empty>No hay nóminas en este periodo.</Empty>}
      {withR.map(p => {
        const x = doc(p.cfdi!.xmlDocId), f = doc(p.cfdi!.pdfDocId);
        return (
          <Card key={p.id}>
            <Row><T bold>{p.employee}</T><Badge tone="ok" label={p.cfdi!.status} /></Row>
            <Muted>{clientName(data, p.clientId)} · pago {p.cfdi!.fechaPago} · neto {formatMXN(p.cfdi!.totalCents)}</Muted>
            <Muted>UUID {p.cfdi!.uuid}</Muted>
            {p.cfdi!.notes.map(n => <Muted key={n} style={{ color: theme.warn }}>• {n}</Muted>)}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {x ? <Btn small kind="ghost" label="Descargar XML" onPress={() => files.open(x).catch(e => notify(e.message))} /> : <Muted>XML no disponible</Muted>}
              {f ? <Btn small kind="ghost" label="Descargar PDF" onPress={() => files.open(f).catch(e => notify(e.message))} /> : <Muted>Sin PDF</Muted>}
              {mode === 'cloud' && session && <Btn small kind="ghost" label="Consultar estatus SAT" onPress={() => checkSat(p)} />}
              {role === 'propietario' && <Btn small kind="danger" label="Quitar recibo" onPress={() => unlink(p)} />}
            </View>
            {sat[p.id] ? <T bold>{sat[p.id]}</T> : null}
          </Card>
        );
      })}
      {without.length > 0 && (
        <Card>
          <H2>Pendientes de recibo timbrado</H2>
          {without.map(p => <Row key={p.id}><T>{p.employee}</T><Muted>{clientName(data, p.clientId)} · neto {formatMXN(payrollNet(p))}</Muted><Badge tone="warn" label="Sin recibo" /></Row>)}
        </Card>
      )}
      {importing && <RecibosImport onClose={() => setImporting(false)} />}
    </>
  );
}
