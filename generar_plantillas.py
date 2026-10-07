#!/usr/bin/env python3
"""Genera plantillas administrativas en Excel (México) en ./plantillas/<categoria>/."""
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter as L

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plantillas")
COLOR = "1F4E78"
CLARO = "DDEBF7"
INPUT = "FFF9E5"
MXN = '"$"#,##0.00'
FECHA = "DD/MM/YYYY"
thin = Side(style="thin", color="BFBFBF")
BORDE = Border(left=thin, right=thin, top=thin, bottom=thin)


def libro(titulo, subtitulo, ancho_cols, hoja="Formato", horizontal=True):
    wb = Workbook()
    ws = wb.active
    ws.title = hoja
    n = len(ancho_cols)
    for i, w in enumerate(ancho_cols, 1):
        ws.column_dimensions[L(i)].width = w
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=n)
    c = ws.cell(1, 1, titulo)
    c.font = Font(name="Calibri", size=18, bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor=COLOR)
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 34
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=n)
    s = ws.cell(2, 1, subtitulo)
    s.font = Font(italic=True, color="595959")
    s.alignment = Alignment(horizontal="center")
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = "landscape" if horizontal else "portrait"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True
    return wb, ws


def encabezado(ws, fila, textos, col=1):
    for i, t in enumerate(textos):
        c = ws.cell(fila, col + i, t)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=COLOR)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORDE
    ws.row_dimensions[fila].height = 32


def campo(ws, fila, col, etiqueta, span=2, valor=None, fmt=None):
    """Etiqueta en col y celda de captura a la derecha (span columnas combinadas)."""
    e = ws.cell(fila, col, etiqueta)
    e.font = Font(bold=True)
    e.fill = PatternFill("solid", fgColor=CLARO)
    e.border = BORDE
    ini = col + 1
    if span > 1:
        ws.merge_cells(start_row=fila, start_column=ini, end_row=fila, end_column=ini + span - 1)
    for k in range(span):
        ws.cell(fila, ini + k).border = BORDE
        ws.cell(fila, ini + k).fill = PatternFill("solid", fgColor=INPUT)
    c = ws.cell(fila, ini, valor)
    if fmt:
        c.number_format = fmt
    return c


def filas(ws, desde, hasta, ncols, formatos=None, formulas=None, col0=1):
    """Pinta filas de captura. formatos {col: fmt}; formulas {col: lambda fila->str}."""
    formatos = formatos or {}
    formulas = formulas or {}
    for r in range(desde, hasta + 1):
        for c in range(col0, col0 + ncols):
            cel = ws.cell(r, c)
            cel.border = BORDE
            if c in formulas:
                cel.value = formulas[c](r)
                cel.fill = PatternFill("solid", fgColor="F2F2F2")
            else:
                cel.fill = PatternFill("solid", fgColor=INPUT)
            if c in formatos:
                cel.number_format = formatos[c]


def total(ws, fila, col_etq, cols_formula, formato=MXN, etiqueta="TOTAL"):
    e = ws.cell(fila, col_etq, etiqueta)
    e.font = Font(bold=True)
    e.alignment = Alignment(horizontal="right")
    for c, f in cols_formula.items():
        x = ws.cell(fila, c, f)
        x.font = Font(bold=True)
        x.number_format = formato
        x.border = BORDE
        x.fill = PatternFill("solid", fgColor=CLARO)


def lista(ws, rango, opciones):
    dv = DataValidation(type="list", formula1='"' + ",".join(opciones) + '"', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(rango)


def firmas(ws, fila, etiquetas, ncols):
    paso = max(1, ncols // len(etiquetas))
    for i, t in enumerate(etiquetas):
        c0 = 1 + i * paso
        c1 = c0 + paso - 2 if paso > 1 else c0
        ws.merge_cells(start_row=fila, start_column=c0, end_row=fila, end_column=max(c0, c1))
        ws.merge_cells(start_row=fila + 1, start_column=c0, end_row=fila + 1, end_column=max(c0, c1))
        for cc in range(c0, max(c0, c1) + 1):
            ws.cell(fila, cc).border = Border(bottom=Side(style="thin"))
        x = ws.cell(fila + 1, c0, t)
        x.alignment = Alignment(horizontal="center")
        x.font = Font(bold=True)


def guardar(wb, cat, nombre):
    d = os.path.join(OUT, cat)
    os.makedirs(d, exist_ok=True)
    wb.save(os.path.join(d, nombre + ".xlsx"))
    print("OK", cat, nombre)


def instrucciones(wb, titulo, pasos):
    ws = wb.create_sheet("Instrucciones")
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 4
    ws.column_dimensions["B"].width = 95
    ws["B1"] = titulo
    ws["B1"].font = Font(size=16, bold=True, color=COLOR)
    ws["B2"] = "Guía de uso"
    ws["B2"].font = Font(italic=True, color="595959")
    for i, p in enumerate(pasos, 1):
        ws.cell(3 + i, 1, i).font = Font(bold=True, color=COLOR)
        c = ws.cell(3 + i, 2, p)
        c.alignment = Alignment(wrap_text=True, vertical="top")
    n = 5 + len(pasos)
    ws.cell(n, 2, "Celdas amarillas = captura · Celdas grises = cálculo automático (no modificar).").font = Font(italic=True)


# ---------------------------------------------------------------- CONTABILIDAD
def ingresos_gastos():
    wb, ws = libro("CONTROL DE INGRESOS Y GASTOS", "Registro diario de movimientos con saldo acumulado",
                   [8, 13, 34, 20, 18, 16, 16, 16])
    campo(ws, 4, 1, "Empresa", 3)
    campo(ws, 4, 5, "Periodo", 3)
    campo(ws, 5, 1, "Saldo inicial", 3, 0, MXN)
    encabezado(ws, 7, ["No.", "Fecha", "Concepto", "Categoría", "Método de pago", "Ingreso", "Gasto", "Saldo"])
    f0, f1 = 8, 57
    filas(ws, f0, f1, 8, {2: FECHA, 6: MXN, 7: MXN, 8: MXN}, {
        1: lambda r: r - 7,
        8: lambda r: f'=IF(AND(F{r}="",G{r}=""),"",$B$5+SUM($F${f0}:F{r})-SUM($G${f0}:G{r}))'})
    total(ws, f1 + 1, 5, {6: f"=SUM(F{f0}:F{f1})", 7: f"=SUM(G{f0}:G{f1})", 8: f"=B5+F{f1+1}-G{f1+1}"})
    lista(ws, f"D{f0}:D{f1}", ["Ventas", "Servicios", "Otros ingresos", "Nómina", "Renta", "Servicios (luz/agua/tel)",
                               "Insumos", "Impuestos", "Publicidad", "Transporte", "Otros gastos"])
    lista(ws, f"E{f0}:E{f1}", ["Efectivo", "Transferencia", "Tarjeta", "Cheque"])
    ws.freeze_panes = "A8"
    instrucciones(wb, "Control de ingresos y gastos", [
        "Captura el saldo inicial del periodo en la celda amarilla correspondiente.",
        "Registra cada movimiento: fecha, concepto, categoría (lista desplegable) y método de pago.",
        "Escribe el monto en la columna Ingreso o Gasto, nunca en ambas.",
        "El saldo acumulado y los totales se calculan solos.",
        "Imprime en horizontal; el formato ya está ajustado a una hoja."])
    guardar(wb, "1_Contabilidad_y_Finanzas", "01_Control_de_Ingresos_y_Gastos")


def caja_chica():
    wb, ws = libro("CONTROL DE CAJA CHICA", "Fondo fijo: vales, reembolsos y arqueo",
                   [8, 13, 14, 36, 24, 16, 16, 16], horizontal=True)
    campo(ws, 4, 1, "Responsable", 3)
    campo(ws, 4, 5, "Fecha de apertura", 2, None, FECHA)
    campo(ws, 5, 1, "Fondo fijo", 3, 2000, MXN)
    encabezado(ws, 7, ["Folio", "Fecha", "No. vale", "Concepto", "Beneficiario / Proveedor", "Importe", "IVA 16%", "Total"])
    f0, f1 = 8, 47
    filas(ws, f0, f1, 8, {2: FECHA, 6: MXN, 7: MXN, 8: MXN}, {
        1: lambda r: r - 7,
        7: lambda r: f'=IF(F{r}="","",ROUND(F{r}*0.16,2))',
        8: lambda r: f'=IF(F{r}="","",F{r}+G{r})'})
    total(ws, f1 + 1, 5, {6: f"=SUM(F{f0}:F{f1})", 7: f"=SUM(G{f0}:G{f1})", 8: f"=SUM(H{f0}:H{f1})"})
    r = f1 + 3
    campo(ws, r, 1, "Total gastado", 2, f"=H{f1+1}", MXN)
    campo(ws, r + 1, 1, "Efectivo en caja", 2, None, MXN)
    campo(ws, r + 2, 1, "Fondo - gastos", 2, f"=B5-H{f1+1}", MXN)
    campo(ws, r + 3, 1, "Diferencia", 2, f"=C{r+1}-C{r+2}", MXN)
    ws.cell(r, 1).alignment = ws.cell(r + 1, 1).alignment = Alignment(wrap_text=True)
    firmas(ws, r + 6, ["Elaboró", "Revisó", "Autorizó"], 8)
    instrucciones(wb, "Control de caja chica", [
        "Define el fondo fijo asignado.",
        "Registra cada vale con importe SIN IVA; el IVA (16%) y el total se calculan.",
        "Al hacer el arqueo captura el efectivo físico en caja: la diferencia debe ser 0.",
        "Si el IVA no aplica (ej. propinas o estacionamiento sin factura), sobrescribe la celda de IVA con 0."])
    guardar(wb, "1_Contabilidad_y_Finanzas", "02_Control_de_Caja_Chica")


def flujo_efectivo():
    meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    wb, ws = libro("FLUJO DE EFECTIVO ANUAL", "Proyección y control mensual", [30] + [13] * 12 + [15])
    campo(ws, 4, 1, "Empresa", 3)
    campo(ws, 4, 6, "Año", 1, 2026)
    campo(ws, 5, 1, "Saldo inicial del año", 1, 0, MXN)
    encabezado(ws, 7, ["Concepto"] + meses + ["TOTAL"])
    r = 8

    def seccion(nombre, items):
        nonlocal r
        c = ws.cell(r, 1, nombre)
        c.font = Font(bold=True, color=COLOR)
        c.fill = PatternFill("solid", fgColor=CLARO)
        for k in range(2, 15):
            ws.cell(r, k).fill = PatternFill("solid", fgColor=CLARO)
        r += 1
        ini = r
        for it in items:
            ws.cell(r, 1, it).border = BORDE
            filas(ws, r, r, 12, {k: MXN for k in range(2, 14)}, col0=2)
            t = ws.cell(r, 14, f"=SUM(B{r}:M{r})")
            t.number_format = MXN
            t.border = BORDE
            t.font = Font(bold=True)
            r += 1
        fin = r - 1
        ws.cell(r, 1, "Total " + nombre.lower()).font = Font(bold=True)
        for k in range(2, 15):
            x = ws.cell(r, k, f"=SUM({L(k)}{ini}:{L(k)}{fin})")
            x.number_format = MXN
            x.font = Font(bold=True)
            x.border = BORDE
        tot = r
        r += 2
        return tot

    ti = seccion("INGRESOS", ["Ventas de contado", "Cobranza de crédito", "Servicios", "Otros ingresos"])
    te = seccion("EGRESOS", ["Nómina y cargas sociales", "Renta", "Proveedores", "Servicios (luz, agua, internet)",
                             "Impuestos (IVA/ISR)", "Publicidad", "Otros egresos"])
    ws.cell(r, 1, "FLUJO NETO DEL MES").font = Font(bold=True)
    ws.cell(r + 1, 1, "SALDO FINAL ACUMULADO").font = Font(bold=True)
    for k in range(2, 14):
        c = L(k)
        a = ws.cell(r, k, f"={c}{ti}-{c}{te}")
        prev = "$B$5" if k == 2 else f"{L(k-1)}{r+1}"
        b = ws.cell(r + 1, k, f"={prev}+{c}{r}")
        for x in (a, b):
            x.number_format = MXN
            x.font = Font(bold=True)
            x.fill = PatternFill("solid", fgColor=CLARO)
            x.border = BORDE
    ws.cell(r, 14, f"=SUM(B{r}:M{r})").number_format = MXN
    ws.freeze_panes = "B8"
    instrucciones(wb, "Flujo de efectivo anual", [
        "Captura el saldo inicial del año.",
        "Llena en amarillo los ingresos y egresos esperados (o reales) de cada mes.",
        "Puedes renombrar los conceptos de la columna A según tu negocio.",
        "El flujo neto y el saldo acumulado se actualizan solos; un saldo negativo indica falta de liquidez."])
    guardar(wb, "1_Contabilidad_y_Finanzas", "03_Flujo_de_Efectivo_Anual")


def cuentas_por_cobrar():
    wb, ws = libro("CUENTAS POR COBRAR", "Seguimiento de facturas, vencimientos y antigüedad de saldos",
                   [8, 28, 14, 13, 13, 12, 16, 16, 16, 14, 16])
    campo(ws, 4, 1, "Empresa", 3)
    campo(ws, 4, 6, "Fecha de corte", 2, "=TODAY()", FECHA)
    encabezado(ws, 6, ["No.", "Cliente", "Folio factura", "Fecha emisión", "Días crédito", "Vence",
                       "Importe", "Abonos", "Saldo", "Días vencido", "Estatus"])
    f0, f1 = 7, 56
    filas(ws, f0, f1, 11, {4: FECHA, 6: FECHA, 7: MXN, 8: MXN, 9: MXN}, {
        1: lambda r: r - 6,
        6: lambda r: f'=IF(D{r}="","",D{r}+E{r})',
        9: lambda r: f'=IF(G{r}="","",G{r}-H{r})',
        10: lambda r: f'=IF(OR(F{r}="",I{r}=""),"",IF(I{r}<=0,0,MAX(0,$G$4-F{r})))',
        11: lambda r: f'=IF(I{r}="","",IF(I{r}<=0,"Pagada",IF(J{r}>0,"Vencida","Vigente")))'})
    total(ws, f1 + 1, 6, {7: f"=SUM(G{f0}:G{f1})", 8: f"=SUM(H{f0}:H{f1})", 9: f"=SUM(I{f0}:I{f1})"})
    r = f1 + 3
    ws.cell(r, 2, "ANTIGÜEDAD DE SALDOS").font = Font(bold=True, color=COLOR)
    rangos = [("Vigente", f'=SUMIFS(I{f0}:I{f1},K{f0}:K{f1},"Vigente")'),
              ("1 a 30 días", f'=SUMIFS(I{f0}:I{f1},J{f0}:J{f1},">=1",J{f0}:J{f1},"<=30")'),
              ("31 a 60 días", f'=SUMIFS(I{f0}:I{f1},J{f0}:J{f1},">=31",J{f0}:J{f1},"<=60")'),
              ("61 a 90 días", f'=SUMIFS(I{f0}:I{f1},J{f0}:J{f1},">=61",J{f0}:J{f1},"<=90")'),
              ("Más de 90 días", f'=SUMIFS(I{f0}:I{f1},J{f0}:J{f1},">90")')]
    for i, (n, f) in enumerate(rangos, 1):
        a = ws.cell(r + i, 2, n)
        a.border = BORDE
        b = ws.cell(r + i, 3, f)
        b.number_format = MXN
        b.border = BORDE
    ws.freeze_panes = "A7"
    instrucciones(wb, "Cuentas por cobrar", [
        "Registra cada factura emitida con fecha, días de crédito e importe.",
        "Cuando recibas un pago, captura el acumulado en la columna Abonos.",
        "El sistema calcula vencimiento, saldo, días vencidos y estatus (Vigente / Vencida / Pagada).",
        "La fecha de corte usa HOY() por defecto; puedes escribir una fecha fija.",
        "Al final verás el resumen de antigüedad de saldos para priorizar tu cobranza."])
    guardar(wb, "1_Contabilidad_y_Finanzas", "04_Cuentas_por_Cobrar")


def conciliacion():
    wb, ws = libro("CONCILIACIÓN BANCARIA", "Saldo en libros vs. estado de cuenta", [6, 50, 20, 20], horizontal=False)
    campo(ws, 4, 1, "Banco", 2)
    campo(ws, 5, 1, "Cuenta", 2)
    campo(ws, 6, 1, "Mes", 2)
    ws.cell(4, 1).alignment = ws.cell(5, 1).alignment = ws.cell(6, 1).alignment = Alignment(wrap_text=True)

    def linea(r, txt, val=None, negrita=False, formula=False):
        ws.cell(r, 2, txt).font = Font(bold=negrita)
        ws.cell(r, 2).border = BORDE
        c = ws.cell(r, 3, val)
        c.number_format = MXN
        c.border = BORDE
        c.fill = PatternFill("solid", fgColor="F2F2F2" if formula else INPUT)
        if negrita:
            c.font = Font(bold=True)

    ws.cell(8, 2, "SEGÚN ESTADO DE CUENTA").font = Font(bold=True, color=COLOR)
    linea(9, "Saldo final según banco")
    linea(10, "(+) Depósitos en tránsito")
    linea(11, "(-) Cheques / pagos en tránsito")
    linea(12, "(+/-) Errores del banco")
    linea(13, "SALDO BANCARIO AJUSTADO", "=C9+C10-C11+C12", True, True)
    ws.cell(15, 2, "SEGÚN LIBROS").font = Font(bold=True, color=COLOR)
    linea(16, "Saldo final según libros")
    linea(17, "(+) Depósitos no registrados / intereses")
    linea(18, "(-) Comisiones y cargos no registrados")
    linea(19, "(-) Cheques devueltos")
    linea(20, "(+/-) Errores en libros")
    linea(21, "SALDO EN LIBROS AJUSTADO", "=C16+C17-C18-C19+C20", True, True)
    linea(23, "DIFERENCIA (debe ser 0)", "=ROUND(C13-C21,2)", True, True)
    ws.cell(24, 2, '=IF(C23=0,"✔ Conciliado","✘ Revisar partidas pendientes")').font = Font(bold=True)
    ws.cell(26, 2, "Detalle de partidas en tránsito").font = Font(bold=True, color=COLOR)
    encabezado(ws, 27, ["No.", "Descripción", "Fecha", "Importe"])
    filas(ws, 28, 37, 4, {3: FECHA, 4: MXN}, {1: lambda r: r - 27})
    firmas(ws, 41, ["Elaboró", "Autorizó"], 4)
    instrucciones(wb, "Conciliación bancaria", [
        "Captura el saldo final del estado de cuenta y el saldo de tu contabilidad.",
        "Anota las partidas de conciliación en cada renglón; deja vacías las que no apliquen.",
        "Cuando la diferencia sea 0 el formato indica 'Conciliado'.",
        "Usa la tabla de detalle para listar cheques y depósitos en tránsito."])
    guardar(wb, "1_Contabilidad_y_Finanzas", "05_Conciliacion_Bancaria")


# ----------------------------------------------------------------- RECURSOS HUMANOS
def asistencia():
    wb, ws = libro("CONTROL DE ASISTENCIA MENSUAL", "A=Asistencia · F=Falta · R=Retardo · V=Vacaciones · I=Incapacidad · D=Descanso · P=Permiso",
                   [5, 28] + [4.2] * 31 + [7, 7, 7, 7, 7])
    campo(ws, 4, 1, "Empresa", 5)
    campo(ws, 4, 10, "Mes/Año", 6)
    encabezado(ws, 6, ["No.", "Empleado"] + [str(d) for d in range(1, 32)] + ["A", "F", "R", "V", "I"])
    f0, f1 = 7, 36
    filas(ws, f0, f1, 38, {}, {1: lambda r: r - 6,
                              34: lambda r: f'=COUNTIF(C{r}:AG{r},"A")',
                              35: lambda r: f'=COUNTIF(C{r}:AG{r},"F")',
                              36: lambda r: f'=COUNTIF(C{r}:AG{r},"R")',
                              37: lambda r: f'=COUNTIF(C{r}:AG{r},"V")',
                              38: lambda r: f'=COUNTIF(C{r}:AG{r},"I")'})
    for r in range(f0, f1 + 1):
        for c in range(3, 34):
            ws.cell(r, c).alignment = Alignment(horizontal="center")
    lista(ws, f"C{f0}:AG{f1}", ["A", "F", "R", "V", "I", "D", "P"])
    ws.freeze_panes = "C7"
    instrucciones(wb, "Control de asistencia", [
        "Escribe el mes y los nombres de tus empleados (hasta 30).",
        "Cada día selecciona la clave en la lista: A, F, R, V, I, D o P.",
        "Las columnas finales suman automáticamente asistencias, faltas, retardos, vacaciones e incapacidades.",
        "Imprime en horizontal; cabe en una sola hoja."])
    guardar(wb, "2_Recursos_Humanos", "01_Control_de_Asistencia")


def nomina():
    wb, ws = libro("NÓMINA SIMPLIFICADA", "Cálculo estimado por periodo (referencia administrativa, no sustituye cálculo fiscal)",
                   [5, 26, 12, 12, 12, 14, 14, 14, 14, 14, 16])
    campo(ws, 4, 1, "Empresa", 3)
    campo(ws, 4, 6, "Periodo", 3)
    campo(ws, 5, 1, "Días del periodo", 3, 15)
    campo(ws, 5, 6, "% retención IMSS (est.)", 3, 0.0275, "0.00%")
    encabezado(ws, 7, ["No.", "Empleado", "Sueldo diario", "Días trab.", "Horas extra", "Sueldo", "Pago horas extra",
                       "Bonos / otros", "Retención IMSS", "ISR retenido", "NETO A PAGAR"])
    f0, f1 = 8, 37
    filas(ws, f0, f1, 11, {3: MXN, 6: MXN, 7: MXN, 8: MXN, 9: MXN, 10: MXN, 11: MXN}, {
        1: lambda r: r - 7,
        6: lambda r: f'=IF(C{r}="","",C{r}*D{r})',
        7: lambda r: f'=IF(C{r}="","",E{r}*(C{r}/8)*2)',
        9: lambda r: f'=IF(C{r}="","",ROUND((F{r}+G{r})*$G$5,2))',
        11: lambda r: f'=IF(C{r}="","",F{r}+G{r}+H{r}-I{r}-J{r})'})
    total(ws, f1 + 1, 5, {c: f"=SUM({L(c)}{f0}:{L(c)}{f1})" for c in range(6, 12)})
    firmas(ws, f1 + 4, ["Elaboró", "Revisó", "Autorizó"], 11)
    instrucciones(wb, "Nómina simplificada", [
        "Captura sueldo diario, días trabajados y horas extra de cada empleado.",
        "Las horas extra se pagan al doble de la hora ordinaria (jornada de 8 h).",
        "El ISR retenido se captura manualmente según la tabla del SAT vigente.",
        "Ajusta el % de retención IMSS según tu cálculo; el valor incluido es solo una referencia.",
        "Este formato es de control administrativo. Para timbrado de recibos usa tu sistema de nómina CFDI."])
    guardar(wb, "2_Recursos_Humanos", "02_Nomina_Simplificada")


def vacaciones():
    wb, ws = libro("CONTROL DE VACACIONES", "Días según antigüedad (Reforma Vacaciones Dignas, LFT 2023)",
                   [5, 28, 14, 12, 14, 14, 14, 14, 24])
    campo(ws, 4, 1, "Empresa", 3)
    campo(ws, 4, 6, "Fecha de corte", 2, "=TODAY()", FECHA)
    encabezado(ws, 6, ["No.", "Empleado", "Fecha ingreso", "Años cumplidos", "Días que corresponden",
                       "Días tomados", "Días pendientes", "Prima vacacional 25%", "Sueldo diario"])
    # Hoja de tabla LFT
    t = wb.create_sheet("Tabla LFT")
    t.append(["Años de servicio", "Días de vacaciones"])
    for a, d in [(1, 12), (2, 14), (3, 16), (4, 18), (5, 20), (6, 22), (11, 24), (16, 26), (21, 28), (26, 30), (31, 32)]:
        t.append([a, d])
    for c in t[1]:
        c.font = Font(bold=True)
    t.column_dimensions["A"].width = 18
    t.column_dimensions["B"].width = 20
    f0, f1 = 7, 36
    filas(ws, f0, f1, 9, {3: FECHA, 6: "0", 8: MXN, 9: MXN}, {
        1: lambda r: r - 6,
        4: lambda r: f'=IF(C{r}="","",DATEDIF(C{r},$G$4,"Y"))',
        5: lambda r: f"=IF(C{r}=\"\",\"\",IF(D{r}<1,0,LOOKUP(D{r},'Tabla LFT'!$A$2:$A$12,'Tabla LFT'!$B$2:$B$12)))",
        7: lambda r: f'=IF(C{r}="","",E{r}-F{r})',
        8: lambda r: f'=IF(OR(C{r}="",I{r}=""),"",ROUND(I{r}*G{r}*0.25,2))'})
    ws.freeze_panes = "A7"
    instrucciones(wb, "Control de vacaciones", [
        "Captura fecha de ingreso, días tomados y sueldo diario de cada empleado.",
        "Los años de servicio y los días que corresponden se calculan con la tabla de la Ley Federal del Trabajo (hoja 'Tabla LFT').",
        "La prima vacacional (25%) se calcula sobre los días pendientes.",
        "Verifica siempre la tabla contra la legislación vigente y tu contrato colectivo, si aplica."])
    guardar(wb, "2_Recursos_Humanos", "03_Control_de_Vacaciones")


def evaluacion():
    wb, ws = libro("EVALUACIÓN DE DESEMPEÑO", "Califica de 1 (deficiente) a 5 (sobresaliente)",
                   [6, 46, 12, 12, 12, 40], horizontal=False)
    campo(ws, 4, 1, "Empleado", 2)
    campo(ws, 4, 4, "Puesto", 2)
    campo(ws, 5, 1, "Área", 2)
    campo(ws, 5, 4, "Periodo", 2)
    campo(ws, 6, 1, "Evaluador", 2)
    campo(ws, 6, 4, "Fecha", 2, None, FECHA)
    encabezado(ws, 8, ["No.", "Criterio", "Calificación (1-5)", "Peso %", "Ponderado", "Comentarios"])
    crit = [("Calidad del trabajo", 20), ("Cumplimiento de objetivos", 20), ("Productividad y orden", 10),
            ("Trabajo en equipo", 10), ("Comunicación", 10), ("Iniciativa y proactividad", 10),
            ("Puntualidad y asistencia", 10), ("Apego a políticas y valores", 10)]
    for i, (n, p) in enumerate(crit):
        r = 9 + i
        filas(ws, r, r, 6, {4: "0%", 5: "0.00"}, {1: lambda x: x - 8,
                                                  5: lambda x: f'=IF(C{x}="","",C{x}*D{x})'})
        ws.cell(r, 2, n)
        ws.cell(r, 2).fill = PatternFill("solid", fgColor="FFFFFF")
        ws.cell(r, 4, p / 100)
    lista(ws, "C9:C16", ["1", "2", "3", "4", "5"])
    total(ws, 17, 3, {4: "=SUM(D9:D16)", 5: "=SUM(E9:E16)"}, "0.00", "RESULTADO")
    ws["D17"].number_format = "0%"
    ws.cell(18, 2, '=IF(E17="","",IF(E17>=4.5,"Sobresaliente",IF(E17>=3.5,"Satisfactorio",IF(E17>=2.5,"Requiere mejora","Deficiente"))))').font = Font(bold=True, size=12)
    ws.cell(20, 2, "Fortalezas").font = Font(bold=True)
    ws.merge_cells("B21:F23")
    ws.cell(25, 2, "Áreas de oportunidad / plan de acción").font = Font(bold=True)
    ws.merge_cells("B26:F28")
    for rng in ("B21:F23", "B26:F28"):
        for row in ws[rng]:
            for c in row:
                c.border = BORDE
                c.fill = PatternFill("solid", fgColor=INPUT)
    firmas(ws, 32, ["Evaluado", "Evaluador", "RH"], 6)
    instrucciones(wb, "Evaluación de desempeño", [
        "Llena los datos del empleado y califica cada criterio de 1 a 5.",
        "Los pesos suman 100% y pueden modificarse; cuida que el total siga siendo 100%.",
        "El resultado ponderado y la categoría se calculan automáticamente.",
        "Documenta fortalezas y plan de acción antes de recabar firmas."])
    guardar(wb, "2_Recursos_Humanos", "04_Evaluacion_de_Desempeno")


# ------------------------------------------------------------ INVENTARIOS Y COMPRAS
def inventario():
    wb, ws = libro("CONTROL DE INVENTARIO", "Existencias, valuación y alertas de reabasto",
                   [8, 14, 32, 16, 10, 12, 12, 12, 14, 16, 18])
    campo(ws, 4, 1, "Almacén", 3)
    campo(ws, 4, 6, "Fecha", 2, "=TODAY()", FECHA)
    encabezado(ws, 6, ["No.", "Código / SKU", "Descripción", "Categoría", "Unidad", "Inv. inicial", "Entradas",
                       "Salidas", "Existencia", "Costo unitario", "Valor inventario"])
    # Columna L-M extra: mínimo y alerta
    ws.column_dimensions["L"].width = 12
    ws.column_dimensions["M"].width = 20
    encabezado(ws, 6, ["Stock mínimo", "Estatus"], 12)
    f0, f1 = 7, 106
    filas(ws, f0, f1, 13, {6: "#,##0", 7: "#,##0", 8: "#,##0", 9: "#,##0", 10: MXN, 11: MXN, 12: "#,##0"}, {
        1: lambda r: r - 6,
        9: lambda r: f'=IF(B{r}="","",F{r}+G{r}-H{r})',
        11: lambda r: f'=IF(B{r}="","",I{r}*J{r})',
        13: lambda r: f'=IF(B{r}="","",IF(I{r}<=0,"SIN STOCK",IF(I{r}<=L{r},"REABASTECER","OK")))'})
    total(ws, f1 + 1, 8, {9: f"=SUM(I{f0}:I{f1})", 11: f"=SUM(K{f0}:K{f1})"}, MXN)
    ws[f"I{f1+1}"].number_format = "#,##0"
    from openpyxl.formatting.rule import CellIsRule
    ws.conditional_formatting.add(f"M{f0}:M{f1}", CellIsRule(operator="equal", formula=['"SIN STOCK"'],
                                  fill=PatternFill("solid", bgColor="F8CBAD")))
    ws.conditional_formatting.add(f"M{f0}:M{f1}", CellIsRule(operator="equal", formula=['"REABASTECER"'],
                                  fill=PatternFill("solid", bgColor="FFE699")))
    ws.freeze_panes = "D7"
    instrucciones(wb, "Control de inventario", [
        "Registra cada producto con su código, inventario inicial, costo y stock mínimo.",
        "Actualiza las columnas Entradas y Salidas con los totales del periodo.",
        "La existencia y el valor del inventario se calculan solos.",
        "La columna Estatus resalta en amarillo los productos por reabastecer y en rojo los agotados."])
    guardar(wb, "3_Inventarios_y_Compras", "01_Control_de_Inventario")


def kardex():
    wb, ws = libro("KARDEX DE ARTÍCULO (COSTO PROMEDIO)", "Movimientos de entradas y salidas con costo promedio ponderado",
                   [6, 13, 16, 30, 11, 13, 14, 11, 13, 14, 11, 13, 14])
    campo(ws, 4, 1, "Artículo", 3)
    campo(ws, 4, 6, "Código", 2)
    campo(ws, 5, 1, "Unidad", 3)
    ws.merge_cells("B7:D7")
    for rng, txt in (("E7:G7", "ENTRADAS"), ("H7:J7", "SALIDAS"), ("K7:M7", "SALDO")):
        a, b = rng.split(":")
        ws.merge_cells(rng)
        ws[a] = txt
        ws[a].font = Font(bold=True, color=COLOR)
        ws[a].alignment = Alignment(horizontal="center")
    encabezado(ws, 8, ["No.", "Fecha", "Documento", "Concepto", "Cant.", "Costo unit.", "Importe",
                       "Cant.", "Costo unit.", "Importe", "Cant.", "Costo prom.", "Importe"])
    f0, f1 = 9, 58
    filas(ws, f0, f1, 13, {2: FECHA, 5: "#,##0.##", 6: MXN, 7: MXN, 8: "#,##0.##", 9: MXN, 10: MXN, 11: "#,##0.##", 12: MXN, 13: MXN}, {
        1: lambda r: r - 8,
        7: lambda r: f'=IF(E{r}="","",E{r}*F{r})',
        9: lambda r: f'=IF(H{r}="","",L{r-1})' if r > f0 else f'=IF(H{r}="","",0)',
        10: lambda r: f'=IF(H{r}="","",H{r}*I{r})',
        11: lambda r: (f'=IF(AND(E{r}="",H{r}=""),"",N(K{r-1})+N(E{r})-N(H{r}))' if r > f0
                       else f'=IF(AND(E{r}="",H{r}=""),"",N(E{r})-N(H{r}))'),
        13: lambda r: (f'=IF(K{r}="","",N(M{r-1})+N(G{r})-N(J{r}))' if r > f0
                       else f'=IF(K{r}="","",N(G{r})-N(J{r}))'),
        12: lambda r: f'=IF(K{r}="","",IF(K{r}=0,0,M{r}/K{r}))'})
    ws.freeze_panes = "A9"
    instrucciones(wb, "Kardex", [
        "Un kardex por artículo. Registra cada movimiento en orden cronológico.",
        "Para una entrada, captura cantidad y costo unitario; para una salida solo la cantidad.",
        "La salida se valúa automáticamente al costo promedio del renglón anterior.",
        "El saldo en unidades e importe se actualiza en cada renglón."])
    guardar(wb, "3_Inventarios_y_Compras", "02_Kardex_Costo_Promedio")


def orden_compra():
    wb, ws = libro("ORDEN DE COMPRA", "", [6, 14, 38, 12, 14, 16, 16], horizontal=False)
    ws["A2"] = None
    campo(ws, 3, 1, "Empresa", 3)
    campo(ws, 3, 5, "No. de orden", 2)
    campo(ws, 4, 1, "RFC", 3)
    campo(ws, 4, 5, "Fecha", 2, None, FECHA)
    campo(ws, 5, 1, "Proveedor", 3)
    campo(ws, 5, 5, "Entrega", 2, None, FECHA)
    campo(ws, 6, 1, "Contacto", 3)
    campo(ws, 6, 5, "Condiciones", 2)
    campo(ws, 7, 1, "Dirección de entrega", 6)
    encabezado(ws, 9, ["Part.", "Código", "Descripción", "Unidad", "Cantidad", "Precio unit.", "Importe"])
    f0, f1 = 10, 24
    filas(ws, f0, f1, 7, {5: "#,##0.##", 6: MXN, 7: MXN}, {
        1: lambda r: r - 9, 7: lambda r: f'=IF(E{r}="","",E{r}*F{r})'})
    r = f1 + 1
    for i, (n, f) in enumerate([("Subtotal", f"=SUM(G{f0}:G{f1})"), ("Descuento", None),
                                ("IVA 16%", f"=ROUND((G{r}-G{r+1})*0.16,2)"), ("TOTAL", f"=G{r}-G{r+1}+G{r+2}")]):
        ws.cell(r + i, 6, n).font = Font(bold=True)
        ws.cell(r + i, 6).alignment = Alignment(horizontal="right")
        c = ws.cell(r + i, 7, f if f else 0)
        c.number_format = MXN
        c.border = BORDE
        c.fill = PatternFill("solid", fgColor=INPUT if n == "Descuento" else CLARO)
    ws.cell(r + 5, 1, "Observaciones:").font = Font(bold=True)
    ws.merge_cells(start_row=r + 6, start_column=1, end_row=r + 8, end_column=7)
    firmas(ws, r + 11, ["Solicita", "Autoriza", "Proveedor (acuse)"], 7)
    instrucciones(wb, "Orden de compra", [
        "Llena los datos del proveedor, condiciones de pago y dirección de entrega.",
        "Captura código, descripción, cantidad y precio unitario SIN IVA.",
        "Subtotal, IVA 16% y total se calculan solos; el descuento se captura como importe.",
        "Imprime y recaba las firmas, o envía el archivo en PDF al proveedor."])
    guardar(wb, "3_Inventarios_y_Compras", "03_Orden_de_Compra")


def cotizacion_comparativa():
    wb, ws = libro("CUADRO COMPARATIVO DE COTIZACIONES", "Compara hasta 4 proveedores y selecciona la mejor opción",
                   [6, 34, 11, 11] + [13, 15] * 4)
    campo(ws, 4, 1, "Requisición No.", 2)
    campo(ws, 4, 5, "Fecha", 2, None, FECHA)
    ws.merge_cells("E6:F6"); ws.merge_cells("G6:H6"); ws.merge_cells("I6:J6"); ws.merge_cells("K6:L6")
    for col, n in ((5, "Proveedor A"), (7, "Proveedor B"), (9, "Proveedor C"), (11, "Proveedor D")):
        c = ws.cell(6, col, n)
        c.fill = PatternFill("solid", fgColor=INPUT)
        c.font = Font(bold=True)
        c.alignment = Alignment(horizontal="center")
        for k in (0, 1):
            ws.cell(6, col + k).border = BORDE
    encabezado(ws, 7, ["Part.", "Descripción", "Unidad", "Cantidad"] + ["P. Unit.", "Importe"] * 4)
    f0, f1 = 8, 22
    fm = {c: MXN for c in range(5, 13)}
    fm[4] = "#,##0.##"
    fx = {1: lambda r: r - 7}
    for pc in (5, 7, 9, 11):
        fx[pc + 1] = (lambda p: (lambda r: f'=IF(OR({L(p)}{r}="",$D{r}=""),"",{L(p)}{r}*$D{r})'))(pc)
    filas(ws, f0, f1, 12, fm, fx)
    r = f1 + 1
    ws.cell(r, 2, "SUBTOTAL").font = Font(bold=True)
    ws.cell(r + 1, 2, "IVA 16%").font = Font(bold=True)
    ws.cell(r + 2, 2, "TOTAL").font = Font(bold=True)
    ws.cell(r + 3, 2, "Condiciones de pago")
    ws.cell(r + 4, 2, "Tiempo de entrega (días)")
    for pc in (5, 7, 9, 11):
        c = L(pc + 1)
        for off, f in ((0, f"=SUM({c}{f0}:{c}{f1})"), (1, f"=ROUND({c}{r}*0.16,2)"), (2, f"={c}{r}+{c}{r+1}")):
            x = ws.cell(r + off, pc + 1, f)
            x.number_format = MXN
            x.font = Font(bold=True)
            x.fill = PatternFill("solid", fgColor=CLARO)
            x.border = BORDE
        for off in (3, 4):
            ws.cell(r + off, pc + 1).fill = PatternFill("solid", fgColor=INPUT)
            ws.cell(r + off, pc + 1).border = BORDE
    ws.cell(r + 6, 2, "MEJOR OPCIÓN (menor total)").font = Font(bold=True, color=COLOR)
    tots = ",".join(f"{L(pc+1)}{r+2}" for pc in (5, 7, 9, 11))
    ws.cell(r + 6, 5, f'=IFERROR(INDEX({{"Proveedor A","Proveedor B","Proveedor C","Proveedor D"}},MATCH(MIN({tots}),CHOOSE({{1,2,3,4}},F{r+2},H{r+2},J{r+2},L{r+2}),0)),"")').font = Font(bold=True)
    ws.cell(r + 7, 2, "Nota: si un proveedor no cotiza todas las partidas, su total no es comparable.").font = Font(italic=True, color="7F7F7F")
    instrucciones(wb, "Cuadro comparativo", [
        "Renombra los proveedores en la fila 6.",
        "Captura descripción, unidad y cantidad de cada partida y el precio unitario ofrecido por proveedor.",
        "Importes, IVA y total se calculan; abajo se indica el proveedor con el menor total.",
        "Anota condiciones de pago y tiempos de entrega, pues el precio no es el único criterio."])
    guardar(wb, "3_Inventarios_y_Compras", "04_Cuadro_Comparativo_de_Cotizaciones")


# -------------------------------------------------------------- DOCUMENTOS Y ACTAS
def cotizacion():
    wb, ws = libro("COTIZACIÓN", "", [6, 14, 40, 12, 14, 16, 16], horizontal=False)
    campo(ws, 3, 1, "Empresa", 3)
    campo(ws, 3, 5, "Folio", 2)
    campo(ws, 4, 1, "RFC", 3)
    campo(ws, 4, 5, "Fecha", 2, None, FECHA)
    campo(ws, 5, 1, "Cliente", 3)
    campo(ws, 5, 5, "Vigencia (días)", 2, 15)
    campo(ws, 6, 1, "Contacto", 3)
    campo(ws, 6, 5, "Tel. / Correo", 2)
    encabezado(ws, 8, ["Part.", "Clave", "Descripción", "Unidad", "Cantidad", "Precio unit.", "Importe"])
    f0, f1 = 9, 23
    filas(ws, f0, f1, 7, {5: "#,##0.##", 6: MXN, 7: MXN}, {
        1: lambda r: r - 8, 7: lambda r: f'=IF(E{r}="","",E{r}*F{r})'})
    r = f1 + 1
    for i, (n, f) in enumerate([("Subtotal", f"=SUM(G{f0}:G{f1})"), ("Descuento", None),
                                ("IVA 16%", f"=ROUND((G{r}-G{r+1})*0.16,2)"), ("TOTAL", f"=G{r}-G{r+1}+G{r+2}")]):
        ws.cell(r + i, 6, n).font = Font(bold=True)
        ws.cell(r + i, 6).alignment = Alignment(horizontal="right")
        c = ws.cell(r + i, 7, f if f else 0)
        c.number_format = MXN
        c.border = BORDE
        c.fill = PatternFill("solid", fgColor=INPUT if n == "Descuento" else CLARO)
    ws.cell(r + 5, 1, "Condiciones comerciales:").font = Font(bold=True)
    ws.merge_cells(start_row=r + 6, start_column=1, end_row=r + 9, end_column=7)
    ws.cell(r + 6, 1, "• Precios en pesos mexicanos (MXN) más IVA, salvo indicación.\n• Forma de pago: \n• Tiempo de entrega: \n• Vigencia de la cotización: ")
    ws.cell(r + 6, 1).alignment = Alignment(wrap_text=True, vertical="top")
    firmas(ws, r + 12, ["Atentamente", "Aceptación del cliente"], 7)
    instrucciones(wb, "Cotización", [
        "Escribe los datos de tu empresa y del cliente.",
        "Captura las partidas con cantidad y precio unitario SIN IVA.",
        "Subtotal, IVA y total se calculan automáticamente.",
        "Edita las condiciones comerciales y envía el archivo en PDF."])
    guardar(wb, "4_Documentos_y_Actas", "01_Cotizacion")


def recibo():
    wb, ws = libro("RECIBO DE PAGO", "", [18, 16, 16, 16, 16, 16], horizontal=False)
    campo(ws, 3, 1, "Folio", 2)
    campo(ws, 3, 4, "Fecha", 2, None, FECHA)
    campo(ws, 4, 1, "Bueno por", 2, None, MXN)
    campo(ws, 5, 1, "Recibí de", 5)
    campo(ws, 6, 1, "La cantidad de", 5)
    campo(ws, 7, 1, "Por concepto de", 5)
    campo(ws, 8, 1, "Forma de pago", 2)
    lista(ws, "B8", ["Efectivo", "Transferencia", "Cheque", "Tarjeta"])
    campo(ws, 8, 4, "Referencia", 2)
    for rr in (5, 6, 7):
        ws.row_dimensions[rr].height = 26
    ws.row_dimensions[7].height = 48
    ws["B7"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.cell(10, 1, "Saldo anterior:")
    ws.cell(11, 1, "Pago recibido:")
    ws.cell(12, 1, "Saldo pendiente:").font = Font(bold=True)
    ws["B10"].number_format = ws["B11"].number_format = ws["B12"].number_format = MXN
    ws["B12"] = "=B10-B11"
    ws["B10"].fill = ws["B11"].fill = PatternFill("solid", fgColor=INPUT)
    ws["B12"].fill = PatternFill("solid", fgColor=CLARO)
    for c in ("B10", "B11", "B12"):
        ws[c].border = BORDE
    firmas(ws, 16, ["Recibí (nombre y firma)", "Entregué"], 6)
    instrucciones(wb, "Recibo de pago", [
        "Captura folio, fecha, importe y concepto.",
        "Escribe la cantidad con letra en 'La cantidad de' (ej. Mil quinientos pesos 00/100 M.N.).",
        "Si es un pago parcial, llena saldo anterior y pago recibido para obtener el saldo pendiente.",
        "Imprime dos tantos: uno para quien paga y otro para archivo."])
    guardar(wb, "4_Documentos_y_Actas", "02_Recibo_de_Pago")


def minuta():
    wb, ws = libro("MINUTA DE REUNIÓN", "", [6, 38, 24, 16, 16], horizontal=False)
    campo(ws, 3, 1, "Empresa", 2)
    campo(ws, 3, 4, "Fecha", 2, None, FECHA)
    campo(ws, 4, 1, "Tema", 2)
    campo(ws, 4, 4, "Hora inicio/fin", 2)
    campo(ws, 5, 1, "Lugar", 2)
    campo(ws, 5, 4, "Elaboró", 2)
    ws.cell(7, 1, "ASISTENTES").font = Font(bold=True, color=COLOR)
    encabezado(ws, 8, ["No.", "Nombre", "Puesto / Área", "Firma", ""])
    filas(ws, 9, 16, 4, {}, {1: lambda r: r - 8})
    ws.cell(18, 1, "ORDEN DEL DÍA").font = Font(bold=True, color=COLOR)
    ws.merge_cells("A19:E22")
    ws.cell(24, 1, "DESARROLLO / ACUERDOS").font = Font(bold=True, color=COLOR)
    ws.merge_cells("A25:E30")
    for rng in ("A19:E22", "A25:E30"):
        for row in ws[rng]:
            for c in row:
                c.border = BORDE
                c.fill = PatternFill("solid", fgColor=INPUT)
    ws.cell(32, 1, "COMPROMISOS").font = Font(bold=True, color=COLOR)
    encabezado(ws, 33, ["No.", "Actividad", "Responsable", "Fecha límite", "Estatus"])
    filas(ws, 34, 43, 5, {4: FECHA}, {1: lambda r: r - 33})
    lista(ws, "E34:E43", ["Pendiente", "En proceso", "Cumplido"])
    firmas(ws, 47, ["Elaboró", "Revisó"], 5)
    instrucciones(wb, "Minuta de reunión", [
        "Llena los datos generales y registra a los asistentes.",
        "Anota el orden del día y los acuerdos tomados.",
        "En la tabla de compromisos define responsable, fecha límite y estatus (lista desplegable).",
        "Distribuye la minuta a los asistentes dentro de las 24 horas siguientes a la reunión."])
    guardar(wb, "4_Documentos_y_Actas", "03_Minuta_de_Reunion")


def solicitud_permiso():
    wb, ws = libro("SOLICITUD DE VACACIONES / PERMISO", "", [22, 18, 18, 18, 18], horizontal=False)
    campo(ws, 3, 1, "Fecha de solicitud", 2, None, FECHA)
    campo(ws, 3, 4, "Folio", 1)
    campo(ws, 4, 1, "Empleado", 4)
    campo(ws, 5, 1, "Puesto", 2)
    campo(ws, 5, 4, "Área", 1)
    campo(ws, 7, 1, "Tipo de solicitud", 2)
    lista(ws, "B7", ["Vacaciones", "Permiso con goce", "Permiso sin goce", "Incapacidad", "Día económico"])
    campo(ws, 8, 1, "Del", 1, None, FECHA)
    campo(ws, 8, 3, "Al", 1, None, FECHA)
    campo(ws, 9, 1, "Días hábiles", 1, "=IF(OR(B8=\"\",D8=\"\"),\"\",NETWORKDAYS(B8,D8))")
    campo(ws, 9, 3, "Regreso el", 1, None, FECHA)
    campo(ws, 10, 1, "Motivo / comentarios", 4)
    ws.row_dimensions[10].height = 50
    ws["B10"].alignment = Alignment(wrap_text=True, vertical="top")
    campo(ws, 12, 1, "Días disponibles", 1)
    campo(ws, 12, 3, "Días restantes", 1, "=IF(OR(B12=\"\",B9=\"\"),\"\",B12-B9)")
    ws.cell(14, 1, "Resolución:").font = Font(bold=True)
    ws.cell(14, 2, "☐ Autorizada     ☐ Rechazada")
    firmas(ws, 18, ["Solicitante", "Jefe inmediato", "Recursos Humanos"], 5)
    instrucciones(wb, "Solicitud de vacaciones o permiso", [
        "El empleado llena sus datos, tipo de solicitud y fechas.",
        "Los días hábiles se calculan de lunes a viernes (no descuenta festivos).",
        "Captura los días disponibles para obtener el saldo restante.",
        "Recaba firma del jefe inmediato y de Recursos Humanos."])
    guardar(wb, "2_Recursos_Humanos", "05_Solicitud_de_Vacaciones_o_Permiso")


if __name__ == "__main__":
    for f in (ingresos_gastos, caja_chica, flujo_efectivo, cuentas_por_cobrar, conciliacion,
              asistencia, nomina, vacaciones, evaluacion, solicitud_permiso,
              inventario, kardex, orden_compra, cotizacion_comparativa,
              cotizacion, recibo, minuta):
        f()
