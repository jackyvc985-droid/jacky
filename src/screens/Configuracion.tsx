import React from 'react';
import { useStore } from '../store.tsx';
import { Badge, Banner, Btn, Card, confirmAction, H2, Muted, Page, Row, T } from '../ui/kit.tsx';
import { removeFile } from '../files';

export default function Configuracion() {
  const { mode, data, startLocal, backToDemo, resetLocal, remove } = useStore();
  return (
    <Page title="Configuración">
      <Card>
        <H2>Modo de trabajo</H2>
        <Row><T>Modo actual</T><Badge tone={mode === 'demo' ? 'warn' : 'ok'} label={mode === 'demo' ? 'Demostración' : 'Dispositivo (datos reales)'} /></Row>
        {mode === 'demo' ? (
          <>
            <Muted>Los datos de demostración existen solo en memoria y no se guardan. Para registrar información real, trabaja en este dispositivo.</Muted>
            <Btn label="Trabajar en este dispositivo" onPress={() => confirmAction('Se abrirá tu espacio en este dispositivo (vacío si es la primera vez). ¿Continuar?', startLocal)} />
          </>
        ) : (
          <>
            <Muted>Tus datos se guardan en este dispositivo. El modo local no comparte datos ni se sincroniza con ninguna nube.</Muted>
            <Btn kind="ghost" label="Volver a demostración" onPress={() => confirmAction('Volverás a la demostración. Tus datos locales no se borran; los verás de nuevo al elegir «Trabajar en este dispositivo».', backToDemo)} />
            <Btn kind="danger" label="Borrar todos los datos de este dispositivo" onPress={() => confirmAction('Se borrarán clientes, documentos y registros de este dispositivo. No se puede deshacer.', async () => {
              for (const d of data.docs) await removeFile(d.fileKey).catch(() => {});
              resetLocal();
            })} />
          </>
        )}
      </Card>
      <Card>
        <H2>Accesos al portal</H2>
        {data.invites.length === 0 && <Muted>Sin invitaciones.</Muted>}
        {data.invites.map(i => (
          <Row key={i.email + i.clientId}>
            <T>{i.email} → {data.clients.find(c => c.id === i.clientId)?.name}</T>
            <Btn small kind="danger" label="Revocar" onPress={() => confirmAction(`¿Revocar acceso de ${i.email}?`, () => remove('invites', x => x.email === i.email && x.clientId === i.clientId))} />
          </Row>
        ))}
      </Card>
      <Banner tone="warn">Alcance de esta versión: opera sin conexión en este dispositivo. Inicio de sesión, espacios en nube, sincronización y portal con acceso remoto requieren un servidor propio y no están incluidos. No sustituye la asesoría de un contador.</Banner>
    </Page>
  );
}
