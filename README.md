# Papeles de trabajo administrativos (México)

28 formatos editables listos para vender: 20 plantillas en Excel (fórmulas automáticas, listas
desplegables, impresión ajustada, hoja de instrucciones) y 8 documentos en Word (campos a llenar resaltados).

| Carpeta (`plantillas/`) | Contenido |
|---|---|
| `1_Contabilidad_y_Finanzas` | Ingresos y gastos, caja chica, flujo de efectivo, cuentas por cobrar, conciliación bancaria, presupuesto anual, activos fijos, directorio de clientes/proveedores |
| `2_Recursos_Humanos` | Asistencia, nómina simplificada, vacaciones (LFT), evaluación de desempeño, solicitud de vacaciones/permiso |
| `3_Inventarios_y_Compras` | Inventario, kardex costo promedio, orden de compra, cuadro comparativo de cotizaciones |
| `4_Documentos_y_Actas` | Cotización, recibo de pago, minuta de reunión |
| `5_Documentos_Word` | Contrato de servicios, renuncia, constancia laboral, carta de cobranza, acta entrega-recepción, acta administrativa, NDA, carta poder |

Material para la tienda:
- `vistas_previas/` – captura (PNG) de cada formato, para las fichas de producto.
- `portadas/` – imagen cuadrada 1200x1200 por categoría y del paquete completo (cambia `MARCA` en `generar_paquetes.py`).
- `paquetes_zip/` – un ZIP por categoría y `Paquete_Completo.zip`.

Regenerar todo (requiere `openpyxl`, `python-docx`, `Pillow`, LibreOffice y `pdftoppm`):

```
python3 generar_plantillas.py
python3 generar_documentos_word.py
python3 generar_paquetes.py
```

Convención en Excel: celdas amarillas = captura, grises = cálculo automático.
Los formatos legales (Word) y la nómina son de uso orientativo; se recomienda revisión de un profesional.
