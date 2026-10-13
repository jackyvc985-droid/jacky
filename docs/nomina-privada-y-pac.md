# Nómina privada e integración PAC: qué se hizo y qué no

Respuesta al documento «Base de datos, nómina privada e integración PAC». Ese documento está escrito para el código del kit (MySQL/Drizzle); este proyecto usa su propio servidor (Node + SQLite). Se tomaron sus objetivos, no su estructura de tablas.

Leyenda: ✔ hecho y probado · ◐ parcial · ✗ no hecho (con motivo).

| Punto del documento | Estado | Cómo quedó |
|---|---|---|
| §1 La nómina no debe llegar a quien no corresponde (JSON, CSV, gráficos, búsquedas, archivos) | ✔ | El servidor arma la respuesta según el rol: quien no ve nómina no recibe nóminas, trabajadores ni sus archivos. Probado revisando el JSON y la descarga directa por clave, no solo la pantalla |
| §2 Espacio → cliente → trabajador → recibo, con identificadores internos | ◐ | Hay espacio, cliente, trabajador y recibo con identificador interno (nunca RFC, correo o nombre). El periodo sigue siendo mensual con las fechas reales del CFDI guardadas en el recibo; no hay «corridas» de nómina propias (quincenas/extraordinarias) |
| §3 Tablas separadas con claves foráneas compuestas, bóveda/KMS, perfiles privados | ✗ | Los datos viven en un documento por espacio, con filtrado por rol en el servidor. Pasarlo a tablas relacionales es una migración grande; no se hizo porque el filtrado por rol + cifrado cubre el riesgo inmediato. Queda como opción (con PostgreSQL) si crece el volumen |
| §3 Cifrar datos sensibles | ✔ **nuevo** | Datos del espacio y archivos se cifran en reposo con AES-256-GCM si se define `DATA_KEY`. Probado: ni la base (ni su registro WAL) ni los archivos contienen texto legible, y un archivo alterado se detecta. La clave la custodia quien opere el servidor, aparte de los respaldos. **Si se pierde, no hay forma de recuperar los datos** |
| §4 Política por rol (propietaria, contador, nómina, documental/proyectos/facturación, empleado) | ✔ | `docs/roles-y-permisos.md` |
| §4 Contador y responsable de nómina «solo clientes asignados» | ✔ **nuevo** | Cada persona del equipo se invita con los clientes que atiende («todos» o una lista; sin asignación no ve ninguno). Se cambia en cualquier momento. Lo interno sin cliente solo lo ve quien atiende «todos». Probado, incluido intentar colar o sustituir elementos de otro cliente |
| §4 Capacidades separadas (resumen / detalle / exportar / aprobar / timbrar / cancelar) | ◐ | Lectura y escritura se separan por colección. No hay «exportar» ni «descargar» como permisos aparte: el CSV se arma en el dispositivo con datos que ya recibió, así que no puede impedirse sin generar la exportación en el servidor. Aprobar/timbrar/cancelar no existen porque la app no timbra |
| §4 Invitados existentes: denegar por defecto | ✔ | Los clientes parten con documentos, proyectos y pendientes; nómina nunca por defecto. El equipo, sin clientes asignados, no ve nada |
| §5 Cada petición verifica sesión, membresía, alcance, rol y vínculo usuario–trabajador | ✔ | El contexto sale del servidor; lo que mande el navegador (identificadores, espacio) no se toma como cierto |
| §6 Archivos privados, sin claves expuestas, `no-store`, sin persistir nómina del portal | ✔ | Descargas por servidor autenticado (no hay enlaces firmados, así que revocar acceso corta la descarga al instante). Respuestas con `Cache-Control: private, no-store`. En modo nube el portal no guarda datos de nómina en el dispositivo; solo el token de sesión |
| §6 Auditoría de lectura, descarga y cambios | ✔ **ampliado** | Se registran descargas, cambios (con rol), accesos y, nuevo, la lectura de nómina por quien no es propietario (una vez cada 10 min por persona) |
| §7 Migración desde el JSON | ✗ | No aplica: se conserva el JSON (ahora cifrable). Los datos anteriores sin cifrar se leen y se cifran en su siguiente guardado |
| §8 Pruebas de aislamiento | ✔ | Dos clientes, varios trabajadores y roles; manipulación de identificadores y descargas directas; revocación; cifrado; alcance. Ver `tests/` |
| §9–§15 Integración con un PAC, CSD, timbrado, cancelación, estados fiscales | ✗ **no se hizo** | Ver abajo |
| §10 Perfil CFDI 4.0 / Nómina 1.2 rev. E (XSD + catálogos + matriz de errores) | ◐ | Se lee el complemento Nómina 1.2 y se revisa su coherencia (totales, percepciones, deducciones, CURP, tipo N). **No** se valida contra el XSD ni los catálogos del SAT; eso lo hace quien timbra |

## Por qué no se integró un PAC
1. **Hoy se timbra en CONTPAQi**, y la app ya recibe esos recibos (carga, validación, conciliación y entrega al cliente y al trabajador). Integrar un PAC duplicaría un paso que ya funciona.
2. Hace falta una **decisión y un contrato**: elegir un PAC verificado en la lista del SAT, su documentación de API, un ambiente de pruebas y los certificados de sello digital de **cada cliente emisor**. No se pueden inventar los endpoints ni usar certificados que la app no debe tener.
3. **Los certificados y llaves no se piden ni se guardan por chat.** Si algún día se integra, la firma debe ocurrir en un servicio con bóveda de claves, con aprobación por contenido exacto, claves de idempotencia y separación entre aprobar, timbrar y cancelar, como describe el documento.
4. Timbrar y cancelar tienen efectos fiscales: requieren autorización expresa de JACKY y revisión de un contador antes de activarse.

**Decisión de JACKY (12 oct 2026): se sigue con CONTPAQi.** CONTPAQi timbra; la app carga, valida, concilia y entrega los recibos. La integración con un PAC queda **descartada por ahora**. Si algún día se reabre, el material recibido (`CANVILLE_INICIO_NOMINA_Y_PRUEBAS_PAC`, la presentación y la guía de pruebas) describe cómo hacerlo; está escrito para el código de otra plataforma y habría que adaptarlo. El primer paso sería elegir un PAC de la lista del SAT y conseguir su ambiente de pruebas.

**Decisión de JACKY (12 oct 2026): sí se guarda la clave de cifrado**, según `docs/custodia-clave.md`.

## Operación del servidor
- Genera la clave: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` y defínela como `DATA_KEY` en un gestor de secretos del proveedor (nunca en el repositorio).
- Respaldos: copian la base y los archivos tal cual (cifrados). Guarda la clave por separado; un respaldo sin clave no se puede restaurar, y una clave sin respaldo tampoco.
- Cambiar de clave (o activar el cifrado en datos existentes): `npm run server:rekey` (ver `docs/custodia-clave.md`). Si la clave falta o no corresponde, el servidor **no arranca**, para no mezclar datos cifrados con datos sin cifrar.
