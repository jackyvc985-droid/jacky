# Diagnóstico frente al kit de Canville

Se leyó el kit completo (habilidad `canville-desarrollo-integral`, 12 referencias, documentación y el código de la versión anterior).

**Decisión de base.** Este repositorio es una implementación propia y funcional (Expo + servidor Node/SQLite). El código del kit depende de la autenticación, el almacenamiento y las variables de otra plataforma (Manus), que no se exportan. Por eso **se usó el kit como especificación y no se importó su código**. Si se prefiere continuar el código del kit, es una migración distinta y debe decidirla JACKY.

Leyenda: ✔ comprobado con pruebas automáticas y/o recorrido en navegador · ◐ parcial · ✗ no existe todavía.

| Función | Estado comprobado | Riesgo o dependencia | Siguiente acción |
|---|---|---|---|
| Clientes, expedientes, tareas, proyectos | ✔ local y nube | Sin solicitudes, responsables, comentarios, versiones ni aprobaciones auditadas | Definir flujo de solicitudes y aprobaciones con JACKY |
| Documentos: tipos, estados, subida/descarga | ✔ | Descarga con token de sesión (no URL firmada); sin antivirus; sin clasificación de confidencialidad ni versiones | Clasificación + versiones; evaluar objeto privado con URL temporal |
| Validación de archivos (tipo, tamaño, contenido) | ✔ **nuevo** (cliente y servidor; rechaza ejecutables disfrazados; nombres sin rutas; SHA-256 en la nube) | No es antivirus | Escaneo según proveedor al desplegar |
| Portal de clientes | ✔ invitación por código, aislamiento, revocación inmediata; **solo consulta y descarga** (decisión de JACKY: el cliente no sube, edita ni borra) | Sin verificación de correo; sin MFA | Verificación de correo y MFA para propietario |
| **Permisos por módulo** | ✔ **nuevo**: el cliente ve por defecto solo documentos, proyectos y pendientes; el propietario abre cifras, presupuestos, previsión, obligaciones o nóminas por cliente y puede cambiarlo; el servidor filtra el JSON y las descargas (probado contra acceso directo por clave). Notas internas ocultas. Las membresías anteriores caen al mínimo | Solo dos roles (propietario/cliente) | **Aprobar la matriz de roles** (admin, contador, proyectos, documental, nómina, facturación, empleado) antes de implementarla |
| **Roles del equipo y trabajador** | ✔ **nuevo** (matriz aprobada por JACKY, `docs/roles-y-permisos.md`): administrador, contador, responsable de nómina, coordinador de proyectos, responsable de facturación y trabajador; el servidor filtra datos y descargas y autoriza guardados parciales sin pisar lo oculto | Sin verificación de correo ni MFA | Verificación de correo y MFA para nómina |
| **Alcance por cliente y cifrado en reposo** | ✔ **nuevo**: el equipo ve solo los clientes asignados; datos y archivos cifrables (AES-256-GCM, `DATA_KEY`); sin caché; auditoría de lectura de nómina | La clave debe custodiarse aparte de los respaldos. **JACKY decidió guardarla** (hoja en `docs/custodia-clave.md`; el servidor no arranca con una clave ausente o equivocada; herramienta para cambiarla) | Llenar la hoja de custodia y probar la restauración |
| Integración con PAC / timbrado desde la app | ✗ **descartada por decisión de JACKY: se sigue con CONTPAQi** (`docs/nomina-privada-y-pac.md`) | Reabrirla requeriría contratar un PAC y custodiar certificados | — |
| Nómina privada por colaborador | ◐ el trabajador ve solo lo suyo; el cliente con módulo «Nóminas» ve todas las del expediente | Falta permiso por colaborador para el cliente | Definir con JACKY si el cliente debe ver todas |
| **Trabajadores (ficha completa)** | ✔ **nuevo**: datos personales, relación laboral, salario, pago (CLABE con dígito verificador, oculta por defecto), INFONAVIT, historial y recibos | Datos sensibles: alojamiento cifrado y acceso restringido a cargo de quien opere el servidor | Aviso de privacidad y política de retención |
| **Recibos timbrados (CONTPAQi)** | ✔ **nuevo**: carga masiva de XML y PDF, reconocimiento de cliente y trabajador, validación del CFDI, duplicados por UUID, conciliación con el cálculo, visible al cliente (módulo «Nóminas») y al trabajador | No verifica sello ni estatus ante el SAT (consulta opcional por nube, sin probar contra el SAT); probado con XML de ejemplo con la forma de CONTPAQi, **no con archivos reales** | Probar con un lote real de CONTPAQi |
| **Desglose general de nómina** | ✔ **nuevo**: por periodo y cliente, todos los trabajadores, totales, estado de recibo y CSV | No incluye cuotas patronales ni ISN | Costo patronal cuando haya tablas validadas |
| Finanzas: centavos, presupuestos, CSV seguro | ✔ | Resultado = ingresos − gastos registrados; no es utilidad fiscal ni balance | Ledger con pólizas solo si se decide contabilidad formal |
| Excedente de presupuesto | ✔ **corregido**: se muestra «% utilizado» y «% por encima» por separado (10,540 contra 8,000 = 132 % utilizado y 32 % por encima) | — | — |
| Estados de cuenta (CSV, Excel, OFX) | ✔ (extra respecto al kit) | Probado con archivos de ejemplo, no con exportaciones reales de cada banco; sin PDF ni conciliación de saldos | Probar con exportaciones reales |
| **Planeación** (cobros/pagos esperados, 30/60/90, vencidos, agenda, CSV) | ✔ **nuevo**, con las reglas del kit (fronteras inclusivas, excluye cancelados/liquidados/vencidos, base = neto registrado) | Previsión, no saldo bancario; sin vínculo previsión↔movimiento | Vínculo explícito y reversible si se desea conciliar |
| **Estadísticas** con filtros | ✔ **nuevo**: cliente y periodo, tendencia a escala, distribución completa, presupuesto contra gasto, observaciones deterministas | Sin IA: solo reglas calculadas | — |
| Alertas internas | ✔ **ampliado**: vencimientos a 7 y 1 día, presupuesto 80/100 %, vencidos, documentos por revisar | Solo dentro de la app | Correo/push/WhatsApp requieren proveedor y consentimiento |
| Nómina: cálculo y desglose (en la app) | ✔ ISR, subsidio, IMSS obrero por concepto, recibo paso a paso | Tablas 2026 de fuentes secundarias, sin validar por contador; sin cuotas patronales, ISN, ajuste anual | Contador valida tablas; definir contribuyente/estado |
| Fiscal: obligaciones, validador de CFDI | ✔ / consulta al SAT implementada pero **sin probar contra el SAT** | No presenta declaraciones; no timbra; sin PAC | Contratar PAC con sandbox si se requiere timbrado |
| Local / nube / respaldo | ✔ cuentas, revisión optimista, sondeo 15 s, respaldo y restauración, migración local→nube, eliminación de cuenta y datos | Una réplica SQLite; sin sincronización offline (no se promete) | Alojar con HTTPS y respaldos programados |
| Planes y cobros | ◐ solo propuesta guardada | Sin proveedor de pago, precios/IVA/límites sin aprobar; reglas Play Billing/IAP | Decisión de modelo de cobro (la guía recomienda cobrar en la web) |
| Marca y diseño | ✔ **aplicado**: paleta (marino, verde azulado, coral), monograma, íconos Android/pantalla de inicio del kit | Disponer de los activos no acredita registro de marca | Registro IMPI por el titular |
| Android / iPhone | ◐ configuración preparada y verificada en el manifiesto generado | Sin builds de release ni pruebas en dispositivo físico | Cuentas de organización, firma, builds |
| Derechos y licencias | ◐ inventario de licencias | Contratos de titularidad, INDAUTOR e IMPI los gestiona Canville | Expediente de titularidad (ver `docs/publicacion-y-derechos.md`) |

## Decisiones que necesito de JACKY
1. Confirmar que se continúa con este código (servidor propio) y no con el del kit.
2. Aprobar la matriz de roles y permisos (en especial nómina y empleados).
3. Modelo de cobro, precios, IVA y límites por plan.
4. Dónde se aloja el servidor y la política de retención de copias.
5. Razón social titular e identificador definitivo de la app (el actual, `mx.grupocanville.app`, es provisional).
