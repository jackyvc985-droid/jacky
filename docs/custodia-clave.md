# Hoja de custodia de la clave de cifrado

**Decisión de JACKY (12 oct 2026): sí se guarda la clave de cifrado.** Esta hoja define cómo.

La clave (`DATA_KEY`) cifra los datos y los archivos del servidor (nóminas, trabajadores, recibos). **Si se pierde, esos datos no se pueden recuperar.** Si se filtra, quien la tenga junto con una copia de los datos puede leerlos. Las dos cosas hay que evitarlas.

## Reglas
1. **La genera y la guarda Grupo Canville, no Claude ni ningún proveedor.** Se genera en una computadora de confianza con `node scripts/genkey.mjs`; se muestra una sola vez y no queda en ningún archivo.
2. **Nunca** en el repositorio, por correo, chat, mensajes o capturas.
3. **Dos copias, en dos lugares distintos**: (a) el gestor de contraseñas de la empresa, con acceso solo para las personas de la tabla; (b) una copia impresa en sobre sellado, en un lugar físico seguro (caja fuerte).
4. **Aparte de los respaldos.** Un respaldo de la base junto a la clave, en el mismo lugar, anula el cifrado. Un respaldo sin la clave no se puede restaurar.
5. Se **prueba la recuperación** antes de confiar: restaurar un respaldo en un servidor de prueba usando solo la clave guardada.

## Propuesta de asignación (NO confirmada)
- Responsable principal propuesto: JACKY, como representante de Grupo Canville. Suplente: **sin designar**, lo nombra JACKY.
- La clave que se custodia es la que cifra nóminas y documentos; no es el certificado de sello digital del SAT.
- Cuenta del servidor y dominio: a nombre de Grupo Canville, con correo corporativo y doble factor; **sin fecha de apertura**. Dominio propuesto `grupocanville.com` (`app.` y `api.`), disponibilidad no verificada.
- Nota técnica: hoy el servidor lee la clave de la variable `DATA_KEY`. Guardarla en un KMS de nube sería un cambio de despliegue (inyectar la variable desde el KMS); el código no llama a ningún KMS.

## Datos de custodia (llenar a mano; no escribir aquí la clave)
| Dato | Valor |
|---|---|
| Huella de la clave (la imprime el servidor al arrancar; 8 caracteres) | |
| Fecha de generación | |
| Responsable principal | |
| Responsable suplente | |
| Ubicación copia 1 (gestor de contraseñas) | |
| Ubicación copia 2 (sobre sellado) | |
| Última prueba de restauración exitosa (fecha y quién) | |
| Próxima revisión | |

Para comprobar que una clave guardada es la correcta sin mostrarla: `DATA_KEY=<clave> node scripts/genkey.mjs --verify` imprime su huella; debe coincidir con la anotada.

## Protecciones del servidor
- Al arrancar, el servidor imprime la huella de la clave que recibió.
- Si la clave no corresponde a la usada antes, **el servidor se niega a iniciar** (no escribe nada). Si falta la clave en un servidor que ya cifra, **tampoco inicia**: así nunca mezcla datos cifrados con datos sin cifrar por error.

## Cambiar la clave (rotación, o si sospechas que se filtró)
Con el servidor detenido y un respaldo hecho:
```bash
OLD_DATA_KEY=<clave actual> NEW_DATA_KEY=<clave nueva> npm run server:rekey
```
Recifra todos los datos y archivos, verifica cada uno antes de reemplazar y actualiza la marca de clave. Después, guarda la clave nueva (esta hoja) y destruye las copias de la anterior. **Haz el respaldo antes**: si el proceso se interrumpe a la mitad, se restaura desde ese respaldo. El mismo comando sirve para activar el cifrado en un servidor que hoy guarda datos sin cifrar (deja `OLD_DATA_KEY` vacío).

## Si la clave se perdió
No hay recuperación posible desde el servidor ni desde Claude. Solo sirven las copias guardadas. Por eso son dos y se prueban.
