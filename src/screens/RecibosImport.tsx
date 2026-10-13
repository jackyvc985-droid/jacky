import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uid, useStore } from '../store';
import { Badge, Btn, H2, Muted, T, notify, theme } from '../ui/kit.tsx';
import { useDocFiles } from '../docs';
import { readUri } from '../files';
import { formatMXN } from '../domain/money.ts';
import { decodeBankText } from '../domain/statement.ts';
import { ReceiptPlan, buildReceiptRecords, pairPdf, planReceipts } from '../domain/receipts.ts';
import { sampleReceiptXml } from '../domain/sampleReceipt.ts';
import { localDate } from '../domain/planning.ts';
import type { Data } from '../domain/types.ts';

type XmlIn = { name: string; text: string };
const TONE = { nuevo: 'ok', actualiza: 'ok', duplicado: 'muted', revisar: 'warn', error: 'bad' } as const;
const LABEL = { nuevo: 'Nuevo', actualiza: 'Se asocia a una nómina existente (se usan las cifras del recibo)', duplicado: 'Ya cargado', revisar: 'Elige el cliente', error: 'Con errores: no se carga' } as const;

export default function RecibosImport({ onClose }: { onClose: () => void }) {
  const { data, add, upsert } = useStore();
  const files = useDocFiles();
  const [xmls, setXmls] = useState<XmlIn[]>([]);
  const [pdfs, setPdfs] = useState<{ name: string; bytes: Uint8Array }[]>([]);
  const [xmlBytes, setXmlBytes] = useState<Record<string, Uint8Array>>({});
  const [force, setForce] = useState<Record<string, string>>({});
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const plans = useMemo<ReceiptPlan[]>(() => {
    const items = xmls.map(x => {
      const uuid = /UUID="([0-9A-Fa-f-]{36})"/.exec(x.text)?.[1] ?? '';
      const emp = /NumEmpleado="([^"]*)"/.exec(x.text)?.[1] ?? '';
      return { xmlName: x.name, xmlText: x.text, pdfName: pairPdf(x.name, uuid, pdfs.map(p => p.name), emp) };
    });
    return planReceipts(items, data, force);
  }, [xmls, pdfs, data, force]);
  const orphanPdfs = pdfs.filter(p => !plans.some(pl => pl.pdfName === p.name));
  const selected = plans.filter(p => (p.status === 'nuevo' || p.status === 'actualiza') && !off[p.xmlName]);

  const pick = async () => {
    setErr('');
    try {
      const r = await DocumentPicker.getDocumentAsync({ multiple: true, type: ['text/xml', 'application/xml', 'application/pdf', '*/*'], copyToCacheDirectory: true });
      if (r.canceled) return;
      const nx: XmlIn[] = [], np: { name: string; bytes: Uint8Array }[] = [], nb: Record<string, Uint8Array> = {};
      for (const a of r.assets) {
        const bytes = await readUri(a.uri);
        const lower = a.name.toLowerCase();
        if (lower.endsWith('.xml')) { nx.push({ name: a.name, text: decodeBankText(bytes) }); nb[a.name] = bytes; }
        else if (lower.endsWith('.pdf')) np.push({ name: a.name, bytes });
        else throw new Error(`${a.name}: solo se aceptan archivos XML y PDF.`);
      }
      if (nx.length === 0) throw new Error('Incluye al menos un XML: es el recibo timbrado. El PDF solo lo acompaña.');
      setXmls(x => [...x.filter(o => !nx.some(n => n.name === o.name)), ...nx]); setPdfs(p => [...p, ...np]); setXmlBytes(b => ({ ...b, ...nb }));
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudieron leer los archivos'); }
  };

  const sample = () => {
    const emp = data.employees.find(e => e.rfc && e.curp && data.clients.find(c => c.id === e.clientId)?.rfc);
    const client = emp && data.clients.find(c => c.id === emp.clientId);
    if (!emp || !client) return setErr('Para probar con un ejemplo necesitas un trabajador con RFC y CURP, y su cliente con RFC.');
    const pay = data.payrolls.find(p => p.employeeId === emp.id && !p.cfdi);
    const text = sampleReceiptXml(client, emp, pay, localDate());
    setErr(''); setXmls(x => [...x, { name: `recibo-ejemplo-${x.length + 1}.xml`, text }]);
    setXmlBytes(b => ({ ...b, [`recibo-ejemplo-${xmls.length + 1}.xml`]: new TextEncoder().encode(text) }));
  };

  const confirm = async () => {
    if (selected.length === 0) return setErr('No hay recibos seleccionados.');
    setBusy(true); setErr('');
    try {
      // Se procesa uno por uno contra una copia de trabajo: varios recibos del mismo trabajador nuevo no lo duplican.
      let working: Data = data;
      const newEmployees = [], newDocs = [], payrolls = [];
      let n = 0;
      for (const sel of selected) {
        const plan = planReceipts([{ xmlName: sel.xmlName, xmlText: xmls.find(x => x.name === sel.xmlName)!.text, pdfName: sel.pdfName }], working, force)[0];
        if (plan.status !== 'nuevo' && plan.status !== 'actualiza') continue;
        const xml = await files.storeBytes(plan.xmlName, xmlBytes[plan.xmlName]);
        const pdfIn = plan.pdfName ? pdfs.find(p => p.name === plan.pdfName) : undefined;
        const pdf = pdfIn ? await files.storeBytes(pdfIn.name, pdfIn.bytes) : undefined;
        const rec = buildReceiptRecords(plan, working, uid, { xmlKey: xml.key, xmlSize: xml.size, pdfKey: pdf?.key, pdfSize: pdf?.size });
        working = { ...working, employees: rec.employee ? [...working.employees, rec.employee] : working.employees, docs: [...working.docs, ...rec.docs], payrolls: [...working.payrolls.filter(p => p.id !== rec.payroll.id), rec.payroll] };
        if (rec.employee) newEmployees.push(rec.employee);
        newDocs.push(...rec.docs); payrolls.push(rec.payroll); n++;
      }
      if (newEmployees.length) add('employees', newEmployees);
      if (newDocs.length) add('docs', newDocs);
      for (const p of payrolls) upsert('payrolls', p, x => x.id === p.id);
      onClose();
      notify(`Se cargaron ${n} recibo(s) timbrado(s)${newEmployees.length ? `; se crearon ${newEmployees.length} ficha(s) de trabajador para completar` : ''}. Quedan en el expediente del cliente (si tiene el módulo «Nóminas») y en el acceso de cada trabajador.`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo cargar'); }
    finally { setBusy(false); }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modal}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <H2>Subir recibos timbrados de CONTPAQi</H2>
            <Muted>Selecciona de una vez los XML (y PDF) que descargaste. El PDF se empareja con su XML por el nombre o por el UUID.</Muted>
            <View style={{ gap: 8, marginTop: 10 }}>
              <Btn kind="ghost" label={xmls.length ? `Agregar más archivos (${xmls.length} XML, ${pdfs.length} PDF)` : 'Elegir archivos XML y PDF'} onPress={pick} />
              <Btn small kind="ghost" label="Probar con un recibo de ejemplo (sin timbre real)" onPress={sample} />
            </View>
            {err ? <Text style={{ color: theme.bad, marginTop: 8 }}>{err}</Text> : null}

            {plans.length > 0 && <View style={{ marginTop: 12, gap: 10 }}>
              <T bold>{selected.length} de {plans.length} recibos se cargarán</T>
              {plans.map(p => {
                const n = p.parsed.nomina;
                const loadable = p.status === 'nuevo' || p.status === 'actualiza';
                return (
                  <View key={p.xmlName} style={[s.card, !loadable && p.status !== 'revisar' && { opacity: 0.7 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {loadable && <Switch value={!off[p.xmlName]} onValueChange={v => setOff(o => ({ ...o, [p.xmlName]: !v }))} />}
                      <T bold style={{ flex: 1, minWidth: 140 }}>{n ? n.receptor.nombre : p.xmlName}</T>
                      <Badge tone={TONE[p.status]} label={LABEL[p.status]} />
                    </View>
                    <Muted>{p.xmlName}{p.pdfName ? ` + ${p.pdfName}` : ' · sin PDF'}</Muted>
                    {n && <Muted>RFC {n.receptor.rfc} · pago {n.fechaPago} · periodo {p.period} · neto {formatMXN(n.totalCents)} · UUID {n.uuid.slice(0, 8)}…</Muted>}
                    {n && <Muted>Cliente: {data.clients.find(c => c.id === p.clientId)?.name ?? 'sin identificar'} · Trabajador: {p.employeeId ? data.employees.find(e => e.id === p.employeeId)?.name : 'nuevo (se crea su ficha)'}</Muted>}
                    {p.status === 'revisar' && (
                      <View style={s.chips}>
                        {data.clients.map(c => (
                          <Pressable key={c.id} onPress={() => setForce(f => ({ ...f, [p.xmlName]: c.id }))} style={s.chip}><Text style={{ fontSize: 12, color: theme.text }}>{c.name}</Text></Pressable>
                        ))}
                      </View>
                    )}
                    {p.errors.map(e => <Muted key={e} style={{ color: theme.bad }}>✕ {e}</Muted>)}
                    {p.warnings.map(w => <Muted key={w} style={{ color: theme.warn }}>• {w}</Muted>)}
                  </View>
                );
              })}
              {orphanPdfs.map(p => <Muted key={p.name} style={{ color: theme.warn }}>• {p.name}: este PDF no tiene su XML entre los archivos elegidos, así que no se carga. Súbelo junto con su XML.</Muted>)}
              <Muted>Se valida la coherencia interna del CFDI (totales, percepciones, deducciones, CURP). No se verifica el sello ni el estatus ante el SAT en esta carga.</Muted>
            </View>}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <Btn label="Cancelar" kind="ghost" onPress={onClose} />
              <Btn label={selected.length ? `Cargar ${selected.length} recibo(s)` : 'Cargar'} onPress={confirm} disabled={busy || selected.length === 0} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  modal: { backgroundColor: '#fff', borderRadius: 14, padding: 16, width: '100%', maxWidth: 760, maxHeight: '94%' },
  card: { borderWidth: 1, borderColor: theme.line, borderRadius: 10, padding: 10, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
});
