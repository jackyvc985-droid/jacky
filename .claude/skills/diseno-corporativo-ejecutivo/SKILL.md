---
name: diseno-corporativo-ejecutivo
description: Diseño editorial y visual de nivel consultora para formatos administrativos (Excel, Word, PDF, infografías, presentaciones, propuestas y presupuestos). Úsala siempre que se cree o mejore cualquier archivo de este proyecto o material de ventas: portadas, dashboards, reportes para dirección, plantillas de Excel con tablero, propuestas comerciales, presupuestos de tres opciones, infografías 1080x1350 / 1080x1080 / 1080x1920 y control de calidad visual antes de entregar.
---

# Diseño corporativo ejecutivo (proyecto de formatos administrativos para venta)

Regla de fondo: **nada de formatos planos.** Cada pieza debe parecer hecha por una consultora: jerarquía clara, retícula, espacio, color con función, datos convertidos en lectura de dirección y revisión visual completa antes de entregar.

## Reglas fijas de este proyecto (tienen prioridad)

1. **Los FORMATOS (Excel/Word en `plantillas/`) se venden a terceros: sin logo ni nombre de marca del autor.** Solo un recuadro "INSERTE SU LOGO" para que el comprador ponga el suyo. Nunca insertar `assets/logo.png` en ellos. El MATERIAL DE VENTAS del autor (`marketing/`: presentación, infografías, mensajes) sí lleva la marca y los contactos que el usuario dio en `assets/config_marca.json` (Grupo Canville · ventas@grupocanville.com · WhatsApp 442 286 0954 (solo datos confirmados; QR pequeño con leyenda "Escanea para escribir por WhatsApp")). El logo oficial (`assets/logo.png`, sobre placa blanca, sin deformar) va en infografías y presentación.
2. **Fuente: Arial** en Excel y Word (universal en Windows, Mac y Google). Imágenes y PDF se renderizan con Liberation Sans (misma métrica). Evitar fuentes de Office poco comunes (p. ej. Abadi) y fuentes que el comprador quizá no tenga.
3. **Mayúsculas** en títulos, encabezados, etiquetas y nombres de hoja (PORTADA, FORMATO, RESUMEN, CATÁLOGOS, AYUDA...).
4. **Paleta de estructura:** azul marino `#0B2A4A`, azul turquesa `#0E7C8B`, coral `#E8604C`, dorado `#C9A227`, gris ejecutivo `#EEF2F5` y blanco.
5. **Colores de gráficas (validados con `validate_palette.js` de la habilidad dataviz):** azul `#2A6FBA`, ámbar `#E69F00`, turquesa `#12A0A8`, coral `#E4572E`. La paleta de marca por sí sola falla la validación (azul marino muy oscuro, turquesa poco cromático). Con ámbar/turquesa claro hay que ofrecer etiquetas visibles o tabla.
6. **Semáforos:** verde = en control, ámbar = atención, coral = acción inmediata; siempre con texto además del color.
7. **Excel:** hoja de captura + catálogos + tablero + ayuda; celdas de captura crema `#FFFCF0` desbloqueadas, cálculos gris `#EEF2F5` bloqueados, hojas protegidas **sin contraseña**; validaciones desplegables; formato condicional; filtros; encabezados congelados y repetidos al imprimir; horizontal ajustado a una hoja de ancho. Cero errores de fórmula (verificar con `recalc.py` de la habilidad xlsx sobre copias).
8. **Idioma y contexto:** español de México, MXN, IVA 16%, RFC/CFDI/IMSS; cifras `$1,250,000.00`.

## 12 habilidades (qué incluyen y cómo aplicarlas)

### 1. Diseño editorial corporativo
Retícula de 8 o 12 columnas, jerarquía título > subtítulo > dato, márgenes amplios, encabezado y pie consistentes, portada ejecutiva, separadores de sección, numeración de páginas, listo para imprimir. *No entregar una tabla simple ni texto básico.*
- Word: banner azul marino con título blanco y línea dorada; secciones numeradas con regla fina; avisos destacados ("Regla de oro") con barra de color; tablas con encabezado azul marino y filas alternadas; pie "Página X de Y".

### 2. Dirección de arte e identidad visual
Sistema visual reutilizable: paleta, tipografía, íconos propios, colores para prioridad/riesgo/estado, uso correcto del logo (proporción, zona de respeto, nunca improvisado). Todo el paquete debe parecer de la misma empresa.

### 3. Formatos ejecutivos
Reportes para dirección, comité ejecutivo, tableros de seguimiento, resúmenes de una página, formatos de decisión, avances semanales, reportes de proyecto y de riesgos, autorizaciones, minutas ejecutivas y cierre administrativo. Siempre: resumen visual, indicadores destacados, semáforo de riesgos, decisiones requeridas, avances, pendientes y próximos pasos.

### 4. Visualización de datos
Convertir datos en dashboard: tarjetas KPI, gráficas relevantes (avance, presupuesto vs. real, cobranza, cumplimiento), semáforos, matrices de riesgo y de responsables, líneas de tiempo, tendencias y una **lectura de dirección** en texto automático. Reglas de la habilidad dataviz: una sola escala, barras delgadas, rejilla tenue, leyenda si hay 2 o más series, etiquetas selectivas, validar paleta, mirar el resultado renderizado.

### 5. Excel avanzado
Libro profesional: hojas por función, catálogos, validaciones, fórmulas, formato condicional (semáforos, barras de datos, conjuntos de íconos), filtros, protección, tablero de lectura ejecutiva, vista de impresión profesional, horizontal para PDF, encabezados congelados, anchos optimizados.

### 6. UX/UI para formatos digitales
Separar captura de consulta; jerarquía de campos; **campos obligatorios marcados con \***; mensajes de ayuda (mensajes de entrada en validaciones); validar fechas e importes para reducir errores; navegación clara (portada con enlaces a cada hoja); acciones importantes visibles; legible en celular y computadora.

### 7. Infografías y comunicación visual
Una sola idea principal y máximo cuatro mensajes secundarios; íconos; beneficios claros; llamado a la acción visible; datos de contacto solo si el usuario los da. Formatos: **1080x1350** (vertical), **1080x1080** (cuadrado), **1080x1920** (historias). Diseño orientado a conversión, no cartel genérico.

### 8. Presentaciones ejecutivas
Una idea por lámina, poco texto, un argumento comercial, un recurso visual y una conclusión clara; **variar composiciones** (no repetir el mismo diseño); diagramas, tablas y gráficos; cierre con CTA; **notas del presentador**; versión web interactiva y versión PDF; versión de impresión (hoja con lámina + notas).

### 9. Propuestas comerciales
Problema del cliente, solución, alcance, entregables, metodología, calendario, inversión, beneficios, exclusiones, condiciones y llamado a la acción; comparativo de paquetes; tabla de inversión que se vea premium, no contable; firma visual de cierre.

### 10. Presupuestos profesionales
Tres opciones (esencial, profesional, estratégico) con la **recomendada destacada**; inversión, alcance, entregables, tiempos, condiciones y beneficios; desglose por fases; costos directos e indirectos; subtotales, IVA y total; cronograma de pagos; vigencia; exclusiones; análisis de valor.

### 11. Control de calidad visual (OBLIGATORIO antes de entregar)
Renderizar TODO (Excel/Word -> PDF -> imágenes) y revisar página por página: textos cortados, desbordes, desalineaciones, espacios vacíos, tablas comprimidas, logos deformados, colores inconsistentes, contraste, legibilidad, ortografía, vista móvil y PDF final. Corregir y volver a renderizar. Para Excel, además: `recalc.py` sin errores y revisión de impresión. No decir "listo" sin haber mirado las imágenes.

### 12. Responsive y multiplataforma
Versión para impresión y versión para pantalla; legible en computadora, celular, WhatsApp y PDF; no reducir la tipografía para que "quepa"; imágenes optimizadas de peso; horizontal y vertical.

## Lista de verificación final (copiar a cada entrega)

- [ ] Sin logo ni marca del autor en los productos (solo recuadro del comprador)
- [ ] Arial; títulos y etiquetas en MAYÚSCULAS; ortografía y acentos revisados
- [ ] Portada, ayuda, glosario y lista de verificación en cada Excel; tablero con lectura automática
- [ ] Campos obligatorios con \*; validaciones con mensaje; fechas e importes validados
- [ ] Hojas protegidas sin contraseña; celdas de captura desbloqueadas
- [ ] Cero errores de fórmula (recalc) y ejemplos con datos coherentes
- [ ] Imágenes revisadas una por una (sin cortes, sin desbordes, sin espacios muertos)
- [ ] Infografías en 1080x1350, 1080x1080 y 1080x1920
- [ ] Presentación con notas del presentador y versión de impresión
- [ ] ZIP final íntegro, con README actualizado

## Cómo se genera (scripts del repositorio)

`generar_plantillas.py` (Excel) · `generar_documentos_word.py` (Word) · `generar_ejemplos.py` (versiones con datos) · `generar_paquetes.py` (vistas previas, portadas, ZIP) · `generar_marketing.py` (presentación, infografías, mensajes). Contenido de ayuda en `contenido.py`.


## Reglas de la campaña de infografías (`generar_infografias.py`)

- **Diez piezas, una composición distinta por tema** (nunca una cuadrícula de tarjetas repetida): ciclo, embudo, línea de tiempo, entrada-proceso-resultado, checklist con estados, carriles de aprobación, tablero con semáforo, antes/después, pirámide y matriz. Alternar fondos oscuro/claro; mismo encabezado y barra de acción.
- **Estructura comercial:** titular que conecta con un problema real -> RIESGO -> LO QUE HACEMOS -> visual -> beneficios (una sola fila de chips) -> autoridad (metodología, reporte semanal, responsable, expediente) -> CTA específico + contactos + QR de WhatsApp + "Respuesta inicial para conocer tu operación".
- **Tres adaptaciones reales:** 1350 (completa: riesgo y lo que hacemos, visual, beneficios, autoridad), 1080 (directa: problema, visual, CTA), 1920 (titular mayor, menos filas, zonas seguras arriba y abajo).
- **Sin cifras inventadas:** estados cualitativos (Documentado, Por validar, En seguimiento, Atención requerida, Riesgo alto, Pendiente de autorización).
- **Legibilidad:** texto mínimo 20 px (22+ en historias), contraste >= 4.5:1 (en texto claro usar variantes oscuras: turquesa #0A7C82, dorado #8A5E00, coral #B8321F; etiqueta RIESGO sobre #C9402A; chips con texto azul marino sobre turquesa). Un solo estilo de íconos (línea de 2 px, 24x24).
- **Calidad:** revisar contactos, ortografía y que cada imagen mida exactamente 1080x1350, 1080x1080 o 1080x1920; confirmar que el QR abre WhatsApp con el número correcto.
