# Canville: preparación para tiendas y control de derechos

Complementa la guía de publicación recibida. Aquí solo hay lo que se verificó en este repositorio; las fechas y requisitos de Google/Apple que cita la guía **no se verificaron** y deben confirmarse en sus páginas oficiales antes de enviar.

## Estado técnico (verificado en el repo)

| Tema | Estado |
|---|---|
| Versión | `1.1.0`, Android `versionCode 2`, iOS `buildNumber 2` (`app.json`) |
| Android | `compileSdk`/`targetSdk` 36, `minSdk` 24 (`expo-build-properties`). Verificado generando el proyecto nativo (`expo prebuild`) y leyendo `build.gradle` |
| Permisos Android | Solo `INTERNET`. Bloqueados `SYSTEM_ALERT_WINDOW`, `VIBRATE` y almacenamiento externo (comprobado en el `AndroidManifest.xml` generado) |
| iOS | Destino mínimo 16.4 (generado), sin textos de cámara/micrófono/fotos. `ITSAppUsesNonExemptEncryption` **no** se declara: es una declaración legal que debe hacer Canville tras revisar su uso de cifrado (hoy solo HTTPS) |
| Notificaciones | No hay push ni permiso declarado |
| Builds | `eas.json` con perfiles `development`, `preview` (APK) y `production` (AAB / iOS). **No se ejecutó ningún build de release** (requiere cuenta de Expo y credenciales) |
| Eliminación de cuenta y datos | Implementada: **Configuración → Eliminar mi cuenta y mis datos** (`DELETE /me`). Pide contraseña; un cliente sale sin afectar al despacho; un propietario borra sus espacios con clientes, registros y archivos (borrado físico). La bitácora se conserva sin datos personales. Con pruebas automáticas |
| Inventario de licencias | `docs/THIRD_PARTY_LICENSES.md` (regenerable con `node scripts/licenses.mjs`). 519 paquetes de producción; 12 marcados MPL-2.0 (`lightningcss`, herramienta de compilación que no se distribuye en la app) y 1 doble licencia con GPL-2.0: revisar con un especialista |

## Lo que sigue sin existir
- Servidor de producción con HTTPS estable (no se desplegó nada; ver `server/README.md` y `Dockerfile`). La app se apunta a él desde Configuración o con `EXPO_PUBLIC_API_URL` al compilar.
- Permisos granulares (hoy: propietario y cliente). Nómina y documentos sensibles **no** están segregados por rol más allá de eso.
- Verificación de correo y recuperación de contraseña; política técnica de retención y de copias (los respaldos del servidor deben incluirse en ella: un dato borrado puede seguir en copias antiguas).
- Pruebas en dispositivos físicos; accesibilidad auditada; notificaciones push.
- Cuentas de organización en Google Play y Apple Developer, firma, fichas, capturas, clasificación de edad, política de privacidad y términos.

## Decisiones que solo Canville puede tomar
1. **Razón social titular** de las cuentas de tienda, de Expo, del dominio y del repositorio.
2. **Identificador de la app.** Este repo usa `mx.canville.app` (Android `package` e iOS `bundleIdentifier`) como valor provisional. **No se puede cambiar una vez publicada**; la guía menciona otro identificador de otra versión (`space.manus…`): elijan uno, y cámbienlo en `app.json` antes del primer envío.
3. **Modelo de cobro.** Recomendación de la guía, coherente con el estado del producto: contratar y cobrar en la web, y publicar una app móvil gratuita de acceso a cuentas existentes, sin compras ni enlaces a un checkout externo dentro de la app. La pantalla «Planes» solo guarda una propuesta y no cobra; **si se publica en tiendas, hay que revisar con las políticas vigentes si debe ocultarse o reformularse en la app nativa.**
4. Proveedor de alojamiento y su ubicación; política de conservación y de respaldos.

## Inventario de datos (base para Data Safety de Google y App Privacy de Apple)
Describe lo que el código hace hoy. **Revísalo contra el build final y los proveedores reales antes de declarar nada.**

- **Cuenta:** correo; contraseña (solo hash scrypt); tokens de sesión (solo su hash en servidor).
- **Datos del negocio del usuario (los escribe el usuario):** clientes (nombre, RFC, correo, teléfono, notas), documentos (cualquier archivo, p. ej. constancia fiscal, declaraciones, CFDI, nóminas, contratos), movimientos financieros, presupuestos, **nómina (nombre del empleado, percepciones y deducciones)**, obligaciones fiscales, proyectos y tareas.
- **Bitácora del servidor:** usuario, acción, detalle (por ejemplo correo invitado, clave de archivo) y fecha. No se guarda IP.
- **En el dispositivo:** datos locales (AsyncStorage / IndexedDB / directorio de documentos de la app); token de sesión en el llavero (móvil) o `localStorage` (web).
- **Terceros:** ninguno de analítica ni publicidad en el código. Al validar el estatus de un CFDI, el servidor envía al SAT RFC emisor, RFC receptor, UUID y total, solo cuando el usuario lo pide. El proveedor de alojamiento tendrá acceso técnico a lo almacenado.
- **Seguimiento / compartición con terceros con fines propios:** ninguna en el código actual.
- **Eliminación:** disponible desde la app (ver arriba). Pendiente de definir: plazo de purga en copias de seguridad.

## Derechos y titularidad: expediente que debe reunir Canville
El control de las cuentas no prueba por sí solo la titularidad del código, la marca o materiales de terceros.
- Historial de versiones (git) y registro de **contribuciones humanas** por persona, con fechas.
- **Contratos escritos** con cada desarrollador, diseñador o proveedor: obra y entregables, materiales preexistentes, cesión o licencia, modificación/distribución, plazo, territorio, confidencialidad. Revisar con abogado la situación de empleados y obras por encargo.
- Inventario de dependencias y licencias (este repo) más fuentes, iconos, imágenes y SDK que no estén en `package.json`. Los íconos y el monograma (`assets/`) son los del kit de Canville; disponer de ellos no acredita registro de marca.
- Si se usó IA para generar código o materiales: documentar la intervención humana original; no declarar autoría ni exclusividad que los términos aplicables no garanticen.
- Registro de programa de cómputo (INDAUTOR) y de marca/logotipo (IMPI, con búsqueda de antecedentes y clases) son trámites distintos; los hace Canville con especialista.

Nada de esto es asesoría legal.
