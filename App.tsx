import React, { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider, useStore } from './src/store.tsx';
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
import Resultados from './src/screens/Resultados.tsx';
import Planes from './src/screens/Planes.tsx';
import Configuracion from './src/screens/Configuracion.tsx';

type Key = 'inicio' | 'clientes' | 'documentos' | 'tareas' | 'proyectos' | 'movimientos' | 'presupuestos' | 'nominas' | 'fiscal' | 'resultados' | 'planes' | 'config';
const OWNER_NAV: [Key, string][] = [['inicio', 'Inicio'], ['clientes', 'Clientes'], ['documentos', 'Documentos'], ['tareas', 'Tareas'], ['proyectos', 'Proyectos'], ['movimientos', 'Movimientos'], ['presupuestos', 'Presupuestos'], ['nominas', 'Nóminas'], ['fiscal', 'Fiscal'], ['resultados', 'Resultados'], ['planes', 'Planes'], ['config', 'Configuración']];
const CLIENT_NAV: [Key, string][] = [['inicio', 'Mi expediente'], ['documentos', 'Documentos'], ['proyectos', 'Proyectos'], ['tareas', 'Pendientes'], ['movimientos', 'Cifras'], ['nominas', 'Nóminas'], ['resultados', 'Resultados']];

function Shell() {
  const { ready, mode, previewClientId, setPreviewClientId, data } = useStore();
  const [screen, setScreen] = useState<Key>('inicio');
  const [docClient, setDocClient] = useState('');
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const role = previewClientId ? 'cliente' : 'propietario';
  const nav = role === 'cliente' ? CLIENT_NAV : OWNER_NAV;
  const current: Key = nav.some(n => n[0] === screen) ? screen : 'inicio';

  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>;

  const go = (k: Key) => { setScreen(k); if (k !== 'documentos') setDocClient(''); };
  const body = (() => {
    switch (current) {
      case 'inicio': return <Inicio role={role} />;
      case 'clientes': return <Clientes onOpenDocs={id => { setDocClient(id); setScreen('documentos'); }} />;
      case 'documentos': return <Documentos key={docClient} role={role} filterClient={docClient} />;
      case 'tareas': return <Tareas role={role} />;
      case 'proyectos': return <Proyectos role={role} />;
      case 'movimientos': return <Movimientos role={role} />;
      case 'presupuestos': return <Presupuestos />;
      case 'nominas': return <Nominas role={role} />;
      case 'fiscal': return <Fiscal />;
      case 'resultados': return <Resultados />;
      case 'planes': return <Planes />;
      case 'config': return <Configuracion />;
    }
  })();

  const menu = (
    <ScrollView horizontal={!wide} style={wide ? s.side : s.top} contentContainerStyle={wide ? { padding: 12, gap: 4 } : { padding: 8, gap: 6 }} showsHorizontalScrollIndicator={false}>
      {wide && <Text style={s.brand}>Canville</Text>}
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
  demoT: { color: '#92400e', fontSize: 12, fontWeight: '700', flex: 1 },
});
