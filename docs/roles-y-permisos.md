# Roles y permisos

Aprobada por JACKY para empezar. Se hace cumplir **en el servidor** (`src/domain/roles.ts` + `server/index.ts`): el rol decide qué datos se envían, qué se puede guardar y qué archivos se pueden descargar. Ocultar botones en la pantalla es solo comodidad; lo que no se ve, el servidor ni lo manda. Lo que no aparece en la tabla está **denegado**.

L = lee · E = lee y escribe · — = sin acceso

| | Propietaria | Administrador | Contador | Resp. de nómina | Coordinador de proyectos | Resp. de facturación | Cliente (portal) | Trabajador |
|---|---|---|---|---|---|---|---|---|
| Clientes (con notas internas) | E | E | L | L (sin notas) | L (sin notas) | L (sin notas) | solo el suyo, sin notas | su empresa (sin contacto ni notas) |
| Documentos | E | E (sin nómina) | E | E (solo «Nómina») | L (sin nómina) | E (solo CFDI/Factura) | suyos, según módulos | solo sus recibos |
| Tareas / Proyectos | E | E | L | — | E | — | según módulos | — |
| Movimientos / Previsiones | E | E | E | — | — | E | según módulos | — |
| Presupuestos / Obligaciones fiscales | E | E | E | — | — | L | según módulos | — |
| **Trabajadores** | E | — | E | E | — | — | — | solo su ficha |
| **Nóminas y recibos timbrados** | E | — | E | E | — | — | solo con el módulo «Nóminas» | solo las suyas |
| Equipo, accesos, bitácora, respaldos, planes | E | — | — | — | — | — | — | — |

Notas:
- Un **cliente** parte con el mínimo (documentos, proyectos y pendientes). Cifras, presupuestos, previsión, obligaciones y nóminas las abre el propietario módulo por módulo (ver `docs/diagnostico-kit.md`). Con el módulo «Nóminas» ve las de **todos** los trabajadores de su expediente.
- Un **trabajador** nunca ve datos de otro trabajador ni del despacho. Se invita desde su ficha con un código de un solo uso.
- Quien tiene permisos parciales puede guardar sin pisar lo que no ve: el servidor conserva intacto lo oculto, rechaza cambios en colecciones o documentos ajenos y rechaza sustituir un elemento que no ve.
- Pagar una licencia no concede administración.
- **Pendiente:** verificación de correo y MFA para los roles con acceso a nómina; permisos por colaborador para el cliente; comentarios y aprobaciones.
