import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uid, useStore } from '../store';
import { Badge, Btn, H2, Muted, T, notify, theme } from '../ui/kit.tsx';
import { useDocFiles } from '../docs';
import { readUri } from '../files';
import { formatMXN } from '../domain/money.ts';
import { Mapping, StmtParse, applyMapping, markDuplicates, parseStatementBytes, parseStatementText, sampleStatement, summarize } from '../domain/statement.ts';

const FIELDS: { key: keyof Mapping; label: string }[] = [
  { key: 'date', label: 'Fecha' }, { key: 'concept', label: 'Concepto' }, { key: 'debit', label: 'Cargo' }, { key: 'credit', label: 'Abono' }, { key: 'amount', label: 'Monto con signo' },
];
const SHOW_LIMIT = 300;

export default function EstadoDeCuenta({ onClose }: { onClose: () => void }) {
  const { data, add } = useStore();
  const files = useDocFiles();
  const [clientId, setClientId] = useState(data.clients[0]?.id ?? '');
  const [parse, setParse] = useState<StmtParse | null>(null);
  const [rows, setRows] = useState<StmtParse['rows']>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [include, setInclude] = useState<boolean[]>([]);
  const [picked, setPicked] = useState<{ uri: string; name: string; mime: string; size: number } | null>(null);
  const [attach, setAttach] = useState(true);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const dups = useMemo(() => markDuplicates(rows, data.movements, clientId), [rows, data.movements, clientId]);
  const load = (p: StmtParse) => {
    setParse(p); setRows(p.rows); setErrors(p.errors);
    setInclude(markDuplicates(p.rows, data.movements, clientId).map(d => !d));
  };

  const pick = async () => {
    setErr('');
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/x-ofx', 'application/octet-stream', '*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      const bytes = await readUri(a.uri);
      const p = parseStatementBytes(bytes);
      setPicked({ uri: a.uri, name: a.name, mime: a.mimeType ?? '', size: a.size ?? bytes.length });
      load(p);
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo leer el archivo'); setParse(null); setRows([]); }
  };
  const analyzePaste = (t: string) => {
    setPaste(t); setPicked(null); setErr('');
    if (!t.trim()) { setParse(null); setRows([]); setErrors([]); return; }
    load(parseStatementText(t));
  };
  const remap = (key: keyof Mapping, idx: number) => {
    if (!parse) return;
    const mapping = { ...parse.mapping, [key]: idx };
    const r = applyMapping(parse.table, parse.headerIndex, mapping);
    setParse({ ...parse, mapping, rows: r.rows, errors: r.errors });
    setRows(r.rows); setErrors(r.errors);
    setInclude(markDuplicates(r.rows, data.movements, clientId).map(d => !d));
  };

  const chosen = rows.filter((_, i) => include[i]);
  const sum = summarize(chosen);
  const dupCount = dups.filter(Boolean).length;

  const confirm = async () => {
    if (!clientId) return setErr('Elige el cliente al que pertenece el estado de cuenta.');
    if (chosen.length === 0) return setErr('No hay movimientos seleccionados.');
    setBusy(true); setErr('');
    try {
      add('movements', chosen.map(r => ({ id: uid(), date: r.date, type: r.type, concept: r.concept, category: r.category.trim() || 'Sin categorizar', amountCents: r.amountCents, clientId })));
      let note = '';
      if (attach && picked) {
        try { await files.upload(picked, { clientId, category: 'Estado de cuenta', period: sum.from.slice(0, 7) }); }
        catch (e) { note = ` No se pudo guardar el archivo original en el expediente: ${e instanceof Error ? e.message : 'error'}.`; }
      }
      onClose();
      notify(`Se importaron ${chosen.length} movimientos.${note}`);
    } finally { setBusy(false); }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modal}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <H2>Importar estado de cuenta</H2>
            <Muted>Acepta CSV, Excel (.xlsx) y OFX/QFX descargados de la banca en línea. Los PDF no se pueden leer de forma confiable.</Muted>

            <Text style={s.label}>Cliente *</Text>
            {data.clients.length === 0 && <Muted>Primero crea un cliente.</Muted>}
            <View style={s.chips}>
              {data.clients.map(c => (
                <Pressable key={c.id} onPress={() => { setClientId(c.id); if (parse) setInclude(markDuplicates(rows, data.movements, c.id).map(d => !d)); }} style={[s.chip, clientId === c.id && s.chipOn]}>
                  <Text style={[{ fontSize: 13, color: theme.text }, clientId === c.id && { color: '#fff' }]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ gap: 8, marginTop: 12 }}>
              <Btn kind="ghost" label={picked ? `📎 ${picked.name}` : 'Elegir archivo del banco'} onPress={pick} />
              <Btn small kind="ghost" label="Probar con un estado de cuenta de ejemplo" onPress={() => analyzePaste(sampleStatement())} />
              <TextInput multiline value={paste} onChangeText={analyzePaste} placeholder="…o pega aquí el contenido CSV / OFX" placeholderTextColor="#9ca3af" style={s.input} />
            </View>
            {err ? <Text style={{ color: theme.bad, marginTop: 8 }}>{err}</Text> : null}

            {parse && parse.format !== 'ofx' && (
              <View style={{ marginTop: 12, gap: 6 }}>
                <Text style={s.label}>Columnas detectadas (corrígelas si hace falta)</Text>
                {FIELDS.map(f => (
                  <View key={f.key} style={{ gap: 4 }}>
                    <Muted>{f.label}</Muted>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={s.chips}>
                        {[-1, ...parse.headers.map((_, i) => i)].map(i => (
                          <Pressable key={i} onPress={() => remap(f.key, i)} style={[s.chip, parse.mapping[f.key] === i && s.chipOn]}>
                            <Text style={[{ fontSize: 12, color: theme.text }, parse.mapping[f.key] === i && { color: '#fff' }]}>{i < 0 ? '— ninguna —' : parse.headers[i] || `Col. ${i + 1}`}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                ))}
              </View>
            )}

            {parse && (
              <View style={{ marginTop: 14, gap: 6 }}>
                <H2>Vista previa</H2>
                <T>{chosen.length} de {rows.length} movimientos seleccionados{sum.from ? ` · ${sum.from} a ${sum.to}` : ''}</T>
                <T>Abonos {formatMXN(sum.credits)} · Cargos {formatMXN(sum.debits)}</T>
                {dupCount > 0 && <Badge tone="warn" label={`${dupCount} ya existen en este cliente (desmarcados)`} />}
                {errors.length > 0 && (
                  <View style={{ gap: 2 }}>
                    <Badge tone="bad" label={`${errors.length} fila(s) no se pudieron leer y NO se importarán`} />
                    {errors.slice(0, 6).map(e => <Muted key={e} style={{ color: theme.bad }}>{e}</Muted>)}
                    {errors.length > 6 && <Muted>…y {errors.length - 6} más</Muted>}
                  </View>
                )}
                <Muted>Revisa las categorías (sugeridas por palabras clave) y desmarca lo que no quieras importar. No se concilian saldos.</Muted>
                {rows.slice(0, SHOW_LIMIT).map((r, i) => (
                  <View key={`${r.line}-${i}`} style={[s.row, !include[i] && { opacity: 0.45 }]}>
                    <Switch value={!!include[i]} onValueChange={v => setInclude(inc => inc.map((x, k) => (k === i ? v : x)))} />
                    <View style={{ flex: 1, minWidth: 140 }}>
                      <T bold>{r.concept}</T>
                      <Muted>{r.date}{dups[i] ? ' · ya existe' : ''}</Muted>
                      <TextInput value={r.category} onChangeText={t => setRows(rs => rs.map((x, k) => (k === i ? { ...x, category: t } : x)))} style={s.cat} />
                    </View>
                    <T bold style={{ color: r.type === 'ingreso' ? theme.ok : theme.bad }}>{r.type === 'gasto' ? '-' : ''}{formatMXN(r.amountCents)}</T>
                  </View>
                ))}
                {rows.length > SHOW_LIMIT && <Muted>Se muestran los primeros {SHOW_LIMIT}; los demás se importan igual si están marcados.</Muted>}
                {picked && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Switch value={attach} onValueChange={setAttach} /><T>Guardar el archivo original en el expediente del cliente</T>
                  </View>
                )}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <Btn label="Cancelar" kind="ghost" onPress={onClose} />
              <Btn label={chosen.length ? `Importar ${chosen.length}` : 'Importar'} onPress={confirm} disabled={busy || chosen.length === 0 || !clientId} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  modal: { backgroundColor: '#fff', borderRadius: 14, padding: 16, width: '100%', maxWidth: 720, maxHeight: '94%' },
  label: { fontSize: 13, fontWeight: '600', color: theme.text, marginTop: 12, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  chipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 8, minHeight: 70, fontSize: 14, color: theme.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.line },
  cat: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, fontSize: 12, color: theme.text, alignSelf: 'flex-start', minWidth: 120 },
});
