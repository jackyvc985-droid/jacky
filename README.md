# Canville · Versión administrativa funcional

App de control administrativo (clientes, expedientes, documentos, tareas y proyectos) con pantallas de
movimientos, presupuestos, nóminas, fiscal, resultados y planes. Hecha con **Expo / React Native** y una
vista web adaptable: el mismo código corre en navegador (PC y celular), Android e iOS.

## Ejecutar
```bash
npm install
npm run web        # navegador
npm run android    # o: npm run ios  (requiere Expo Go o un build de desarrollo)
npm test           # pruebas de cálculos, CSV y permisos
npm run build:web  # exporta la versión web a dist/
```

## Cómo comenzar
La app abre en **demostración** (identificada como tal; los datos no se guardan ni se suben). Para trabajar con datos reales hay dos caminos:
- **Este dispositivo** (Configuración → Trabajar en este dispositivo): sin servidor, datos locales.
- **Nube** (Configuración → Cuenta en la nube): requiere el servidor de `server/` (ver `server/README.md`). Da cuentas, sincronización entre dispositivos, portal de clientes con acceso remoto y archivos en el servidor.

## Qué incluye
- **Clientes y expedientes**: ficha, lista por categoría de documento, vista previa de cliente.
- **Portal con permisos por módulo**: al invitar, el propietario elige qué verá el cliente. Por defecto solo documentos, proyectos y pendientes; cifras, presupuestos, previsión, obligaciones y nóminas se abren una por una y se pueden cambiar o revocar después. El servidor filtra los datos y las descargas (no solo la pantalla) y oculta las notas internas.
- **Documentos**: subir, abrir y eliminar; estados Pendiente / En revisión / Completo («Completo» = expediente organizado, no certificación fiscal).
- **Tareas y proyectos**.
- **Movimientos**: importes en centavos; importación CSV (una fila inválida impide importar todo); exportación que neutraliza fórmulas.
- **Estados de cuenta**: importa los de los clientes desde CSV, Excel (.xlsx) y OFX/QFX. Detecta el encabezado y las columnas (con corrección manual), entiende fechas y montos mexicanos, sugiere categoría, marca los movimientos que ya existen para no duplicarlos, reporta cada fila ilegible (que no se importa) y puede guardar el archivo original en el expediente. **No lee PDF ni concilia saldos.**
- **Planeación**: cobros y pagos esperados, proyección a 30/60/90 días desde la base neta registrada, vencidos aparte, agenda mensual y CSV. Previsión, no saldo bancario.
- **Estadísticas**: filtros por cliente y periodo, tendencia de 6 meses, gasto por categoría, presupuesto contra gasto (con «% utilizado» y «% por encima» por separado) y observaciones calculadas.
- **Alertas** en Inicio: vencimientos a 7 y 1 día, presupuesto al 80 % y 100 %, vencidos y documentos por revisar (solo dentro de la app).
- **Presupuestos** con alertas, **Planes** orientativos (Esencial $499, Profesional $999, Empresarial $1,999 MXN/mes; guardan una propuesta, no cobran).
- **Trabajadores**: ficha completa (datos personales, relación laboral, salario, pago, INFONAVIT, historial y recibos). Cada trabajador puede tener su acceso para ver **solo** sus recibos.
- **Recibos timbrados (CONTPAQi)**: se timbra en CONTPAQi y aquí se suben los XML (y PDF) de golpe: se reconocen cliente y trabajador, se valida el CFDI, se evitan duplicados por UUID, se concilian con el cálculo y quedan visibles al cliente (módulo «Nóminas») y al trabajador. La app no timbra. Probado con recibos semanales reales: el PDF se empareja con su XML por nombre, UUID o sufijo CONTPAQi (`_<empleado>_<3 últimos del UUID>`); un PDF sin XML se avisa y no se carga; el trabajador nuevo se crea con ficha incompleta (salario diario 0) para completarla; los pagos semanales se ven por «Periodo de pago» en el resumen.
- **Resumen del periodo**: desglose general de nómina de todos los trabajadores por periodo y cliente, con totales, estado de recibo y CSV.
- **Roles del equipo** (contador, responsable de nómina, administrador, proyectos, facturación) con permisos aplicados en el servidor: `docs/roles-y-permisos.md`.
- **Nóminas** con cálculo automático mensual (`src/domain/fiscal.ts`) y **recibo desglosado**: percepciones (sueldo, otras gravadas, exentas), ISR paso a paso (tramo, excedente, tasa, cuota fija, subsidio), IMSS obrero por concepto, otras deducciones y neto; exportable a CSV. También admite captura manual.
- **Fiscal**: obligaciones, importes y fechas; validador de CFDI 3.3/4.0 (estructura, RFC, UUID, timbre, aritmética); consulta de estatus ante el SAT vía servidor; resumen mensual exportable.
- **Nube**: cuentas, espacios, portal de clientes con invitación por código, revisión optimista (nunca sobrescribe cambios ajenos sin avisar), consulta de cambios cada 15 s, eliminación física de archivos, bitácora y respaldos.
- **Respaldo**: descarga/restauración de un archivo con datos y documentos; solicitud de protección de almacenamiento al navegador.

## Servidor, clave de cifrado y despliegue
`docs/despliegue.md` (pasos para ponerlo en línea; quién debe hacer qué) y `docs/custodia-clave.md` (hoja de custodia de la clave). Decisiones de JACKY: se sigue con CONTPAQi (sin PAC) y se guarda la clave de cifrado.

## Nómina privada y PAC
Ver `docs/nomina-privada-y-pac.md`: qué se hizo (cifrado en reposo, alcance por cliente, auditoría de lectura, sin caché), qué no y por qué (no se integró un PAC; hoy se timbra en CONTPAQi).

## Diagnóstico frente al kit
Ver `docs/diagnostico-kit.md`: qué existe, qué se comprobó, qué riesgo tiene y qué decisiones faltan.

## Publicar en tiendas
Ver `docs/publicacion-y-derechos.md` (estado técnico verificado, decisiones pendientes de Canville, inventario de datos y expediente de derechos) y `docs/THIRD_PARTY_LICENSES.md`.

## Verificado
`npm test` (67 pruebas: cálculos, CSV, permisos, respaldo, fiscal y 8 pruebas de integración del servidor), `tsc --noEmit`, `expo export --platform web` y recorridos en Chromium (escritorio y 390 px) del modo local y del flujo completo en la nube: cuenta de despacho, cliente invitado que solo ve su expediente, subida del cliente, conflicto entre dos dispositivos, revocación, respaldo y migración local→nube.

## Límites (importante)
- **Fiscal**: la app **no presenta declaraciones** (eso requiere e.firma o contraseña en el portal del SAT; la app nunca las pide ni las guarda). El validador de CFDI **no verifica sello ni cadena original**. La consulta de estatus ante el SAT está implementada según la especificación pública pero **no se pudo probar contra el SAT real** desde el entorno de desarrollo.
- **Nómina**: las tablas 2026 (tarifa ISR, subsidio, UMA $117.31, cuotas IMSS) se tomaron de publicaciones secundarias cotejadas entre sí y con comprobaciones aritméticas, **no del DOF directamente**; un contador debe validarlas. Solo periodo mensual; sin ajuste anual, **cuotas patronales ni ISN** (la tabla patronal de cesantía y vejez 2026 no coincide entre fuentes y depende del salario mínimo) ni amortización INFONAVIT (se captura como «otras deducciones»). El subsidio de enero 2026 difiere por un centavo entre fuentes; se usa el de febrero–diciembre.
- **Servidor**: una sola réplica (SQLite); sin verificación de correo ni recuperación de contraseña (por eso las invitaciones usan un código entregado por el propietario); sin WebSocket. En producción exige HTTPS, respaldos programados y disco protegido. **No se desplegó ningún servidor**: tú debes alojarlo (hay `Dockerfile`).
- **Local**: si se borra el almacenamiento del navegador se pierden los datos; usa respaldos o la nube.
- No se generó build nativo (APK/AAB, iOS) ni se probó en dispositivo físico; solo la versión web se verificó en navegador.
- No sustituye a un contador ni garantiza certeza jurídica o contable.
