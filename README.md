# Papeles de trabajo administrativos (México)

45 formatos editables listos para vender: 22 libros de Excel y 23 documentos de Word. Sin marca ni logotipo (producto para venta a terceros). Guía de diseño permanente en `.claude/skills/diseno-corporativo-ejecutivo/SKILL.md`. Paleta: azul marino, azul turquesa, coral, dorado y gris ejecutivo;
fuente Arial; títulos, encabezados y etiquetas en mayúsculas.

Cada Excel incluye: PORTADA con contenido e instrucciones, FORMATO con fórmulas y listas desplegables, tablero RESUMEN con gráficas (en 14 de ellos),
CATÁLOGOS editables, AYUDA (preguntas frecuentes, glosario y lista de verificación), recuadro para el logo del comprador y hojas protegidas
(solo se editan las celdas de captura; sin contraseña: Revisar > Desproteger hoja).

| Carpeta (`plantillas/`) | Contenido |
|---|---|
| `1_Contabilidad_y_Finanzas` | Ingresos y gastos, caja chica, flujo de efectivo, cuentas por cobrar, conciliación bancaria, presupuesto anual, activos fijos, directorio |
| `2_Recursos_Humanos` | Asistencia, nómina simplificada, vacaciones (LFT), evaluación de desempeño, solicitud de vacaciones/permiso |
| `3_Inventarios_y_Compras` | Inventario, kardex costo promedio, orden de compra, cuadro comparativo de cotizaciones |
| `4_Documentos_y_Actas` | Cotización, recibo de pago, minuta de reunión |
| `5_Documentos_Word` | Contrato de servicios, renuncia, constancia laboral, carta de cobranza, acta entrega-recepción, acta administrativa, NDA, carta poder |
| `6_Politicas_y_Procedimientos` | Manual de caja chica, políticas de compras, viáticos y asistencia, procedimiento de inventarios, checklist de alta |
| `7_Control_Directivo` | **Control operativo semanal** (semáforos, matriz de riesgos, tablero), reporte semanal, plan de 30 días, modelo operativo, minuta ejecutiva de comité, solicitud de autorización, reporte de proyecto (1 página), reporte de riesgos, cierre administrativo |
| `8_Propuestas_y_Presupuestos` | **Presupuesto comercial de 3 opciones** (esencial, profesional, estratégico; recomendada destacada, fases, IVA, cronograma de pagos, análisis de valor) y **propuesta comercial ejecutiva** (Word) |

Material para la tienda y ventas:
- `ejemplos/` – versiones con datos de ejemplo de 17 plantillas (también van en `Paquete_Completo.zip`, carpeta `Ejemplos_con_datos`).
- `marketing/` – presentación comercial de 10 láminas (PDF, HTML interactivo con notas del presentador con la tecla N, y versión para imprimir con notas), 8 infografías en 3 formatos (1080x1350, 1080x1080 y 1080x1920), mensajes de WhatsApp, guion de presentación.
- `portadas_productos/` – una portada de venta por producto (34 + 4).
- `vistas_previas/` – capturas (PNG) de cada formato con datos de ejemplo; `_portada` y `_resumen` cuando aplica.
- `portadas/` – imagen cuadrada 1200x1200 por categoría y del paquete completo con capturas reales (marca configurable en `generar_paquetes.py`).
- `paquetes_zip/` – un ZIP por categoría y `Paquete_Completo.zip`.

Regenerar todo (requiere `openpyxl`, `python-docx`, `Pillow`, LibreOffice y `pdftoppm`):

```
python3 generar_plantillas.py
python3 generar_documentos_word.py
python3 generar_ejemplos.py
python3 generar_paquetes.py
python3 generar_marketing.py   # logo: assets/logo.png · contacto: assets/config_marca.json
```

Convención en Excel: celdas crema = captura, grises = cálculo automático.
Los formatos legales (Word) y la nómina son de uso orientativo; se recomienda revisión de un profesional.
