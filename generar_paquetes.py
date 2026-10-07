#!/usr/bin/env python3
"""Genera vistas previas (PNG), portadas de producto (PNG) y paquetes ZIP.
Requiere: LibreOffice (soffice), pdftoppm, Pillow. Ejecutar después de generar_plantillas.py
y generar_documentos_word.py."""
import os, shutil, subprocess, tempfile, zipfile
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

RAIZ = os.path.dirname(os.path.abspath(__file__))
PLANT = os.path.join(RAIZ, "plantillas")
PREV = os.path.join(RAIZ, "vistas_previas")
PORT = os.path.join(RAIZ, "portadas")
ZIPS = os.path.join(RAIZ, "paquetes_zip")
MARCA = "FORMATOS ADMINISTRATIVOS"  # etiqueta genérica, sin marca
CATEGORIAS = {
    "1_Contabilidad_y_Finanzas": ("Contabilidad y Finanzas", "Excel"),
    "2_Recursos_Humanos": ("Recursos Humanos", "Excel"),
    "3_Inventarios_y_Compras": ("Inventarios y Compras", "Excel"),
    "4_Documentos_y_Actas": ("Documentos y Actas", "Excel"),
    "5_Documentos_Word": ("Contratos, Cartas y Actas", "Word"),
    "6_Politicas_y_Procedimientos": ("Políticas y Procedimientos", "Word"),
    "7_Control_Directivo": ("Control Directivo", "Excel y Word"),
}


def _ruta_fuente(familia):
    try:
        r = subprocess.run(["fc-match", "-f", "%{file}", familia], capture_output=True, text=True).stdout.strip()
        return r if os.path.exists(r) else None
    except Exception:
        return None


FUENTES = {False: _ruta_fuente("Inter:medium") or "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
           True: _ruta_fuente("Inter:bold") or "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"}


def fuente(tam, bold=False):
    try:
        f = ImageFont.truetype(FUENTES[bold], tam)
        if bold and FUENTES[True].lower().endswith(".otf") is False:
            pass
        return f
    except Exception:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", tam)


ACENTOS = {"Dias": "Días", "Implementacion": "Implementación", "Modelo Operativo Ordenar Planear Ejecutar Cerrar": "Modelo Operativo: Ordenar, Planear, Ejecutar, Cerrar", "Nomina": "Nómina", "Conciliacion": "Conciliación", "Evaluacion": "Evaluación", "Desempeno": "Desempeño",
           "Cotizacion": "Cotización", "Minuta de Reunion": "Minuta de Reunión", "Prestacion": "Prestación",
           "Entrega Recepcion": "Entrega-Recepción", "Politica": "Política", "Politicas": "Políticas", "Viaticos": "Viáticos",
           "Asistencia y Puntualidad": "Asistencia y Puntualidad", "Procedimiento de Control de Inventarios": "Procedimiento de Control de Inventarios",
           "Ejecutivo": "Ejecutivo", "Colaborador": "Colaborador", "Compras y Adquisiciones": "Compras y Adquisiciones"}


def bonito(archivo):
    t = os.path.splitext(archivo)[0].split("_", 1)[1].replace("_", " ")
    for a, b in ACENTOS.items():
        t = t.replace(a, b)
    return t


def listar(cat):
    return sorted(f for f in os.listdir(os.path.join(PLANT, cat)) if f.endswith((".xlsx", ".docx")))


def pagina_con_texto(pdf, texto):
    """Número de página (1-based) del PDF cuyo texto contiene `texto`, o None."""
    info = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    n = int(next(l.split()[-1] for l in info.splitlines() if l.startswith("Pages:")))
    for pg in range(1, n + 1):
        t = subprocess.run(["pdftotext", "-f", str(pg), "-l", str(pg), pdf, "-"], capture_output=True, text=True).stdout
        if texto in t:
            return pg
    return None


PISTA_FORMATO = {"01_Control_Operativo_Semanal": "ACTIVIDADES DE LA SEMANA"}
PISTAS_RESUMEN = ("RESUMEN D", "TABLERO EJECUTIVO")


def vistas_previas():
    """Usa la versión con datos de ejemplo si existe. Excel: página 1 = portada (_portada.png),
    página 2 = formato, y el tablero Resumen (_resumen.png) si lo tiene. Word: página 1."""
    shutil.rmtree(PREV, ignore_errors=True)
    for cat in CATEGORIAS:
        os.makedirs(os.path.join(PREV, cat))
        with tempfile.TemporaryDirectory() as tmp:
            for f in listar(cat):
                base = os.path.splitext(f)[0]
                origen = os.path.join(PLANT, cat, f)
                ej = os.path.join(RAIZ, "ejemplos", cat, base + "_EJEMPLO.xlsx")
                if os.path.exists(ej):
                    origen = ej
                subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", tmp, origen], capture_output=True)
                pdf = os.path.join(tmp, os.path.basename(origen).rsplit(".", 1)[0] + ".pdf")
                destino = os.path.join(PREV, cat, base)
                pag = 2 if f.endswith(".xlsx") else 1
                if base in PISTA_FORMATO:
                    pag = pagina_con_texto(pdf, PISTA_FORMATO[base]) or pag
                subprocess.run(["pdftoppm", "-png", "-r", "110", "-f", str(pag), "-l", str(pag), "-singlefile",
                                pdf, destino], check=True)
                if f.endswith(".xlsx"):
                    subprocess.run(["pdftoppm", "-png", "-r", "70", "-f", "1", "-l", "1", "-singlefile",
                                    pdf, destino + "_portada"], check=True)
                    pr = next((x for x in (pagina_con_texto(pdf, t_) for t_ in PISTAS_RESUMEN) if x), None)
                    if pr:
                        subprocess.run(["pdftoppm", "-png", "-r", "110", "-f", str(pr), "-l", str(pr), "-singlefile",
                                        pdf, destino + "_resumen"], check=True)


def recortar(im):
    fondo = Image.new(im.mode, im.size, (255, 255, 255))
    bbox = ImageChops.difference(im, fondo).getbbox()
    return im.crop(bbox) if bbox else im


NAVY, NAVY2, GOLD = (8, 30, 54), (19, 74, 108), (201, 162, 39)


def fondo(W, H):
    g = Image.linear_gradient("L").resize((W, H))
    im = ImageOps.colorize(g, NAVY, NAVY2).convert("RGBA")
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.ellipse([W - 470, -260, W + 260, 470], fill=(201, 162, 39, 34))
    d.ellipse([W - 330, -120, W + 120, 330], outline=(201, 162, 39, 110), width=3)
    d.ellipse([-300, H - 420, 380, H + 260], fill=(255, 255, 255, 12))
    d.ellipse([-180, H - 300, 240, H + 120], outline=(255, 255, 255, 40), width=2)
    return Image.alpha_composite(im, ov)


def foto(ruta, alto, angulo=0):
    x = recortar(Image.open(ruta).convert("RGB"))
    x = x.resize((max(1, int(x.width * alto / x.height)), alto), Image.LANCZOS)
    if x.width > 640:
        x = x.resize((640, int(x.height * 640 / x.width)), Image.LANCZOS)
    w, h = x.size
    marco = Image.new("RGBA", (w + 4, h + 4), (255, 255, 255, 255))
    marco.paste(x, (2, 2))
    pad = 70
    lienzo = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    sombra = Image.new("RGBA", marco.size, (0, 0, 0, 150))
    lienzo.paste(sombra, (pad + 8, pad + 18))
    lienzo = lienzo.filter(ImageFilter.GaussianBlur(16))
    lienzo.alpha_composite(marco, (pad, pad))
    if angulo:
        lienzo = lienzo.rotate(angulo, expand=True, resample=Image.BICUBIC)
    return lienzo


def ajustar_texto(d, texto, fuente_, ancho_max):
    lineas, actual = [], ""
    for palabra in texto.split():
        prueba = (actual + " " + palabra).strip()
        if d.textlength(prueba, font=fuente_) <= ancho_max or not actual:
            actual = prueba
        else:
            lineas.append(actual)
            actual = palabra
    if actual:
        lineas.append(actual)
    return lineas


def portada_generica(nombre_archivo, carpeta, categoria, titulo, subtitulo, chips, muestras, insignia=None, bullets=None):
    W = H = 1200
    im = fondo(W, H)
    d = ImageDraw.Draw(im)
    d.rectangle([80, 78, 92, 112], fill=GOLD)
    d.text((110, 80), MARCA, font=fuente(26, True), fill=GOLD)
    d.text((W - 80, 84), categoria.upper(), font=fuente(18, True), fill=(201, 211, 219), anchor="ra")
    # título
    tam = 78 if len(titulo) < 26 else 64
    f_t = fuente(tam, True)
    lineas = ajustar_texto(d, titulo.upper(), f_t, 760)[:3]
    y = 170
    for ln in lineas:
        d.text((80, y), ln, font=f_t, fill=(255, 255, 255))
        y += int(tam * 1.12)
    d.rectangle([80, y + 14, 220, y + 20], fill=GOLD)
    d.text((80, y + 44), subtitulo, font=fuente(26), fill=(201, 211, 219))
    y_chip = y + 110
    if bullets:
        for k, b in enumerate(bullets):
            d.rectangle([80, y_chip + k * 46 + 9, 94, y_chip + k * 46 + 23], fill=GOLD)
            d.text((112, y_chip + k * 46), b, font=fuente(24, True), fill=(255, 255, 255))
        y_fin = y_chip + len(bullets) * 46
    else:
        x = 80
        for c in chips:
            w = d.textlength(c, font=fuente(17, True)) + 40
            d.rounded_rectangle([x, y_chip, x + w, y_chip + 42], radius=21, outline=GOLD, width=2)
            d.text((x + 20, y_chip + 10), c, font=fuente(17, True), fill=GOLD)
            x += w + 14
        y_fin = y_chip + 42
    # collage inferior
    base = max(y_fin + 50, 600)
    fotos = []
    if len(muestras) == 1:
        fotos = [(foto(muestras[0], 700, 0), 0.5)]
    elif len(muestras) == 2:
        fotos = [(foto(muestras[0], 430, 5), 0.30), (foto(muestras[1], 430, -5), 0.70)]
    else:
        fotos = [(foto(muestras[0], 400, 6), 0.22), (foto(muestras[2], 400, -6), 0.78), (foto(muestras[1], 450, 0), 0.50)]
    orden = sorted(fotos, key=lambda f: abs(f[1] - 0.5), reverse=True)  # el central al frente
    for ft, cx in orden:
        px = int(W * cx - ft.width / 2)
        py = (base - 80 if len(fotos) == 1 else base - 20) if ft is not fotos[-1][0] or len(fotos) < 3 else base - 60
        im.alpha_composite(ft, (max(-60, min(px, W - ft.width + 60)), py))
    # insignia
    if insignia:
        n, txt = insignia
        cx, cy, r = W - 190, 330, 100
        d = ImageDraw.Draw(im)
        d.ellipse([cx - r - 10, cy - r - 10, cx + r + 10, cy + r + 10], outline=(255, 255, 255, 90), width=2)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD)
        d.text((cx, cy - 18), str(n), font=fuente(70, True), fill=NAVY, anchor="mm")
        d.text((cx, cy + 40), txt.upper(), font=fuente(17, True), fill=NAVY, anchor="mm")
    # pie
    d = ImageDraw.Draw(im)
    d.rectangle([0, H - 56, W, H], fill=(5, 20, 38))
    d.rectangle([0, H - 56, W, H - 53], fill=GOLD)
    d.text((W // 2, H - 24), "EDITABLE  ·  LISTO PARA IMPRIMIR  ·  PARA EMPRESAS EN MÉXICO", font=fuente(17, True), fill=(201, 211, 219), anchor="mm")
    os.makedirs(os.path.join(RAIZ, carpeta), exist_ok=True)
    im.convert("RGB").save(os.path.join(RAIZ, carpeta, nombre_archivo + ".png"))


def muestras_de(cat, n=3):
    """Primer formato + hasta 2 tableros (Resumen) si existen; completa con más formatos."""
    bases = [os.path.join(PREV, cat, os.path.splitext(f)[0]) for f in listar(cat)]
    formas = [b + ".png" for b in bases]
    tableros = [b + "_resumen.png" for b in bases if os.path.exists(b + "_resumen.png")]
    elegidas = [formas[0]] + tableros[:2]
    for f in formas[1:]:
        if len(elegidas) >= n:
            break
        elegidas.append(f)
    return elegidas[:n]


def portadas():
    shutil.rmtree(PORT, ignore_errors=True)
    shutil.rmtree(os.path.join(RAIZ, "portadas_productos"), ignore_errors=True)
    todos, mu = 0, []
    for cat, (nombre, fmt) in CATEGORIAS.items():
        n = len(listar(cat))
        todos += n
        m = muestras_de(cat)
        mu.append(m[0])
        chips = (["FÓRMULAS AUTOMÁTICAS", "HOJAS PROTEGIDAS", "CON GRÁFICAS"] if fmt == "Excel" else
                 ["EXCEL + WORD", "SEMÁFOROS", "TABLERO EJECUTIVO"] if "Excel" in fmt else ["EDITABLE EN WORD", "CAMPOS RESALTADOS", "LISTO PARA PDF"])
        portada_generica(cat, "portadas", "Colección profesional", nombre, f"{n} formatos administrativos en {fmt}", chips, m, (n, "formatos"))
    portada_generica("0_Paquete_Completo", "portadas", "Paquete completo", "Paquete administrativo", f"{todos} formatos · Excel y Word",
                     ["EXCEL + WORD", "CON EJEMPLOS", "LISTO PARA USAR"], [mu[0], mu[3], mu[6]], (todos, "formatos"))
    # una portada por producto (para las fichas de la tienda)
    for cat, (nombre, fmt) in CATEGORIAS.items():
        for f in listar(cat):
            base = os.path.splitext(f)[0]
            ruta = os.path.join(PREV, cat, base)
            muestras = [ruta + ".png"] + ([ruta + "_resumen.png"] if os.path.exists(ruta + "_resumen.png") else [])
            if f.endswith(".xlsx"):
                bullets = ["Fórmulas y totales automáticos", "Hojas protegidas y listas desplegables",
                           "Tablero con gráficas" if len(muestras) > 1 else "Portada, ayuda y glosario incluidos"]
            else:
                bullets = ["Campos resaltados para llenar", "Recuadro para tu logotipo", "Editable en Word, listo para PDF"]
            portada_generica(base, "portadas_productos", nombre, bonito(f), f"Formato en {'Excel' if f.endswith('.xlsx') else 'Word'} · México", [], muestras, bullets=bullets)


def entrega_completa():
    """Un solo ZIP con todo: plantillas, ejemplos, portadas de venta y vistas previas."""
    destino = os.path.join(ZIPS, "Entrega_Completa.zip")
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
        for carpeta, nombre in (("plantillas", "1_Plantillas_en_blanco"), ("ejemplos", "2_Ejemplos_con_datos"),
                                ("portadas", "3_Portadas_por_coleccion"), ("portadas_productos", "4_Portadas_por_producto"),
                                ("vistas_previas", "5_Vistas_previas"), ("marketing", "6_Material_de_ventas")):
            base = os.path.join(RAIZ, carpeta)
            for d_, _, fs in os.walk(base):
                for f in fs:
                    ruta = os.path.join(d_, f)
                    z.write(ruta, os.path.join(nombre, os.path.relpath(ruta, base)))


def zips():
    shutil.rmtree(ZIPS, ignore_errors=True)
    os.makedirs(ZIPS)
    for cat in CATEGORIAS:
        with zipfile.ZipFile(os.path.join(ZIPS, cat + ".zip"), "w", zipfile.ZIP_DEFLATED) as z:
            for f in listar(cat):
                z.write(os.path.join(PLANT, cat, f), os.path.join(cat, f))
    with zipfile.ZipFile(os.path.join(ZIPS, "Paquete_Completo.zip"), "w", zipfile.ZIP_DEFLATED) as z:
        for cat in CATEGORIAS:
            for f in listar(cat):
                z.write(os.path.join(PLANT, cat, f), os.path.join(cat, f))
        ej = os.path.join(RAIZ, "ejemplos")  # versiones con datos de ejemplo, como bonus
        for carpeta, _, archivos in os.walk(ej):
            for f in archivos:
                ruta = os.path.join(carpeta, f)
                z.write(ruta, os.path.join("Ejemplos_con_datos", os.path.relpath(ruta, ej)))


if __name__ == "__main__":
    vistas_previas()
    portadas()
    zips()
    entrega_completa()
    print("Listo: vistas_previas/, portadas/, paquetes_zip/")
