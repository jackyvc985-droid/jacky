# CAMBIOS_CLAUDE.md — Grupo Canville (GCV)

**Esto NO es una modificación de la copia de Manus `8498e76`.** Es un código independiente, creado desde cero en este repositorio (`jackyvc985-droid/jacky`, rama `claude/magical-faraday-eb26ym`). No comparte historial ni archivos con la copia de Manus, así que **no hay base común para una fusión a tres vías**. No tengo acceso a la copia de Manus y no la he visto.

- Commit de origen: `6236fc0` (Initial commit, vacío). Commit final de esta entrega: ver `git rev-parse HEAD` del ZIP (el SHA-256 del ZIP se informa en el mensaje que lo acompaña, no dentro de él).
- Tests al cierre: 73 pasan, 0 fallan (`npm test`); `npx tsc --noEmit` limpio.

## Pila técnica (difiere de la que pide Manus)
| Capa | Aquí | Manus (según su documento) |
|---|---|---|
| App | Expo SDK 57 / React Native 0.86 / TypeScript (web, Android, iOS) | Expo / React Native / TypeScript |
| Servidor | **Node 22 sin dependencias**, `node:http`, ejecutado con `--experimental-strip-types` | Express / tRPC |
| Base de datos | **SQLite** (`node:sqlite`), un archivo | Drizzle / MySQL |
| Identidad | Correo + contraseña (scrypt), sesiones con hash, invitaciones de un uso | OAuth de Manus |
| Gestor de paquetes | npm (`package-lock.json`) | pnpm |
| Dinero | Centavos enteros | Centavos enteros |
| Variable de API | `EXPO_PUBLIC_API_URL` (**sin** alias `EXPO_PUBLIC_API_BASE_URL`) | `EXPO_PUBLIC_API_BASE_URL` |
| Identificador | `mx.grupocanville.app` (propuesto, sin registrar) | `space.manus.canville.t267961621730757` |

Por eso **no se puede copiar archivo por archivo**. Opciones reales: (a) elegir una sola base, o (b) portar a la base de Manus solo la lógica de dominio de `src/domain/*`, que es TypeScript puro sin dependencias de pila (dinero en centavos, permisos/roles, ISR/IMSS/subsidio, CFDI/Nómina 1.2, conciliación de recibos).

## Funciones realmente presentes (con pruebas)
Clientes/expedientes, documentos, tareas, proyectos, movimientos (CSV), estados de cuenta (CSV/Excel/OFX), presupuestos, planeación, estadísticas, avisos internos; nómina (ficha del trabajador, cálculo, desglose, resumen, recibos timbrados de CONTPAQi: carga XML+PDF, validación, duplicados por UUID, conciliación); validador de CFDI; planes; nube con cuentas, portal de cliente de solo lectura y empleado; 8 roles con alcance por cliente y módulos; cifrado en reposo AES-256-GCM con verificación de clave al arrancar, rotación de clave, respaldos, bitácora, eliminación de cuenta y de archivos.

## Archivos principales
`src/domain/*` (lógica compartida app/servidor), `src/screens/*`, `src/store.tsx`, `src/cloud.ts`, `server/{index,crypto,rekey,sat,backup}.ts`, `tests/*.test.ts` (+ `tests/fixtures/contpaqi/` anonimizado), `Dockerfile`, `deploy/`, `app.json`, `eas.json`, `scripts/{genkey,build-demo,licenses}.mjs`, `docs/*`, `server/README.md`.

## Dependencias y scripts
Dependencias de ejecución: `expo ~57.0.28`, `react-native ^0.86.3`, `react ^19.2.3`, `react-native-web`, `fast-xml-parser ^5.11.2`, `fflate ^0.8.3`, `expo-secure-store`, `expo-file-system`, `expo-document-picker`, `expo-sharing`, `@react-native-async-storage/async-storage`, entre otras de Expo. Servidor: **cero** dependencias propias. No hay scripts `postinstall`. Scripts: `test`, `server`, `server:genkey`, `server:rekey`, `server:backup`, `build:web`, `build:demo`. Inventario de licencias: `docs/THIRD_PARTY_LICENSES.md`.

## Esquema de datos (SQLite, creado al arrancar con `CREATE TABLE IF NOT EXISTS`)
`users`, `sessions` (hash del token), `workspaces` (JSON cifrado + revisión), `members` (rol, cliente/alcance), `invites` (hash del código), `files`, `audit`. **No hay migraciones SQL ni Drizzle.** La nómina vive dentro del JSON del espacio (cifrado), filtrada por rol en el servidor (`src/domain/roles.ts`); no tiene tablas privadas separadas. Eso es una diferencia con lo que pide el documento de Manus (tablas privadas de nómina con relación empleado–usuario).

## Lo que NO está (no afirmarlo)
- No hay verificación de correo, recuperación de contraseña ni segundo factor.
- No hay notificaciones push. Hay avisos solo dentro de la app.
- Nada probado en Android/iPhone físicos ni auditoría de accesibilidad; solo navegador (Playwright).
- El servidor no está desplegado; `Dockerfile` y `deploy/` no se probaron (no había Docker).
- La consulta de estatus al SAT (`server/sat.ts`) nunca se probó contra el SAT real.
- No hay integración con PAC (se timbra en CONTPAQi).
- Las tablas fiscales 2026 vienen de fuentes secundarias; no se contrastaron con el Anexo 8 (no se pudo acceder a `sat.gob.mx`) ni las revisó un contador. No hay cuotas patronales ni ISN.
- Sin matriz de retención aprobada, ni RPO/RTO, ni prueba de restauración en un servidor real.
- La clave de cifrado se lee de `DATA_KEY`; no hay integración con KMS. Responsable/suplente: sin confirmar.
- La selección de la dirección del servidor existe en Configuración y ahora solo acepta `https://` (http solo a localhost). No hay lista de hosts autorizados.

## Contenido excluido del ZIP
Sin `.git`, `node_modules`, `dist`, `demo/`, `.env`, claves, certificados, bases de datos ni documentos reales. Los fixtures de `tests/fixtures/contpaqi/` son recibos con datos ficticios (RFC `AAA010101AAA`) derivados de la estructura de recibos reales, con todos los datos personales reemplazados.
