import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { parseMoney } from '../domain/money.ts';

export const theme = { bg: '#F6F8FB', card: '#ffffff', text: '#1E293B', muted: '#64748B', primary: '#002D54', accent: '#E18464', gold: '#C5A028', teal: '#0D9488', line: '#E2E8F0', ok: '#0F766E', warn: '#B45309', bad: '#B91C1C' };

export const Page = ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
  <ScrollView style={{ flex: 1 }} contentContainerStyle={s.page}>
    <View style={s.head}><Text style={s.h1}>{title}</Text><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{actions}</View></View>
    {children}
  </ScrollView>
);
export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => <View style={[s.card, style]}>{children}</View>;
export const H2 = ({ children }: { children: React.ReactNode }) => <Text style={s.h2}>{children}</Text>;
export const Muted = ({ children, style }: { children: React.ReactNode; style?: object }) => <Text style={[{ color: theme.muted, fontSize: 13 }, style]}>{children}</Text>;
export const T = ({ children, bold, style }: { children: React.ReactNode; bold?: boolean; style?: object }) => <Text style={[{ color: theme.text, fontSize: 15 }, bold && { fontWeight: '700' }, style]}>{children}</Text>;
export const Empty = ({ children }: { children: React.ReactNode }) => <Card><Muted>{children}</Muted></Card>;

export const Btn = ({ label, onPress, kind = 'primary', small, disabled }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; small?: boolean; disabled?: boolean }) => (
  <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[s.btn, small && s.btnSm, kind === 'ghost' && s.btnGhost, kind === 'danger' && s.btnDanger, disabled && { opacity: 0.4 }]}>
    <Text style={[s.btnT, kind === 'ghost' && { color: theme.primary }, kind === 'danger' && { color: theme.bad }, small && { fontSize: 13 }]}>{label}</Text>
  </Pressable>
);
export const Badge = ({ label, tone = 'muted' }: { label: string; tone?: 'ok' | 'warn' | 'bad' | 'muted' }) => {
  const c = tone === 'ok' ? theme.ok : tone === 'warn' ? theme.warn : tone === 'bad' ? theme.bad : theme.muted;
  return <Text style={[s.badge, { color: c, borderColor: c }]}>{label}</Text>;
};
export const Row = ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) =>
  onPress ? <Pressable onPress={onPress} accessibilityRole="button" style={s.row}>{children}</Pressable> : <View style={s.row}>{children}</View>;
export const Banner = ({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) => (
  <View style={[s.banner, tone === 'warn' ? { backgroundColor: '#fef3c7', borderColor: '#f59e0b' } : { backgroundColor: '#dbeafe', borderColor: '#60a5fa' }]}><Text style={{ color: theme.text, fontSize: 13 }}>{children}</Text></View>
);

export type Field = { key: string; label: string; type?: 'text' | 'money' | 'date' | 'select' | 'multi' | 'multiline' | 'period'; options?: { value: string; label: string }[]; required?: boolean; hint?: string };

export function FormModal({ title, fields, initial, onSubmit, onClose, extra }: {
  title: string; fields: Field[]; initial: Record<string, unknown>; onSubmit: (v: Record<string, string>) => void | Promise<void>; onClose: () => void; extra?: React.ReactNode;
}) {
  const [v, setV] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(fields.map(f => [f.key, ''])),
    ...Object.fromEntries(Object.entries(initial).map(([k, x]) => [k, typeof x === 'string' ? x : ''])),
  }));
  const [err, setErr] = useState('');
  const submit = async () => {
    for (const f of fields) {
      const val = (v[f.key] ?? '').trim();
      if (f.required && !val) return setErr(`Falta: ${f.label}`);
      if (f.type === 'money' && val && parseMoney(val) === null) return setErr(`Importe inválido: ${f.label}`);
      if (f.type === 'date' && val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) return setErr(`Fecha inválida (AAAA-MM-DD): ${f.label}`);
      if (f.type === 'period' && val && !/^\d{4}-(0[1-9]|1[0-2])$/.test(val)) return setErr(`Periodo inválido (AAAA-MM): ${f.label}`);
    }
    try { await onSubmit(v); } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo guardar'); }
  };
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modal}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.h2}>{title}</Text>
            {fields.map(f => (
              <View key={f.key} style={{ marginTop: 10 }}>
                <Text style={s.label}>{f.label}{f.required ? ' *' : ''}</Text>
                {f.type === 'multi' ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {f.options!.map(o => {
                      const on = (v[f.key] ?? '').split(',').includes(o.value);
                      return (
                        <Pressable key={o.value} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                          onPress={() => { const cur = (v[f.key] ?? '').split(',').filter(Boolean); setV({ ...v, [f.key]: (on ? cur.filter(x => x !== o.value) : [...cur, o.value]).join(',') }); }}
                          style={[s.chip, on && s.chipOn]}>
                          <Text style={[{ fontSize: 13, color: theme.text }, on && { color: '#fff' }]}>{on ? '✓ ' : ''}{o.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : f.type === 'select' ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {f.options!.map(o => (
                      <Pressable key={o.value} onPress={() => setV({ ...v, [f.key]: o.value })} style={[s.chip, v[f.key] === o.value && s.chipOn]}>
                        <Text style={[{ fontSize: 13, color: theme.text }, v[f.key] === o.value && { color: '#fff' }]}>{o.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    value={v[f.key] ?? ''} onChangeText={t => setV({ ...v, [f.key]: t })}
                    multiline={f.type === 'multiline'} keyboardType={f.type === 'money' ? 'decimal-pad' : 'default'}
                    placeholder={f.type === 'date' ? 'AAAA-MM-DD' : f.type === 'period' ? 'AAAA-MM' : f.type === 'money' ? '0.00' : ''}
                    style={[s.input, f.type === 'multiline' && { minHeight: 70 }]} placeholderTextColor="#9ca3af"
                  />
                )}
                {f.hint ? <Muted>{f.hint}</Muted> : null}
              </View>
            ))}
            {extra}
            {err ? <Text style={{ color: theme.bad, marginTop: 10 }}>{err}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <Btn label="Cancelar" kind="ghost" onPress={onClose} />
              <Btn label="Guardar" onPress={submit} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function confirmAction(msg: string, onYes: () => void) {
  if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm(msg)) onYes(); return; }
  const { Alert } = require('react-native');
  Alert.alert('Confirmar', msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Aceptar', style: 'destructive', onPress: onYes }]);
}
export function askConfirm(msg: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(typeof window !== 'undefined' && window.confirm(msg));
  const { Alert } = require('react-native');
  return new Promise(res => Alert.alert('Confirmar', msg, [{ text: 'Cancelar', style: 'cancel', onPress: () => res(false) }, { text: 'Eliminar', style: 'destructive', onPress: () => res(true) }], { cancelable: true, onDismiss: () => res(false) }));
}
export function notify(msg: string) {
  if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.alert(msg); return; }
  require('react-native').Alert.alert('Aviso', msg);
}

export const Bars = ({ data, height = 120 }: { data: { label: string; a: number; b: number }[]; height?: number }) => {
  const max = Math.max(1, ...data.flatMap(d => [d.a, d.b]));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 8 }}>
        {data.map(d => (
          <View key={d.label} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2, height }}>
            <View style={{ flex: 1, height: Math.max(2, (d.a / max) * height), backgroundColor: theme.primary, borderRadius: 3 }} />
            <View style={{ flex: 1, height: Math.max(2, (d.b / max) * height), backgroundColor: theme.accent, borderRadius: 3 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>{data.map(d => <Text key={d.label} style={{ flex: 1, fontSize: 11, color: theme.muted, textAlign: 'center' }}>{d.label.slice(2)}</Text>)}</View>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
        <Text style={{ fontSize: 13, color: theme.primary }}>■ Ingresos</Text><Text style={{ fontSize: 13, color: theme.accent }}>■ Gastos</Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 60, maxWidth: 980, width: '100%', alignSelf: 'center', gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  h1: { fontSize: 24, fontWeight: '800', color: theme.primary },
  h2: { fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 4 },
  card: { backgroundColor: theme.card, borderRadius: 12, padding: 14, gap: 6, borderWidth: 1, borderColor: theme.line },
  btn: { backgroundColor: theme.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' },
  btnSm: { paddingVertical: 6, paddingHorizontal: 10 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.primary },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.bad },
  btnT: { color: '#fff', fontWeight: '600', fontSize: 14 },
  badge: { fontSize: 12, borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.line, flexWrap: 'wrap' },
  banner: { borderWidth: 1, borderRadius: 10, padding: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modal: { backgroundColor: '#fff', borderRadius: 14, padding: 18, width: '100%', maxWidth: 520, maxHeight: '90%' },
  label: { fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 15, color: theme.text, backgroundColor: '#fff' },
  chip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  chipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
});
