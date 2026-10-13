import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider, useStore } from './src/store';
import { canRead, canWrite, type Coll } from './src/domain/roles.ts';
import Trabajadores from './src/screens/Trabajadores';
import MisRecibos from './src/screens/MisRecibos';
import type { Role } from './src/screens/common.ts';
import type { ClientModule } from './src/domain/permissions.ts';
import { Banner, Btn, theme } from './src/ui/kit.tsx';
import Inicio from './src/screens/Inicio.tsx';
import Clientes from './src/screens/Clientes.tsx';
import Documentos from './src/screens/Documentos.tsx';
import Tareas from './src/screens/Tareas.tsx';
import Proyectos from './src/screens/Proyectos.tsx';
import Movimientos from './src/screens/Movimientos.tsx';
import Presupuestos from './src/screens/Presupuestos.tsx';
import Nominas from './src/screens/Nominas.tsx';
import Fiscal from './src/screens/Fiscal.tsx';
import Estadisticas from './src/screens/Estadisticas';
import Planeacion from './src/screens/Planeacion';
import Planes from './src/screens/Planes.tsx';
import Configuracion from './src/screens/Configuracion.tsx';

type Key = 'inicio' | 'planeacion' | 'estadisticas' | 'clientes' | 'documentos' | 'tareas' | 'proyectos' | 'movimientos' | 'presupuestos' | 'trabajadores' | 'nominas' | 'recibos' | 'fiscal' | 'planes' | 'config';
const OWNER_NAV: [Key, string][] = [['inicio', 'Inicio'], ['planeacion', 'Planeación'], ['estadisticas', 'Estadísticas'], ['clientes', 'Clientes'], ['documentos', 'Documentos'], ['tareas', 'Tareas'], ['proyectos', 'Proyectos'], ['movimientos', 'Movimientos'], ['presupuestos', 'Presupuestos'], ['trabajadores', 'Trabajadores'], ['nominas', 'Nóminas'], ['fiscal', 'Fiscal'], ['planes', 'Planes'], ['config', 'Configuración']];
// Colección que debe poder leer el rol del equipo para ver cada pantalla (el servidor la filtra igual).
const NAV_COLL: Partial<Record<Key, Coll>> = { clientes: 'clients', documentos: 'docs', tareas: 'tasks', proyectos: 'projects', movimientos: 'movements', estadisticas: 'movements', presupuestos: 'budgets', planeacion: 'forecasts', fiscal: 'obligations', nominas: 'payrolls', trabajadores: 'employees' };
// Cada pantalla del portal exige su módulo; sin módulo no aparece (y el servidor tampoco envía esos datos).
const CLIENT_NAV: [Key, string, ClientModule | null][] = [['inicio', 'Mi expediente', null], ['documentos', 'Documentos', 'documentos'], ['proyectos', 'Proyectos', 'proyectos'], ['tareas', 'Pendientes', 'tareas'], ['movimientos', 'Cifras', 'movimientos'], ['estadisticas', 'Estadísticas', 'movimientos'], ['presupuestos', 'Presupuestos', 'presupuestos'], ['planeacion', 'Previsión', 'previsiones'], ['fiscal', 'Obligaciones', 'fiscal'], ['nominas', 'Nóminas', 'nominas']];

function Shell() {
  const { ready, mode, previewClientId, setPreviewClientId, data, role, memberRole, notice, clearNotice, sync, session, modules } = useStore();
  const [screen, setScreen] = useState<Key>('inicio');
  const [docClient, setDocClient] = useState('');
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const clientNav: [Key, string][] = CLIENT_NAV.filter(n => n[2] === null || (modules ?? []).includes(n[2])).map(n => [n[0], n[1]]);
  const staffNav: [Key, string][] = OWNER_NAV.filter(([k]) => k === 'inicio' || k === 'config' || (memberRole === 'propietario') || (NAV_COLL[k] && canRead(memberRole, NAV_COLL[k]!)));
  const nav: [Key, string][] = memberRole === 'empleado' ? [['recibos', 'Mis recibos'], ['config', 'Cuenta']] : role === 'cliente' ? (previewClientId ? clientNav : [...clientNav, ['config', 'Cuenta']]) : staffNav;
  // Rol efectivo por pantalla: edita quien puede escribir esa colección; el resto solo consulta.
  const eff = (c: Coll): Role => (role === 'cliente' ? 'cliente' : canWrite(memberRole, c) ? 'propietario' : 'lectura');
  const current: Key = nav.some(n => n[0] === screen) ? screen : nav[0][0];

  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>;

  const go = (k: Key) => { setScreen(k); if (k !== 'documentos') setDocClient(''); };
  const body = (() => {
    switch (current) {
      case 'inicio': return <Inicio role={role} />;
      case 'clientes': return <Clientes readOnly={eff('clients') !== 'propietario'} onOpenDocs={id => { setDocClient(id); setScreen('documentos'); }} />;
      case 'documentos': return <Documentos key={docClient} role={eff('docs')} filterClient={docClient} />;
      case 'tareas': return <Tareas role={eff('tasks')} />;
      case 'proyectos': return <Proyectos role={eff('projects')} />;
      case 'movimientos': return <Movimientos role={eff('movements')} />;
      case 'presupuestos': return <Presupuestos role={eff('budgets')} />;
      case 'trabajadores': return <Trabajadores role={eff('employees')} />;
      case 'nominas': return <Nominas role={eff('payrolls')} />;
      case 'recibos': return <MisRecibos />;
      case 'fiscal': return <Fiscal role={eff('obligations')} />;
      case 'estadisticas': return <Estadisticas role={role} />;
      case 'planeacion': return <Planeacion role={eff('forecasts')} />;
      case 'planes': return <Planes />;
      case 'config': return <Configuracion />;
    }
  })();

  const menu = (
    <ScrollView horizontal={!wide} style={wide ? s.side : s.top} contentContainerStyle={wide ? { padding: 12, gap: 4 } : { padding: 8, gap: 6 }} showsHorizontalScrollIndicator={false}>
      {wide && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 8 }}><Image source={require('./assets/icon.png')} style={{ width: 30, height: 30, borderRadius: 6 }} accessibilityLabel="Canville" /><Text style={[s.brand, { marginBottom: 0, paddingHorizontal: 0, fontSize: 16, lineHeight: 18 }]}>Grupo{"\n"}Canville</Text></View>}
      {nav.map(([k, l]) => (
        <Pressable key={k} onPress={() => go(k)} style={[s.item, current === k && s.itemOn]}>
          <Text style={[s.itemT, current === k && { color: '#fff' }]}>{l}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style="dark" />
      {mode === 'demo' && !previewClientId && (
        <View style={s.demo}><Text style={s.demoT}>MODO DEMOSTRACIÓN · datos de ejemplo, no se guardan</Text>
          <Btn small kind="ghost" label="Configurar" onPress={() => setScreen('config')} /></View>
      )}
      {mode === 'cloud' && session && !previewClientId && (
        <View style={s.cloud}><Text style={s.cloudT}>NUBE · {session.email} · {sync.state === 'saving' ? 'guardando…' : sync.state === 'error' ? `sin sincronizar (${sync.message})` : 'sincronizado'}</Text></View>
      )}
      {notice ? (
        <View style={{ padding: 8 }}><Banner tone="warn">{notice}</Banner><View style={{ alignSelf: 'flex-start', marginTop: 6 }}><Btn small kind="ghost" label="Entendido" onPress={clearNotice} /></View></View>
      ) : null}
      {previewClientId && (
        <View style={{ padding: 8 }}><Banner tone="info">Vista previa de cliente: {data.clients.find(c => c.id === previewClientId)?.name}. No modifica los permisos reales.</Banner>
          <View style={{ alignSelf: 'flex-start', marginTop: 6 }}><Btn small label="Salir de la vista previa" onPress={() => setPreviewClientId('')} /></View></View>
      )}
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
        {menu}
        <View style={{ flex: 1 }}>{body}</View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}

const s = StyleSheet.create({
  side: { width: 210, flexGrow: 0, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: theme.line },
  top: { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: theme.line },
  brand: { fontSize: 22, fontWeight: '800', color: theme.primary, marginBottom: 10, paddingHorizontal: 8 },
  item: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8 },
  itemOn: { backgroundColor: theme.primary },
  itemT: { color: theme.text, fontWeight: '600', fontSize: 14 },
  demo: { backgroundColor: '#fef3c7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  cloud: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 4 },
  cloudT: { color: '#166534', fontSize: 12, fontWeight: '700' },
  demoT: { color: '#92400e', fontSize: 12, fontWeight: '700', flex: 1 },
});
