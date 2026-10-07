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
PETROL = RGBColor(0x1B, 0x6B, 0x73)  # verde petróleo
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
    st.font.name = "Abadi"
    st.font.size = Pt(11)
    st.element.rPr.rFonts.set(qn("w:eastAsia"), "Abadi")
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


def titulo(d, t, sub=None):
    encabezado_empresa(d)
    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(t.upper())
    r.bold = True
    r.font.size = Pt(18)
    r.font.color.rgb = AZUL
    p.paragraph_format.space_after = Pt(10)
    borde_parrafo(p)
    if sub:
        q = d.add_paragraph()
        q.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = q.add_run(sub)
        r.italic = True
        r.font.color.rgb = GRIS


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


def guardar(d, nombre):
    carpeta = OUT if int(nombre[:2]) < 9 else OUT.replace("5_Documentos_Word", "6_Politicas_y_Procedimientos")
    os.makedirs(carpeta, exist_ok=True)
    d.save(os.path.join(carpeta, nombre + ".docx"))
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
    guardar(d, "09_Manual_de_Procedimiento_de_Caja_Chica")


def politica_compras():
    d = doc_base("Política de compras y adquisiciones", "Lineamientos para solicitar, cotizar, autorizar y recibir bienes y servicios", "PO-COM-01")
    seccion(d, "1. Objetivo")
    par(d, "Garantizar que las compras de [NOMBRE DE LA EMPRESA] se realicen con las mejores condiciones de precio, calidad y servicio, con transparencia, "
           "autorización adecuada y soporte documental.")
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
    guardar(d, "10_Politica_de_Compras_y_Adquisiciones")


def politica_viaticos():
    d = doc_base("Política de viáticos y gastos de viaje", "Lineamientos de solicitud, límites, comprobación y reembolso", "PO-FIN-02")
    seccion(d, "1. Objetivo")
    par(d, "Regular el otorgamiento, uso y comprobación de viáticos y gastos de viaje del personal de [NOMBRE DE LA EMPRESA], asegurando que sean razonables, "
           "necesarios y deducibles.")
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
    guardar(d, "11_Politica_de_Viaticos_y_Gastos_de_Viaje")


def reglamento_asistencia():
    d = doc_base("Política de asistencia y puntualidad", "Horarios, retardos, faltas, permisos y registro de asistencia", "PO-RH-03")
    seccion(d, "1. Objetivo")
    par(d, "Establecer las reglas de asistencia, puntualidad y permanencia de los colaboradores de [NOMBRE DE LA EMPRESA], para asegurar la continuidad de la operación "
           "y la equidad en el trato al personal.")
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
    guardar(d, "12_Politica_de_Asistencia_y_Puntualidad")


def procedimiento_inventarios():
    d = doc_base("Procedimiento de control de inventarios", "Recepción, resguardo, salidas, conteos físicos y ajustes", "PR-ALM-01")
    seccion(d, "1. Objetivo")
    par(d, "Definir las actividades para recibir, almacenar, entregar y controlar los inventarios de [NOMBRE DE LA EMPRESA], asegurando que las existencias en sistema "
           "coincidan con las físicas y que las diferencias se investiguen y corrijan.")
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
    guardar(d, "13_Procedimiento_de_Control_de_Inventarios")


def checklist_alta():
    d = doc_base("Checklist de alta de nuevo colaborador", "Documentación, accesos, capacitación y seguimiento del primer mes", "FO-RH-04")
    par(d, "Colaborador: [NOMBRE COMPLETO]    Puesto: [PUESTO]    Área: [ÁREA]    Fecha de ingreso: [FECHA]", align=WD_ALIGN_PARAGRAPH.LEFT)
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
    guardar(d, "14_Checklist_de_Alta_de_Colaborador")


if __name__ == "__main__":
    for f in (contrato_servicios, carta_renuncia, constancia_laboral, carta_cobranza, acta_entrega,
              acta_administrativa, contrato_confidencialidad, carta_poder,
              manual_caja_chica, politica_compras, politica_viaticos, reglamento_asistencia,
              procedimiento_inventarios, checklist_alta):
        f()
