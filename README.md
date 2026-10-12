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
- **Documentos**: subir, abrir y eliminar; estados Pendiente / En revisión / Completo («Completo» = expediente organizado, no certificación fiscal).
- **Tareas y proyectos**.
- **Movimientos**: importes en centavos; importación CSV (una fila inválida impide importar todo); exportación que neutraliza fórmulas.
- **Presupuestos** con alertas, **Resultados** (ingresos − gastos, tendencia de 6 meses), **Planes** orientativos (Esencial $499, Profesional $999, Empresarial $1,999 MXN/mes; guardan una propuesta, no cobran).
- **Nóminas** con cálculo automático mensual: ISR (tarifa Art. 96 LISR 2026), subsidio para el empleo 2026 e IMSS cuota obrera 2026 (`src/domain/fiscal.ts`). También admite captura manual.
- **Fiscal**: obligaciones, importes y fechas; validador de CFDI 3.3/4.0 (estructura, RFC, UUID, timbre, aritmética); consulta de estatus ante el SAT vía servidor; resumen mensual exportable.
- **Nube**: cuentas, espacios, portal de clientes con invitación por código, revisión optimista (nunca sobrescribe cambios ajenos sin avisar), consulta de cambios cada 15 s, eliminación física de archivos, bitácora y respaldos.
- **Respaldo**: descarga/restauración de un archivo con datos y documentos; solicitud de protección de almacenamiento al navegador.

## Verificado
`npm test` (25 pruebas: cálculos, CSV, permisos, respaldo, fiscal y 8 pruebas de integración del servidor), `tsc --noEmit`, `expo export --platform web` y recorridos en Chromium (escritorio y 390 px) del modo local y del flujo completo en la nube: cuenta de despacho, cliente invitado que solo ve su expediente, subida del cliente, conflicto entre dos dispositivos, revocación, respaldo y migración local→nube.

## Límites (importante)
- **Fiscal**: la app **no presenta declaraciones** (eso requiere e.firma o contraseña en el portal del SAT; la app nunca las pide ni las guarda). El validador de CFDI **no verifica sello ni cadena original**. La consulta de estatus ante el SAT está implementada según la especificación pública pero **no se pudo probar contra el SAT real** desde el entorno de desarrollo.
- **Nómina**: las tablas 2026 (tarifa ISR, subsidio, UMA $117.31, cuotas IMSS) se tomaron de publicaciones secundarias cotejadas entre sí y con comprobaciones aritméticas, **no del DOF directamente**; un contador debe validarlas. Solo periodo mensual; sin prestaciones exentas, ajuste anual, cuotas patronales ni amortización INFONAVIT (se captura como «otras deducciones»). El subsidio de enero 2026 difiere por un centavo entre fuentes; se usa el de febrero–diciembre.
- **Servidor**: una sola réplica (SQLite); sin verificación de correo ni recuperación de contraseña (por eso las invitaciones usan un código entregado por el propietario); sin WebSocket. En producción exige HTTPS, respaldos programados y disco protegido. **No se desplegó ningún servidor**: tú debes alojarlo (hay `Dockerfile`).
- **Local**: si se borra el almacenamiento del navegador se pierden los datos; usa respaldos o la nube.
- No se generó build nativo (APK/AAB, iOS) ni se probó en dispositivo físico; solo la versión web se verificó en navegador.
- No sustituye a un contador ni garantiza certeza jurídica o contable.
