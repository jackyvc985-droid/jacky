import React, { useState } from 'react';
import { Linking, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uid, useStore } from '../store';
import { Badge, Banner, Btn, Card, Empty, FormModal, Muted, Page, Row, T } from '../ui/kit.tsx';
import { Obligation, ObligationStatus } from '../domain/types.ts';
import { formatMXN, parseMoney } from '../domain/money.ts';
import { clientName, clientOptions, today, thisPeriod } from './common.ts';
import { CfdiReport, validateCfdi } from '../domain/cfdi.ts';
import { api } from '../cloud';
import { exportText } from '../files';
import { toCSV } from '../domain/csv.ts';
import { periodOf, totals } from '../domain/accounting.ts';
import { notify } from '../ui/kit.tsx';

const ST: ObligationStatus[] = ['Pendiente', 'Presentada', 'Pagada'];
const LINKS = [['Portal SAT', 'https://www.sat.gob.mx'], ['Declaraciones', 'https://www.sat.gob.mx/aplicacion/53175/presenta-tu-declaracion-de-impuestos'], ['Validar CFDI', 'https://verificacfdi.facturaelectronica.sat.gob.mx']] as const;

export default function Fiscal({ role = 'propietario' }: { role?: 'propietario' | 'cliente' | 'lectura' }) {
  const { data, upsert, remove, session, mode } = useStore();
  const [xml, setXml] = useState('');
  const [rep, setRep] = useState<CfdiReport | null>(null);
  const [sat, setSat] = useState('');
  const [edit, setEdit] = useState<Obligation | 'new' | null>(null);
  const list = [...data.obligations].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const save = (v: Record<string, string>) => {
    const o: Obligation = { id: edit && edit !== 'new' ? edit.id : uid(), name: v.name.trim(), clientId: v.clientId || '', dueDate: v.dueDate, amountCents: parseMoney(v.amount || '0')!, status: (ST as string[]).includes(v.status) ? (v.status as ObligationStatus) : 'Pendiente' };
    upsert('obligations', o, x => x.id === o.id); setEdit(null);
  };
  const analyze = (t: string) => { setXml(t); setSat(''); setRep(t.trim() ? validateCfdi(t) : null); };
  const pickXml = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['text/xml', 'application/xml', '*/*'], copyToCacheDirectory: true });
    if (!r.canceled && r.assets[0]) analyze(await (await fetch(r.assets[0].uri)).text());
  };
  const checkSat = async () => {
    if (!rep?.uuid || !session) return;
    setSat('Consultando…');
    try {
      const r = await api<{ estado: string; codigo: string; cancelable: string }>(session.apiUrl, session.token, 'POST', '/cfdi/status', { re: rep.emisorRfc, rr: rep.receptorRfc, total: ((rep.total ?? 0) / 100).toFixed(2), uuid: rep.uuid });
      setSat(`SAT: ${r.estado} — ${r.codigo}`);
    } catch (e) { setSat(`No se pudo consultar al SAT: ${e instanceof Error ? e.message : 'error'}`); }
  };
  const exportSummary = () => {
    const per = thisPeriod();
    const ms = data.movements.filter(m => periodOf(m.date) === per);
    const t = totals(ms);
    const rows: (string | number)[][] = [['concepto', 'importe_mxn'], ['periodo', per], ['ingresos_registrados', (t.income / 100).toFixed(2)], ['gastos_registrados', (t.expense / 100).toFixed(2)], ['resultado_ingresos_menos_gastos', (t.result / 100).toFixed(2)]];
    data.obligations.filter(o => o.status === 'Pendiente').forEach(o => rows.push([`obligacion_pendiente: ${o.name} (vence ${o.dueDate})`, (o.amountCents / 100).toFixed(2)]));
    exportText(`resumen-fiscal-${per}.csv`, toCSV(rows)).catch(e => notify(e.message));
  };
  return (
    <Page title="Fiscal" actions={<><Btn small kind="ghost" label="Exportar resumen del mes" onPress={exportSummary} />{role === 'propietario' && <Btn label="+ Obligación" onPress={() => setEdit('new')} />}</>}>
      <Banner tone="warn">Sirve para organizar obligaciones, importes capturados, fechas y estados. Esta app NO presenta declaraciones: eso se hace en el portal del SAT con e.firma o contraseña, que la app nunca solicita ni guarda. Las reglas vigentes deben confirmarse con un contador.</Banner>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{LINKS.map(([l, u]) => <Btn key={l} small kind="ghost" label={l} onPress={() => Linking.openURL(u)} />)}</View>
      <Card>
        <Muted>Validador de CFDI (XML 3.3/4.0): revisa estructura, RFC, UUID, timbre y aritmética. No verifica sello ni cadena original.</Muted>
        <Btn small kind="ghost" label="Elegir archivo XML" onPress={pickXml} />
        <TextInput multiline value={xml} onChangeText={analyze} placeholder="…o pega aquí el XML" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 8, minHeight: 70 }} />
        {rep && <>
          <Badge tone={rep.ok ? 'ok' : 'bad'} label={rep.ok ? 'Estructura válida' : 'Con errores'} />
          {rep.uuid ? <T>UUID {rep.uuid} · {rep.emisorRfc} → {rep.receptorRfc} · Total {formatMXN(rep.total ?? 0)}</T> : null}
          {rep.errors.map(e => <Muted key={e} style={{ color: '#b91c1c' }}>✕ {e}</Muted>)}
          {rep.warnings.map(e => <Muted key={e}>• {e}</Muted>)}
          {rep.ok && (mode === 'cloud' && session
            ? <Btn small kind="ghost" label="Consultar estatus ante el SAT" onPress={checkSat} />
            : <Muted>La consulta de estatus ante el SAT se hace a través del servidor: inicia sesión en la nube para usarla.</Muted>)}
          {sat ? <T bold>{sat}</T> : null}
        </>}
      </Card>
      {list.length === 0 && <Empty>Sin obligaciones registradas.</Empty>}
      {list.map(o => (
        <Card key={o.id}>
          <Row><T bold>{o.name}</T><Badge label={o.status} tone={o.status === 'Pendiente' ? (o.dueDate < today() ? 'bad' : 'warn') : 'ok'} /></Row>
          <Muted>{clientName(data, o.clientId)} · Vence {o.dueDate} · Importe capturado {formatMXN(o.amountCents)}</Muted>
          {role === 'propietario' && <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {ST.filter(s => s !== o.status).map(s => <Btn key={s} small kind="ghost" label={`→ ${s}`} onPress={() => upsert('obligations', { ...o, status: s }, x => x.id === o.id)} />)}
            <Btn small kind="ghost" label="Editar" onPress={() => setEdit(o)} /><Btn small kind="danger" label="Eliminar" onPress={() => remove('obligations', x => x.id === o.id)} />
          </View>}
        </Card>
      ))}
      {edit && <FormModal title={edit === 'new' ? 'Nueva obligación' : 'Editar obligación'} onClose={() => setEdit(null)} onSubmit={save}
        initial={edit === 'new' ? { status: 'Pendiente', dueDate: today() } : { ...edit, amount: (edit.amountCents / 100).toFixed(2) }}
        fields={[
          { key: 'name', label: 'Obligación', required: true },
          { key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions(data, true) },
          { key: 'dueDate', label: 'Fecha límite', type: 'date', required: true },
          { key: 'amount', label: 'Importe capturado (MXN)', type: 'money' },
          { key: 'status', label: 'Estado', type: 'select', options: ST.map(s => ({ value: s, label: s })) },
        ]} />}
    </Page>
  );
}
