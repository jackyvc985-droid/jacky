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
    st.font.name = "Calibri"
    st.font.size = Pt(11)
    st.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
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
    r = p.add_run(nombre + ". ")
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
    os.makedirs(OUT, exist_ok=True)
    d.save(os.path.join(OUT, nombre + ".docx"))
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


if __name__ == "__main__":
    for f in (contrato_servicios, carta_renuncia, constancia_laboral, carta_cobranza, acta_entrega,
              acta_administrativa, contrato_confidencialidad, carta_poder):
        f()
