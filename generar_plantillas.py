#!/usr/bin/env python3
"""Genera plantillas administrativas en Excel (México) en ./plantillas/<categoria>/."""
import os
from openpyxl import Workbook
from openpyxl.styles import Font as _Font, PatternFill, Alignment, Border, Side, Protection
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter as L
from contenido import CONTENIDO, GENERALES_FAQ



def Font(**kw):
    kw.setdefault("name", FUENTE)
    return _Font(**kw)


OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plantillas")
COLOR = "0B2A4A"    # azul marino (principal)
PETROL = "0E7C8B"   # azul turquesa (secundario)
CORAL = "E8604C"    # coral (alertas y semáforo rojo)
GOLD = "C9A227"     # dorado sobrio (acento)
CLARO = "E6ECF1"
INPUT = "FFFCF0"
CALC = "EEF2F5"
MARCA = ""  # sin marca: el producto se vende a terceros
ETIQUETA = "FORMATOS ADMINISTRATIVOS"
FUENTE = "Abadi"
# capacidad (último renglón de captura) de cada formato; generar_ejemplos.py las importa
ING_F0, ING_F1 = 8, 307
CAJA_F0, CAJA_F1 = 8, 107
CXC_F0, CXC_F1 = 7, 156
ASIS_F0, ASIS_F1 = 7, 56
NOM_F0, NOM_F1 = 8, 67
VAC_F0, VAC_F1 = 7, 66
INV_F0, INV_F1 = 7, 306
KAR_F0, KAR_F1 = 9, 208
ACT_F0, ACT_F1 = 7, 156
DIR_F0, DIR_F1 = 7, 306
PARTIDAS_FILAS = 50
MXN = '"$"#,##0.00'
FECHA = "DD/MM/YYYY"
thin = Side(style="thin", color="C9D3DB")
BORDE = Border(left=thin, right=thin, top=thin, bottom=thin)


def libro(titulo, subtitulo, ancho_cols, hoja="FORMATO", horizontal=True):
    wb = Workbook()
    ws = wb.active
    ws.title = hoja
    banner(ws, titulo, subtitulo, ancho_cols, horizontal)
    return wb, ws


def banner(ws, titulo, subtitulo, ancho_cols, horizontal=True):
    n = len(ancho_cols)
    for i, w in enumerate(ancho_cols, 1):
        ws.column_dimensions[L(i)].width = w
    # Recuadro de logo: últimas k columnas (>= 18 de ancho) en filas 1-2
    k, acum = 0, 0
    while k < n - 2 and acum < 18:
        k += 1
        acum += ancho_cols[n - k]
    t_fin = n - k
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=t_fin)
    c = ws.cell(1, 1, titulo)
    c.font = Font(size=20, bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor=COLOR)
    c.alignment = Alignment(horizontal="center", vertical="center")
    for cc in range(1, t_fin + 1):
        ws.cell(1, cc).fill = PatternFill("solid", fgColor=COLOR)
    ws.row_dimensions[1].height = 44
    ws.row_dimensions[2].height = 26
    for cc in range(1, t_fin + 1):
        ws.cell(2, cc).border = Border(bottom=Side(style="medium", color=GOLD))
    ws.sheet_properties.tabColor = COLOR
    ws.page_setup.firstPageNumber = 1
    ws.page_setup.useFirstPageNumber = True
    ws.oddFooter.center.text = "Página &P"
    ws.oddFooter.center.size = 8
    ws.oddFooter.right.text = "Impreso: &D"
    ws.oddFooter.right.size = 8
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=t_fin)
    s_ = ws.cell(2, 1, subtitulo)
    s_.font = Font(italic=True, size=10, color="5B6B78")
    s_.alignment = Alignment(horizontal="center", vertical="center")
    lg0 = t_fin + 1
    ws.merge_cells(start_row=1, start_column=lg0, end_row=2, end_column=n)
    lg = ws.cell(1, lg0, "INSERTE SU LOGO\n(clic derecho > Insertar imagen)")
    lg.font = Font(size=8, italic=True, color="A6A6A6")
    lg.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    dash = Side(style="dashed", color="A6A6A6")
    for rr in (1, 2):
        for cc in range(lg0, n + 1):
            ws.cell(rr, cc).border = Border(top=dash if rr == 1 else None, bottom=dash if rr == 2 else None,
                                            left=dash if cc == lg0 else None, right=dash if cc == n else None)
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = "landscape" if horizontal else "portrait"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True


def encabezado(ws, fila, textos, col=1):
    for i, t in enumerate(textos):
        c = ws.cell(fila, col + i, t.upper() if isinstance(t, str) else t)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=COLOR)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORDE
    ws.row_dimensions[fila].height = 32


def campo(ws, fila, col, etiqueta, span=2, valor=None, fmt=None):
    """Etiqueta en col y celda de captura a la derecha (span columnas combinadas)."""
    letra = L(col)
    necesario = len(etiqueta) * 1.15 + 2
    actual = ws.column_dimensions[letra].width or 8.43
    if actual < necesario:
        ws.column_dimensions[letra].width = necesario
    e = ws.cell(fila, col, etiqueta.upper())
    e.font = Font(bold=True, color=PETROL)
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
                cel.fill = PatternFill("solid", fgColor=CALC)
                if c == col0:
                    cel.alignment = Alignment(horizontal="center")
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
        x.font = Font(bold=True, color=COLOR)
        x.number_format = formato
        x.border = BORDE
        x.fill = PatternFill("solid", fgColor=CLARO)


def lista(ws, rango, opciones, aviso=False):
    """opciones: lista de textos o una fórmula/rango que empiece con '='. aviso=True permite otros valores (advertencia)."""
    f1 = opciones if isinstance(opciones, str) else '"' + ",".join(opciones) + '"'
    dv = DataValidation(type="list", formula1=f1, allow_blank=True)
    if aviso:
        dv.errorStyle = "warning"
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


def catalogo(wb, listas, hoja="CATÁLOGOS", filas_=30):
    """Hoja de listas editables. listas = {"TÍTULO": [valores]}. Devuelve {título: fórmula de lista dinámica}."""
    ws = wb.create_sheet(hoja)
    ancho = [4] + [30] * len(listas) + [4]
    banner(ws, "CATÁLOGOS EDITABLES", "Las listas desplegables del formato se alimentan de estas columnas", ancho + [10], horizontal=False)
    ws.sheet_properties.tabColor = PETROL
    refs = {}
    for k, (tit, vals) in enumerate(listas.items()):
        col = 2 + k
        encabezado(ws, 4, [tit], col)
        for r in range(5, 5 + filas_):
            c = ws.cell(r, col)
            c.border = BORDE
            c.fill = PatternFill("solid", fgColor=INPUT)
            if r - 5 < len(vals):
                c.value = vals[r - 5]
        letra = L(col)
        refs[tit] = f"=OFFSET('{hoja}'!${letra}$5,0,0,MAX(1,COUNTA('{hoja}'!${letra}$5:${letra}${4 + filas_})),1)"
    ws.cell(5 + filas_ + 1, 2, "Escribe una opción por renglón, sin dejar espacios en blanco entre ellas.").font = Font(italic=True, size=9, color="5B6B78")
    return refs


def mayusculas(ws):
    """Títulos, encabezados y etiquetas en MAYÚSCULAS (no toca datos de captura ni fórmulas)."""
    for fila in ws.iter_rows():
        for c in fila:
            v = c.value
            if not isinstance(v, str) or v.startswith("=") or len(v) > 60 or c.font.i:
                continue
            f = c.fill
            if f and f.fill_type == "solid" and str(f.fgColor.rgb).endswith(INPUT):
                continue
            c.value = v.upper()


def aplicar_fuente(ws):
    for fila in ws.iter_rows():
        for c in fila:
            f = c.font
            if f.name != FUENTE:
                c.font = _Font(name=FUENTE, sz=f.sz or 10, b=f.b, i=f.i, color=f.color, u=f.u)


def proteger(wb):
    """Bloquea todo salvo las celdas de captura (relleno INPUT). Sin contraseña."""
    for ws in wb.worksheets:
        if ws.title in ("TABLA LFT", "TASAS"):
            continue
        for fila in ws.iter_rows():
            for c in fila:
                f = c.fill
                if f and f.fill_type == "solid" and str(f.fgColor.rgb).endswith(INPUT):
                    c.protection = Protection(locked=False)
        ws.protection.sheet = True
        ws.protection.objects = False      # permite insertar el logo
        ws.protection.scenarios = False
        ws.protection.formatColumns = False
        ws.protection.formatRows = False
        ws.protection.autoFilter = False
        ws.protection.sort = False


def guardar(wb, cat, nombre):
    for ws in wb.worksheets:
        if ws.title not in ("PORTADA", "AYUDA"):
            mayusculas(ws)
        aplicar_fuente(ws)
    proteger(wb)
    d = os.path.join(OUT, cat)
    os.makedirs(d, exist_ok=True)
    wb.save(os.path.join(d, nombre + ".xlsx"))
    print("OK", cat, nombre)


DESCRIPCION_HOJAS = {
    "FORMATO": "Hoja principal de captura. Aquí registras tu información; las celdas grises calculan solas.",
    "RESUMEN": "Tablero con indicadores y gráficas que se actualizan automáticamente con tus datos.",
    "CATÁLOGOS": "Listas editables (categorías, métodos, unidades) que alimentan los menús desplegables.",
    "PARTIDAS": "Detalle de partidas en tránsito y movimientos pendientes de conciliar.",
    "TASAS": "Tabla de tasas de depreciación de referencia; edítala según tu criterio contable.",
    "TABLA LFT": "Días de vacaciones por antigüedad conforme a la Ley Federal del Trabajo.",
    "AYUDA": "Preguntas frecuentes, glosario y lista de verificación para cerrar tu periodo.",
    "TABLERO": "Tablero ejecutivo: semáforo general, indicadores clave, gráficas y texto automático para el reporte semanal.",
    "ACTIVIDADES": "Registro semanal de actividades con responsable, fecha compromiso, avance y semáforo automático.",
    "PROYECTOS": "Seguimiento de proyectos: avance planeado vs. real, presupuesto ejercido y semáforo.",
    "PENDIENTES": "Lista de pendientes con origen, responsable, antigüedad y semáforo.",
    "RIESGOS": "Registro de riesgos con probabilidad, impacto, clasificación automática y matriz de calor.",
    "DECISIONES": "Decisiones que requiere la dirección: contexto, opciones, recomendación y fecha requerida.",
    "INDICADORES": "Indicadores con meta y 12 semanas de historia; cumplimiento y semáforo automáticos.",
}


def _texto_merge(ws, fila, col0, col1, texto, fuente=None, alto_por_linea=15, ancho_chars=80, minimo=18):
    ws.merge_cells(start_row=fila, start_column=col0, end_row=fila, end_column=col1)
    c = ws.cell(fila, col0, texto)
    c.alignment = Alignment(wrap_text=True, vertical="center")
    c.font = fuente or Font(size=10, color="2B2B2B")
    lineas = max(1, -(-len(texto) // ancho_chars))
    ws.row_dimensions[fila].height = max(minimo, alto_por_linea * lineas + 6)
    return c


def _seccion(ws, fila, texto, c0=2, c1=6):
    for cc in range(c0, c1 + 1):
        ws.cell(fila, cc).border = Border(bottom=Side(style="medium", color=GOLD))
    t = ws.cell(fila, c0, texto)
    t.font = Font(size=12, bold=True, color=PETROL)
    ws.row_dimensions[fila].height = 24


def instrucciones(wb, titulo, pasos):
    """Crea la hoja PORTADA (primera pestaña) y la hoja AYUDA con contenido propio de cada formato."""
    info = CONTENIDO.get(titulo, {})
    # ---------------- PORTADA
    ws = wb.create_sheet("PORTADA", 0)
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = GOLD
    for col, w in (("A", 3), ("B", 6), ("C", 27), ("D", 27), ("E", 27), ("F", 27), ("G", 3)):
        ws.column_dimensions[col].width = w
    azul = PatternFill("solid", fgColor=COLOR)
    for r in range(1, 13):
        for c in range(1, 8):
            ws.cell(r, c).fill = azul
    ws.row_dimensions[1].height = 8
    ws.row_dimensions[2].height = 22
    ws["B2"] = ETIQUETA
    ws["B2"].font = Font(size=11, bold=True, color=GOLD)
    ws.merge_cells("E2:F2")
    ws["E2"] = "VERSIÓN 2.0  ·  MÉXICO"
    ws["E2"].font = Font(size=9, bold=True, color="C9D3DB")
    ws["E2"].alignment = Alignment(horizontal="right", vertical="center")
    ws.row_dimensions[4].height = 30
    ws.row_dimensions[5].height = 30
    ws.merge_cells("B4:F5")
    ws["B4"] = titulo.upper()
    ws["B4"].font = Font(size=30, bold=True, color="FFFFFF")
    ws["B4"].alignment = Alignment(vertical="center", wrap_text=True)
    ws.row_dimensions[6].height = 22
    ws.merge_cells("B6:F6")
    ws["B6"] = "Formato administrativo profesional · editable · listo para imprimir"
    ws["B6"].font = Font(size=12, italic=True, color="C9D3DB")
    ws.row_dimensions[8].height = 4
    gold_b = Side(style="thin", color=GOLD)
    ws.row_dimensions[9].height = 24
    for col, txt in zip("CDEF", ("FÓRMULAS AUTOMÁTICAS", "LISTAS DESPLEGABLES", "HOJAS PROTEGIDAS", "LISTO PARA IMPRIMIR")):
        x = ws[f"{col}9"]
        x.value = txt
        x.font = Font(size=9, bold=True, color=GOLD)
        x.alignment = Alignment(horizontal="center", vertical="center")
        x.border = Border(top=gold_b, bottom=gold_b, left=gold_b, right=gold_b)
    for c in range(1, 8):
        ws.cell(13, c).border = Border(top=Side(style="thick", color=GOLD))
    ws.row_dimensions[13].height = 6

    r = 15
    _seccion(ws, r, "¿QUÉ INCLUYE ESTE ARCHIVO?")
    r += 1
    for nombre in wb.sheetnames:
        if nombre == "PORTADA":
            continue
        ws.cell(r, 2, "▸").font = Font(size=11, bold=True, color=GOLD)
        ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="center")
        n = ws.cell(r, 3, nombre)
        n.font = Font(size=10, bold=True, color=COLOR)
        n.alignment = Alignment(vertical="center")
        _texto_merge(ws, r, 4, 6, DESCRIPCION_HOJAS.get(nombre, ""), ancho_chars=78)
        r += 1
    if "AYUDA" not in wb.sheetnames:
        ws.cell(r, 2, "▸").font = Font(size=11, bold=True, color=GOLD)
        ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="center")
        ws.cell(r, 3, "AYUDA").font = Font(size=10, bold=True, color=COLOR)
        _texto_merge(ws, r, 4, 6, DESCRIPCION_HOJAS["AYUDA"], ancho_chars=78)
        r += 1
    r += 1
    _seccion(ws, r, "CÓMO USARLO")
    r += 1
    pasos = list(pasos) + ["Personaliza: inserta tu logotipo en el recuadro punteado de la esquina superior derecha "
                           "(Insertar > Imágenes) y captura los datos de tu empresa en las celdas de captura."]
    for i, p_ in enumerate(pasos, 1):
        ws.cell(r, 2, i).font = Font(bold=True, size=12, color=GOLD)
        ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="center")
        _texto_merge(ws, r, 3, 6, p_, ancho_chars=108)
        r += 1
    if info.get("tips"):
        r += 1
        _seccion(ws, r, "RECOMENDACIONES DE USO")
        r += 1
        for t in info["tips"]:
            ws.cell(r, 2, "✓").font = Font(bold=True, size=11, color=PETROL)
            ws.cell(r, 2).alignment = Alignment(horizontal="center", vertical="center")
            _texto_merge(ws, r, 3, 6, t, ancho_chars=108)
            r += 1
    r += 1
    _seccion(ws, r, "LEYENDA DE COLORES")
    r += 1
    for color, txt in ((INPUT, "CELDA DE CAPTURA: escribe aquí."), (CALC, "CÁLCULO AUTOMÁTICO: no la modifiques."), (COLOR, "ENCABEZADOS Y TÍTULOS.")):
        sw = ws.cell(r, 2, "")
        sw.fill = PatternFill("solid", fgColor=color)
        sw.border = BORDE
        ws.cell(r, 3, txt).font = Font(size=10, color="5B6B78")
        r += 1
    r += 1
    for c in range(1, 8):
        ws.cell(r, c).fill = azul
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=6)
    f_ = ws.cell(r, 2, "Formatos administrativos  ·  Para uso interno de tu empresa")
    f_.font = Font(size=9, color="C9D3DB")
    f_.alignment = Alignment(vertical="center")
    ws.row_dimensions[r].height = 26
    ws.page_setup.orientation = "portrait"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True
    wb.active = 0

    # ---------------- AYUDA
    ay = wb.create_sheet("AYUDA")
    ay.sheet_view.showGridLines = False
    ay.sheet_properties.tabColor = PETROL
    for col, w in (("A", 3), ("B", 6), ("C", 38), ("D", 80), ("E", 3)):
        ay.column_dimensions[col].width = w
    for c in range(1, 6):
        ay.cell(1, c).fill = azul
        ay.cell(2, c).fill = azul
    ay.row_dimensions[1].height = 30
    ay.merge_cells("B1:D1")
    ay["B1"] = "AYUDA Y PREGUNTAS FRECUENTES"
    ay["B1"].font = Font(size=18, bold=True, color="FFFFFF")
    ay["B1"].alignment = Alignment(vertical="center")
    ay.merge_cells("B2:D2")
    ay["B2"] = titulo.upper()
    ay["B2"].font = Font(size=10, bold=True, color=GOLD)
    for c in range(1, 6):
        ay.cell(3, c).border = Border(top=Side(style="thick", color=GOLD))
    r = 5
    _seccion(ay, r, "PREGUNTAS FRECUENTES", 2, 4)
    r += 1
    for q, a in list(info.get("faq", [])) + GENERALES_FAQ:
        qq = ay.cell(r, 3, q)
        qq.font = Font(size=10, bold=True, color=COLOR)
        qq.alignment = Alignment(wrap_text=True, vertical="top")
        aa = ay.cell(r, 4, a)
        aa.font = Font(size=10, color="2B2B2B")
        aa.alignment = Alignment(wrap_text=True, vertical="top")
        for cc in (3, 4):
            ay.cell(r, cc).border = Border(bottom=Side(style="thin", color="C9D3DB"))
        ay.row_dimensions[r].height = max(30, 15 * max(-(-len(a) // 85), -(-len(q) // 38)) + 8)
        r += 1
    if info.get("glosario"):
        r += 1
        _seccion(ay, r, "GLOSARIO", 2, 4)
        r += 1
        for t, d in info["glosario"]:
            tt = ay.cell(r, 3, t)
            tt.font = Font(size=10, bold=True, color=PETROL)
            dd = ay.cell(r, 4, d)
            dd.font = Font(size=10, color="2B2B2B")
            dd.alignment = Alignment(wrap_text=True, vertical="center")
            for cc in (3, 4):
                ay.cell(r, cc).border = Border(bottom=Side(style="thin", color="C9D3DB"))
            ay.row_dimensions[r].height = max(20, 15 * -(-len(d) // 85) + 6)
            r += 1
    if info.get("checklist"):
        r += 1
        _seccion(ay, r, "LISTA DE VERIFICACIÓN (marca ☑ al completar)", 2, 4)
        r += 1
        dv = DataValidation(type="list", formula1='"☐,☑"', allow_blank=False)
        ay.add_data_validation(dv)
        for t in info["checklist"]:
            b = ay.cell(r, 2, "☐")
            b.fill = PatternFill("solid", fgColor=INPUT)
            b.border = BORDE
            b.alignment = Alignment(horizontal="center")
            b.font = Font(size=12, color=COLOR)
            dv.add(b)
            ay.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
            ay.cell(r, 3, t).font = Font(size=10, color="2B2B2B")
            ay.row_dimensions[r].height = 20
            r += 1
    ay.page_setup.orientation = "portrait"
    ay.page_setup.fitToWidth = 1
    ay.page_setup.fitToHeight = 0
    ay.sheet_properties.pageSetUpPr.fitToPage = True


# ------------------------------------------------------------------ TABLERO (Resumen)
from openpyxl.chart import BarChart, LineChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList


def hoja_resumen(wb, titulo, subtitulo, nombre="RESUMEN"):
    ws = wb.create_sheet(nombre)
    banner(ws, titulo, subtitulo, [2] + [15] * 8 + [2])
    ws.sheet_properties.tabColor = GOLD
    ws.page_setup.fitToHeight = 1
    return ws


def kpi(ws, col, etiqueta, formula, fmt=MXN, fila=4):
    """Tarjeta de indicador de 2 columnas: etiqueta arriba, valor grande abajo."""
    for r_, alto in ((fila, 20), (fila + 1, 36)):
        ws.row_dimensions[r_].height = alto
        ws.merge_cells(start_row=r_, start_column=col, end_row=r_, end_column=col + 1)
    a = ws.cell(fila, col, etiqueta)
    a.font = Font(size=9, bold=True, color=PETROL)
    a.alignment = Alignment(horizontal="center", vertical="center")
    b = ws.cell(fila + 1, col, formula)
    b.font = Font(size=18, bold=True, color=COLOR)
    b.number_format = fmt
    b.alignment = Alignment(horizontal="center", vertical="center")
    for r_ in (fila, fila + 1):
        for c_ in (col, col + 1):
            x = ws.cell(r_, c_)
            x.fill = PatternFill("solid", fgColor=CLARO if r_ == fila else "FFFFFF")
            x.border = Border(left=thin if c_ == col else None, right=thin if c_ == col + 1 else None,
                              top=Side(style="medium", color=GOLD) if r_ == fila else None,
                              bottom=thin if r_ == fila + 1 else None)


def colorear(chart, colores=(COLOR, GOLD, PETROL, "8A97A3")):
    for i, ser in enumerate(chart.series):
        ser.graphicalProperties.solidFill = colores[i % len(colores)]
        ser.graphicalProperties.line.solidFill = colores[i % len(colores)]


def grafica_barras(titulo, horizontal=False, ancho=11.5, alto=7.2):
    ch = BarChart()
    ch.type = "bar" if horizontal else "col"
    ch.title = titulo
    ch.width, ch.height = ancho, alto
    ch.legend.position = "b"
    ch.y_axis.numFmt = '"$"#,##0'
    ch.y_axis.majorGridlines = None
    ch.x_axis.delete = False
    ch.y_axis.delete = False
    return ch


def tabla_simple(ws, fila, col, encabezados, filas_, formatos=None):
    encabezado(ws, fila, encabezados, col)
    ws.row_dimensions[fila].height = 32
    for i, fila_ in enumerate(filas_, 1):
        for j, v in enumerate(fila_):
            c = ws.cell(fila + i, col + j, v)
            c.border = BORDE
            if formatos and j in formatos:
                c.number_format = formatos[j]
            if j > 0:
                c.fill = PatternFill("solid", fgColor=CALC)


# ---------------------------------------------------------------- CONTABILIDAD
def ingresos_gastos():
    wb, ws = libro("CONTROL DE INGRESOS Y GASTOS", "Registro diario de movimientos con saldo acumulado",
                   [8, 13, 34, 24, 18, 16, 16, 16])
    campo(ws, 4, 1, "Empresa", 3)
    campo(ws, 4, 5, "Periodo", 3)
    campo(ws, 5, 1, "Saldo inicial", 3, 0, MXN)
    encabezado(ws, 7, ["No.", "Fecha", "Concepto", "Categoría", "Método de pago", "Ingreso", "Gasto", "Saldo"])
    f0, f1 = ING_F0, ING_F1
    filas(ws, f0, f1, 8, {2: FECHA, 6: MXN, 7: MXN, 8: MXN}, {
        1: lambda r: r - 7,
        8: lambda r: f'=IF(AND(F{r}="",G{r}=""),"",$B$5+SUM($F${f0}:F{r})-SUM($G${f0}:G{r}))'})
    total(ws, f1 + 1, 5, {6: f"=SUM(F{f0}:F{f1})", 7: f"=SUM(G{f0}:G{f1})", 8: f"=B5+F{f1+1}-G{f1+1}"})
    categorias = ["VENTAS", "SERVICIOS", "OTROS INGRESOS", "NÓMINA", "RENTA", "SERVICIOS (LUZ/AGUA/TEL)", "INSUMOS",
                  "IMPUESTOS", "PUBLICIDAD", "TRANSPORTE", "MANTENIMIENTO", "OTROS GASTOS"]
    refs = catalogo(wb, {"CATEGORÍAS": categorias, "MÉTODOS DE PAGO": ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE", "DEPÓSITO"]})
    lista(ws, f"D{f0}:D{f1}", refs["CATEGORÍAS"])
    lista(ws, f"E{f0}:E{f1}", refs["MÉTODOS DE PAGO"])
    ws.freeze_panes = "A8"
    ws.auto_filter.ref = f"A7:H{f1}"
    # ----- tablero
    rs = hoja_resumen(wb, "RESUMEN DE INGRESOS Y GASTOS", "Se actualiza solo con lo que captures en la hoja FORMATO")
    kpi(rs, 2, "TOTAL INGRESOS", f"=FORMATO!F{f1+1}")
    kpi(rs, 4, "TOTAL GASTOS", f"=FORMATO!G{f1+1}")
    kpi(rs, 6, "SALDO FINAL", f"=FORMATO!H{f1+1}")
    kpi(rs, 8, "MARGEN (%)", f'=IFERROR((FORMATO!F{f1+1}-FORMATO!G{f1+1})/FORMATO!F{f1+1},0)', "0.0%")
    rng = lambda c: f"FORMATO!${c}${f0}:${c}${f1}"
    meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]
    t0 = 46
    tabla_simple(rs, t0, 2, ["Mes", "Ingresos", "Gastos", "Saldo del mes"], [
        [mm, f"=SUMPRODUCT(({rng('B')}<>\"\")*(MONTH({rng('B')})={i + 1})*{rng('F')})",
         f"=SUMPRODUCT(({rng('B')}<>\"\")*(MONTH({rng('B')})={i + 1})*{rng('G')})", f"=C{t0 + 1 + i}-D{t0 + 1 + i}"]
        for i, mm in enumerate(meses)], {1: MXN, 2: MXN, 3: MXN})
    tabla_simple(rs, t0, 7, ["Categoría", "Ingresos", "Gastos"], [
        [f"=IF('CATÁLOGOS'!B{5 + i}=\"\",\"\",'CATÁLOGOS'!B{5 + i})",
         f"=IF(G{t0 + 1 + i}=\"\",0,SUMIF({rng('D')},G{t0 + 1 + i},{rng('F')}))",
         f"=IF(G{t0 + 1 + i}=\"\",0,SUMIF({rng('D')},G{t0 + 1 + i},{rng('G')}))"] for i in range(15)], {1: MXN, 2: MXN})
    rs.column_dimensions["G"].width = 26
    g1 = grafica_barras("Ingresos vs. gastos por mes", ancho=23.5, alto=7.5)
    g1.add_data(Reference(rs, min_col=3, max_col=4, min_row=t0, max_row=t0 + 12), titles_from_data=True)
    g1.set_categories(Reference(rs, min_col=2, min_row=t0 + 1, max_row=t0 + 12))
    colorear(g1, (PETROL, GOLD))
    rs.add_chart(g1, "B8")
    g2 = grafica_barras("Movimientos por categoría", horizontal=True, ancho=23.5, alto=10)
    g2.add_data(Reference(rs, min_col=8, max_col=9, min_row=t0, max_row=t0 + 15), titles_from_data=True)
    g2.set_categories(Reference(rs, min_col=7, min_row=t0 + 1, max_row=t0 + 15))
    colorear(g2, (PETROL, GOLD))
    rs.add_chart(g2, "B24")
    instrucciones(wb, "Control de ingresos y gastos", [
        "Captura el saldo inicial del periodo en la celda de captura correspondiente.",
        "Registra cada movimiento: fecha, concepto, categoría (lista desplegable) y método de pago.",
        "Escribe el monto en la columna Ingreso o Gasto, nunca en ambas.",
        "El saldo acumulado y los totales se calculan solos; el resumen mensual y por categoría está en la hoja RESUMEN.",
        "Personaliza las categorías y métodos de pago en la hoja CATÁLOGOS (hasta 30 opciones).",
        "Usa un archivo por año para que el resumen mensual no mezcle ejercicios."])
    guardar(wb, "1_Contabilidad_y_Finanzas", "01_Control_de_Ingresos_y_Gastos")

def caja_chica():
    wb, ws = libro("CONTROL DE CAJA CHICA", "Fondo fijo: vales, reembolsos y arqueo",
                   [8, 13, 14, 36, 24, 16, 16, 16], horizontal=True)
    campo(ws, 4, 1, "Responsable", 3)
    campo(ws, 4, 5, "Fecha de apertura", 2, None, FECHA)
    campo(ws, 5, 1, "Fondo fijo", 3, 2000, MXN)
    encabezado(ws, 7, ["Folio", "Fecha", "No. vale", "Concepto", "Beneficiario / Proveedor", "Importe", "IVA 16%", "Total"])
    f0, f1 = CAJA_F0, CAJA_F1
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
    rs = hoja_resumen(wb, "RESUMEN DE CAJA CHICA", "Uso del fondo fijo y comprobación de gastos")
    kpi(rs, 2, "FONDO FIJO", "=FORMATO!B5")
    kpi(rs, 4, "TOTAL GASTADO", f"=FORMATO!H{f1+1}")
    kpi(rs, 6, "DISPONIBLE", f"=B5-D5")
    kpi(rs, 8, "% DEL FONDO USADO", "=IFERROR(D5/B5,0)", "0%")
    tabla_simple(rs, 25, 2, ["Concepto", "Importe"], [["GASTADO", "=D5"], ["DISPONIBLE", "=MAX(0,F5)"]], {1: MXN})
    pie = PieChart()
    pie.title = "Uso del fondo"
    pie.width, pie.height = 12, 8
    pie.add_data(Reference(rs, min_col=3, min_row=25, max_row=27), titles_from_data=True)
    pie.set_categories(Reference(rs, min_col=2, min_row=26, max_row=27))
    pie.dataLabels = DataLabelList()
    pie.dataLabels.showPercent = True
    pie.dataLabels.showCatName = pie.dataLabels.showSerName = pie.dataLabels.showVal = False
    from openpyxl.chart.series import DataPoint
    for i_, col_ in enumerate((GOLD, PETROL)):
        pt = DataPoint(idx=i_)
        pt.graphicalProperties.solidFill = col_
        pie.series[0].dPt.append(pt)
    rs.add_chart(pie, "B8")
    kpi(rs, 6, "IVA ACUMULADO", f"=FORMATO!G{f1+1}", fila=26)
    kpi(rs, 8, "VALES REGISTRADOS", f"=COUNT(FORMATO!F{f0}:F{f1})", "0", fila=26)
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
        c.font = Font(bold=True, color=PETROL)
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
    rs = hoja_resumen(wb, "RESUMEN DE FLUJO DE EFECTIVO", "Ingresos, egresos y saldo acumulado por mes")
    kpi(rs, 2, "INGRESOS DEL AÑO", f"=FORMATO!N{ti}")
    kpi(rs, 4, "EGRESOS DEL AÑO", f"=FORMATO!N{te}")
    kpi(rs, 6, "FLUJO NETO", f"=FORMATO!N{r}")
    kpi(rs, 8, "SALDO FINAL", f"=FORMATO!M{r+1}")
    cats = Reference(ws, min_col=2, max_col=13, min_row=7)
    g1 = grafica_barras("Ingresos vs. egresos por mes", ancho=23.5, alto=7.5)
    for fila_ in (ti, te):
        g1.add_data(Reference(ws, min_col=1, max_col=13, min_row=fila_), titles_from_data=True, from_rows=True)
    g1.set_categories(cats)
    colorear(g1, (PETROL, GOLD))
    rs.add_chart(g1, "B8")
    g2 = LineChart()
    g2.title = "Saldo acumulado"
    g2.width, g2.height = 23.5, 7.5
    g2.add_data(Reference(ws, min_col=1, max_col=13, min_row=r + 1), titles_from_data=True, from_rows=True)
    g2.set_categories(cats)
    g2.legend = None
    g2.y_axis.numFmt = '"$"#,##0'
    g2.y_axis.majorGridlines = None
    g2.x_axis.delete = False
    g2.y_axis.delete = False
    g2.series[0].graphicalProperties.line.solidFill = COLOR
    g2.series[0].graphicalProperties.line.width = 32000
    g2.series[0].smooth = False
    g2.x_axis.tickLblPos = "low"
    rs.add_chart(g2, "B24")
    instrucciones(wb, "Flujo de efectivo anual", [
        "Captura el saldo inicial del año.",
        "Llena en las celdas de captura los ingresos y egresos esperados (o reales) de cada mes.",
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
    f0, f1 = CXC_F0, CXC_F1
    filas(ws, f0, f1, 11, {4: FECHA, 6: FECHA, 7: MXN, 8: MXN, 9: MXN}, {
        1: lambda r: r - 6,
        6: lambda r: f'=IF(D{r}="","",D{r}+E{r})',
        9: lambda r: f'=IF(G{r}="","",G{r}-H{r})',
        10: lambda r: f'=IF(OR(F{r}="",I{r}=""),"",IF(I{r}<=0,0,MAX(0,$G$4-F{r})))',
        11: lambda r: f'=IF(I{r}="","",IF(I{r}<=0,"PAGADA",IF(J{r}>0,"VENCIDA","VIGENTE")))'})
    total(ws, f1 + 1, 6, {7: f"=SUM(G{f0}:G{f1})", 8: f"=SUM(H{f0}:H{f1})", 9: f"=SUM(I{f0}:I{f1})"})
    r = f1 + 3
    ws.cell(r, 2, "ANTIGÜEDAD DE SALDOS").font = Font(bold=True, color=PETROL)
    rangos = [("Vigente", f'=SUMIFS(I{f0}:I{f1},K{f0}:K{f1},"VIGENTE")'),
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
    rs = hoja_resumen(wb, "RESUMEN DE COBRANZA", "Saldo, vencimientos y antigüedad de saldos")
    kpi(rs, 2, "SALDO POR COBRAR", f"=FORMATO!I{f1+1}")
    kpi(rs, 4, "SALDO VENCIDO", f'=SUMIF(FORMATO!K{f0}:K{f1},"VENCIDA",FORMATO!I{f0}:I{f1})')
    kpi(rs, 6, "% VENCIDO", "=IFERROR(D5/B5,0)", "0.0%")
    kpi(rs, 8, "FACTURAS CON SALDO", f'=COUNTIF(FORMATO!I{f0}:I{f1},">0")', "0")
    g1 = grafica_barras("Antigüedad de saldos", ancho=23.5, alto=8.5)
    g1.add_data(Reference(ws, min_col=3, min_row=r + 1, max_row=r + 5))
    g1.set_categories(Reference(ws, min_col=2, min_row=r + 1, max_row=r + 5))
    g1.legend = None
    colorear(g1, (COLOR,))
    rs.add_chart(g1, "B8")
    instrucciones(wb, "Cuentas por cobrar", [
        "Registra cada factura emitida con fecha, días de crédito e importe.",
        "Cuando recibas un pago, captura el acumulado en la columna Abonos.",
        "El sistema calcula vencimiento, saldo, días vencidos y estatus (Vigente / Vencida / Pagada).",
        "La fecha de corte usa HOY() por defecto; puedes escribir una fecha fija.",
        "Al final verás el resumen de antigüedad de saldos para priorizar tu cobranza."])
    guardar(wb, "1_Contabilidad_y_Finanzas", "04_Cuentas_por_Cobrar")


def conciliacion():
    from openpyxl.formatting.rule import CellIsRule
    wb, ws = libro("CONCILIACIÓN BANCARIA", "Saldo en libros vs. estado de cuenta, con detalle de partidas en tránsito",
                   [6, 70, 22, 22, 6], horizontal=False)
    campo(ws, 4, 1, "Banco", 2)
    campo(ws, 5, 1, "Cuenta", 2)
    campo(ws, 6, 1, "Mes", 2)
    campo(ws, 7, 1, "Fecha de corte", 2, None, FECHA)
    ws.column_dimensions["A"].width = 20

    def linea(r, txt, val=None, negrita=False, formula=False):
        ws.cell(r, 2, txt).font = Font(bold=negrita)
        ws.cell(r, 2).border = BORDE
        c = ws.cell(r, 3, val)
        c.number_format = MXN
        c.border = BORDE
        c.fill = PatternFill("solid", fgColor=CALC if formula else INPUT)
        if negrita:
            c.font = Font(bold=True, color=COLOR)

    P = PARTIDAS_FILAS
    a0, a1 = 5, 4 + P
    ws.cell(9, 2, "SEGÚN ESTADO DE CUENTA").font = Font(bold=True, color=PETROL)
    linea(10, "Saldo final según banco")
    linea(11, "(+) Depósitos en tránsito (hoja PARTIDAS)", f"=SUM(PARTIDAS!D{a0}:D{a1})", formula=True)
    linea(12, "(-) Cheques y pagos en tránsito (hoja PARTIDAS)", f"=SUM(PARTIDAS!J{a0}:J{a1})", formula=True)
    linea(13, "(+/-) Errores del banco")
    linea(14, "SALDO BANCARIO AJUSTADO", "=C10+C11-C12+C13", True, True)
    ws.cell(16, 2, "SEGÚN LIBROS").font = Font(bold=True, color=PETROL)
    linea(17, "Saldo final según libros")
    linea(18, "(+) Abonos del banco no registrados (intereses, depósitos)", f'=SUMIF(PARTIDAS!P{a0}:P{a1},"ABONO",PARTIDAS!Q{a0}:Q{a1})', formula=True)
    linea(19, "(-) Cargos del banco no registrados (comisiones, IVA)", f'=SUMIF(PARTIDAS!P{a0}:P{a1},"CARGO",PARTIDAS!Q{a0}:Q{a1})', formula=True)
    linea(20, "(-) Cheques devueltos")
    linea(21, "(+/-) Errores en libros")
    linea(22, "SALDO EN LIBROS AJUSTADO", "=C17+C18-C19-C20+C21", True, True)
    linea(24, "DIFERENCIA (debe ser 0)", "=ROUND(C14-C22,2)", True, True)
    ws.merge_cells("B25:C25")
    ws.cell(25, 2, '=IF(AND(C10="",C17=""),"",IF(C24=0,"✔ CONCILIADO","✘ REVISAR PARTIDAS PENDIENTES"))').font = Font(bold=True, size=12, color=COLOR)
    ws.cell(25, 2).alignment = Alignment(horizontal="center")
    ws.cell(27, 2, "INDICADORES DE CONTROL").font = Font(bold=True, color=PETROL)
    corte = 'IF($B$7="",TODAY(),$B$7)'
    kp = [("Partidas en tránsito", f'=COUNT(PARTIDAS!D{a0}:D{a1})+COUNT(PARTIDAS!J{a0}:J{a1})', "0"),
          ("Importe total en tránsito", f"=C11+C12", MXN),
          ("Partidas con más de 30 días", f'=COUNTIF(PARTIDAS!E{a0}:E{a1},">30")+COUNTIF(PARTIDAS!K{a0}:K{a1},">30")', "0"),
          ("Partidas con más de 90 días (cancelar o reexpedir)", f'=COUNTIF(PARTIDAS!E{a0}:E{a1},">90")+COUNTIF(PARTIDAS!K{a0}:K{a1},">90")', "0")]
    for i, (t, f, fm) in enumerate(kp):
        ws.cell(28 + i, 2, t).border = BORDE
        c = ws.cell(28 + i, 3, f)
        c.number_format = fm
        c.border = BORDE
        c.fill = PatternFill("solid", fgColor=CALC)
    ws.conditional_formatting.add("C24", CellIsRule(operator="notEqual", formula=["0"], font=Font(bold=True, color="C00000")))
    firmas(ws, 35, ["Elaboró", "Autorizó"], 4)

    # ---------------- hoja PARTIDAS
    pw = wb.create_sheet("PARTIDAS")
    anchos = [6, 13, 40, 16, 10, 3, 6, 13, 40, 16, 10, 3, 6, 13, 40, 12, 16]
    banner(pw, "PARTIDAS DE CONCILIACIÓN", "Depósitos y cheques en tránsito, y movimientos del banco no registrados", anchos)
    pw.sheet_properties.tabColor = PETROL
    for col0, tit in ((1, "DEPÓSITOS EN TRÁNSITO (SUMAN AL BANCO)"), (7, "CHEQUES Y PAGOS EN TRÁNSITO (RESTAN AL BANCO)"),
                      (13, "MOVIMIENTOS DEL BANCO NO REGISTRADOS EN LIBROS")):
        pw.cell(3, col0, tit).font = Font(bold=True, color=PETROL)
    encabezado(pw, 4, ["No.", "Fecha", "Descripción / referencia", "Importe", "Días"], 1)
    encabezado(pw, 4, ["No.", "Fecha", "No. cheque / beneficiario", "Importe", "Días"], 7)
    encabezado(pw, 4, ["No.", "Fecha", "Descripción", "Tipo", "Importe"], 13)
    dias = lambda col: (lambda r: f'=IF({col}{r}="","",MAX(0,{corte.replace("$B$7", "FORMATO!$B$7")}-{col}{r}))')
    filas(pw, a0, a1, 5, {2: FECHA, 4: MXN, 5: "0"}, {1: lambda r: r - 4, 5: dias("B")}, col0=1)
    filas(pw, a0, a1, 5, {2: FECHA, 4: MXN, 5: "0"}, {1: lambda r: r - 4, 5: dias("H")}, col0=7)
    # la fórmula de días de la 2ª tabla debe apuntar a su propia fecha (col H) e importe en col J
    for r in range(a0, a1 + 1):
        pw.cell(r, 11).value = f'=IF(H{r}="","",MAX(0,{corte.replace("$B$7", "FORMATO!$B$7")}-H{r}))'
        pw.cell(r, 7).value = r - 4
        for cc in (7, 11):
            pw.cell(r, cc).fill = PatternFill("solid", fgColor=CALC)
        pw.cell(r, 7).alignment = Alignment(horizontal="center")
        pw.cell(r, 8).number_format = FECHA
        pw.cell(r, 10).number_format = MXN
    filas(pw, a0, a1, 5, {14: FECHA, 17: MXN}, {13: lambda r: r - 4}, col0=13)
    lista(pw, f"P{a0}:P{a1}", ["ABONO", "CARGO"])
    total(pw, a1 + 1, 3, {4: f"=SUM(D{a0}:D{a1})"}, MXN)
    total(pw, a1 + 1, 9, {10: f"=SUM(J{a0}:J{a1})"}, MXN)
    total(pw, a1 + 1, 16, {17: f"=SUM(Q{a0}:Q{a1})"}, MXN)
    for col in ("E", "K"):
        pw.conditional_formatting.add(f"{col}{a0}:{col}{a1}", CellIsRule(operator="greaterThan", formula=["30"], fill=PatternFill("solid", bgColor="FCE4D6")))
        pw.conditional_formatting.add(f"{col}{a0}:{col}{a1}", CellIsRule(operator="greaterThan", formula=["90"], fill=PatternFill("solid", bgColor="F4B084")))
    pw.freeze_panes = "A5"
    instrucciones(wb, "Conciliación bancaria", [
        "Captura banco, cuenta, mes y fecha de corte; después el saldo final del estado de cuenta y el saldo de tus libros.",
        "En la hoja PARTIDAS lista los depósitos y cheques en tránsito (hasta 50 de cada uno) y los movimientos del banco que aún no registras.",
        "Los totales de las partidas alimentan automáticamente la conciliación: no necesitas sumarlas.",
        "Captura manualmente solo los errores del banco o de libros y los cheques devueltos, si los hay.",
        "Cuando la diferencia sea 0 el formato indica CONCILIADO; si no, revisa el detalle de partidas.",
        "Las partidas con más de 30 días se resaltan para que les des seguimiento."])
    guardar(wb, "1_Contabilidad_y_Finanzas", "05_Conciliacion_Bancaria")

# ----------------------------------------------------------------- RECURSOS HUMANOS
def asistencia():
    wb, ws = libro("CONTROL DE ASISTENCIA MENSUAL", "A=Asistencia · F=Falta · R=Retardo · V=Vacaciones · I=Incapacidad · D=Descanso · P=Permiso",
                   [5, 28] + [4.2] * 31 + [7, 7, 7, 7, 7])
    campo(ws, 4, 2, "Empresa", 8)
    campo(ws, 5, 2, "Mes/Año", 8)
    encabezado(ws, 6, ["No.", "Empleado"] + [str(d) for d in range(1, 32)] + ["A", "F", "R", "V", "I"])
    f0, f1 = ASIS_F0, ASIS_F1
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
    for r in range(f0, f1 + 1):
        for c in range(34, 39):
            ws.cell(r, c).number_format = "0;;"
    ws.freeze_panes = "C7"
    rs = hoja_resumen(wb, "RESUMEN DE ASISTENCIA", "Asistencias, faltas y retardos del mes")
    kpi(rs, 2, "ASISTENCIAS", f"=SUM(FORMATO!AH{f0}:AH{f1})", "0")
    kpi(rs, 4, "FALTAS", f"=SUM(FORMATO!AI{f0}:AI{f1})", "0")
    kpi(rs, 6, "RETARDOS", f"=SUM(FORMATO!AJ{f0}:AJ{f1})", "0")
    kpi(rs, 8, "% ASISTENCIA", "=IFERROR(B5/(B5+D5+F5),0)", "0.0%")
    n_emp = 15
    tabla_simple(rs, 25, 2, ["Empleado", "Faltas", "Retardos"],
                 [[f'=IF(FORMATO!B{f0 + i}="","",FORMATO!B{f0 + i})', f"=FORMATO!AI{f0 + i}", f"=FORMATO!AJ{f0 + i}"] for i in range(n_emp)])
    rs.column_dimensions["B"].width = 30
    g1 = grafica_barras("Faltas y retardos por empleado", horizontal=True, ancho=23.5, alto=8.6)
    g1.add_data(Reference(rs, min_col=3, max_col=4, min_row=25, max_row=25 + n_emp), titles_from_data=True)
    g1.set_categories(Reference(rs, min_col=2, min_row=26, max_row=25 + n_emp))
    g1.y_axis.numFmt = "0"
    colorear(g1, (COLOR, GOLD))
    rs.add_chart(g1, "B8")
    instrucciones(wb, "Control de asistencia", [
        "Escribe el mes y los nombres de tus empleados (hasta 50).",
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
    f0, f1 = NOM_F0, NOM_F1
    filas(ws, f0, f1, 11, {3: MXN, 6: MXN, 7: MXN, 8: MXN, 9: MXN, 10: MXN, 11: MXN}, {
        1: lambda r: r - 7,
        6: lambda r: f'=IF(C{r}="","",C{r}*D{r})',
        7: lambda r: f'=IF(C{r}="","",E{r}*(C{r}/8)*2)',
        9: lambda r: f'=IF(C{r}="","",ROUND((F{r}+G{r})*$G$5,2))',
        11: lambda r: f'=IF(C{r}="","",F{r}+G{r}+H{r}-I{r}-J{r})'})
    total(ws, f1 + 1, 5, {c: f"=SUM({L(c)}{f0}:{L(c)}{f1})" for c in range(6, 12)})
    firmas(ws, f1 + 4, ["Elaboró", "Revisó", "Autorizó"], 11)
    rs = hoja_resumen(wb, "RESUMEN DE NÓMINA", "Percepciones, deducciones y neto del periodo")
    kpi(rs, 2, "PERCEPCIONES", f"=FORMATO!F{f1+1}+FORMATO!G{f1+1}+FORMATO!H{f1+1}")
    kpi(rs, 4, "DEDUCCIONES", f"=FORMATO!I{f1+1}+FORMATO!J{f1+1}")
    kpi(rs, 6, "NETO A PAGAR", f"=FORMATO!K{f1+1}")
    kpi(rs, 8, "EMPLEADOS", f"=COUNT(FORMATO!C{f0}:C{f1})", "0")
    n_emp = 15
    tabla_simple(rs, 25, 2, ["Empleado", "Neto a pagar"],
                 [[f'=IF(FORMATO!B{f0 + i}="","",FORMATO!B{f0 + i})', f'=IF(FORMATO!K{f0 + i}="",0,FORMATO!K{f0 + i})'] for i in range(n_emp)], {1: MXN})
    rs.column_dimensions["B"].width = 30
    g1 = grafica_barras("Neto a pagar por empleado", horizontal=True, ancho=23.5, alto=8.6)
    g1.add_data(Reference(rs, min_col=3, min_row=25, max_row=25 + n_emp), titles_from_data=True)
    g1.set_categories(Reference(rs, min_col=2, min_row=26, max_row=25 + n_emp))
    g1.legend = None
    colorear(g1, (PETROL,))
    rs.add_chart(g1, "B8")
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
    t = wb.create_sheet("TABLA LFT")
    t.append(["Años de servicio", "Días de vacaciones"])
    for a, d in [(1, 12), (2, 14), (3, 16), (4, 18), (5, 20), (6, 22), (11, 24), (16, 26), (21, 28), (26, 30), (31, 32)]:
        t.append([a, d])
    for c in t[1]:
        c.font = Font(bold=True)
    t.column_dimensions["A"].width = 18
    t.column_dimensions["B"].width = 20
    f0, f1 = VAC_F0, VAC_F1
    filas(ws, f0, f1, 9, {3: FECHA, 6: "0", 8: MXN, 9: MXN}, {
        1: lambda r: r - 6,
        4: lambda r: f'=IF(C{r}="","",DATEDIF(C{r},$G$4,"Y"))',
        5: lambda r: f"=IF(C{r}=\"\",\"\",IF(D{r}<1,0,LOOKUP(D{r},'TABLA LFT'!$A$2:$A$12,'TABLA LFT'!$B$2:$B$12)))",
        7: lambda r: f'=IF(C{r}="","",E{r}-F{r})',
        8: lambda r: f'=IF(OR(C{r}="",I{r}=""),"",ROUND(I{r}*G{r}*0.25,2))'})
    ws.freeze_panes = "A7"
    rs = hoja_resumen(wb, "RESUMEN DE VACACIONES", "Días pendientes y prima vacacional por pagar")
    kpi(rs, 2, "EMPLEADOS", f"=COUNT(FORMATO!C{f0}:C{f1})", "0")
    kpi(rs, 4, "DÍAS PENDIENTES", f"=SUM(FORMATO!G{f0}:G{f1})", "0")
    kpi(rs, 6, "PRIMA VACACIONAL", f"=SUM(FORMATO!H{f0}:H{f1})")
    kpi(rs, 8, "CON MÁS DE 10 DÍAS", f'=COUNTIF(FORMATO!G{f0}:G{f1},">10")', "0")
    n_emp = 15
    tabla_simple(rs, 25, 2, ["Empleado", "Días pendientes"],
                 [[f'=IF(FORMATO!B{f0 + i}="","",FORMATO!B{f0 + i})', f'=IF(FORMATO!G{f0 + i}="",0,FORMATO!G{f0 + i})'] for i in range(n_emp)], {1: "0"})
    rs.column_dimensions["B"].width = 30
    g1 = grafica_barras("Días de vacaciones pendientes por empleado", horizontal=True, ancho=23.5, alto=8.6)
    g1.add_data(Reference(rs, min_col=3, min_row=25, max_row=25 + n_emp), titles_from_data=True)
    g1.set_categories(Reference(rs, min_col=2, min_row=26, max_row=25 + n_emp))
    g1.legend = None
    g1.y_axis.numFmt = "0"
    colorear(g1, (PETROL,))
    rs.add_chart(g1, "B8")
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
    ws.cell(18, 2, '=IF(COUNT(C9:C16)=0,"",IF(E17>=4.5,"SOBRESALIENTE",IF(E17>=3.5,"SATISFACTORIO",IF(E17>=2.5,"REQUIERE MEJORA","DEFICIENTE"))))').font = Font(bold=True, size=12)
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
    rs = hoja_resumen(wb, "RESUMEN DE LA EVALUACIÓN", "Resultado por criterio y calificación global")
    kpi(rs, 2, "RESULTADO GLOBAL", '=IF(COUNT(FORMATO!C9:C16)=0,0,FORMATO!E17)', "0.00")
    kpi(rs, 4, "CATEGORÍA", "=FORMATO!B18", "@")
    kpi(rs, 6, "MEJOR CRITERIO", '=IFERROR(INDEX(B26:B33,MATCH(MAX(C26:C33),C26:C33,0)),"")', "@")
    kpi(rs, 8, "A MEJORAR", '=IF(COUNT(C26:C33)=0,"",IFERROR(INDEX(B26:B33,MATCH(MIN(C26:C33),C26:C33,0)),""))', "@")
    tabla_simple(rs, 25, 2, ["Criterio", "Calificación"],
                 [[f"=FORMATO!B{9 + i}", f'=IF(FORMATO!C{9 + i}="",0,FORMATO!C{9 + i})'] for i in range(8)], {1: "0"})
    rs.column_dimensions["B"].width = 30
    g1 = grafica_barras("Calificación por criterio (1 a 5)", horizontal=True, ancho=23.5, alto=8.6)
    g1.add_data(Reference(rs, min_col=3, min_row=25, max_row=33), titles_from_data=True)
    g1.set_categories(Reference(rs, min_col=2, min_row=26, max_row=33))
    g1.legend = None
    g1.y_axis.scaling.min, g1.y_axis.scaling.max = 0, 5
    g1.y_axis.numFmt = "0"
    colorear(g1, (PETROL,))
    rs.add_chart(g1, "B8")
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
    f0, f1 = INV_F0, INV_F1
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
    rs = hoja_resumen(wb, "RESUMEN DE INVENTARIO", "Valor, existencias y alertas de reabasto")
    kpi(rs, 2, "VALOR DEL INVENTARIO", f"=FORMATO!K{f1+1}")
    kpi(rs, 4, "PRODUCTOS", f"=COUNTA(FORMATO!B{f0}:B{f1})", "0")
    kpi(rs, 6, "POR REABASTECER", f'=COUNTIF(FORMATO!M{f0}:M{f1},"REABASTECER")', "0")
    kpi(rs, 8, "SIN STOCK", f'=COUNTIF(FORMATO!M{f0}:M{f1},"SIN STOCK")', "0")
    tabla_simple(rs, 25, 2, ["Estatus", "Productos"],
                 [["OK", f'=COUNTIF(FORMATO!M{f0}:M{f1},"OK")'], ["REABASTECER", "=F5"], ["SIN STOCK", "=H5"]])
    pie = PieChart()
    pie.title = "Estatus del inventario"
    pie.width, pie.height = 14, 8
    pie.add_data(Reference(rs, min_col=3, min_row=25, max_row=28), titles_from_data=True)
    pie.set_categories(Reference(rs, min_col=2, min_row=26, max_row=28))
    pie.dataLabels = DataLabelList()
    pie.dataLabels.showPercent = True
    pie.dataLabels.showCatName = False
    pie.dataLabels.showSerName = False
    pie.dataLabels.showVal = False
    pie.dataLabels.showLeaderLines = False
    from openpyxl.chart.series import DataPoint
    for i, col_ in enumerate((PETROL, GOLD, CORAL)):
        pt = DataPoint(idx=i)
        pt.graphicalProperties.solidFill = col_
        pie.series[0].dPt.append(pt)
    rs.add_chart(pie, "B8")
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
        ws[a].font = Font(bold=True, color=PETROL)
        ws[a].alignment = Alignment(horizontal="center")
    encabezado(ws, 8, ["No.", "Fecha", "Documento", "Concepto", "Cant.", "Costo unit.", "Importe",
                       "Cant.", "Costo unit.", "Importe", "Cant.", "Costo prom.", "Importe"])
    f0, f1 = KAR_F0, KAR_F1
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
    rs = hoja_resumen(wb, "RESUMEN DEL KARDEX", "Existencia actual, costo promedio y movimientos")
    ult = lambda col: f'=IFERROR(LOOKUP(2,1/(FORMATO!{col}{f0}:{col}{f1}<>""),FORMATO!{col}{f0}:{col}{f1}),0)'
    kpi(rs, 2, "EXISTENCIA ACTUAL", ult("K"), "#,##0.##")
    kpi(rs, 4, "COSTO PROMEDIO", ult("L"))
    kpi(rs, 6, "VALOR DEL INVENTARIO", ult("M"))
    kpi(rs, 8, "MOVIMIENTOS", f"=COUNT(FORMATO!E{f0}:E{f1})+COUNT(FORMATO!H{f0}:H{f1})", "0")
    tabla_simple(rs, 25, 2, ["Concepto", "Unidades", "Importe"],
                 [["ENTRADAS", f"=SUM(FORMATO!E{f0}:E{f1})", f"=SUM(FORMATO!G{f0}:G{f1})"],
                  ["SALIDAS", f"=SUM(FORMATO!H{f0}:H{f1})", f"=SUM(FORMATO!J{f0}:J{f1})"]], {1: "#,##0.##", 2: MXN})
    g1 = grafica_barras("Entradas vs. salidas (unidades)", ancho=14, alto=8)
    g1.add_data(Reference(rs, min_col=3, min_row=25, max_row=27), titles_from_data=True)
    g1.set_categories(Reference(rs, min_col=2, min_row=26, max_row=27))
    g1.legend = None
    g1.y_axis.numFmt = "#,##0"
    colorear(g1, (COLOR,))
    rs.add_chart(g1, "B8")
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
    for rr in range(r + 6, r + 9):
        for cc in range(1, 8):
            ws.cell(rr, cc).fill = PatternFill("solid", fgColor=INPUT)
            ws.cell(rr, cc).border = BORDE
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
    ws.cell(r + 6, 2, "MEJOR OPCIÓN (menor total)").font = Font(bold=True, color=PETROL)
    cols = [("F", "E"), ("H", "G"), ("J", "I"), ("L", "K")]
    m = "MIN(" + ",".join(f"IF({c}{r+2}=0,1E+99,{c}{r+2})" for c, _ in cols) + ")"
    f = '""'
    for c, n in reversed(cols):
        f = f"IF({c}{r+2}={m},{n}6,{f})"
    ws.cell(r + 6, 5, f"=IF({m}=1E+99,\"\",{f})").font = Font(bold=True)
    ws.cell(r + 7, 2, "Nota: si un proveedor no cotiza todas las partidas, su total no es comparable.").font = Font(italic=True, color="7F7F7F")
    rs = hoja_resumen(wb, "RESUMEN DE COTIZACIONES", "Comparativo de totales por proveedor")
    kpi(rs, 2, "MEJOR OPCIÓN", f"=FORMATO!E{r + 6}", "@")
    kpi(rs, 4, "TOTAL MÁS BAJO", "=IFERROR(MIN(C26:C29),0)")
    kpi(rs, 6, "TOTAL MÁS ALTO", "=IFERROR(MAX(C26:C29),0)")
    kpi(rs, 8, "AHORRO POTENCIAL", "=F5-D5")
    tabla_simple(rs, 25, 2, ["Proveedor", "Total con IVA"],
                 [[f'=IF(FORMATO!{c1}6="","PROVEEDOR {n_}",FORMATO!{c1}6)', f'=IF(FORMATO!{c2}{r + 2}=0,"",FORMATO!{c2}{r + 2})']
                  for n_, c1, c2 in (("A", "E", "F"), ("B", "G", "H"), ("C", "I", "J"), ("D", "K", "L"))], {1: MXN})
    rs.column_dimensions["B"].width = 30
    g1 = grafica_barras("Total por proveedor (con IVA)", ancho=23.5, alto=8.5)
    g1.add_data(Reference(rs, min_col=3, min_row=25, max_row=29), titles_from_data=True)
    g1.set_categories(Reference(rs, min_col=2, min_row=26, max_row=29))
    g1.legend = None
    colorear(g1, (PETROL,))
    rs.add_chart(g1, "B8")
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
    for rr in range(r + 6, r + 10):
        for cc in range(1, 8):
            ws.cell(rr, cc).fill = PatternFill("solid", fgColor=INPUT)
            ws.cell(rr, cc).border = BORDE
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
    ws.cell(7, 1, "ASISTENTES").font = Font(bold=True, color=PETROL)
    encabezado(ws, 8, ["No.", "Nombre", "Puesto / Área", "Firma", ""])
    filas(ws, 9, 16, 4, {}, {1: lambda r: r - 8})
    ws.cell(18, 1, "ORDEN DEL DÍA").font = Font(bold=True, color=PETROL)
    ws.merge_cells("A19:E22")
    ws.cell(24, 1, "DESARROLLO / ACUERDOS").font = Font(bold=True, color=PETROL)
    ws.merge_cells("A25:E30")
    for rng in ("A19:E22", "A25:E30"):
        for row in ws[rng]:
            for c in row:
                c.border = BORDE
                c.fill = PatternFill("solid", fgColor=INPUT)
    ws.cell(32, 1, "COMPROMISOS").font = Font(bold=True, color=PETROL)
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


def presupuesto():
    meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    wb, ws = libro("PRESUPUESTO ANUAL: PRESUPUESTADO VS REAL", "Captura presupuesto y gasto real por mes; la variación se calcula sola",
                   [30] + [12] * 12 + [14, 14, 14, 11])
    campo(ws, 4, 1, "Empresa / Área", 3)
    campo(ws, 4, 6, "Año", 1, 2026)
    encabezado(ws, 7, ["Concepto"] + meses + ["Presup. anual", "Real anual", "Variación", "% ejec."])
    conceptos = ["Ventas", "Costo de ventas", "Sueldos y salarios", "Renta", "Servicios", "Publicidad y mercadotecnia",
                 "Mantenimiento", "Papelería y oficina", "Impuestos y derechos", "Otros gastos"]
    r = 8
    for c in conceptos:
        for tipo in ("Presup.", "Real"):
            ws.cell(r, 1, f"{c} - {tipo}").border = BORDE
            filas(ws, r, r, 12, {k: MXN for k in range(2, 14)}, col0=2)
            r += 1
    for i in range(len(conceptos)):
        a, b = 8 + 2 * i, 9 + 2 * i
        ws.cell(a, 14, f"=SUM(B{a}:M{a})").number_format = MXN
        ws.cell(a, 15, f"=SUM(B{b}:M{b})").number_format = MXN
        ws.cell(a, 16, f"=O{a}-N{a}").number_format = MXN
        ws.cell(a, 17, f'=IF(N{a}=0,"",O{a}/N{a})').number_format = "0%"
        for k in range(14, 18):
            ws.cell(a, k).border = BORDE
            ws.cell(a, k).fill = PatternFill("solid", fgColor=CALC)
        ws.cell(a, 1).font = Font(bold=True)
    from openpyxl.formatting.rule import CellIsRule
    ws.conditional_formatting.add(f"P8:P{r}", CellIsRule(operator="greaterThan", formula=["0"], font=Font(color="C00000", bold=True)))
    ws.freeze_panes = "B8"
    rs = hoja_resumen(wb, "RESUMEN DEL PRESUPUESTO", "Presupuestado vs. real por concepto")
    filas_p = [[c, f"=FORMATO!N{8 + 2 * i}", f"=FORMATO!O{8 + 2 * i}", f"=D{9 + i}-C{9 + i}",
                f'=IF(C{9 + i}=0,"",D{9 + i}/C{9 + i})'] for i, c in enumerate(conceptos)]
    tabla_simple(rs, 8, 2, ["Concepto", "Presupuesto", "Real", "Variación", "% ejec."], filas_p, {1: MXN, 2: MXN, 3: MXN, 4: "0%"})
    rs.column_dimensions["B"].width = 34
    kpi(rs, 2, "VENTAS PRESUPUESTADAS", "=C9")
    kpi(rs, 4, "VENTAS REALES", "=D9")
    kpi(rs, 6, "GASTO PRESUPUESTADO", "=SUM(C10:C18)")
    kpi(rs, 8, "GASTO REAL", "=SUM(D10:D18)")
    g1 = grafica_barras("Presupuesto vs. real por concepto", ancho=23.5, alto=8.5)
    g1.add_data(Reference(rs, min_col=3, max_col=4, min_row=8, max_row=18), titles_from_data=True)
    g1.set_categories(Reference(rs, min_col=2, min_row=9, max_row=18))
    colorear(g1, (COLOR, GOLD))
    rs.add_chart(g1, "B21")
    instrucciones(wb, "Presupuesto anual", [
        "Por cada concepto hay dos renglones: Presup. (lo planeado) y Real (lo ejercido).",
        "Captura mes a mes. La columna Variación muestra Real - Presupuesto del primer renglón de cada concepto.",
        "En gastos, una variación positiva (rojo) significa que te pasaste del presupuesto; en ventas, positiva es favorable.",
        "El % de ejecución indica qué parte del presupuesto anual ya se ejerció."])
    guardar(wb, "1_Contabilidad_y_Finanzas", "06_Presupuesto_Anual")


def activos_fijos():
    wb, ws = libro("CONTROL DE ACTIVOS FIJOS Y DEPRECIACIÓN", "Depreciación en línea recta con tasas máximas de la LISR como referencia",
                   [6, 12, 30, 18, 13, 15, 10, 14, 12, 15, 15, 16])
    campo(ws, 4, 1, "Empresa", 3)
    campo(ws, 4, 6, "Fecha de corte", 2, "=TODAY()", FECHA)
    encabezado(ws, 6, ["No.", "Código", "Descripción", "Categoría", "Fecha adquisición", "Costo (MOI)", "Tasa anual",
                       "Dep. anual", "Años en uso", "Dep. acumulada", "Valor en libros", "Ubicación / Responsable"])
    f0, f1 = ACT_F0, ACT_F1
    filas(ws, f0, f1, 12, {5: FECHA, 6: MXN, 7: "0%", 8: MXN, 9: "0.00", 10: MXN, 11: MXN}, {
        1: lambda r: r - 6,
        7: lambda r: (f'=IF(D{r}="","",IFERROR(VLOOKUP(D{r},TASAS!$A$2:$B$10,2,FALSE),0))'),
        8: lambda r: f'=IF(F{r}="","",F{r}*G{r})',
        9: lambda r: f'=IF(E{r}="","",MAX(0,($G$4-E{r})/365))',
        10: lambda r: f'=IF(F{r}="","",MIN(F{r},H{r}*I{r}))',
        11: lambda r: f'=IF(F{r}="","",F{r}-J{r})'})
    t = wb.create_sheet("TASAS")
    t.append(["Categoría", "Tasa anual (ref.)"])
    for c, v in [("Mobiliario y equipo de oficina", 0.10), ("Equipo de cómputo", 0.30), ("Automóviles", 0.25),
                 ("Maquinaria y equipo", 0.10), ("Equipo de comunicación", 0.10), ("Edificios", 0.05),
                 ("Herramientas", 0.35), ("Otros", 0.10)]:
        t.append([c, v])
    for c in t[1]:
        c.font = Font(bold=True)
    for r_ in range(2, 10):
        t.cell(r_, 2).number_format = "0%"
    t.column_dimensions["A"].width = 34
    t.column_dimensions["B"].width = 18
    lista(ws, f"D{f0}:D{f1}", ["Mobiliario y equipo de oficina", "Equipo de cómputo", "Automóviles", "Maquinaria y equipo",
                               "Equipo de comunicación", "Edificios", "Herramientas", "Otros"])
    total(ws, f1 + 1, 5, {6: f"=SUM(F{f0}:F{f1})", 8: f"=SUM(H{f0}:H{f1})", 10: f"=SUM(J{f0}:J{f1})", 11: f"=SUM(K{f0}:K{f1})"})
    ws.freeze_panes = "A7"
    rs = hoja_resumen(wb, "RESUMEN DE ACTIVOS FIJOS", "Inversión, depreciación y valor en libros por categoría")
    kpi(rs, 2, "INVERSIÓN (MOI)", f"=FORMATO!F{f1+1}")
    kpi(rs, 4, "DEP. ACUMULADA", f"=FORMATO!J{f1+1}")
    kpi(rs, 6, "VALOR EN LIBROS", f"=FORMATO!K{f1+1}")
    kpi(rs, 8, "ACTIVOS", f"=COUNT(FORMATO!F{f0}:F{f1})", "0")
    tabla_simple(rs, 25, 2, ["Categoría", "Costo (MOI)", "Valor en libros"],
                 [[f"=TASAS!A{2 + i}", f"=SUMIF(FORMATO!$D${f0}:$D${f1},B{26 + i},FORMATO!$F${f0}:$F${f1})",
                   f"=SUMIF(FORMATO!$D${f0}:$D${f1},B{26 + i},FORMATO!$K${f0}:$K${f1})"] for i in range(8)], {1: MXN, 2: MXN})
    rs.column_dimensions["B"].width = 34
    g1 = grafica_barras("Costo vs. valor en libros por categoría", ancho=23.5, alto=8.5)
    g1.add_data(Reference(rs, min_col=3, max_col=4, min_row=25, max_row=33), titles_from_data=True)
    g1.set_categories(Reference(rs, min_col=2, min_row=26, max_row=33))
    colorear(g1, (COLOR, GOLD))
    rs.add_chart(g1, "B8")
    instrucciones(wb, "Activos fijos", [
        "Registra cada activo con fecha de adquisición, costo (sin IVA) y categoría.",
        "La tasa se toma de la hoja 'Tasas' (referencia de porcentajes máximos de la LISR); edítala según tu criterio contable.",
        "Depreciación acumulada = depreciación anual x años en uso, sin exceder el costo.",
        "Es una herramienta de control administrativo; consulta a tu contador para efectos fiscales."])
    guardar(wb, "1_Contabilidad_y_Finanzas", "07_Control_de_Activos_Fijos")


def directorio():
    wb, ws = libro("DIRECTORIO DE CLIENTES Y PROVEEDORES", "Base de contactos con datos fiscales y condiciones comerciales",
                   [6, 12, 32, 16, 24, 16, 28, 14, 16, 26])
    campo(ws, 4, 1, "Empresa", 3)
    encabezado(ws, 6, ["No.", "Tipo", "Razón social / Nombre", "RFC", "Contacto", "Teléfono", "Correo",
                       "Días crédito", "Límite crédito", "Dirección / Notas"])
    f0, f1 = DIR_F0, DIR_F1
    filas(ws, f0, f1, 10, {8: "0", 9: MXN}, {1: lambda r: r - 6})
    lista(ws, f"B{f0}:B{f1}", ["CLIENTE", "PROVEEDOR", "AMBOS"])
    ws.auto_filter.ref = f"A6:J{f1}"
    ws.freeze_panes = "D7"
    rs = hoja_resumen(wb, "RESUMEN DEL DIRECTORIO", "Clientes, proveedores y exposición de crédito")
    kpi(rs, 2, "REGISTROS", f"=COUNTA(FORMATO!C{f0}:C{f1})", "0")
    kpi(rs, 4, "CLIENTES", f'=COUNTIF(FORMATO!B{f0}:B{f1},"CLIENTE")+COUNTIF(FORMATO!B{f0}:B{f1},"AMBOS")', "0")
    kpi(rs, 6, "PROVEEDORES", f'=COUNTIF(FORMATO!B{f0}:B{f1},"PROVEEDOR")+COUNTIF(FORMATO!B{f0}:B{f1},"AMBOS")', "0")
    kpi(rs, 8, "CRÉDITO OTORGADO", f"=SUM(FORMATO!I{f0}:I{f1})")
    tabla_simple(rs, 25, 2, ["Tipo", "Registros"], [[t_, f'=COUNTIF(FORMATO!$B${f0}:$B${f1},B{26 + i})'] for i, t_ in enumerate(["CLIENTE", "PROVEEDOR", "AMBOS"])], {1: "0"})
    pie = PieChart()
    pie.title = "Composición del directorio"
    pie.width, pie.height = 12, 8
    pie.add_data(Reference(rs, min_col=3, min_row=25, max_row=28), titles_from_data=True)
    pie.set_categories(Reference(rs, min_col=2, min_row=26, max_row=28))
    pie.dataLabels = DataLabelList()
    pie.dataLabels.showPercent = True
    pie.dataLabels.showCatName = pie.dataLabels.showSerName = pie.dataLabels.showVal = False
    from openpyxl.chart.series import DataPoint
    for i_, col_ in enumerate((PETROL, GOLD, COLOR)):
        pt = DataPoint(idx=i_)
        pt.graphicalProperties.solidFill = col_
        pie.series[0].dPt.append(pt)
    rs.add_chart(pie, "B8")
    instrucciones(wb, "Directorio", [
        "Captura un renglón por cliente o proveedor y elige el tipo en la lista.",
        "Usa los filtros del encabezado para ver solo clientes, proveedores o buscar por nombre.",
        "Protege este archivo: contiene datos personales (Ley Federal de Protección de Datos Personales)."])
    guardar(wb, "1_Contabilidad_y_Finanzas", "08_Directorio_Clientes_y_Proveedores")


# ------------------------------------------------------------ CONTROL OPERATIVO SEMANAL
OP = {"ACT": (5, 204), "PRO": (5, 44), "PEN": (5, 154), "RIE": (5, 64), "DEC": (5, 64), "IND": (5, 24)}


def semaforo_cf(ws, rango):
    from openpyxl.formatting.rule import CellIsRule
    grupos = ((("CUMPLIDO", "EN TIEMPO", "VERDE", "BAJO", "EN META", "APROBADA"), "C6EFCE", "006100"),
              (("POR VENCER", "ÁMBAR", "MEDIO", "EN RIESGO", "APLAZADA"), "FFEB9C", "7F5F00"),
              (("VENCIDO", "ROJO", "ALTO", "FUERA DE META", "BLOQUEADO"), "FFD6D0", "B3261E"))
    for textos, fondo, letra in grupos:
        for t in textos:
            ws.conditional_formatting.add(rango, CellIsRule(operator="equal", formula=[f'"{t}"'],
                                                            fill=PatternFill("solid", bgColor=fondo, fgColor=fondo),
                                                            font=_Font(name=FUENTE, bold=True, color=letra)))


def hoja_tabla(wb, nombre, titulo, subtitulo, encabezados, anchos, desde, hasta, formatos=None, formulas=None, nueva=True):
    ws = wb.create_sheet(nombre) if nueva else wb[nombre]
    if nueva:
        banner(ws, titulo, subtitulo, anchos)
    ws.sheet_properties.tabColor = PETROL
    encabezado(ws, desde - 1, encabezados)
    filas(ws, desde, hasta, len(encabezados), formatos or {}, formulas or {})
    ws.freeze_panes = f"A{desde}"
    ws.auto_filter.ref = f"A{desde - 1}:{L(len(encabezados))}{hasta}"
    return ws


def control_operativo():
    from openpyxl.workbook.defined_name import DefinedName
    from openpyxl.formatting.rule import CellIsRule
    wb, ws0 = libro("ACTIVIDADES DE LA SEMANA", "Registro semanal de actividades con semáforo automático",
                    [6, 13, 56, 32, 22, 12, 14, 14, 15, 10, 10, 15, 34], hoja="ACTIVIDADES")
    refs = catalogo(wb, {"RESPONSABLES": ["ADMINISTRACIÓN", "COMPRAS", "FINANZAS", "RECURSOS HUMANOS", "OPERACIONES", "PROYECTOS", "VENTAS", "DIRECCIÓN"],
                         "ESTATUS": ["PENDIENTE", "EN PROCESO", "TERMINADO", "BLOQUEADO"],
                         "PRIORIDAD": ["ALTA", "MEDIA", "BAJA"],
                         "ESTATUS DE DECISIÓN": ["PENDIENTE", "APROBADA", "RECHAZADA", "APLAZADA"],
                         "ESCALA 1 A 5": ["1", "2", "3", "4", "5"],
                         "SENTIDO DEL INDICADOR": ["MAYOR ES MEJOR", "MENOR ES MEJOR"]})
    corte = "FECHA_CORTE"
    # ------------------------------------------------ ACTIVIDADES
    a0, a1 = OP["ACT"]
    hoja_tabla(wb, "ACTIVIDADES", "", "", ["No.", "Semana (lunes)", "Actividad", "Proyecto / área", "Responsable", "Prioridad", "Fecha compromiso",
                                          "Fecha real", "Estatus", "Avance", "Días de atraso", "Semáforo", "Evidencia / entregable"],
               [6, 13, 56, 32, 22, 12, 14, 14, 15, 10, 10, 15, 34], a0, a1,
               {2: FECHA, 7: FECHA, 8: FECHA, 10: "0%", 11: "0"},
               {1: lambda r: r - a0 + 1,
                11: lambda r: f'=IF(OR(C{r}="",G{r}="",I{r}="TERMINADO"),"",MAX(0,{corte}-G{r}))',
                12: lambda r: (f'=IF(C{r}="","",IF(I{r}="TERMINADO","CUMPLIDO",IF(G{r}="","SIN FECHA",IF(G{r}<{corte},"VENCIDO",'
                               f'IF(G{r}-{corte}<=2,"POR VENCER","EN TIEMPO")))))')}, nueva=False)
    lista(wb["ACTIVIDADES"], f"E{a0}:E{a1}", refs["RESPONSABLES"], aviso=True)
    lista(wb["ACTIVIDADES"], f"F{a0}:F{a1}", refs["PRIORIDAD"])
    lista(wb["ACTIVIDADES"], f"I{a0}:I{a1}", refs["ESTATUS"])
    semaforo_cf(wb["ACTIVIDADES"], f"L{a0}:L{a1}")
    # ------------------------------------------------ PROYECTOS
    p0, p1 = OP["PRO"]
    w = hoja_tabla(wb, "PROYECTOS", "SEGUIMIENTO DE PROYECTOS", "Avance planeado vs. real y presupuesto ejercido",
                   ["No.", "Proyecto", "Cliente / área", "Responsable", "Inicio", "Fin planeado", "Avance planeado", "Avance real",
                    "Presupuesto", "Gasto real", "% presupuesto ejercido", "Desviación de avance", "Semáforo", "Estatus", "Comentarios"],
                   [6, 42, 28, 22, 13, 13, 12, 12, 16, 16, 13, 13, 13, 14, 34], p0, p1,
                   {5: FECHA, 6: FECHA, 7: "0%", 8: "0%", 9: MXN, 10: MXN, 11: "0%", 12: "0%"},
                   {1: lambda r: r - p0 + 1,
                    7: lambda r: f'=IF(OR(E{r}="",F{r}=""),"",MAX(0,MIN(1,({corte}-E{r})/MAX(1,F{r}-E{r}))))',
                    11: lambda r: f'=IF(OR(I{r}="",J{r}="",I{r}=0),"",J{r}/I{r})',
                    12: lambda r: f'=IF(OR(G{r}="",H{r}=""),"",H{r}-G{r})',
                    13: lambda r: (f'=IF(B{r}="","",IF(N{r}="TERMINADO","VERDE",IF(L{r}="","",IF(OR(L{r}<-0.15,AND(K{r}<>"",K{r}>1.05)),"ROJO",'
                                   f'IF(OR(L{r}<-0.05,AND(K{r}<>"",K{r}>1)),"ÁMBAR","VERDE")))))')})
    lista(w, f"D{p0}:D{p1}", refs["RESPONSABLES"], aviso=True)
    lista(w, f"N{p0}:N{p1}", ["EN PROCESO", "PAUSADO", "TERMINADO", "CANCELADO"])
    semaforo_cf(w, f"M{p0}:M{p1}")
    # ------------------------------------------------ PENDIENTES
    e0, e1 = OP["PEN"]
    w = hoja_tabla(wb, "PENDIENTES", "PENDIENTES ABIERTOS", "Lo que no se cierra, se acumula: responsable, fecha y semáforo",
                   ["No.", "Pendiente", "Origen (cliente, junta, dirección)", "Responsable", "Prioridad", "Fecha solicitud", "Fecha compromiso",
                    "Estatus", "Días abiertos", "Semáforo", "Comentarios"],
                   [6, 56, 30, 22, 12, 14, 14, 15, 11, 15, 36], e0, e1, {6: FECHA, 7: FECHA, 9: "0"},
                   {1: lambda r: r - e0 + 1,
                    9: lambda r: f'=IF(OR(B{r}="",F{r}=""),"",MAX(0,{corte}-F{r}))',
                    10: lambda r: (f'=IF(B{r}="","",IF(H{r}="TERMINADO","CUMPLIDO",IF(G{r}="","SIN FECHA",IF(G{r}<{corte},"VENCIDO",'
                                   f'IF(G{r}-{corte}<=2,"POR VENCER","EN TIEMPO")))))')})
    lista(w, f"D{e0}:D{e1}", refs["RESPONSABLES"], aviso=True)
    lista(w, f"E{e0}:E{e1}", refs["PRIORIDAD"])
    lista(w, f"H{e0}:H{e1}", refs["ESTATUS"])
    semaforo_cf(w, f"J{e0}:J{e1}")
    # ------------------------------------------------ RIESGOS
    r0, r1 = OP["RIE"]
    w = hoja_tabla(wb, "RIESGOS", "REGISTRO DE RIESGOS", "Probabilidad x impacto con clasificación automática y matriz de calor",
                   ["No.", "Riesgo", "Proyecto / área", "Probabilidad (1-5)", "Impacto (1-5)", "Nivel (P x I)", "Clasificación", "Responsable",
                    "Acción de mitigación", "Fecha límite", "Estatus"],
                   [6, 54, 28, 12, 12, 10, 14, 22, 62, 14, 16], r0, r1, {10: FECHA, 6: "0"},
                   {1: lambda r: r - r0 + 1,
                    6: lambda r: f'=IF(OR(D{r}="",E{r}=""),"",D{r}*E{r})',
                    7: lambda r: f'=IF(F{r}="","",IF(F{r}>=15,"ALTO",IF(F{r}>=8,"MEDIO","BAJO")))'})
    lista(w, f"D{r0}:E{r1}", refs["ESCALA 1 A 5"])
    lista(w, f"H{r0}:H{r1}", refs["RESPONSABLES"], aviso=True)
    lista(w, f"K{r0}:K{r1}", ["ABIERTO", "EN MITIGACIÓN", "CERRADO", "MATERIALIZADO"])
    semaforo_cf(w, f"G{r0}:G{r1}")
    for k in range(1, 7):
        w.column_dimensions[L(12 + k)].width = 9
    w.column_dimensions["L"].width = 3
    w.cell(3, 13, "MATRIZ DE RIESGOS (CANTIDAD)").font = Font(bold=True, color=PETROL)
    w.cell(4, 13, "PROB. \\ IMPACTO").font = Font(bold=True, size=8, color=COLOR)
    for imp in range(1, 6):
        c = w.cell(4, 13 + imp, imp)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=COLOR)
        c.alignment = Alignment(horizontal="center")
    for k, prob in enumerate(range(5, 0, -1)):
        h = w.cell(5 + k, 13, prob)
        h.font = Font(bold=True, color="FFFFFF")
        h.fill = PatternFill("solid", fgColor=COLOR)
        h.alignment = Alignment(horizontal="center")
        for imp in range(1, 6):
            nivel = prob * imp
            color = "FFD6D0" if nivel >= 15 else ("FFEB9C" if nivel >= 8 else "C6EFCE")
            c = w.cell(5 + k, 13 + imp, f'=COUNTIFS($D${r0}:$D${r1},{prob},$E${r0}:$E${r1},{imp})')
            c.fill = PatternFill("solid", fgColor=color)
            c.border = BORDE
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.font = Font(bold=True, size=12, color=COLOR)
            w.row_dimensions[5 + k].height = 24
    # ------------------------------------------------ DECISIONES
    d0, d1 = OP["DEC"]
    w = hoja_tabla(wb, "DECISIONES", "DECISIONES REQUERIDAS A DIRECCIÓN", "Contexto, opciones y recomendación para decidir rápido",
                   ["No.", "Decisión requerida", "Contexto", "Opciones", "Recomendación", "Quién decide", "Fecha requerida", "Estatus",
                    "Fecha de decisión", "Días de retraso", "Semáforo"],
                   [6, 46, 46, 46, 38, 20, 14, 14, 14, 11, 15], d0, d1, {7: FECHA, 9: FECHA, 10: "0"},
                   {1: lambda r: r - d0 + 1,
                    10: lambda r: f'=IF(OR(B{r}="",G{r}="",H{r}<>"PENDIENTE"),"",MAX(0,{corte}-G{r}))',
                    11: lambda r: (f'=IF(B{r}="","",IF(H{r}<>"PENDIENTE","CUMPLIDO",IF(G{r}="","SIN FECHA",IF(G{r}<{corte},"VENCIDO",'
                                   f'IF(G{r}-{corte}<=2,"POR VENCER","EN TIEMPO")))))')})
    lista(w, f"H{d0}:H{d1}", refs["ESTATUS DE DECISIÓN"])
    semaforo_cf(w, f"K{d0}:K{d1}")
    for r in range(d0, d1 + 1):
        for c in (3, 4, 5):
            w.cell(r, c).alignment = Alignment(wrap_text=True, vertical="top")
    # ------------------------------------------------ INDICADORES
    i0, i1 = OP["IND"]
    semanas = [f"S{k}" for k in range(1, 13)]
    w = hoja_tabla(wb, "INDICADORES", "INDICADORES OPERATIVOS", "Meta, 12 semanas de historia, cumplimiento y semáforo",
                   ["No.", "Indicador", "Unidad", "Sentido", "Meta"] + semanas + ["Último valor", "Cumplimiento", "Semáforo"],
                   [6, 48, 10, 18, 12] + [9] * 12 + [12, 13, 15], i0, i1, {5: "#,##0.##", **{c: "#,##0.##" for c in range(6, 18)}, 18: "#,##0.##", 19: "0%"},
                   {1: lambda r: r - i0 + 1,
                    18: lambda r: f'=IFERROR(LOOKUP(2,1/(F{r}:Q{r}<>""),F{r}:Q{r}),"")',
                    19: lambda r: (f'=IF(OR(E{r}="",R{r}=""),"",IF(D{r}="MENOR ES MEJOR",IF(R{r}=0,1,E{r}/R{r}),IF(E{r}=0,"",R{r}/E{r})))'),
                    20: lambda r: f'=IF(S{r}="","",IF(S{r}>=1,"EN META",IF(S{r}>=0.9,"EN RIESGO","FUERA DE META")))'})
    lista(w, f"D{i0}:D{i1}", refs["SENTIDO DEL INDICADOR"])
    semaforo_cf(w, f"T{i0}:T{i1}")
    # ------------------------------------------------ TABLERO
    t = hoja_resumen(wb, "TABLERO EJECUTIVO SEMANAL", "Lectura rápida para dirección: avances, pendientes, riesgos y decisiones", nombre="TABLERO")
    A = lambda col: f"ACTIVIDADES!${col}${a0}:${col}${a1}"
    P = lambda col: f"PROYECTOS!${col}${p0}:${col}${p1}"
    E = lambda col: f"PENDIENTES!${col}${e0}:${col}${e1}"
    R = lambda col: f"RIESGOS!${col}${r0}:${col}${r1}"
    D = lambda col: f"DECISIONES!${col}${d0}:${col}${d1}"
    kpi(t, 2, "ACTIVIDADES CUMPLIDAS", f'=IFERROR(COUNTIF({A("I")},"TERMINADO")/COUNTA({A("C")}),0)', "0%")
    kpi(t, 4, "ACTIVIDADES VENCIDAS", f'=COUNTIF({A("L")},"VENCIDO")', "0")
    kpi(t, 6, "PENDIENTES ABIERTOS", f'=COUNTIFS({E("H")},"<>TERMINADO",{E("B")},"<>")', "0")
    kpi(t, 8, "RIESGOS ALTOS", f'=COUNTIF({R("G")},"ALTO")', "0")
    kpi(t, 2, "DECISIONES PENDIENTES", f'=COUNTIFS({D("H")},"PENDIENTE",{D("B")},"<>")', "0", fila=7)
    kpi(t, 4, "PROYECTOS EN ROJO", f'=COUNTIF({P("M")},"ROJO")', "0", fila=7)
    kpi(t, 6, "SEMÁFORO GENERAL",
        '=IF(OR(D5>5,H5>2,D8>0),"ROJO",IF(OR(D5>0,H5>0,B8>0,F5>5),"ÁMBAR","VERDE"))', "@", fila=7)
    kpi(t, 8, "FECHA DE CORTE", "=TODAY()", FECHA, fila=7)
    for c_ in (8, 9):
        t.cell(8, c_).fill = PatternFill("solid", fgColor=INPUT)
    wb.defined_names["FECHA_CORTE"] = DefinedName("FECHA_CORTE", attr_text="TABLERO!$H$8")
    semaforo_cf(t, "F8")
    t.merge_cells("B10:I10")
    t["B10"] = ('="SEMANA AL "&TEXT(H8,"DD/MM/YYYY")&": "&TEXT(B5,"0%")&" DE LAS ACTIVIDADES CUMPLIDAS, "&D5&" VENCIDAS, "&F5&" PENDIENTES ABIERTOS, "'
                '&H5&" RIESGOS ALTOS, "&B8&" DECISIONES POR TOMAR Y "&D8&" PROYECTOS EN ROJO. SEMÁFORO GENERAL: "&F8&"."')
    t["B10"].alignment = Alignment(wrap_text=True, vertical="center")
    t["B10"].font = Font(size=10, italic=True, color=COLOR)
    t.row_dimensions[10].height = 34
    t0 = 46
    tabla_simple(t, t0, 2, ["Estatus de actividades", "Actividades"], [[x, f'=COUNTIF({A("I")},B{t0 + 1 + i})'] for i, x in
                                                                        enumerate(["PENDIENTE", "EN PROCESO", "TERMINADO", "BLOQUEADO"])], {1: "0"})
    tabla_simple(t, t0, 5, ["Clasificación de riesgos", "Riesgos"], [[x, f'=COUNTIF({R("G")},E{t0 + 1 + i})'] for i, x in
                                                                     enumerate(["ALTO", "MEDIO", "BAJO"])], {1: "0"})
    n_resp = 8
    tabla_simple(t, t0 + 7, 2, ["Responsable", "Asignadas", "Terminadas"],
                 [[f"=IF('CATÁLOGOS'!B{5 + i}=\"\",\"\",'CATÁLOGOS'!B{5 + i})", f'=IF(B{t0 + 8 + i}="",0,COUNTIF({A("E")},B{t0 + 8 + i}))',
                   f'=IF(B{t0 + 8 + i}="",0,COUNTIFS({A("E")},B{t0 + 8 + i},{A("I")},"TERMINADO"))'] for i in range(n_resp)], {1: "0", 2: "0"})
    tabla_simple(t, t0 + 7, 6, ["Proyecto", "Avance planeado", "Avance real"],
                 [[f'=IF(PROYECTOS!B{p0 + i}="","",LEFT(PROYECTOS!B{p0 + i},26))', f'=IF(PROYECTOS!G{p0 + i}="",0,PROYECTOS!G{p0 + i})',
                   f'=IF(PROYECTOS!H{p0 + i}="",0,PROYECTOS!H{p0 + i})'] for i in range(n_resp)], {1: "0%", 2: "0%"})
    t.column_dimensions["F"].width = 28
    pie = PieChart()
    pie.title = "Actividades por estatus"
    pie.width, pie.height = 11.5, 7.5
    pie.add_data(Reference(t, min_col=3, min_row=t0, max_row=t0 + 4), titles_from_data=True)
    pie.set_categories(Reference(t, min_col=2, min_row=t0 + 1, max_row=t0 + 4))
    pie.dataLabels = DataLabelList()
    pie.dataLabels.showPercent = True
    pie.dataLabels.showCatName = pie.dataLabels.showSerName = pie.dataLabels.showVal = False
    from openpyxl.chart.series import DataPoint
    for i_, col_ in enumerate(("8A97A3", PETROL, "63BE7B", CORAL)):
        pt = DataPoint(idx=i_)
        pt.graphicalProperties.solidFill = col_
        pie.series[0].dPt.append(pt)
    t.add_chart(pie, "B12")
    g2 = grafica_barras("Riesgos por clasificación", ancho=11.5, alto=7.5)
    g2.add_data(Reference(t, min_col=6, min_row=t0, max_row=t0 + 3), titles_from_data=True)
    g2.set_categories(Reference(t, min_col=5, min_row=t0 + 1, max_row=t0 + 3))
    g2.legend = None
    g2.y_axis.numFmt = "0"
    g2.series[0].graphicalProperties.solidFill = COLOR
    t.add_chart(g2, "F12")
    g3 = grafica_barras("Actividades por responsable", horizontal=True, ancho=11.5, alto=8.5)
    g3.add_data(Reference(t, min_col=3, max_col=4, min_row=t0 + 7, max_row=t0 + 7 + n_resp), titles_from_data=True)
    g3.set_categories(Reference(t, min_col=2, min_row=t0 + 8, max_row=t0 + 7 + n_resp))
    g3.y_axis.numFmt = "0"
    colorear(g3, (COLOR, PETROL))
    t.add_chart(g3, "B28")
    g4 = grafica_barras("Proyectos: avance planeado vs. real", horizontal=True, ancho=11.5, alto=8.5)
    g4.add_data(Reference(t, min_col=7, max_col=8, min_row=t0 + 7, max_row=t0 + 7 + n_resp), titles_from_data=True)
    g4.set_categories(Reference(t, min_col=6, min_row=t0 + 8, max_row=t0 + 7 + n_resp))
    g4.y_axis.numFmt = "0%"
    g4.y_axis.scaling.min, g4.y_axis.scaling.max = 0, 1
    colorear(g4, (GOLD, COLOR))
    t.add_chart(g4, "F28")
    wb.move_sheet("TABLERO", offset=-(len(wb.sheetnames) - 1))
    wb.move_sheet("CATÁLOGOS", offset=len(wb.sheetnames))
    instrucciones(wb, "Control operativo semanal", [
        "Define tus responsables, estatus y prioridades en la hoja CATÁLOGOS (todo el libro usa esas listas).",
        "Captura cada semana tus ACTIVIDADES, PROYECTOS, PENDIENTES, RIESGOS, DECISIONES e INDICADORES; los semáforos se calculan solos.",
        "La FECHA DE CORTE del TABLERO se actualiza con HOY; puedes escribir una fecha fija para cerrar una semana.",
        "Lee el TABLERO: semáforo general, indicadores clave y gráficas. El texto de la celda B10 sirve de resumen para tu reporte semanal.",
        "Envía a dirección el reporte semanal (formato Word incluido en el paquete) con los pendientes, riesgos y decisiones en rojo o ámbar."])
    guardar(wb, "7_Control_Directivo", "01_Control_Operativo_Semanal")


if __name__ == "__main__":
    for f in (ingresos_gastos, caja_chica, flujo_efectivo, cuentas_por_cobrar, conciliacion,
              asistencia, nomina, vacaciones, evaluacion, solicitud_permiso,
              inventario, kardex, orden_compra, cotizacion_comparativa,
              cotizacion, recibo, minuta, presupuesto, activos_fijos, directorio, control_operativo):
        f()
