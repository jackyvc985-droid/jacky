#!/usr/bin/env python3
"""Genera formatos administrativos en Word (México) en ./plantillas/5_Documentos_Word/.
Los campos a llenar van entre [CORCHETES] y resaltados en amarillo."""
import os, re
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_COLOR_INDEX
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plantillas", "5_Documentos_Word")
AZUL = RGBColor(0x0B, 0x2A, 0x4A)    # azul marino
PETROL = RGBColor(0x0E, 0x7C, 0x8B)  # azul turquesa
GRIS = RGBColor(0x5B, 0x6B, 0x78)
ORO = "C9A227"
AVISO = ("Formato de uso general con fines administrativos y orientativos. No constituye asesoría legal; "
         "se recomienda que un abogado lo revise y adapte a su caso antes de firmarlo.")


def nuevo():
    d = Document()
    s = d.sections[0]
    s.page_width, s.page_height = Cm(21.59), Cm(27.94)
    s.left_margin = s.right_margin = Cm(2.5)
    s.top_margin = s.bottom_margin = Cm(2.3)
    st = d.styles["Normal"]
    st.font.name = "Arial"
    st.font.size = Pt(10)
    st.element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
    st.font.color.rgb = RGBColor(0x2B, 0x2B, 0x2B)
    st.paragraph_format.space_after = Pt(8)
    st.paragraph_format.line_spacing = 1.15
    pf = d.styles["Footer"].font
    pf.size = Pt(8)
    pf.color.rgb = GRIS
    pie(s)
    return d


def _campo(run, instr):
    for tipo, txt in (("begin", None), (None, instr), ("end", None)):
        if tipo:
            f = OxmlElement("w:fldChar")
            f.set(qn("w:fldCharType"), tipo)
        else:
            f = OxmlElement("w:instrText")
            f.set(qn("xml:space"), "preserve")
            f.text = txt
        run._r.append(f)


def pie(sec):
    p = sec.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for txt, campo_ in (("Página ", None), (None, "PAGE"), (" de ", None), (None, "NUMPAGES")):
        r = p.add_run(txt or "")
        r.font.size = Pt(8)
        r.font.color.rgb = GRIS
        if campo_:
            _campo(r, campo_)


def borde_parrafo(p, lado="bottom", color=ORO, sz=12, espacio=4):
    pPr = p._p.get_or_add_pPr()
    b = OxmlElement("w:pBdr")
    e = OxmlElement(f"w:{lado}")
    e.set(qn("w:val"), "single")
    e.set(qn("w:sz"), str(sz))
    e.set(qn("w:space"), str(espacio))
    e.set(qn("w:color"), color)
    b.append(e)
    pPr.append(b)


def bordes_celda(c, **lados):
    """lados: top/bottom/left/right = (val, color) o None para sin borde."""
    tcPr = c._tc.get_or_add_tcPr()
    b = OxmlElement("w:tcBorders")
    for lado in ("top", "left", "bottom", "right"):
        e = OxmlElement(f"w:{lado}")
        v = lados.get(lado)
        e.set(qn("w:val"), v[0] if v else "nil")
        if v:
            e.set(qn("w:sz"), "6")
            e.set(qn("w:color"), v[1])
        b.append(e)
    tcPr.append(b)


def runs(p, texto, bold=False):
    """Agrega texto; lo que va entre [ ] se resalta en amarillo."""
    for parte in re.split(r"(\[[^\]]+\])", texto):
        if not parte:
            continue
        r = p.add_run(parte)
        r.bold = bold
        if parte.startswith("[") and parte.endswith("]"):
            r.font.highlight_color = WD_COLOR_INDEX.YELLOW
    return p


def encabezado_empresa(d):
    """Recuadro para logo + datos de la empresa de quien compra la plantilla."""
    t = d.add_table(rows=1, cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    a, b = t.cell(0, 0), t.cell(0, 1)
    a.width, b.width = Cm(4.5), Cm(12)
    a.text, b.text = "", ""
    tr = t.rows[0]._tr
    trPr = tr.get_or_add_trPr()
    h = OxmlElement("w:trHeight")
    h.set(qn("w:val"), "1300")
    trPr.append(h)
    d_ = ("dashed", "A6B3BF")
    bordes_celda(a, top=d_, bottom=d_, left=d_, right=d_)
    bordes_celda(b, bottom=("single", "C9D3DB"))
    pa = a.paragraphs[0]
    pa.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = pa.add_run("\nINSERTE SU LOGO\n(Insertar > Imágenes)")
    r.font.size = Pt(8)
    r.font.color.rgb = RGBColor(0xA6, 0xB3, 0xBF)
    pb = b.paragraphs[0]
    pb.paragraph_format.left_indent = Cm(0.4)
    runs(pb, "[NOMBRE DE SU EMPRESA]")
    pb.runs[0].bold = True
    pb.runs[0].font.size = Pt(13)
    q = b.add_paragraph()
    q.paragraph_format.left_indent = Cm(0.4)
    runs(q, "RFC: [RFC]  ·  Tel.: [TELÉFONO]\n[DIRECCIÓN]  ·  [CORREO / SITIO WEB]")
    for x in q.runs:
        x.font.size = Pt(9)
        x.font.color.rgb = GRIS
    d.add_paragraph()


def _sombra(celda, hex_):
    sh = OxmlElement("w:shd")
    sh.set(qn("w:val"), "clear")
    sh.set(qn("w:fill"), hex_)
    celda._tc.get_or_add_tcPr().append(sh)


def _margenes(celda, arriba=140, abajo=140, izq=260, der=260):
    tcPr = celda._tc.get_or_add_tcPr()
    m = OxmlElement("w:tcMar")
    for lado, v in (("top", arriba), ("left", izq), ("bottom", abajo), ("right", der)):
        e = OxmlElement(f"w:{lado}")
        e.set(qn("w:w"), str(v))
        e.set(qn("w:type"), "dxa")
        m.append(e)
    tcPr.append(m)


def titulo(d, t, sub=None):
    """Banner azul marino con el título (blanco), subtítulo y línea dorada; encabezado de página con el nombre del documento."""
    encabezado_empresa(d)
    tb = d.add_table(rows=1, cols=1)
    tb.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = tb.cell(0, 0)
    c.width = Cm(16.5)
    _sombra(c, "0B2A4A")
    _margenes(c)
    tcPr = c._tc.get_or_add_tcPr()
    b = OxmlElement("w:tcBorders")
    for lado in ("top", "left", "right"):
        e = OxmlElement(f"w:{lado}")
        e.set(qn("w:val"), "nil")
        b.append(e)
    e = OxmlElement("w:bottom")
    e.set(qn("w:val"), "single")
    e.set(qn("w:sz"), "30")
    e.set(qn("w:color"), ORO)
    b.append(e)
    tcPr.append(b)
    p = c.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(t.upper())
    r.bold = True
    r.font.size = Pt(20)
    r.font.color.rgb = RGBColor(255, 255, 255)
    if sub:
        q = c.add_paragraph()
        q.paragraph_format.space_after = Pt(0)
        r2 = q.add_run(sub)
        r2.font.size = Pt(10.5)
        r2.font.color.rgb = RGBColor(0xE6, 0xD9, 0xA6)
    d.add_paragraph().paragraph_format.space_after = Pt(2)
    h = d.sections[0].header.paragraphs[0]
    h.text = ""
    rr = h.add_run(t.upper())
    rr.font.size = Pt(7.5)
    rr.font.color.rgb = GRIS
    borde_parrafo(h, color="C9D3DB", sz=6, espacio=2)


def nota(d, rotulo, texto, color="0E7C8B", fondo="F1F8F9"):
    """Aviso destacado: barra de color a la izquierda, fondo suave, rótulo en mayúsculas."""
    t = d.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = t.cell(0, 0)
    c.width = Cm(16.5)
    _sombra(c, fondo)
    _margenes(c, 110, 110, 220, 200)
    tcPr = c._tc.get_or_add_tcPr()
    b = OxmlElement("w:tcBorders")
    for lado in ("top", "right", "bottom"):
        e = OxmlElement(f"w:{lado}")
        e.set(qn("w:val"), "nil")
        b.append(e)
    e = OxmlElement("w:left")
    e.set(qn("w:val"), "single")
    e.set(qn("w:sz"), "36")
    e.set(qn("w:color"), color)
    b.append(e)
    tcPr.append(b)
    p = c.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(rotulo.upper())
    r.bold = True
    r.font.size = Pt(8)
    r.font.color.rgb = RGBColor.from_string(color)
    q = c.add_paragraph()
    q.paragraph_format.space_after = Pt(0)
    runs(q, texto)
    for x in q.runs:
        x.font.size = Pt(10)
    d.add_paragraph().paragraph_format.space_after = Pt(0)


def par(d, t, bold=False, align=None, indent=False):
    p = d.add_paragraph()
    p.alignment = align if align is not None else WD_ALIGN_PARAGRAPH.JUSTIFY
    if indent:
        p.paragraph_format.left_indent = Cm(0.8)
    runs(p, t, bold)
    if bold and t.isupper() or (bold and t[:2].rstrip(".").isdigit()):
        p.paragraph_format.space_before = Pt(8)
        for r in p.runs:
            r.font.color.rgb = PETROL
    return p


def clausula(d, nombre, texto):
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r = p.add_run(nombre.upper() + ". ")
    r.bold = True
    r.font.color.rgb = AZUL
    runs(p, texto)


def derecha(d, t):
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    runs(p, t)


def firmas(d, etiquetas):
    d.add_paragraph()
    d.add_paragraph()
    t = d.add_table(rows=2, cols=len(etiquetas))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, e in enumerate(etiquetas):
        a, b = t.cell(0, i), t.cell(1, i)
        a.text = "________________________"
        b.text = e
        for c in (a, b):
            c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        b.paragraphs[0].runs[0].bold = True


def tabla(d, encabezados, filas_vacias=5, anchos=None):
    t = d.add_table(rows=1 + filas_vacias, cols=len(encabezados))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(encabezados):
        c = t.cell(0, i)
        c.text = ""
        r = c.paragraphs[0].add_run(h)
        r.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)
        c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        tcPr = c._tc.get_or_add_tcPr()
        sh = OxmlElement("w:shd")
        sh.set(qn("w:val"), "clear")
        sh.set(qn("w:fill"), "0B2A4A")
        tcPr.append(sh)
    for i_, row_ in enumerate(t.rows):
        trPr = row_._tr.get_or_add_trPr()
        cs = OxmlElement("w:cantSplit")
        trPr.append(cs)
        if i_ == 0:
            th = OxmlElement("w:tblHeader")
            trPr.append(th)
    for i_ in range(2, len(t.rows), 2):
        for c_ in t.rows[i_].cells:
            _sombra(c_, "F4F6F8")
    # bordes suaves
    tblPr = t._tbl.tblPr
    bs = OxmlElement("w:tblBorders")
    for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{lado}")
        e.set(qn("w:val"), "single")
        e.set(qn("w:sz"), "4")
        e.set(qn("w:color"), "C9D3DB")
        bs.append(e)
    tblPr.append(bs)
    if anchos:
        t.autofit = False
        for i, w in enumerate(anchos):
            t.columns[i].width = Cm(w)
        for row in t.rows:
            for i, w in enumerate(anchos):
                row.cells[i].width = Cm(w)
    return t


def aviso(d):
    p = d.add_paragraph()
    r = p.add_run(AVISO)
    r.italic = True
    r.font.size = Pt(8)
    r.font.color.rgb = RGBColor(0x7F, 0x7F, 0x7F)


def guardar(d, nombre, carpeta="5_Documentos_Word"):
    destino = OUT.replace("5_Documentos_Word", carpeta)
    os.makedirs(destino, exist_ok=True)
    d.save(os.path.join(destino, nombre + ".docx"))
    print("OK", nombre)


def contrato_servicios():
    d = nuevo()
    titulo(d, "Contrato de prestación de servicios profesionales")
    par(d, "Contrato de prestación de servicios que celebran, por una parte, [NOMBRE O RAZÓN SOCIAL DEL CLIENTE], con RFC [RFC], "
           "representada por [REPRESENTANTE], con domicilio en [DOMICILIO] (en adelante, “EL CLIENTE”); y por la otra, "
           "[NOMBRE DEL PRESTADOR], con RFC [RFC], con domicilio en [DOMICILIO] (en adelante, “EL PRESTADOR”), "
           "al tenor de las siguientes declaraciones y cláusulas:")
    par(d, "DECLARACIONES", True, WD_ALIGN_PARAGRAPH.CENTER)
    par(d, "I. EL CLIENTE declara que es una persona legalmente constituida/capaz para contratar y que requiere los servicios descritos en este contrato.")
    par(d, "II. EL PRESTADOR declara que cuenta con los conocimientos, experiencia y capacidad para prestar los servicios y que actúa de forma independiente.")
    par(d, "CLÁUSULAS", True, WD_ALIGN_PARAGRAPH.CENTER)
    clausula(d, "PRIMERA. Objeto", "EL PRESTADOR se obliga a prestar a EL CLIENTE los siguientes servicios: [DESCRIPCIÓN DETALLADA DE LOS SERVICIOS Y ENTREGABLES].")
    clausula(d, "SEGUNDA. Vigencia", "El contrato iniciará el [FECHA DE INICIO] y concluirá el [FECHA DE TÉRMINO], salvo terminación anticipada conforme a este contrato.")
    clausula(d, "TERCERA. Honorarios", "EL CLIENTE pagará a EL PRESTADOR la cantidad de $[MONTO] ([MONTO CON LETRA] pesos 00/100 M.N.) más el Impuesto al Valor Agregado, "
                                      "pagaderos de la siguiente forma: [FORMA Y FECHAS DE PAGO], contra entrega del CFDI correspondiente.")
    clausula(d, "CUARTA. Obligaciones del prestador", "Prestar los servicios con diligencia y profesionalismo, entregar los resultados en los plazos pactados y guardar confidencialidad sobre la información recibida.")
    clausula(d, "QUINTA. Obligaciones del cliente", "Proporcionar la información y accesos necesarios, y pagar los honorarios en tiempo y forma.")
    clausula(d, "SEXTA. Relación de las partes", "Este contrato es de naturaleza civil/mercantil. No existe relación laboral entre las partes ni entre EL CLIENTE y el personal que EL PRESTADOR utilice, quien será su único responsable.")
    clausula(d, "SÉPTIMA. Confidencialidad", "Las partes se obligan a no divulgar la información confidencial a la que tengan acceso, durante la vigencia del contrato y [NÚMERO] años posteriores.")
    clausula(d, "OCTAVA. Propiedad intelectual", "Los entregables serán propiedad de [EL CLIENTE / EL PRESTADOR] una vez cubierto el pago total de los honorarios.")
    clausula(d, "NOVENA. Terminación", "Cualquiera de las partes podrá dar por terminado el contrato con [NÚMERO] días de aviso por escrito. EL CLIENTE pagará los servicios efectivamente prestados hasta esa fecha.")
    clausula(d, "DÉCIMA. Pena convencional", "En caso de incumplimiento, la parte infractora pagará una pena equivalente al [PORCENTAJE]% del monto total del contrato.")
    clausula(d, "DÉCIMA PRIMERA. Jurisdicción", "Para la interpretación y cumplimiento de este contrato, las partes se someten a los tribunales competentes de [CIUDAD, ESTADO], renunciando a cualquier otro fuero que por sus domicilios presentes o futuros les corresponda.")
    par(d, "Leído que fue el contrato y enteradas las partes de su contenido y alcance, lo firman en [CIUDAD], a [DÍA] de [MES] de [AÑO].")
    firmas(d, ["EL CLIENTE", "EL PRESTADOR"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "01_Contrato_de_Prestacion_de_Servicios")


def carta_renuncia():
    d = nuevo()
    titulo(d, "Carta de renuncia voluntaria")
    derecha(d, "[CIUDAD], a [DÍA] de [MES] de [AÑO]")
    par(d, "[NOMBRE DE LA EMPRESA]\nAtención: [NOMBRE DEL JEFE / RECURSOS HUMANOS]\nPresente", align=WD_ALIGN_PARAGRAPH.LEFT)
    par(d, "Por medio de la presente, yo, [NOMBRE COMPLETO DEL TRABAJADOR], con puesto de [PUESTO] en el área de [ÁREA], "
           "manifiesto mi decisión de renunciar de manera voluntaria e irrevocable al empleo que vengo desempeñando, "
           "con efectos a partir del día [FECHA DE SEPARACIÓN].")
    par(d, "Agradezco la oportunidad de formar parte de la empresa y me comprometo a entregar mis pendientes, equipo y documentación "
           "antes de la fecha indicada.")
    par(d, "Solicito que se me elabore el finiquito correspondiente, que incluya las prestaciones proporcionales a que tenga derecho "
           "conforme a la Ley Federal del Trabajo (salarios devengados, aguinaldo y vacaciones proporcionales, prima vacacional y demás aplicables).")
    par(d, "Asimismo, manifiesto que durante la relación laboral no se me adeuda cantidad alguna por salarios, tiempo extraordinario "
           "u otro concepto, salvo lo que resulte del finiquito.")
    par(d, "Atentamente,", align=WD_ALIGN_PARAGRAPH.LEFT)
    firmas(d, ["[NOMBRE Y FIRMA DEL TRABAJADOR]", "Recibido por la empresa"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "02_Carta_de_Renuncia_Voluntaria")


def constancia_laboral():
    d = nuevo()
    titulo(d, "Constancia laboral")
    derecha(d, "[CIUDAD], a [DÍA] de [MES] de [AÑO]")
    par(d, "A QUIEN CORRESPONDA:", True, WD_ALIGN_PARAGRAPH.LEFT)
    par(d, "Por medio de la presente, [NOMBRE DE LA EMPRESA], con RFC [RFC], hace constar que [NOMBRE COMPLETO DEL TRABAJADOR] "
           "labora/laboró en esta empresa desde el [FECHA DE INGRESO] [hasta el [FECHA DE BAJA]], desempeñando el puesto de [PUESTO] "
           "en el área de [ÁREA].")
    par(d, "Durante ese tiempo percibe/percibió un sueldo mensual de $[MONTO] ([MONTO CON LETRA] pesos 00/100 M.N.), "
           "con número de seguro social [NSS] y CURP [CURP].")
    par(d, "Se extiende la presente a petición del interesado para los fines que a este convengan.")
    par(d, "Atentamente,", align=WD_ALIGN_PARAGRAPH.LEFT)
    firmas(d, ["[NOMBRE Y PUESTO]\nRecursos Humanos"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "03_Constancia_Laboral")


def carta_cobranza():
    d = nuevo()
    titulo(d, "Carta de cobranza", "Recordatorio de pago")
    derecha(d, "[CIUDAD], a [DÍA] de [MES] de [AÑO]")
    par(d, "[NOMBRE DEL CLIENTE]\nAtención: [CONTACTO]\nPresente", align=WD_ALIGN_PARAGRAPH.LEFT)
    par(d, "Asunto: Saldo pendiente de pago", True, WD_ALIGN_PARAGRAPH.LEFT)
    par(d, "Estimado(a) [NOMBRE]:")
    par(d, "Por este medio le saludamos cordialmente y le recordamos que, a la fecha, nuestros registros muestran un saldo pendiente "
           "a su cargo, de acuerdo con el siguiente detalle:")
    t = tabla(d, ["Folio factura", "Fecha emisión", "Fecha vencimiento", "Importe", "Saldo"], 4)
    d.add_paragraph()
    par(d, "Total adeudado: $[MONTO] ([MONTO CON LETRA] pesos 00/100 M.N.)", True)
    par(d, "Le solicitamos realizar el pago a más tardar el [FECHA LÍMITE], mediante transferencia a la cuenta [BANCO / CLABE] "
           "a nombre de [TITULAR], indicando como referencia el folio de la factura.")
    par(d, "Si ya efectuó el pago, le agradeceremos enviarnos su comprobante para aplicarlo; si requiere aclaración, puede "
           "comunicarse con nosotros al [TELÉFONO] o [CORREO].")
    par(d, "Agradecemos su atención y quedamos a sus órdenes.")
    par(d, "Atentamente,", align=WD_ALIGN_PARAGRAPH.LEFT)
    firmas(d, ["[NOMBRE Y PUESTO]\n[EMPRESA]"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "04_Carta_de_Cobranza")


def acta_entrega():
    d = nuevo()
    titulo(d, "Acta de entrega-recepción")
    par(d, "En [CIUDAD], siendo las [HORA] horas del día [DÍA] de [MES] de [AÑO], en las instalaciones de [LUGAR], se reunieron "
           "[NOMBRE QUIEN ENTREGA], con cargo de [CARGO] (quien entrega) y [NOMBRE QUIEN RECIBE], con cargo de [CARGO] (quien recibe), "
           "con el fin de formalizar la entrega-recepción de [ÁREA / PUESTO / BIENES / PROYECTO].")
    par(d, "1. RELACIÓN DE BIENES, EQUIPO Y DOCUMENTOS", True, WD_ALIGN_PARAGRAPH.LEFT)
    tabla(d, ["No.", "Descripción", "Cantidad", "Estado", "Observaciones"], 8, [1.2, 6.5, 2, 2.5, 4])
    d.add_paragraph()
    par(d, "2. ASUNTOS PENDIENTES", True, WD_ALIGN_PARAGRAPH.LEFT)
    tabla(d, ["No.", "Asunto", "Responsable", "Fecha compromiso"], 4, [1.2, 8, 3.5, 3.5])
    d.add_paragraph()
    par(d, "3. MANIFESTACIONES", True, WD_ALIGN_PARAGRAPH.LEFT)
    par(d, "Quien recibe manifiesta haber revisado lo anterior y recibirlo a su entera satisfacción, salvo lo señalado en observaciones. "
           "Quien entrega declara que la información y bienes descritos son los que están bajo su resguardo.")
    par(d, "No habiendo más asuntos que tratar, se firma la presente por quienes intervinieron.")
    firmas(d, ["Entrega", "Recibe", "Testigo"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "05_Acta_de_Entrega_Recepcion")


def acta_administrativa():
    d = nuevo()
    titulo(d, "Acta administrativa", "Registro de hechos laborales")
    par(d, "Siendo las [HORA] horas del día [DÍA] de [MES] de [AÑO], en [LUGAR], se levanta la presente acta con la intervención de: "
           "el/la C. [NOMBRE DEL TRABAJADOR], puesto [PUESTO]; [NOMBRE DEL JEFE INMEDIATO], jefe inmediato; [NOMBRE DE RH], Recursos Humanos; "
           "y los testigos [TESTIGO 1] y [TESTIGO 2].")
    par(d, "HECHOS", True, WD_ALIGN_PARAGRAPH.LEFT)
    par(d, "Se hace constar que el día [FECHA DE LOS HECHOS], a las [HORA], el/la trabajador(a) [DESCRIPCIÓN OBJETIVA Y DETALLADA DE LOS HECHOS: "
           "qué, cuándo, dónde, cómo, sin juicios de valor].")
    par(d, "DECLARACIÓN DEL TRABAJADOR", True, WD_ALIGN_PARAGRAPH.LEFT)
    par(d, "En uso de la palabra, el/la trabajador(a) manifestó: [DECLARACIÓN]. / Se negó a declarar.")
    par(d, "DECLARACIÓN DE TESTIGOS", True, WD_ALIGN_PARAGRAPH.LEFT)
    par(d, "[TESTIGO 1]: [DECLARACIÓN]. [TESTIGO 2]: [DECLARACIÓN].")
    par(d, "CONSECUENCIA / MEDIDA APLICADA", True, WD_ALIGN_PARAGRAPH.LEFT)
    par(d, "[AMONESTACIÓN VERBAL / ESCRITA / SUSPENSIÓN / OTRA, con fundamento en el Reglamento Interior de Trabajo y la Ley Federal del Trabajo].")
    par(d, "No habiendo más que agregar, se cierra el acta a las [HORA] horas del mismo día, firmando al calce quienes intervinieron.")
    firmas(d, ["Trabajador(a)", "Jefe inmediato", "Recursos Humanos"])
    d.add_paragraph()
    firmas(d, ["Testigo 1", "Testigo 2"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "06_Acta_Administrativa")


def contrato_confidencialidad():
    d = nuevo()
    titulo(d, "Acuerdo de confidencialidad (NDA)")
    par(d, "Acuerdo que celebran [PARTE REVELADORA], RFC [RFC] (“LA REVELADORA”), y [PARTE RECEPTORA], RFC [RFC] (“LA RECEPTORA”), "
           "para proteger la información que se compartan con motivo de [FINALIDAD: p. ej. evaluación de una posible relación comercial].")
    clausula(d, "PRIMERA. Información confidencial", "Toda información técnica, comercial, financiera, de clientes, procesos o cualquier otra que LA REVELADORA entregue de forma verbal, escrita o electrónica y que sea identificada como confidencial o que por su naturaleza deba considerarse como tal.")
    clausula(d, "SEGUNDA. Obligaciones", "LA RECEPTORA se obliga a usar la información únicamente para la finalidad indicada, a no divulgarla a terceros sin autorización escrita y a protegerla con el mismo cuidado que a la propia.")
    clausula(d, "TERCERA. Excepciones", "No es confidencial la información que sea de dominio público sin culpa de LA RECEPTORA, la que ya conociera legítimamente o la que deba revelar por mandato de autoridad competente, previo aviso a LA REVELADORA.")
    clausula(d, "CUARTA. Vigencia", "Las obligaciones estarán vigentes durante [NÚMERO] años contados a partir de la firma.")
    clausula(d, "QUINTA. Devolución", "A solicitud de LA REVELADORA, LA RECEPTORA devolverá o destruirá la información y las copias que tenga.")
    clausula(d, "SEXTA. Pena convencional", "El incumplimiento generará una pena de $[MONTO], sin perjuicio de la reparación de daños y perjuicios.")
    clausula(d, "SÉPTIMA. Jurisdicción", "Las partes se someten a los tribunales de [CIUDAD, ESTADO].")
    par(d, "Firmado en [CIUDAD], a [DÍA] de [MES] de [AÑO].")
    firmas(d, ["LA REVELADORA", "LA RECEPTORA"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "07_Acuerdo_de_Confidencialidad")


def carta_poder():
    d = nuevo()
    titulo(d, "Carta poder simple")
    derecha(d, "[CIUDAD], a [DÍA] de [MES] de [AÑO]")
    par(d, "Yo, [NOMBRE DEL OTORGANTE], con identificación oficial [TIPO Y NÚMERO], otorgo poder amplio y bastante a [NOMBRE DEL APODERADO], "
           "para que en mi nombre y representación realice el siguiente trámite: [DESCRIPCIÓN DEL TRÁMITE], ante [INSTITUCIÓN / DEPENDENCIA].")
    par(d, "El apoderado queda facultado para presentar y recibir documentos, firmar lo necesario y realizar cuanto sea indispensable para el "
           "cumplimiento de este encargo. Vigencia: [FECHA / HASTA CONCLUIR EL TRÁMITE].")
    par(d, "Anexar copia de las identificaciones oficiales de otorgante, apoderado y testigos.", align=WD_ALIGN_PARAGRAPH.LEFT)
    firmas(d, ["Otorgante", "Apoderado"])
    d.add_paragraph()
    firmas(d, ["Testigo 1\nNombre y domicilio", "Testigo 2\nNombre y domicilio"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "08_Carta_Poder_Simple")


# ----------------------------------------------------------------- POLÍTICAS Y PROCEDIMIENTOS
def ficha(d, codigo, version="1.0"):
    t = d.add_table(rows=2, cols=4)
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, (a, b) in enumerate((("CÓDIGO", codigo), ("VERSIÓN", version), ("FECHA DE EMISIÓN", "[DÍA/MES/AÑO]"), ("PRÓXIMA REVISIÓN", "[DÍA/MES/AÑO]"))):
        h, v = t.cell(0, i), t.cell(1, i)
        h.text = ""
        r = h.paragraphs[0].add_run(a)
        r.bold = True
        r.font.size = Pt(8)
        r.font.color.rgb = RGBColor(255, 255, 255)
        h.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        sh = OxmlElement("w:shd")
        sh.set(qn("w:val"), "clear")
        sh.set(qn("w:fill"), "0B2A4A")
        h._tc.get_or_add_tcPr().append(sh)
        v.text = ""
        runs(v.paragraphs[0], b)
        v.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        for x in v.paragraphs[0].runs:
            x.font.size = Pt(10)
    d.add_paragraph()


def seccion(d, titulo):
    p = d.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(titulo.upper())
    r.bold = True
    r.font.size = Pt(11)
    r.font.color.rgb = PETROL
    borde_parrafo(p, color="C9D3DB", sz=6, espacio=2)


def vinetas(d, items):
    for it in items:
        p = d.add_paragraph(style="List Bullet")
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        if it.startswith("**"):
            negrita, resto = it[2:].split("**", 1)
            runs(p, negrita, bold=True)
            runs(p, resto)
        else:
            runs(p, it)


def pasos_tabla(d, filas_, encabezados=("No.", "Actividad", "Responsable", "Registro / formato"), anchos=(1.2, 8.8, 3.2, 3.3)):
    t = tabla(d, list(encabezados), len(filas_), list(anchos))
    for i, fila in enumerate(filas_, 1):
        for j, txt in enumerate(fila):
            c = t.cell(i, j)
            c.text = ""
            runs(c.paragraphs[0], str(txt))
            for x in c.paragraphs[0].runs:
                x.font.size = Pt(9.5)
            if j == 0:
                c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    d.add_paragraph()


def control_cambios(d):
    seccion(d, "Control de cambios")
    t = tabla(d, ["Versión", "Fecha", "Descripción del cambio", "Elaboró"], 2, [2, 3, 8.5, 3])
    t.cell(1, 0).text, t.cell(1, 1).text, t.cell(1, 2).text, t.cell(1, 3).text = "1.0", "[FECHA]", "Emisión inicial", "[NOMBRE]"
    d.add_paragraph()
    firmas(d, ["Elaboró", "Revisó", "Autorizó"])
    d.add_paragraph()
    aviso(d)


def doc_base(titulo, subtitulo, codigo):
    d = nuevo()
    titulo_doc(d, titulo, subtitulo)
    ficha(d, codigo)
    return d


def titulo_doc(d, t, sub):
    titulo(d, t, sub)


def manual_caja_chica():
    d = doc_base("Manual de procedimiento de caja chica", "Fondo fijo: apertura, operación, arqueo y reposición", "MP-ADM-01")
    seccion(d, "1. Objetivo")
    par(d, "Establecer las reglas para el manejo, control y reposición del fondo fijo de caja chica de [NOMBRE DE LA EMPRESA], con el fin de atender gastos menores "
           "e imprevistos de forma ágil, con comprobación suficiente y sin riesgo de pérdida de recursos.")
    nota(d, "Regla de oro", "Sin vale y sin comprobante no hay reembolso. El fondo se cuenta y se concilia, siempre.")
    seccion(d, "2. Alcance")
    par(d, "Aplica a todas las áreas que soliciten recursos de caja chica y al personal responsable de su custodia, autorización y registro contable.")
    seccion(d, "3. Definiciones")
    vinetas(d, ["**Fondo fijo:** monto autorizado por Dirección que se mantiene constante mediante reposiciones.",
                "**Vale provisional:** documento interno firmado por quien recibe el efectivo, mientras entrega su comprobante.",
                "**Arqueo:** conteo físico del efectivo y los comprobantes para compararlos contra el fondo autorizado.",
                "**Reposición:** reembolso del efectivo gastado, contra comprobantes autorizados."])
    seccion(d, "4. Responsables")
    pasos_tabla(d, [("1", "Autorizar apertura, monto y reposiciones del fondo", "Dirección / Finanzas", "Acta de autorización"),
                    ("2", "Custodiar el fondo y operar el procedimiento", "Custodio de caja chica", "Bitácora de caja"),
                    ("3", "Autorizar gastos de su área", "Jefe de área", "Vale provisional"),
                    ("4", "Registrar contablemente y reponer el fondo", "Contabilidad", "Póliza de gastos")],
                 ("No.", "Función", "Responsable", "Registro"))
    seccion(d, "5. Políticas")
    vinetas(d, ["El fondo fijo será de $[MONTO] MXN y se asignará por escrito a una sola persona responsable.",
                "El monto máximo por gasto individual es de $[MONTO] MXN; los gastos mayores se tramitan por el procedimiento de compras.",
                "Solo se pagan gastos menores, urgentes y no recurrentes. No se otorgan préstamos personales ni se cambian cheques.",
                "Todo desembolso requiere vale provisional autorizado y comprobante fiscal (CFDI) o, en su defecto, nota con los datos del gasto.",
                "Los comprobantes se entregan en un máximo de [2] días hábiles; los vales sin comprobar se descuentan vía nómina previa autorización del colaborador.",
                "El fondo se repone cuando alcance el 30% del monto autorizado o al cierre de mes, lo que ocurra primero.",
                "El efectivo se guarda bajo llave; el custodio no puede ser quien autoriza ni quien registra contablemente."])
    seccion(d, "6. Procedimiento")
    pasos_tabla(d, [("1", "El solicitante llena el vale provisional con concepto, importe y área y lo firma su jefe inmediato.", "Solicitante / Jefe de área", "Vale provisional"),
                    ("2", "El custodio verifica autorización y monto, entrega el efectivo y registra el movimiento.", "Custodio", "Control de caja chica (Excel)"),
                    ("3", "El solicitante compra y entrega comprobante y cambio en el plazo establecido.", "Solicitante", "Factura / ticket"),
                    ("4", "El custodio cancela el vale, anexa el comprobante y actualiza el saldo.", "Custodio", "Control de caja chica"),
                    ("5", "Cuando se alcance el nivel de reposición, el custodio integra los comprobantes y solicita el reembolso.", "Custodio", "Solicitud de reposición"),
                    ("6", "Finanzas revisa, autoriza y emite el pago; Contabilidad registra.", "Finanzas / Contabilidad", "Póliza"),
                    ("7", "Se realiza arqueo sorpresa mensual; la diferencia debe ser cero y se documenta.", "Finanzas", "Acta de arqueo")])
    seccion(d, "7. Formatos relacionados")
    vinetas(d, ["Control de caja chica (Excel).", "Vale provisional de caja.", "Acta de arqueo de caja."])
    control_cambios(d)
    guardar(d, "09_Manual_de_Procedimiento_de_Caja_Chica", "6_Politicas_y_Procedimientos")


def politica_compras():
    d = doc_base("Política de compras y adquisiciones", "Lineamientos para solicitar, cotizar, autorizar y recibir bienes y servicios", "PO-COM-01")
    seccion(d, "1. Objetivo")
    par(d, "Garantizar que las compras de [NOMBRE DE LA EMPRESA] se realicen con las mejores condiciones de precio, calidad y servicio, con transparencia, "
           "autorización adecuada y soporte documental.")
    nota(d, "Regla de oro", "Nada se compra sin requisición autorizada, y quien solicita nunca autoriza ni recibe.")
    seccion(d, "2. Alcance")
    par(d, "Aplica a todas las compras de bienes, materiales, equipo y contratación de servicios, sin importar el área solicitante ni el monto.")
    seccion(d, "3. Niveles de autorización")
    t = tabla(d, ["Monto de la compra (sin IVA)", "Cotizaciones mínimas", "Autoriza"], 4, [6, 4.5, 6])
    for i, fila in enumerate([("Hasta $[MONTO 1]", "1", "Jefe de área"), ("De $[MONTO 1] a $[MONTO 2]", "2", "Gerencia"),
                              ("De $[MONTO 2] a $[MONTO 3]", "3", "Dirección"), ("Mayor a $[MONTO 3]", "3 + contrato", "Dirección y Socios")], 1):
        for j, v in enumerate(fila):
            t.cell(i, j).text = ""
            runs(t.cell(i, j).paragraphs[0], v)
    d.add_paragraph()
    seccion(d, "4. Políticas generales")
    vinetas(d, ["Ninguna compra se realiza sin requisición autorizada y orden de compra emitida por el área de compras.",
                "Se prefiere a proveedores registrados en el padrón; todo proveedor nuevo entrega constancia de situación fiscal, opinión de cumplimiento positiva y datos bancarios.",
                "Se evita el fraccionamiento de compras para eludir niveles de autorización.",
                "Quien solicita no puede ser quien autoriza ni quien recibe el bien.",
                "Los pagos se realizan por transferencia contra factura (CFDI) y entrada de almacén; no se pagan anticipos sin autorización de Dirección.",
                "Se evita cualquier conflicto de interés: el personal declara por escrito vínculos familiares o comerciales con proveedores.",
                "No se aceptan obsequios de proveedores superiores a $[MONTO] MXN."])
    seccion(d, "5. Procedimiento")
    pasos_tabla(d, [("1", "El área solicitante elabora la requisición con descripción, cantidad y justificación.", "Solicitante", "Requisición"),
                    ("2", "El jefe de área autoriza la requisición.", "Jefe de área", "Requisición firmada"),
                    ("3", "Compras solicita las cotizaciones según el nivel de monto.", "Compras", "Solicitud de cotización"),
                    ("4", "Compras integra el cuadro comparativo y recomienda proveedor.", "Compras", "Cuadro comparativo (Excel)"),
                    ("5", "Se autoriza la compra según el nivel de aprobación.", "Autoriza", "Cuadro firmado"),
                    ("6", "Compras emite la orden de compra y la envía al proveedor.", "Compras", "Orden de compra (Excel)"),
                    ("7", "Almacén recibe, verifica contra la orden y registra la entrada.", "Almacén", "Entrada de almacén"),
                    ("8", "Cuentas por pagar concilia orden, entrada y factura (3 vías) y programa el pago.", "Cuentas por pagar", "Factura / pago")])
    seccion(d, "6. Evaluación de proveedores")
    par(d, "Una vez al año se evalúa a los proveedores principales en cumplimiento de entrega, calidad, precio y atención. Los resultados determinan su permanencia en el padrón.")
    seccion(d, "7. Formatos relacionados")
    vinetas(d, ["Orden de compra (Excel).", "Cuadro comparativo de cotizaciones (Excel).", "Directorio de clientes y proveedores (Excel)."])
    control_cambios(d)
    guardar(d, "10_Politica_de_Compras_y_Adquisiciones", "6_Politicas_y_Procedimientos")


def politica_viaticos():
    d = doc_base("Política de viáticos y gastos de viaje", "Lineamientos de solicitud, límites, comprobación y reembolso", "PO-FIN-02")
    seccion(d, "1. Objetivo")
    par(d, "Regular el otorgamiento, uso y comprobación de viáticos y gastos de viaje del personal de [NOMBRE DE LA EMPRESA], asegurando que sean razonables, "
           "necesarios y deducibles.")
    nota(d, "Regla de oro", "Todo viaje se autoriza antes y se comprueba con CFDI en los días hábiles definidos.")
    seccion(d, "2. Alcance")
    par(d, "Aplica a todo colaborador que deba trasladarse por motivos de trabajo fuera de su lugar habitual de adscripción.")
    seccion(d, "3. Límites autorizados por día")
    t = tabla(d, ["Concepto", "Nivel operativo", "Nivel gerencial", "Nivel directivo"], 5, [5, 3.9, 3.9, 3.9])
    for i, fila in enumerate([("Hospedaje (por noche)", "$[MONTO]", "$[MONTO]", "$[MONTO]"), ("Alimentos (por día)", "$[MONTO]", "$[MONTO]", "$[MONTO]"),
                              ("Transporte local (por día)", "$[MONTO]", "$[MONTO]", "$[MONTO]"), ("Transporte aéreo / terrestre", "Clase turista", "Clase turista", "Según autorización"),
                              ("Kilometraje (vehículo propio)", "$[MONTO]/km", "$[MONTO]/km", "$[MONTO]/km")], 1):
        for j, v in enumerate(fila):
            t.cell(i, j).text = ""
            runs(t.cell(i, j).paragraphs[0], v)
    d.add_paragraph()
    seccion(d, "4. Políticas")
    vinetas(d, ["Todo viaje debe contar con autorización previa del jefe inmediato mediante la solicitud de viáticos.",
                "Se reservan boletos y hospedaje con al menos [7] días de anticipación para obtener mejores tarifas.",
                "No son reembolsables multas, bebidas alcohólicas, gastos personales, propinas por encima del [10]% ni gastos de acompañantes.",
                "Los gastos se comprueban con CFDI a nombre de la empresa dentro de los [5] días hábiles posteriores al regreso.",
                "Los gastos sin factura se comprueban con nota firmada y no excederán el [10]% del total del viaje.",
                "El anticipo no comprobado se descuenta vía nómina, previa autorización del colaborador.",
                "Los saldos a favor del colaborador se reembolsan en la siguiente dispersión de pagos."])
    seccion(d, "5. Procedimiento")
    pasos_tabla(d, [("1", "El colaborador llena la solicitud de viáticos con destino, fechas, objetivo y presupuesto.", "Colaborador", "Solicitud de viáticos"),
                    ("2", "El jefe inmediato autoriza y Finanzas entrega el anticipo.", "Jefe / Finanzas", "Solicitud firmada"),
                    ("3", "El colaborador realiza el viaje y conserva todos los comprobantes.", "Colaborador", "Facturas / tickets"),
                    ("4", "A su regreso llena el informe de gastos y adjunta los comprobantes.", "Colaborador", "Informe de gastos"),
                    ("5", "Finanzas revisa, concilia el anticipo y registra la comprobación.", "Finanzas", "Póliza"),
                    ("6", "Se reembolsa o descuenta la diferencia.", "Finanzas / Nómina", "Transferencia / recibo")])
    seccion(d, "6. Formatos relacionados")
    vinetas(d, ["Solicitud de viáticos.", "Informe de gastos de viaje.", "Control de ingresos y gastos (Excel)."])
    control_cambios(d)
    guardar(d, "11_Politica_de_Viaticos_y_Gastos_de_Viaje", "6_Politicas_y_Procedimientos")


def reglamento_asistencia():
    d = doc_base("Política de asistencia y puntualidad", "Horarios, retardos, faltas, permisos y registro de asistencia", "PO-RH-03")
    seccion(d, "1. Objetivo")
    par(d, "Establecer las reglas de asistencia, puntualidad y permanencia de los colaboradores de [NOMBRE DE LA EMPRESA], para asegurar la continuidad de la operación "
           "y la equidad en el trato al personal.")
    nota(d, "Principio", "El registro de asistencia es personal e intransferible; la puntualidad es parte del trabajo en equipo.")
    seccion(d, "2. Alcance")
    par(d, "Aplica a todo el personal, de base o eventual, en cualquiera de las áreas y turnos de la empresa.")
    seccion(d, "3. Jornada y horarios")
    t = tabla(d, ["Turno", "Horario de entrada", "Horario de salida", "Tiempo de alimentos"], 3, [4, 4, 4, 4])
    for i, fila in enumerate([("Diurno", "[08:00]", "[17:00]", "[60 min]"), ("Mixto", "[11:00]", "[19:00]", "[45 min]"), ("Nocturno", "[20:00]", "[05:00]", "[60 min]")], 1):
        for j, v in enumerate(fila):
            t.cell(i, j).text = ""
            runs(t.cell(i, j).paragraphs[0], v)
    d.add_paragraph()
    seccion(d, "4. Lineamientos")
    vinetas(d, ["El registro de entrada y salida es personal e intransferible; registrar por otro compañero se considera falta grave.",
                "Tolerancia: [10] minutos después de la hora de entrada. Entre [11] y [30] minutos se considera retardo; después de [30] minutos, falta, salvo autorización.",
                "[Tres] retardos en un mismo mes equivalen a [una falta injustificada].",
                "La falta injustificada implica el descuento del día y, en su caso, del séptimo día conforme a la Ley Federal del Trabajo.",
                "Las ausencias se justifican con incapacidad del IMSS, permiso autorizado o evidencia de causa de fuerza mayor presentada en un máximo de [48] horas.",
                "Más de [tres] faltas injustificadas en un periodo de [30] días pueden ser causa de rescisión de la relación laboral, conforme a la LFT (art. 47).",
                "Los permisos se solicitan por escrito con al menos [un día] de anticipación, salvo emergencias."])
    seccion(d, "5. Procedimiento")
    pasos_tabla(d, [("1", "El colaborador registra su entrada y salida en el sistema o formato de asistencia.", "Colaborador", "Control de asistencia"),
                    ("2", "El jefe inmediato valida el registro diario y señala retardos y faltas.", "Jefe inmediato", "Control de asistencia (Excel)"),
                    ("3", "El colaborador entrega justificantes dentro del plazo.", "Colaborador", "Justificante"),
                    ("4", "RH consolida el mes, aplica las reglas y envía incidencias a nómina.", "Recursos Humanos", "Reporte de incidencias"),
                    ("5", "Nómina aplica descuentos y el colaborador recibe su recibo.", "Nómina", "Recibo de nómina")])
    seccion(d, "6. Formatos relacionados")
    vinetas(d, ["Control de asistencia mensual (Excel).", "Solicitud de vacaciones o permiso (Excel).", "Acta administrativa (Word)."])
    control_cambios(d)
    guardar(d, "12_Politica_de_Asistencia_y_Puntualidad", "6_Politicas_y_Procedimientos")


def procedimiento_inventarios():
    d = doc_base("Procedimiento de control de inventarios", "Recepción, resguardo, salidas, conteos físicos y ajustes", "PR-ALM-01")
    seccion(d, "1. Objetivo")
    par(d, "Definir las actividades para recibir, almacenar, entregar y controlar los inventarios de [NOMBRE DE LA EMPRESA], asegurando que las existencias en sistema "
           "coincidan con las físicas y que las diferencias se investiguen y corrijan.")
    nota(d, "Regla de oro", "Todo movimiento de inventario tiene un documento de respaldo y un responsable.")
    seccion(d, "2. Alcance")
    par(d, "Aplica a almacenes, bodegas y áreas que resguarden materiales, productos terminados, refacciones o consumibles.")
    seccion(d, "3. Políticas")
    vinetas(d, ["Todo producto tiene código único (SKU), descripción, unidad de medida y ubicación asignada.",
                "Ninguna entrada o salida se realiza sin documento de respaldo (orden de compra, remisión, requisición o nota de devolución).",
                "El acceso al almacén está restringido al personal autorizado; los visitantes son acompañados.",
                "Se define un stock mínimo y máximo por producto, revisado cada [trimestre].",
                "Se realiza inventario físico general al menos [dos] veces al año y conteos cíclicos mensuales por clasificación ABC.",
                "Las diferencias superiores a [2]% del valor se investigan antes de ajustarse; todo ajuste requiere autorización de Gerencia.",
                "El método de valuación es costo promedio ponderado."])
    seccion(d, "4. Procedimiento de recepción")
    pasos_tabla(d, [("1", "Recibir al transportista y verificar documentos (factura, remisión) contra la orden de compra.", "Almacenista", "Orden de compra"),
                    ("2", "Contar físicamente y revisar calidad, empaque y caducidad.", "Almacenista", "Reporte de recepción"),
                    ("3", "Registrar la entrada en el sistema o kardex y ubicar el producto.", "Almacenista", "Kardex / Control de inventario"),
                    ("4", "Enviar copia a Cuentas por pagar y reportar diferencias o daños.", "Almacenista", "Entrada de almacén")])
    seccion(d, "5. Procedimiento de salidas")
    pasos_tabla(d, [("1", "El área solicita material mediante requisición autorizada.", "Área solicitante", "Requisición"),
                    ("2", "El almacenista verifica existencia, surte y recaba firma de quien recibe.", "Almacenista", "Vale de salida"),
                    ("3", "Registra la salida y actualiza existencias.", "Almacenista", "Kardex / Control de inventario"),
                    ("4", "Si la existencia llega al mínimo, genera aviso para reabasto.", "Almacenista / Compras", "Control de inventario")])
    seccion(d, "6. Conteo físico y ajustes")
    pasos_tabla(d, [("1", "Congelar movimientos del área a contar y definir equipos de conteo independientes.", "Contraloría", "Programa de conteo"),
                    ("2", "Realizar el primer conteo y, de existir diferencias, un reconteo.", "Equipos de conteo", "Hoja de conteo"),
                    ("3", "Comparar contra sistema, investigar causas y proponer ajustes.", "Contraloría", "Reporte de diferencias"),
                    ("4", "Autorizar y registrar ajustes con póliza y justificación.", "Gerencia / Contabilidad", "Póliza de ajuste")])
    seccion(d, "7. Formatos relacionados")
    vinetas(d, ["Control de inventario (Excel).", "Kardex de costo promedio (Excel).", "Orden de compra (Excel)."])
    control_cambios(d)
    guardar(d, "13_Procedimiento_de_Control_de_Inventarios", "6_Politicas_y_Procedimientos")


def checklist_alta():
    d = doc_base("Checklist de alta de nuevo colaborador", "Documentación, accesos, capacitación y seguimiento del primer mes", "FO-RH-04")
    par(d, "Colaborador: [NOMBRE COMPLETO]    Puesto: [PUESTO]    Área: [ÁREA]    Fecha de ingreso: [FECHA]", align=WD_ALIGN_PARAGRAPH.LEFT)
    nota(d, "Recomendación", "Complete la documentación antes del primer día; el alta en el IMSS debe hacerse dentro de los 5 días hábiles.")
    bloques = [
        ("A. Documentación (antes del primer día)", ["Solicitud de empleo y CV", "Acta de nacimiento", "CURP", "RFC con constancia de situación fiscal",
                                                     "Número de seguridad social (NSS)", "Comprobante de domicilio (menor a 3 meses)", "Comprobante de estudios",
                                                     "Identificación oficial (INE o pasaporte)", "Cuenta bancaria o CLABE para nómina", "Examen médico y referencias laborales"]),
        ("B. Trámites de contratación", ["Contrato individual de trabajo firmado", "Alta en el IMSS (dentro de los 5 días hábiles)", "Aviso de retención de crédito Infonavit/Fonacot, si aplica",
                                         "Carta de confidencialidad firmada", "Aviso de privacidad entregado y firmado", "Alta en nómina y esquema de pago"]),
        ("C. Accesos y herramientas", ["Correo electrónico y accesos a sistemas", "Equipo de cómputo / herramientas asignadas con carta responsiva", "Gafete y control de acceso",
                                       "Uniforme o equipo de protección (si aplica)", "Lugar de trabajo asignado"]),
        ("D. Inducción y capacitación", ["Bienvenida y presentación del equipo", "Recorrido por las instalaciones", "Explicación del reglamento y políticas",
                                         "Capacitación del puesto y objetivos de 30-60-90 días", "Capacitación de seguridad y protección civil"]),
        ("E. Seguimiento", ["Revisión con jefe inmediato a los 7 días", "Revisión a los 30 días y confirmación de objetivos", "Evaluación de periodo de prueba, si aplica"]),
    ]
    for tit, items in bloques:
        seccion(d, tit)
        t = tabla(d, ["Requisito / actividad", "Responsable", "Fecha", "Listo (✔)"], len(items), [8, 3.3, 2.7, 2.4])
        for i, it in enumerate(items, 1):
            t.cell(i, 0).text = ""
            runs(t.cell(i, 0).paragraphs[0], it)
            for x in t.cell(i, 0).paragraphs[0].runs:
                x.font.size = Pt(9.5)
        d.add_paragraph()
    firmas(d, ["Colaborador", "Jefe inmediato", "Recursos Humanos"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "14_Checklist_de_Alta_de_Colaborador", "6_Politicas_y_Procedimientos")


# ---------------------------------------------------------------- CONTROL DIRECTIVO
VERDE, AMBAR, CORAL_HEX = "C6EFCE", "FFEB9C", "FFD6D0"


def sombrear(celda, hex_):
    sh = OxmlElement("w:shd")
    sh.set(qn("w:val"), "clear")
    sh.set(qn("w:fill"), hex_)
    celda._tc.get_or_add_tcPr().append(sh)


def tabla_datos(d, encabezados, filas_vacias, anchos, ejemplo=None):
    t = tabla(d, list(encabezados), filas_vacias, list(anchos))
    for i, fila in enumerate(ejemplo or [], 1):
        for j, v in enumerate(fila):
            t.cell(i, j).text = ""
            runs(t.cell(i, j).paragraphs[0], v)
            for x in t.cell(i, j).paragraphs[0].runs:
                x.font.size = Pt(9)
    for row in t.rows[1:]:
        for c in row.cells:
            for pp in c.paragraphs:
                for x in pp.runs:
                    x.font.size = Pt(9)
    d.add_paragraph()
    return t


def reporte_semanal():
    d = doc_base("Reporte semanal para directivos", "Resumen ejecutivo, avances, pendientes, riesgos, decisiones y próximos pasos", "FO-DIR-01")
    t = d.add_table(rows=2, cols=4)
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, (a, b) in enumerate((("SEMANA", "Del [FECHA] al [FECHA]"), ("CLIENTE / PROYECTO", "[NOMBRE]"), ("ELABORÓ", "[NOMBRE Y PUESTO]"), ("SEMÁFORO GENERAL", "[VERDE / ÁMBAR / ROJO]"))):
        h, v = t.cell(0, i), t.cell(1, i)
        h.text = ""
        r = h.paragraphs[0].add_run(a)
        r.bold = True
        r.font.size = Pt(8)
        sombrear(h, "E6ECF1")
        v.text = ""
        runs(v.paragraphs[0], b)
        for x in v.paragraphs[0].runs:
            x.font.size = Pt(9.5)
    sombrear(t.cell(1, 3), AMBAR)
    d.add_paragraph()
    nota(d, "Cómo leer este reporte", "Verde: en control · Ámbar: atención · Coral: acción inmediata. Una página para decidir.")
    seccion(d, "1. Resumen ejecutivo")
    par(d, "[Conclusión en una frase: cómo va la operación y qué necesitas de dirección. Copia aquí el texto automático de la celda B10 del TABLERO del libro de control operativo.]")
    vinetas(d, ["[Logro principal de la semana].", "[Principal desviación o preocupación].", "[Decisión o apoyo que se requiere de dirección]."])
    seccion(d, "2. Indicadores clave")
    tabla_datos(d, ("Indicador", "Meta", "Real", "Tendencia", "Semáforo"), 5, (6.5, 2.5, 2.5, 2.5, 3), [
        ("[% de actividades cumplidas en tiempo]", "[90%]", "[ ]", "[▲ ▼ ●]", "[ ]"), ("[Facturación semanal]", "[ ]", "[ ]", "[ ]", "[ ]"),
        ("[Cobranza semanal]", "[ ]", "[ ]", "[ ]", "[ ]")])
    seccion(d, "3. Avances de la semana")
    tabla_datos(d, ("Actividad / entregable", "Proyecto o área", "Responsable", "Resultado y evidencia"), 5, (5.8, 3.6, 3, 4.6))
    seccion(d, "4. Pendientes críticos")
    tabla_datos(d, ("Pendiente", "Responsable", "Fecha compromiso", "Estatus", "Semáforo"), 4, (6.3, 3, 3, 2.5, 2.2))
    seccion(d, "5. Riesgos")
    tabla_datos(d, ("Riesgo", "Nivel (alto, medio, bajo)", "Acción de mitigación", "Responsable"), 4, (5.3, 2.7, 6, 3))
    seccion(d, "6. Decisiones requeridas a dirección")
    tabla_datos(d, ("Decisión", "Opciones", "Recomendación", "Fecha requerida"), 3, (5, 4.5, 4.5, 3))
    seccion(d, "7. Próximos pasos (siguiente semana)")
    tabla_datos(d, ("Actividad", "Responsable", "Fecha", "Entregable"), 4, (6.6, 3.4, 2.6, 4.4))
    par(d, "Fuente de datos: libro de control operativo semanal (hoja TABLERO). Semáforos: verde = en control, ámbar = atención, coral/rojo = acción inmediata.", align=WD_ALIGN_PARAGRAPH.LEFT)
    firmas(d, ["Elaboró", "Revisó"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "02_Reporte_Semanal_para_Directivos", "7_Control_Directivo")


def plan_30_dias():
    d = doc_base("Plan de implementación de 30 días", "Ordenar, planear, ejecutar y cerrar: de la solicitud al primer reporte para dirección", "PL-IMP-01")
    nota(d, "Principio", "Un proyecto no termina al entregar: termina al cerrar bien, con evidencia y responsables.")
    seccion(d, "1. Objetivo")
    par(d, "Poner bajo control la operación administrativa de [NOMBRE DEL CLIENTE] en 30 días: procesos documentados, responsables definidos, controles en operación "
           "y un reporte semanal que permita a dirección decidir con información.")
    seccion(d, "2. Resultados esperados al día 30")
    vinetas(d, ["Diagnóstico de procesos con brechas priorizadas.", "Expediente documental completo y ordenado.",
                "Controles de nómina, compras, facturación y cobranza en operación.", "Tablero semanal con semáforos y reporte para directivos.",
                "Plan de mejora de 90 días aprobado por dirección."])
    sem = [
        ("3. Semana 1 - ORDENAR (días 1 a 7)", [("Reunión de arranque y definición de alcance", "Dirección / Consultor", "Acta de arranque", "Día 1"),
                                                  ("Levantamiento de procesos y documentos existentes", "Consultor", "Mapa de procesos", "Día 3"),
                                                  ("Recepción de accesos, documentos fiscales y laborales", "Administración", "Expediente inicial", "Día 4"),
                                                  ("Diagnóstico administrativo y semáforo de cumplimiento", "Consultor", "Informe de diagnóstico", "Día 7")]),
        ("4. Semana 2 - PLANEAR (días 8 a 14)", [("Priorizar brechas (urgente / importante)", "Consultor / Dirección", "Matriz de prioridades", "Día 9"),
                                                   ("Definir responsables, calendario y políticas", "Dirección", "Matriz de responsables", "Día 10"),
                                                   ("Configurar libro de control operativo y catálogos", "Consultor", "Libro de control semanal", "Día 12"),
                                                   ("Aprobar plan de trabajo", "Dirección", "Plan firmado", "Día 14")]),
        ("5. Semana 3 - EJECUTAR (días 15 a 21)", [("Operar nómina, compras y facturación con los nuevos controles", "Administración", "Registros y evidencias", "Día 17"),
                                                     ("Regularizar pendientes críticos fiscales e IMSS", "Finanzas / RH", "Acuses y comprobantes", "Día 19"),
                                                     ("Capacitar al equipo en formatos y tablero", "Consultor", "Lista de asistencia", "Día 20"),
                                                     ("Primer reporte semanal a dirección", "Consultor", "Reporte semanal", "Día 21")]),
        ("6. Semana 4 - CERRAR (días 22 a 30)", [("Revisar indicadores y cerrar pendientes", "Administración", "Pendientes cerrados", "Día 25"),
                                                   ("Documentar procedimientos finales", "Consultor", "Manuales y políticas", "Día 28"),
                                                   ("Presentar resultados y plan de mejora a 90 días", "Consultor / Dirección", "Presentación de cierre", "Día 29"),
                                                   ("Entrega de expediente final", "Consultor", "Expediente completo", "Día 30")])]
    for tit, filas_ in sem:
        seccion(d, tit)
        tabla_datos(d, ("Actividad", "Responsable", "Entregable", "Fecha"), len(filas_), (7, 3.6, 3.7, 1.7), filas_)
    seccion(d, "7. Documentos requeridos al inicio")
    tabla_datos(d, ("Documento", "Área responsable", "Recibido (✔)", "Observaciones"), 8, (6.8, 3.6, 2.4, 3.2), [
        ("Acta constitutiva y poderes", "Dirección", "", ""), ("Constancia de situación fiscal y opinión de cumplimiento", "Finanzas", "", ""),
        ("Últimas 3 declaraciones mensuales y anual", "Finanzas", "", ""), ("Nómina de los últimos 3 meses y altas/bajas IMSS", "Recursos humanos", "", ""),
        ("Contratos vigentes de clientes y proveedores", "Dirección / Compras", "", ""), ("Estados de cuenta bancarios y conciliaciones", "Finanzas", "", ""),
        ("Inventario, activos fijos y presupuestos", "Operaciones", "", ""), ("Organigrama y descripción de puestos", "Recursos humanos", "", "")])
    seccion(d, "8. Gobierno del plan")
    vinetas(d, ["Reunión semanal de seguimiento de 30 minutos (mismo día y hora).", "Reporte semanal para directivos con semáforos, riesgos y decisiones.",
                "Escalamiento: un pendiente en rojo por más de 3 días se lleva a dirección.", "Comunicación: canal único (correo o WhatsApp corporativo) para acuerdos y evidencias."])
    seccion(d, "9. Entregables de arranque")
    vinetas(d, ["Acta de arranque y matriz de responsables.", "Mapa de procesos y matriz de riesgos.", "Libro de control operativo semanal configurado.", "Formato de reporte semanal."])
    firmas(d, ["Dirección", "Consultor responsable"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "03_Plan_de_Implementacion_30_Dias", "7_Control_Directivo")


def modelo_operativo():
    d = doc_base("Modelo operativo: ordenar, planear, ejecutar, cerrar", "Un método simple para operar con control y cerrar cada proyecto con evidencia", "MO-GEN-01")
    par(d, "Orden para operar. Control para crecer. Menos improvisación, más trazabilidad. Un proyecto no termina al entregar: termina al cerrar bien.", align=WD_ALIGN_PARAGRAPH.CENTER)
    pasos = [("1. ORDENAR", "0B2A4A", ["Levantar procesos, documentos y responsables.", "Eliminar duplicidades y pendientes ocultos.", "Definir qué se controla y con qué formato."],
              "Mapa de procesos · Expediente · Matriz de responsables"),
             ("2. PLANEAR", "0E7C8B", ["Priorizar por urgencia e impacto.", "Calendario, presupuesto y recursos.", "Riesgos y plan de mitigación."],
              "Plan de trabajo · Presupuesto anual · Matriz de riesgos"),
             ("3. EJECUTAR", "C9A227", ["Operar con formatos y controles estándar.", "Seguimiento semanal con semáforos.", "Escalar desviaciones a tiempo."],
              "Control operativo semanal · Reporte semanal · Indicadores"),
             ("4. CERRAR", "E8604C", ["Validar entregables y evidencia.", "Cerrar pendientes y conciliar cifras.", "Documentar lecciones aprendidas."],
              "Acta de entrega-recepción · Expediente final · Informe de cierre")]
    t = d.add_table(rows=3, cols=4)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for j, (tit, color, items, ent) in enumerate(pasos):
        h = t.cell(0, j)
        h.text = ""
        r = h.paragraphs[0].add_run(tit)
        r.bold = True
        r.font.size = Pt(13)
        r.font.color.rgb = RGBColor(255, 255, 255) if color != "C9A227" else RGBColor(0x0B, 0x2A, 0x4A)
        h.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        sombrear(h, color)
        b = t.cell(1, j)
        b.text = ""
        for k, it in enumerate(items):
            pp = b.paragraphs[0] if k == 0 else b.add_paragraph()
            rr = pp.add_run("• " + it)
            rr.font.size = Pt(9.5)
        e = t.cell(2, j)
        e.text = ""
        rr = e.paragraphs[0].add_run("ENTREGABLES\n")
        rr.bold = True
        rr.font.size = Pt(8)
        rr.font.color.rgb = PETROL
        r2 = e.paragraphs[0].add_run(ent)
        r2.font.size = Pt(9)
        sombrear(e, "F4F6F8")
    d.add_paragraph()
    seccion(d, "Responsables y fechas")
    tabla_datos(d, ("Paso", "Responsable", "Fecha inicio", "Fecha cierre", "Evidencia"), 4, (3, 4, 3, 3, 4), [
        ("Ordenar", "[NOMBRE]", "[FECHA]", "[FECHA]", "[DOCUMENTO]"), ("Planear", "[NOMBRE]", "[FECHA]", "[FECHA]", "[DOCUMENTO]"),
        ("Ejecutar", "[NOMBRE]", "[FECHA]", "[FECHA]", "[DOCUMENTO]"), ("Cerrar", "[NOMBRE]", "[FECHA]", "[FECHA]", "[DOCUMENTO]")])
    seccion(d, "Cómo usarlo con el paquete administrativo")
    vinetas(d, ["**Ordenar:** Directorio de clientes y proveedores, Control de activos fijos, Políticas y procedimientos.",
                "**Planear:** Presupuesto anual, Flujo de efectivo anual, Plan de implementación de 30 días.",
                "**Ejecutar:** Control operativo semanal, Nómina, Compras, Cuentas por cobrar.",
                "**Cerrar:** Conciliación bancaria, Acta de entrega-recepción, Reporte semanal para directivos."])
    aviso(d)
    guardar(d, "04_Modelo_Operativo_Ordenar_Planear_Ejecutar_Cerrar", "7_Control_Directivo")


# ------------------------------------------------------------- FORMATOS EJECUTIVOS (comité, autorización, proyecto, riesgos, cierre)
def tarjetas(d, items):
    """Fila de tarjetas KPI: etiqueta pequeña, valor grande y línea dorada inferior."""
    t = d.add_table(rows=1, cols=len(items))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    ancho = 16.5 / len(items)
    for j, (etq, val, color) in enumerate(items):
        c = t.cell(0, j)
        c.width = Cm(ancho)
        _sombra(c, color)
        _margenes(c, 100, 100, 160, 120)
        tcPr = c._tc.get_or_add_tcPr()
        b = OxmlElement("w:tcBorders")
        for lado, v in (("top", "nil"), ("left", "single"), ("right", "single")):
            e = OxmlElement(f"w:{lado}")
            e.set(qn("w:val"), v)
            if v != "nil":
                e.set(qn("w:sz"), "12")
                e.set(qn("w:color"), "FFFFFF")
            b.append(e)
        e = OxmlElement("w:bottom")
        e.set(qn("w:val"), "single")
        e.set(qn("w:sz"), "24")
        e.set(qn("w:color"), ORO)
        b.append(e)
        tcPr.append(b)
        p_ = c.paragraphs[0]
        p_.paragraph_format.space_after = Pt(0)
        r = p_.add_run(etq.upper())
        r.bold = True
        r.font.size = Pt(7.5)
        r.font.color.rgb = PETROL
        q = c.add_paragraph()
        q.paragraph_format.space_after = Pt(0)
        runs(q, val)
        for x in q.runs:
            x.font.size = Pt(13)
            x.bold = True
            x.font.color.rgb = AZUL
    d.add_paragraph().paragraph_format.space_after = Pt(0)


def matriz_riesgos(d):
    t = d.add_table(rows=6, cols=6)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.style = "Table Grid"
    t.cell(0, 0).text = ""
    for j in range(1, 6):
        c = t.cell(0, j)
        c.text = ""
        r = c.paragraphs[0].add_run(f"IMPACTO {j}")
        r.bold = True
        r.font.size = Pt(7.5)
        r.font.color.rgb = RGBColor(255, 255, 255)
        c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        _sombra(c, "0B2A4A")
    for i, prob in enumerate(range(5, 0, -1), 1):
        h = t.cell(i, 0)
        h.text = ""
        r = h.paragraphs[0].add_run(f"PROB. {prob}")
        r.bold = True
        r.font.size = Pt(7.5)
        r.font.color.rgb = RGBColor(255, 255, 255)
        _sombra(h, "0B2A4A")
        for j in range(1, 6):
            nivel = prob * j
            c = t.cell(i, j)
            c.text = ""
            r = c.paragraphs[0].add_run(f"{nivel}")
            r.font.size = Pt(9)
            r.bold = True
            c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            _sombra(c, "FFD6D0" if nivel >= 15 else ("FFEB9C" if nivel >= 8 else "C6EFCE"))
    p_ = d.add_paragraph()
    r = p_.add_run("Nivel = probabilidad x impacto.  ALTO >= 15 (coral)  ·  MEDIO 8 a 14 (ámbar)  ·  BAJO < 8 (verde). Escribe en cada celda el número de riesgos que caen ahí.")
    r.font.size = Pt(8)
    r.font.color.rgb = GRIS


def minuta_comite():
    d = doc_base("Minuta ejecutiva de comité", "Decisiones, acuerdos y compromisos con responsable y fecha", "FO-DIR-02")
    tarjetas(d, [("Comité", "[NOMBRE]", "F4F8FA"), ("Fecha y hora", "[FECHA · HORA]", "F4F8FA"), ("Acuerdos", "[ # ]", "F4F8FA"), ("Pendientes vencidos", "[ # ]", "FFF3F0")])
    nota(d, "Propósito", "Registrar solo lo que cambia la operación: decisiones tomadas, acuerdos con responsable y fecha, y los temas que pasan a la siguiente sesión.")
    seccion(d, "1. Asistentes")
    tabla_datos(d, ("Nombre", "Puesto / área", "Asistencia", "Firma"), 6, (5.5, 5, 2.5, 3.5))
    seccion(d, "2. Orden del día")
    vinetas(d, ["[Tema 1 y responsable].", "[Tema 2 y responsable].", "[Tema 3 y responsable]."])
    seccion(d, "3. Decisiones tomadas")
    tabla_datos(d, ("Decisión", "Contexto breve", "Quién decidió", "Impacto"), 4, (5.5, 5, 3, 3))
    seccion(d, "4. Acuerdos y compromisos")
    tabla_datos(d, ("No.", "Acuerdo", "Responsable", "Fecha límite", "Semáforo"), 6, (1.2, 7, 3.2, 2.6, 2.5))
    seccion(d, "5. Temas para la siguiente sesión")
    tabla_datos(d, ("Tema", "Responsable", "Información requerida"), 3, (6.5, 4, 6))
    firmas(d, ["Presidente del comité", "Secretario"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "05_Minuta_Ejecutiva_de_Comite", "7_Control_Directivo")


def formato_autorizacion():
    d = doc_base("Solicitud de autorización", "Gasto, compra, contratación o cambio de alcance", "FO-DIR-03")
    tarjetas(d, [("Monto solicitado", "$[ MONTO ]", "F4F8FA"), ("Presupuesto disponible", "$[ MONTO ]", "F4F8FA"), ("Urgencia", "[ALTA/MEDIA/BAJA]", "FFF8E1"), ("Folio", "[AUT-0000]", "F4F8FA")])
    seccion(d, "1. Datos de la solicitud")
    tabla_datos(d, ("Campo", "Detalle"), 6, (4.5, 12), [
        ("Solicitante y área", "[NOMBRE · ÁREA]"), ("Tipo de solicitud", "[Gasto / Compra / Contratación / Cambio de alcance]"),
        ("Descripción", "[QUÉ SE SOLICITA]"), ("Proyecto o centro de costo", "[CLAVE · NOMBRE]"),
        ("Proveedor propuesto", "[NOMBRE · RFC]"), ("Fecha requerida", "[DD/MM/AAAA]")])
    seccion(d, "2. Justificación")
    par(d, "[Por qué se necesita, qué problema resuelve y qué ocurre si no se autoriza.]")
    seccion(d, "3. Opciones evaluadas")
    tabla_datos(d, ("Opción", "Costo", "Ventajas", "Riesgos"), 3, (4, 3, 5, 4.5), [("[A] Opción recomendada", "$[ ]", "[ ]", "[ ]"), ("[B]", "$[ ]", "[ ]", "[ ]"), ("[C]", "$[ ]", "[ ]", "[ ]")])
    nota(d, "Recomendación", "[Opción recomendada y razón en una frase.]", color="C9A227", fondo="FFF8E1")
    seccion(d, "4. Niveles de autorización")
    tabla_datos(d, ("Nivel", "Nombre y puesto", "Decisión", "Fecha", "Firma"), 3, (3, 5, 3.5, 2.2, 2.8), [
        ("Jefe de área", "[ ]", "☐ Autoriza  ☐ Rechaza  ☐ Aplaza", "[ ]", ""), ("Finanzas", "[ ]", "☐ Autoriza  ☐ Rechaza  ☐ Aplaza", "[ ]", ""),
        ("Dirección", "[ ]", "☐ Autoriza  ☐ Rechaza  ☐ Aplaza", "[ ]", "")])
    aviso(d)
    guardar(d, "06_Solicitud_de_Autorizacion", "7_Control_Directivo")


def reporte_proyecto():
    d = nuevo()
    d.sections[0].top_margin = Cm(1.5)
    d.sections[0].bottom_margin = Cm(1.4)
    titulo(d, "Reporte de proyecto", "Resumen de una página: avance, presupuesto, riesgos y decisiones")
    tarjetas(d, [("Avance real / plan", "[ % ] / [ % ]", "F4F8FA"), ("Presupuesto ejercido", "[ % ]", "F4F8FA"), ("Desviación", "[ ± días ]", "F4F8FA"), ("Semáforo", "[COLOR]", "FFF8E1")])
    seccion(d, "Resumen ejecutivo")
    par(d, "[Qué se logró, dónde está la desviación y qué se necesita de dirección. Máximo 3 líneas.]")
    seccion(d, "Hitos")
    tabla_datos(d, ("Hito", "Fecha plan", "Fecha real", "Avance", "Semáforo"), 3, (6.5, 2.7, 2.7, 2, 2.6))
    seccion(d, "Riesgos principales")
    tabla_datos(d, ("Riesgo", "Nivel", "Mitigación", "Responsable"), 2, (5.5, 2, 6, 3))
    seccion(d, "Pendientes y decisiones requeridas")
    tabla_datos(d, ("Pendiente / decisión", "Responsable", "Fecha requerida", "Estatus"), 2, (7, 3.5, 3, 3))
    seccion(d, "Próximos pasos")
    vinetas(d, ["[Próximo paso 1 · responsable · fecha].", "[Próximo paso 2 · responsable · fecha]."])
    for p_ in d.paragraphs:  # compactar separadores vacíos para que quepa en una sola página
        if not p_.text.strip():
            p_.paragraph_format.space_after = Pt(0)
            p_.paragraph_format.line_spacing = Pt(5)
    guardar(d, "07_Reporte_de_Proyecto_Una_Pagina", "7_Control_Directivo")

def reporte_riesgos():
    d = doc_base("Reporte de riesgos", "Matriz de calor, riesgos prioritarios y plan de mitigación", "FO-DIR-05")
    tarjetas(d, [("Riesgos altos", "[ # ]", "FFF3F0"), ("Riesgos medios", "[ # ]", "FFF8E1"), ("Riesgos bajos", "[ # ]", "F1FAF3"), ("Mitigaciones vencidas", "[ # ]", "F4F8FA")])
    seccion(d, "Matriz de riesgos")
    matriz_riesgos(d)
    d.add_paragraph()
    seccion(d, "Registro de riesgos prioritarios")
    tabla_datos(d, ("Riesgo", "P", "I", "Nivel", "Mitigación", "Responsable", "Fecha"), 6, (4.4, 0.9, 0.9, 1.4, 4.2, 2.9, 1.8))
    seccion(d, "Decisiones requeridas")
    tabla_datos(d, ("Decisión", "Opciones", "Recomendación"), 3, (5.5, 5.5, 5.5))
    aviso(d)
    guardar(d, "08_Reporte_de_Riesgos", "7_Control_Directivo")


def cierre_administrativo():
    d = doc_base("Cierre administrativo de proyecto", "Lista de cierre con responsable, evidencia y fecha", "FO-DIR-06")
    nota(d, "Principio", "Un proyecto no termina al entregar: termina al cerrar bien, con cifras conciliadas, pendientes en cero y expediente completo.")
    secciones = [("Entregables y cliente", ["Acta de entrega-recepción firmada", "Aceptación del cliente por escrito", "Garantías y manuales entregados"]),
                 ("Finanzas", ["Facturación final emitida", "Cobranza pendiente conciliada", "Presupuesto vs. real cerrado y explicado", "Anticipos y retenciones liberados"]),
                 ("Compras y contratos", ["Órdenes de compra cerradas", "Finiquitos de subcontratistas firmados", "Pagos a proveedores conciliados"]),
                 ("Personal", ["Altas y bajas del proyecto en el IMSS", "Finiquitos y liquidaciones", "Evaluación del equipo"]),
                 ("Documentación", ["Expediente final digitalizado", "Lecciones aprendidas documentadas", "Informe de cierre a dirección"])]
    for tit, items in secciones:
        seccion(d, tit)
        t = tabla(d, ["Actividad de cierre", "Responsable", "Evidencia", "Fecha", "Listo (✔)"], len(items), [5.5, 3, 4, 2, 2])
        for i, it in enumerate(items, 1):
            t.cell(i, 0).text = ""
            runs(t.cell(i, 0).paragraphs[0], it)
            for x in t.cell(i, 0).paragraphs[0].runs:
                x.font.size = Pt(9.5)
        d.add_paragraph()
    firmas(d, ["Responsable del proyecto", "Finanzas", "Dirección"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "09_Cierre_Administrativo_de_Proyecto", "7_Control_Directivo")


# ---------------------------------------------------------------- PROPUESTA COMERCIAL EJECUTIVA
def portada_ejecutiva(d, etiqueta, titulo_, subtitulo_, datos):
    """Portada de página completa: bloque azul marino con título, línea dorada y tres datos clave."""
    encabezado_empresa(d)
    for _ in range(3):
        d.add_paragraph()
    tb = d.add_table(rows=1, cols=1)
    tb.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = tb.cell(0, 0)
    c.width = Cm(16.5)
    tr = tb.rows[0]._tr
    h = OxmlElement("w:trHeight")
    h.set(qn("w:val"), "6300")
    h.set(qn("w:hRule"), "exact")
    tr.get_or_add_trPr().append(h)
    _sombra(c, "0B2A4A")
    _margenes(c, 300, 300, 500, 400)
    tcPr = c._tc.get_or_add_tcPr()
    va = OxmlElement("w:vAlign")
    va.set(qn("w:val"), "center")
    tcPr.append(va)
    b = OxmlElement("w:tcBorders")
    for lado in ("top", "left", "right"):
        e = OxmlElement(f"w:{lado}")
        e.set(qn("w:val"), "nil")
        b.append(e)
    e = OxmlElement("w:bottom")
    e.set(qn("w:val"), "single")
    e.set(qn("w:sz"), "48")
    e.set(qn("w:color"), ORO)
    b.append(e)
    tcPr.append(b)
    p1 = c.paragraphs[0]
    r = p1.add_run(etiqueta.upper())
    r.bold = True
    r.font.size = Pt(10)
    r.font.color.rgb = RGBColor(0xC9, 0xA2, 0x27)
    p2 = c.add_paragraph()
    p2.paragraph_format.space_before = Pt(10)
    r = p2.add_run(titulo_.upper())
    r.bold = True
    r.font.size = Pt(30)
    r.font.color.rgb = RGBColor(255, 255, 255)
    p3 = c.add_paragraph()
    p3.paragraph_format.space_before = Pt(8)
    r = p3.add_run(subtitulo_)
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0xC9, 0xD3, 0xDB)
    d.add_paragraph()
    t = d.add_table(rows=2, cols=len(datos))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for j, (etq, val) in enumerate(datos):
        a_, b_ = t.cell(0, j), t.cell(1, j)
        a_.text, b_.text = "", ""
        r = a_.paragraphs[0].add_run(etq.upper())
        r.bold = True
        r.font.size = Pt(8)
        r.font.color.rgb = PETROL
        runs(b_.paragraphs[0], val)
        for x in b_.paragraphs[0].runs:
            x.font.size = Pt(12)
            x.bold = True
        _sombra(a_, "F4F8FA")
        _sombra(b_, "F4F8FA")
    d.add_page_break()


def comparativo_paquetes(d):
    """Tabla premium de tres paquetes con la opción recomendada destacada en dorado."""
    cols = ["", "ESENCIAL", "PROFESIONAL", "ESTRATÉGICO"]
    filas_ = [("Alcance", "[Diagnóstico y plan]", "[Diagnóstico + controles + tablero]", "[Implementación integral]"),
              ("Libro de control operativo", "✔", "✔", "✔"), ("Tablero ejecutivo semanal", "—", "✔", "✔"),
              ("Reporte semanal a dirección", "—", "✔", "✔"), ("Integración de compras y proyectos", "—", "—", "✔"),
              ("Capacitación al equipo", "[1 sesión]", "[2 sesiones]", "[4 sesiones]"), ("Soporte posterior", "—", "[1 mes]", "[3 meses]"),
              ("Tiempo de entrega", "[4 semanas]", "[6 semanas]", "[8 semanas]"), ("Inversión (antes de IVA)", "$[MONTO]", "$[MONTO]", "$[MONTO]")]
    t = d.add_table(rows=len(filas_) + 2, cols=4)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    for i, w in enumerate((5.2, 3.7, 4.1, 3.7)):
        t.columns[i].width = Cm(w)
    # cinta "RECOMENDADO"
    for j in range(4):
        c = t.cell(0, j)
        c.text = ""
        c.width = Cm((5.2, 3.7, 4.1, 3.7)[j])
        if j == 2:
            r = c.paragraphs[0].add_run("★ RECOMENDADO")
            r.bold = True
            r.font.size = Pt(8.5)
            r.font.color.rgb = AZUL
            c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            _sombra(c, "C9A227")
    for j, nom in enumerate(cols):
        c = t.cell(1, j)
        c.text = ""
        c.width = Cm((5.2, 3.7, 4.1, 3.7)[j])
        r = c.paragraphs[0].add_run(nom)
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = AZUL if j == 2 else RGBColor(255, 255, 255)
        c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        _sombra(c, "C9A227" if j == 2 else "0B2A4A")
        _margenes(c, 120, 120, 100, 100)
    for i, fila in enumerate(filas_, 2):
        ult = i == len(filas_) + 1
        for j, v in enumerate(fila):
            c = t.cell(i, j)
            c.text = ""
            c.width = Cm((5.2, 3.7, 4.1, 3.7)[j])
            runs(c.paragraphs[0], v)
            _margenes(c, 80, 80, 120, 100)
            for x in c.paragraphs[0].runs:
                x.font.size = Pt(12 if ult else 9.5)
                x.bold = j == 0 or ult
                if v == "✔":
                    x.font.color.rgb = PETROL
                if v == "—":
                    x.font.color.rgb = RGBColor(0xA6, 0xB3, 0xBF)
            if j:
                c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            _sombra(c, "FFF4CC" if j == 2 else ("E6ECF1" if ult else ("F7F9FB" if i % 2 else "FFFFFF")))
    tblPr = t._tbl.tblPr
    bs = OxmlElement("w:tblBorders")
    for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{lado}")
        e.set(qn("w:val"), "single")
        e.set(qn("w:sz"), "4")
        e.set(qn("w:color"), "D9DEE3")
        bs.append(e)
    tblPr.append(bs)
    d.add_paragraph()


def propuesta_comercial():
    d = nuevo()
    d.sections[0].header.paragraphs[0].text = ""
    portada_ejecutiva(d, "Propuesta comercial", "Propuesta de servicios", "[NOMBRE DEL PROYECTO] · Preparada para [NOMBRE DEL CLIENTE]",
                      [("Fecha", "[DD/MM/AAAA]"), ("Folio", "[PC-0000]"), ("Vigencia", "[15 días]")])
    h = d.sections[0].header.paragraphs[0]
    rr = h.add_run("PROPUESTA COMERCIAL")
    rr.font.size = Pt(7.5)
    rr.font.color.rgb = GRIS
    seccion(d, "1. Resumen ejecutivo")
    nota(d, "En una frase", "[Qué resolvemos, en cuánto tiempo y con qué resultado medible para [CLIENTE].]", color="C9A227", fondo="FFF8E1")
    vinetas(d, ["**Problema:** [lo que hoy le cuesta al cliente: tiempo, dinero, riesgo].", "**Solución:** [qué implementaremos].", "**Resultado:** [qué podrá hacer el cliente al terminar]."])
    seccion(d, "2. El reto del cliente")
    tarjetas(d, [("Situación actual", "[ ]", "F4F8FA"), ("Impacto", "[ ]", "FFF3F0"), ("Riesgo", "[ ]", "FFF8E1"), ("Oportunidad", "[ ]", "F1FAF3")])
    par(d, "[Describe en 3 a 5 líneas la situación del cliente con sus propias palabras: qué intentó, qué no funcionó y qué está en juego.]")
    seccion(d, "3. Solución y metodología")
    par(d, "Trabajamos con un método de cuatro pasos que convierte el desorden en control y asegura que cada proyecto termine con evidencia.")
    t = d.add_table(rows=2, cols=4)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for j, (tit, color, txt) in enumerate([("1 · ORDENAR", "0B2A4A", "Procesos, documentos y responsables."), ("2 · PLANEAR", "0E7C8B", "Prioridades, calendario y riesgos."),
                                           ("3 · EJECUTAR", "C9A227", "Controles y seguimiento semanal."), ("4 · CERRAR", "E8604C", "Entregables, cifras y expediente final.")]):
        a_, b_ = t.cell(0, j), t.cell(1, j)
        a_.text, b_.text = "", ""
        r = a_.paragraphs[0].add_run(tit)
        r.bold = True
        r.font.size = Pt(10.5)
        r.font.color.rgb = RGBColor(255, 255, 255) if color != "C9A227" else AZUL
        a_.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        _sombra(a_, color)
        _margenes(a_, 100, 100, 80, 80)
        rr = b_.paragraphs[0].add_run(txt)
        rr.font.size = Pt(9)
        _sombra(b_, "F4F6F8")
        _margenes(b_, 100, 100, 120, 100)
    d.add_paragraph()
    seccion(d, "4. Alcance y entregables")
    tabla_datos(d, ("Entregable", "Descripción", "Fase", "Formato"), 5, (4.5, 7, 2, 3), [
        ("[Informe de diagnóstico]", "[Hallazgos, brechas y prioridades]", "Ordenar", "PDF"), ("[Plan de trabajo]", "[Actividades, responsables y fechas]", "Planear", "Excel"),
        ("[Libro de control]", "[Seguimiento semanal con semáforos]", "Ejecutar", "Excel"), ("[Reporte semanal]", "[Resumen para dirección]", "Ejecutar", "Word / PDF"),
        ("[Informe de cierre]", "[Resultados y plan a 90 días]", "Cerrar", "PDF")])
    seccion(d, "5. Calendario de implementación")
    tabla_datos(d, ("Semana", "Actividades principales", "Entregable", "Responsable"), 4, (2.5, 7, 4, 3), [
        ("Semana 1", "[Arranque, diagnóstico y recepción de documentos]", "[Informe de diagnóstico]", "[ ]"), ("Semana 2", "[Priorización, responsables y calendario]", "[Plan firmado]", "[ ]"),
        ("Semana 3", "[Operación con controles y capacitación]", "[Primer reporte semanal]", "[ ]"), ("Semana 4", "[Cierre, procedimientos y plan a 90 días]", "[Expediente final]", "[ ]")])
    seccion(d, "6. Inversión: elige tu paquete")
    comparativo_paquetes(d)
    nota(d, "Por qué recomendamos el paquete profesional", "[Una razón concreta: equilibra alcance e inversión y cubre el riesgo principal del cliente.]", color="C9A227", fondo="FFF8E1")
    seccion(d, "7. Beneficios para su empresa")
    tarjetas(d, [("Menos retrabajo", "[ ]", "F4F8FA"), ("Control documental", "[ ]", "F4F8FA"), ("Decisiones con información", "[ ]", "F4F8FA")])
    seccion(d, "8. Condiciones comerciales y exclusiones")
    tabla_datos(d, ("Condición", "Detalle"), 6, (4.5, 12), [
        ("Forma de pago", "[40% anticipo · 30% avance · 30% cierre]"), ("Vigencia", "[15 días naturales]"), ("Precios", "[Pesos mexicanos (MXN) más IVA]"),
        ("Exclusiones", "[Lo que no incluye la propuesta]"), ("Supuestos", "[Accesos, información y responsables del cliente]"), ("Cambios de alcance", "[Se cotizan por separado y requieren autorización]")])
    seccion(d, "9. Próximo paso")
    t = d.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = t.cell(0, 0)
    c.width = Cm(16.5)
    _sombra(c, "0B2A4A")
    _margenes(c, 200, 200, 300, 300)
    p1 = c.paragraphs[0]
    r = p1.add_run("AGENDEMOS EL ARRANQUE")
    r.bold = True
    r.font.size = Pt(14)
    r.font.color.rgb = RGBColor(0xC9, 0xA2, 0x27)
    p2 = c.add_paragraph()
    r2 = p2.add_run("Elige tu paquete, firma la aceptación y fijamos la reunión de arranque.")
    r2.font.size = Pt(10.5)
    r2.font.color.rgb = RGBColor(255, 255, 255)
    p3 = c.add_paragraph()
    r3 = p3.add_run("Contacto: [NOMBRE]  ·  [TELÉFONO]  ·  [CORREO]")
    r3.font.size = Pt(10.5)
    r3.bold = True
    r3.font.color.rgb = RGBColor(0xE6, 0xD9, 0xA6)
    d.add_paragraph()
    seccion(d, "Aceptación de la propuesta")
    par(d, "Paquete elegido:   ☐ Esencial     ☐ Profesional     ☐ Estratégico", align=WD_ALIGN_PARAGRAPH.LEFT)
    firmas(d, ["Por el cliente", "Por el prestador"])
    d.add_paragraph()
    aviso(d)
    guardar(d, "02_Propuesta_Comercial_Ejecutiva", "8_Propuestas_y_Presupuestos")


if __name__ == "__main__":
    for f in (contrato_servicios, carta_renuncia, constancia_laboral, carta_cobranza, acta_entrega,
              acta_administrativa, contrato_confidencialidad, carta_poder,
              manual_caja_chica, politica_compras, politica_viaticos, reglamento_asistencia,
              procedimiento_inventarios, checklist_alta,
              reporte_semanal, plan_30_dias, modelo_operativo,
              minuta_comite, formato_autorizacion, reporte_proyecto, reporte_riesgos, cierre_administrativo,
              propuesta_comercial):
        f()
