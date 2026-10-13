# Poner el servidor en línea (Grupo Canville)

**Estado:** el servidor no está desplegado. Esta guía deja listo lo que depende del código; lo que depende de una cuenta, un pago o un dominio solo lo puede hacer Grupo Canville (yo no puedo contratar ni pagar servicios ni crear cuentas). La configuración de `deploy/` **no se probó en un servidor real** ni con Docker (no había Docker disponible al prepararla); sí se comprobó que el servidor arranca con solo las carpetas que copia el `Dockerfile`.

## Qué necesita hacer Grupo Canville
| # | Qué | Quién |
|---|---|---|
| 1 | Cuenta en un proveedor de servidores **a nombre de la empresa** (con su medio de pago) | Representante de Grupo Canville |
| 2 | Un dominio y acceso a su DNS (propuesto `api.grupocanville.com`; **no verificado**) | Quien administre el dominio |
| 3 | Una persona responsable de la operación (actualizaciones, respaldos, alertas) y una suplente | JACKY |
| 4 | Generar y custodiar la clave de cifrado (`docs/custodia-clave.md`) | JACKY / responsable |

Servidor sugerido para empezar (orientativo, no medido): Linux, 2 vCPU, 2 GB de RAM, 40 GB de disco SSD, en una sola máquina (la base es SQLite: una sola réplica). Elegir región cerca de los usuarios; **no se asume que los datos queden físicamente en México**: pregúntalo al proveedor si importa.

## Pasos
1. **Servidor.** Crear la máquina Linux, con acceso por llave SSH (no contraseña). Instalar Docker y Docker Compose.
2. **DNS.** Crear un registro `A` de `api.<tu dominio>` hacia la IP del servidor.
3. **Código.** Clonar el repositorio en el servidor (`git clone` con una llave de solo lectura).
4. **Clave de cifrado.** En tu computadora: `node scripts/genkey.mjs`. Copiar la clave al gestor de contraseñas y a la copia impresa. Anotar la huella en la hoja de custodia.
5. **Configuración.** En el servidor: `cd deploy && cp .env.example .env` y llenar `API_DOMAIN`, `ALLOWED_ORIGINS` y `DATA_KEY`. El `.env` no se sube a ningún repositorio.
6. **Arrancar.** `docker compose up -d --build`. Caddy obtiene el certificado HTTPS solo.
7. **Comprobar.** `curl https://api.<tu dominio>/health` debe responder `{"ok":true,"encrypted":true}`. En los registros (`docker compose logs api`) aparece la **huella de la clave**: debe ser la anotada.
8. **Crear la cuenta del despacho** desde la app (Configuración → Cuenta en la nube → Crear cuenta de despacho, con la dirección del servidor).
9. **Respaldos.** Programar (cron) una copia diaria **fuera del servidor**:
   `docker compose exec -T api node --experimental-strip-types --disable-warning=ExperimentalWarning server/backup.ts /data/respaldos` y copiar esa carpeta a otro lugar (otro proveedor o disco externo). Un respaldo en el mismo disco no protege de perder el servidor. Guardar la clave **aparte** de los respaldos.
10. **Probar la restauración** en un servidor de prueba con un respaldo y solo la clave guardada. Hasta que no funcione, no hay respaldo.
11. **App.** Compilar la versión web y móvil apuntando a la dirección (`EXPO_PUBLIC_API_URL=https://api.<tu dominio>`). Para tiendas, ver `docs/publicacion-y-derechos.md`.

## Mantenimiento mínimo
- Actualizar el sistema y las imágenes de Docker cada mes. 
- Revisar que los respaldos se estén generando y copiando (alerta si pasa un día sin copia).
- Vigilar el espacio en disco del volumen `canville-data`.
- El servidor tiene límite de intentos de inicio de sesión y bitácora de accesos (Configuración → Bitácora).
- **Pendiente de la app:** verificación de correo y segundo factor para quienes ven nómina; mientras tanto, usar contraseñas largas y únicas.

## Qué no hace esta guía
No elige ni contrata el proveedor, no registra el dominio ni activa avisos por correo. Tampoco sustituye una revisión de seguridad del servidor por un especialista antes de cargar datos reales de clientes.
