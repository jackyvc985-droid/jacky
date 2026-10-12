# Servidor de Canville

API en Node 22 (sin dependencias externas): cuentas, espacios en nube, archivos, portal de clientes y bitácora.
Datos en SQLite (`node:sqlite`) y archivos en disco.

```bash
npm run server                       # escucha en :8787, datos en ./server-data
DATA_DIR=/var/lib/canville PORT=8787 ALLOWED_ORIGINS=https://app.tudominio.com npm run server
```

| Variable | Descripción |
|---|---|
| `PORT` | Puerto (8787) |
| `DATA_DIR` | Carpeta de base de datos y archivos (`./server-data`) |
| `ALLOWED_ORIGINS` | Orígenes CORS permitidos, separados por coma (`*` por defecto: restríngelo en producción) |

La app apunta al servidor desde **Configuración → Cuenta en la nube** o con `EXPO_PUBLIC_API_URL` al compilar.

## Producción: lo mínimo indispensable
- **HTTPS obligatorio.** Pon el servidor detrás de un proxy con TLS (Caddy, nginx, Cloudflare). Las sesiones viajan como token `Bearer`.
- **Respaldos.** `DATA_DIR=... node --experimental-strip-types server/backup.ts /ruta/respaldos` genera una copia consistente de la base y los archivos. Prográmalo (cron) y guarda copias fuera del servidor. Un respaldo sin prueba de restauración no cuenta: restáuralo de prueba.
- **Disco cifrado y acceso restringido** a `DATA_DIR`: ahí viven expedientes fiscales.
- Aviso de privacidad, contratos con clientes y política de conservación son responsabilidad de quien opera el servicio.

## Qué hace
- `POST /auth/register|login|logout|accept`, `GET /me`: contraseñas con scrypt, tokens aleatorios (se guarda su hash), vigencia de 30 días, límite de intentos.
- `GET/PUT /ws/:id/data`: revisión optimista. `PUT` exige la revisión base; si otro guardó antes responde `409` y no sobrescribe.
- `PUT/GET/DELETE /ws/:id/files/:key`: el archivo solo se entrega al propietario o al cliente dueño del documento. `DELETE` borra físicamente. Los archivos sin registro (cargas huérfanas) se purgan tras 1 hora.
- `POST /ws/:id/invites`: genera un código de un solo uso (se comparte manualmente, no se envía correo). El cliente se registra o acepta con su correo + código. `DELETE /ws/:id/invites/:email` revoca acceso.
- El portal del cliente es **solo de consulta y descarga**: no puede subir, editar ni borrar (`/ws/:id/portal/*` responde 403). Todo lo carga el despacho.
- `GET /ws/:id/audit|backup`: bitácora (200 últimos eventos) y respaldo lógico, solo propietario.
- `POST /cfdi/status`: consulta de estatus de un CFDI ante el SAT (requiere sesión). Implementada según la especificación pública; **no se pudo probar contra el servicio real** desde el entorno de desarrollo.

## Límites conocidos
- No hay verificación de correo electrónico ni recuperación de contraseña. Por eso las invitaciones usan un código que el propietario entrega.
- Sondeo cada 15 s; no hay WebSocket.
- Una sola réplica del servidor (SQLite). Para varias réplicas habría que migrar a PostgreSQL y almacenamiento de objetos.
- Las URLs de archivo no son firmadas: cada descarga exige el token de sesión.
