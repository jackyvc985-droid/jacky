import React, { useState } from 'react';
import { View } from 'react-native';
import { uid, useStore } from '../store';
import { Badge, Banner, Btn, Card, Empty, FormModal, H2, Muted, Page, Row, T, confirmAction, notify, theme, type Field } from '../ui/kit.tsx';
import { Employee } from '../domain/types.ts';
import { CONTRACT_TYPES, JORNADAS, PERIODICIDADES, blankEmployee, labelOf, maskClabe, validateEmployee } from '../domain/employees.ts';
import { formatMXN, parseMoney } from '../domain/money.ts';
import { payrollNet } from '../domain/accounting.ts';
import { api } from '../cloud';
import { useDocFiles } from '../docs';
import { clientName, clientOptions } from './common.ts';

const opts = (l: [string, string][]) => l.map(([value, label]) => ({ value: `${value}`, label: `${value} · ${label}` }));
const INFONAVIT = [{ value: '', label: 'Sin crédito' }, { value: 'porcentaje', label: 'Porcentaje' }, { value: 'cuota fija', label: 'Cuota fija' }, { value: 'veces SM', label: 'Veces salario mínimo' }];

const FIELDS: Field[] = [
  { key: 'name', label: 'Nombre completo (como en su CFDI)', required: true },
  { key: 'clientId', label: 'Empresa patrón (cliente)', type: 'select' },
  { key: 'numEmpleado', label: 'Número de empleado' },
  { key: 'rfc', label: 'RFC', hint: 'Con él se reconocen sus recibos timbrados.' },
  { key: 'curp', label: 'CURP' }, { key: 'nss', label: 'Número de seguridad social (11 dígitos)' },
  { key: 'birthDate', label: 'Fecha de nacimiento', type: 'date' },
  { key: 'email', label: 'Correo' }, { key: 'phone', label: 'Teléfono' },
  { key: 'address', label: 'Domicilio', type: 'multiline' }, { key: 'cp', label: 'Código postal' },
  { key: 'hireDate', label: 'Fecha de ingreso', type: 'date' },
  { key: 'status', label: 'Estado', type: 'select', options: [{ value: 'Activo', label: 'Activo' }, { value: 'Baja', label: 'Baja' }] },
  { key: 'endDate', label: 'Fecha de baja', type: 'date' },
  { key: 'puesto', label: 'Puesto' }, { key: 'departamento', label: 'Departamento' },
  { key: 'contractType', label: 'Tipo de contrato', type: 'select', options: opts(CONTRACT_TYPES) },
  { key: 'jornada', label: 'Jornada', type: 'select', options: opts(JORNADAS) },
  { key: 'periodicidad', label: 'Periodicidad de pago', type: 'select', options: opts(PERIODICIDADES) },
  { key: 'entidad', label: 'Entidad federativa (clave, p. ej. CMX, JAL)' },
  { key: 'dailySalary', label: 'Salario diario (MXN)', type: 'money' },
  { key: 'sbcDaily', label: 'Salario base de cotización / integrado diario (MXN)', type: 'money' },
  { key: 'bank', label: 'Banco' }, { key: 'clabe', label: 'CLABE (18 dígitos)' },
  { key: 'infonavitType', label: 'Descuento INFONAVIT', type: 'select', options: INFONAVIT },
  { key: 'infonavitValue', label: 'Valor del descuento INFONAVIT' }, { key: 'infonavitCredit', label: 'Número de crédito INFONAVIT' },
  { key: 'notes', label: 'Notas internas', type: 'multiline' },
];

const toForm = (e: Employee) => ({ ...e, dailySalary: e.dailySalaryCents ? (e.dailySalaryCents / 100).toFixed(2) : '', sbcDaily: e.sbcDailyCents ? (e.sbcDailyCents / 100).toFixed(2) : '' });

export default function Trabajadores({ role }: { role: 'propietario' | 'cliente' | 'lectura' }) {
  const { data, upsert, remove, mode, session, memberRole } = useStore();
  const files = useDocFiles();
  const [sel, setSel] = useState<string | null>(null);
  const [edit, setEdit] = useState<Employee | 'new' | null>(null);
  const [filter, setFilter] = useState('');
  const [showClabe, setShowClabe] = useState(false);
  const canEdit = role === 'propietario';
  const e = data.employees.find(x => x.id === sel);

  const save = (v: Record<string, string>) => {
    const dc = v.dailySalary ? parseMoney(v.dailySalary) : 0, sc = v.sbcDaily ? parseMoney(v.sbcDaily) : 0;
    if (dc === null || sc === null || dc < 0 || sc < 0) throw new Error('Salario inválido.');
    const item: Employee = {
      ...(edit && edit !== 'new' ? edit : blankEmployee(uid())),
      clientId: v.clientId, numEmpleado: v.numEmpleado.trim(), name: v.name.trim(), rfc: v.rfc.trim().toUpperCase(), curp: v.curp.trim().toUpperCase(), nss: v.nss.trim(), birthDate: v.birthDate,
      email: v.email.trim(), phone: v.phone.trim(), address: v.address, cp: v.cp.trim(), hireDate: v.hireDate, endDate: v.endDate, status: v.status === 'Baja' ? 'Baja' : 'Activo',
      puesto: v.puesto.trim(), departamento: v.departamento.trim(), contractType: v.contractType || '01', jornada: v.jornada || '01', periodicidad: v.periodicidad || '05', entidad: v.entidad.trim().toUpperCase(),
      dailySalaryCents: dc ?? 0, sbcDailyCents: sc ?? 0, bank: v.bank.trim(), clabe: v.clabe.replace(/\s/g, ''),
      infonavitType: (['porcentaje', 'cuota fija', 'veces SM'].includes(v.infonavitType) ? v.infonavitType : '') as Employee['infonavitType'], infonavitValue: v.infonavitValue.trim(), infonavitCredit: v.infonavitCredit.trim(), notes: v.notes,
    };
    const { errors } = validateEmployee(item);
    if (errors.length) throw new Error(errors[0]);
    upsert('employees', item, x => x.id === item.id);
    setEdit(null); setSel(item.id);
  };

  const fields = FIELDS.map(f => (f.key === 'clientId' ? { ...f, options: clientOptions(data, true) } : f));

  if (e) {
    const { warnings } = validateEmployee(e);
    const pays = data.payrolls.filter(p => p.employeeId === e.id).sort((a, b) => b.period.localeCompare(a.period));
    const row = (l: string, v: string) => <Row><Muted>{l}</Muted><T>{v || '—'}</T></Row>;
    return (
      <Page title={e.name} actions={<><Btn small kind="ghost" label="← Trabajadores" onPress={() => setSel(null)} />{canEdit && <Btn small label="Editar" onPress={() => setEdit(e)} />}</>}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Badge tone={e.status === 'Activo' ? 'ok' : 'muted'} label={e.status} />
          <Badge tone="muted" label={clientName(data, e.clientId)} />
        </View>
        {warnings.length > 0 && <Banner tone="warn">Pendiente de completar: {warnings.join(' ')}</Banner>}
        <Card>
          <H2>Datos personales</H2>
          {row('RFC', e.rfc)}{row('CURP', e.curp)}{row('NSS', e.nss)}{row('Nacimiento', e.birthDate)}{row('Correo', e.email)}{row('Teléfono', e.phone)}{row('Domicilio', e.address)}{row('Código postal', e.cp)}
        </Card>
        <Card>
          <H2>Relación laboral</H2>
          {row('Número de empleado', e.numEmpleado)}{row('Ingreso', e.hireDate)}{row('Baja', e.endDate)}{row('Puesto', e.puesto)}{row('Departamento', e.departamento)}
          {row('Contrato', labelOf(CONTRACT_TYPES, e.contractType))}{row('Jornada', labelOf(JORNADAS, e.jornada))}{row('Periodicidad de pago', labelOf(PERIODICIDADES, e.periodicidad))}{row('Régimen', e.regimen === '02' ? '02 · Sueldos' : e.regimen)}{row('Entidad federativa', e.entidad)}
        </Card>
        <Card>
          <H2>Salario y pago</H2>
          {row('Salario diario', e.dailySalaryCents ? formatMXN(e.dailySalaryCents) : '')}{row('SBC / integrado diario', e.sbcDailyCents ? formatMXN(e.sbcDailyCents) : '')}{row('Banco', e.bank)}
          <Row><Muted>CLABE</Muted><T>{e.clabe ? (showClabe ? e.clabe : maskClabe(e.clabe)) : '—'}</T>{e.clabe ? <Btn small kind="ghost" label={showClabe ? 'Ocultar' : 'Mostrar'} onPress={() => setShowClabe(v => !v)} /> : null}</Row>
          {row('Descuento INFONAVIT', e.infonavitType ? `${e.infonavitType}: ${e.infonavitValue} · crédito ${e.infonavitCredit || '—'}` : 'Sin crédito')}
        </Card>
        {e.notes ? <Card><H2>Notas internas</H2><T>{e.notes}</T></Card> : null}
        <Card>
          <H2>Nóminas y recibos</H2>
          {pays.length === 0 && <Muted>Aún no hay nóminas de este trabajador.</Muted>}
          {pays.map(p => {
            const xml = p.cfdi ? data.docs.find(d => d.id === p.cfdi!.xmlDocId) : undefined;
            const pdf = p.cfdi?.pdfDocId ? data.docs.find(d => d.id === p.cfdi!.pdfDocId) : undefined;
            return (
              <Row key={p.id}>
                <View style={{ flex: 1, minWidth: 150 }}><T bold>{p.period}</T><Muted>Neto {formatMXN(payrollNet(p))}{p.cfdi ? ` · UUID ${p.cfdi.uuid.slice(0, 8)}…` : ''}</Muted></View>
                <Badge tone={p.cfdi ? 'ok' : 'warn'} label={p.cfdi ? 'Timbrado' : 'Sin recibo timbrado'} />
                {xml && <Btn small kind="ghost" label="XML" onPress={() => files.open(xml).catch(x => notify(x.message))} />}
                {pdf && <Btn small kind="ghost" label="PDF" onPress={() => files.open(pdf).catch(x => notify(x.message))} />}
              </Row>
            );
          })}
        </Card>
        {mode === 'cloud' && session && memberRole === 'propietario' && <EmployeeAccess employee={e} />}
        {canEdit && <Btn kind="danger" label="Eliminar trabajador" onPress={() => {
          if (pays.length) return notify('Tiene nóminas registradas: cámbialo a «Baja» en lugar de eliminarlo, para conservar su historial.');
          confirmAction('¿Eliminar la ficha de este trabajador?', () => { remove('employees', x => x.id === e.id); setSel(null); });
        }} />}
        {edit && <FormModal title="Editar trabajador" fields={fields} initial={toForm(edit === 'new' ? blankEmployee('') : edit)} onSubmit={save} onClose={() => setEdit(null)} />}
      </Page>
    );
  }

  const list = data.employees.filter(x => !filter || x.clientId === filter).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Page title="Trabajadores" actions={canEdit ? <Btn label="+ Nuevo trabajador" onPress={() => setEdit('new')} /> : undefined}>
      <Muted>Ficha completa de cada trabajador: datos personales, relación laboral, salario, pago y sus recibos.</Muted>
      {data.clients.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Btn small kind={filter ? 'ghost' : 'primary'} label="Todos" onPress={() => setFilter('')} />
          {data.clients.map(c => <Btn key={c.id} small kind={filter === c.id ? 'primary' : 'ghost'} label={c.name} onPress={() => setFilter(c.id)} />)}
        </View>
      )}
      {list.length === 0 && <Empty>Sin trabajadores. {canEdit ? 'Créalos aquí o carga recibos timbrados en Nóminas: se crean solos.' : ''}</Empty>}
      <Card>
        {list.map(x => (
          <Row key={x.id} onPress={() => setSel(x.id)}>
            <View style={{ flex: 1, minWidth: 160 }}><T bold>{x.name}</T><Muted>{x.puesto || 'Sin puesto'} · {clientName(data, x.clientId)} · {x.rfc || 'sin RFC'}</Muted></View>
            <Badge tone={x.status === 'Activo' ? 'ok' : 'muted'} label={x.status} />
          </Row>
        ))}
      </Card>
      {edit === 'new' && <FormModal title="Nuevo trabajador" fields={fields} initial={toForm({ ...blankEmployee(''), clientId: filter || data.clients[0]?.id || '' })} onSubmit={save} onClose={() => setEdit(null)} />}
    </Page>
  );
}

/** Acceso del trabajador a sus propios recibos (nube): invitación con código de un solo uso. */
function EmployeeAccess({ employee }: { employee: Employee }) {
  const { session } = useStore();
  type Entry = { email: string; role: string; employeeId: string };
  const [list, setList] = useState<{ pending: Entry[]; members: Entry[] } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [code, setCode] = useState<{ email: string; code: string } | null>(null);
  const s = session!;
  const load = () => api(s.apiUrl, s.token, 'GET', `/ws/${s.workspaceId}/invites`).then(setList).catch(x => notify(x.message));
  React.useEffect(() => { load(); }, [employee.id]);
  const mine = (x: Entry) => x.role === 'empleado' && x.employeeId === employee.id;
  const revoke = (email: string) => api(s.apiUrl, s.token, 'DELETE', `/ws/${s.workspaceId}/invites/${encodeURIComponent(email)}`).then(load).catch(x => notify(x.message));
  return (
    <Card>
      <H2>Acceso del trabajador</H2>
      <Banner tone="info">El trabajador entra con su propio correo y ve solo su ficha, sus nóminas y sus recibos, nunca los de otros. La invitación genera un código de un solo uso que compartes tú; no se envía correo automático.</Banner>
      {code && <Banner tone="warn">Código para {code.email}: {code.code} — cópialo ahora, no se vuelve a mostrar.</Banner>}
      {list?.members.filter(mine).map(m => <Row key={m.email}><T>{m.email}</T><Badge tone="ok" label="Con acceso" /><Btn small kind="danger" label="Revocar" onPress={() => confirmAction(`¿Revocar acceso de ${m.email}?`, () => revoke(m.email))} /></Row>)}
      {list?.pending.filter(mine).map(m => <Row key={m.email}><T>{m.email}</T><Badge tone="warn" label="Invitación pendiente" /><Btn small kind="danger" label="Cancelar" onPress={() => revoke(m.email)} /></Row>)}
      <Btn small label="Invitar a ver sus recibos" onPress={() => setInviting(true)} />
      {inviting && <FormModal title="Invitar al trabajador" initial={{ email: employee.email }} fields={[{ key: 'email', label: 'Correo del trabajador', required: true }]} onClose={() => setInviting(false)}
        onSubmit={async v => { const r = await api<{ code: string; email: string }>(s.apiUrl, s.token, 'POST', `/ws/${s.workspaceId}/invites`, { email: v.email.trim(), role: 'empleado', employeeId: employee.id }); setCode(r); setInviting(false); load(); }} />}
    </Card>
  );
}
