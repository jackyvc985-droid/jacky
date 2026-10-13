# Estado frente a los pendientes de producción (revisión del 12-oct-2026)

Compara cada punto del documento «Pendientes de producción para Claude» con **este repositorio** (rama `claude/magical-faraday-eb26ym`). Es la versión de Claude que el documento pide aportar: tiene `Dockerfile`, `server/README.md`, `app.json`, `eas.json`, identidad propia (correo + contraseña scrypt), bitácora, consulta SAT y eliminación de cuenta. **Nada de esto se ha desplegado ni probado en un servidor real, ni en dispositivos físicos.**

| Punto | Estado real | Falta |
|---|---|---|
| Dockerfile / `server/README.md` / `deploy/` | Existen. El servidor arranca con las carpetas que copia el Dockerfile. Docker **no se probó** (no había Docker). | Probar en un servidor real; proveedor y cuenta de Canville |
| Variable de la API | Aquí es `EXPO_PUBLIC_API_URL` (no `…_API_BASE_URL`). Sin alias. | Unificar nombre si se integra con la otra copia |
| Dirección del servidor editable | Sí se escribe en Configuración. **Antes no se validaba**; ahora solo se aceptan `https://` (http solo hacia localhost). | Lista de hosts autorizados para builds de tienda; borrar sesión al cambiar de servidor |
| Roles | Ocho roles (propietario, administrador, contador, nómina, proyectos, facturación, cliente, empleado), alcance por cliente, módulos por cliente, empleado solo ve sus recibos. Autorizado en servidor, probado con API. | Que JACKY apruebe la matriz y las asignaciones; permisos separados de aprobar/timbrar/cancelar (la app no timbra) |
| Identidad | Correo + contraseña scrypt, tokens guardados con hash, invitaciones de un uso, límite de intentos, bitácora. | **No hay verificación de correo, recuperación de contraseña ni MFA.** Decisión de proveedor de identidad |
| Eliminación y copias | Eliminación de cuenta y de archivos (borrado físico en el servidor). Respaldos con `server/backup.ts`. | Matriz de retención, RPO/RTO, probar restauración, tratamiento de copias antiguas, volver a aplicar borrados al restaurar |
| Clave de cifrado | AES-256-GCM, el servidor no arranca sin la clave o con otra, herramienta de rotación. La clave se lee de `DATA_KEY`. | Responsable y suplente (propuesta, sin confirmar); KMS; MFA |
| Notificaciones push | **No hay.** Solo avisos dentro de la app. | Todo el bloque |
| Dispositivos y accesibilidad | **No probado.** Solo navegador. Pocas etiquetas de accesibilidad. | Compilar, probar en Android/iPhone físicos, auditar TalkBack/VoiceOver |
| Tiendas | `app.json`/`eas.json` listos (API 36, solo permiso INTERNET), identificador `mx.grupocanville.app` propuesto. | Cuentas de organización, firma, fichas, política de privacidad y términos, URL de eliminación de cuenta; declarar datos según el build real |
| Consulta SAT | `server/sat.ts` existe. **Nunca se probó contra el SAT real.** | Prueba real |
| PAC | No se integró (decisión: se timbra en CONTPAQi). | — |

Las afirmaciones de privacidad (por ejemplo «sin terceros») no deben usarse en formularios de tienda hasta revisarlas contra el build final, sus librerías y el proveedor del servidor.
