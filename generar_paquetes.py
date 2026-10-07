#!/usr/bin/env python3
"""Genera vistas previas (PNG), portadas de producto (PNG) y paquetes ZIP.
Requiere: LibreOffice (soffice), pdftoppm, Pillow. Ejecutar después de generar_plantillas.py
y generar_documentos_word.py."""
import os, shutil, subprocess, tempfile, zipfile
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

RAIZ = os.path.dirname(os.path.abspath(__file__))
PLANT = os.path.join(RAIZ, "plantillas")
PREV = os.path.join(RAIZ, "vistas_previas")
PORT = os.path.join(RAIZ, "portadas")
ZIPS = os.path.join(RAIZ, "paquetes_zip")
MARCA = "GRUPO CANVILLE"
CATEGORIAS = {
    "1_Contabilidad_y_Finanzas": ("Contabilidad y Finanzas", "Excel"),
    "2_Recursos_Humanos": ("Recursos Humanos", "Excel"),
    "3_Inventarios_y_Compras": ("Inventarios y Compras", "Excel"),
    "4_Documentos_y_Actas": ("Documentos y Actas", "Excel"),
    "5_Documentos_Word": ("Contratos, Cartas y Actas", "Word"),
}


def fuente(tam, bold=False):
    n = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/" + n, tam)


ACENTOS = {"Nomina": "Nómina", "Conciliacion": "Conciliación", "Evaluacion": "Evaluación", "Desempeno": "Desempeño",
           "Cotizacion": "Cotización", "Minuta de Reunion": "Minuta de Reunión", "Prestacion": "Prestación",
           "Entrega Recepcion": "Entrega-Recepción"}


def bonito(archivo):
    t = os.path.splitext(archivo)[0].split("_", 1)[1].replace("_", " ")
    for a, b in ACENTOS.items():
        t = t.replace(a, b)
    return t


def listar(cat):
    return sorted(f for f in os.listdir(os.path.join(PLANT, cat)) if f.endswith((".xlsx", ".docx")))


def vistas_previas():
    """Excel: página 1 = portada (_portada.png), página 2 = formato. Word: página 1."""
    shutil.rmtree(PREV, ignore_errors=True)
    for cat in CATEGORIAS:
        os.makedirs(os.path.join(PREV, cat))
        with tempfile.TemporaryDirectory() as tmp:
            for f in listar(cat):
                base = os.path.splitext(f)[0]
                subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", tmp,
                                os.path.join(PLANT, cat, f)], capture_output=True)
                pdf = os.path.join(tmp, base + ".pdf")
                destino = os.path.join(PREV, cat, base)
                pag = 2 if f.endswith(".xlsx") else 1
                subprocess.run(["pdftoppm", "-png", "-r", "110", "-f", str(pag), "-l", str(pag), "-singlefile",
                                pdf, destino], check=True)
                if f.endswith(".xlsx"):
                    subprocess.run(["pdftoppm", "-png", "-r", "70", "-f", "1", "-l", "1", "-singlefile",
                                    pdf, destino + "_portada"], check=True)


def recortar(im):
    fondo = Image.new(im.mode, im.size, (255, 255, 255))
    bbox = ImageChops.difference(im, fondo).getbbox()
    return im.crop(bbox) if bbox else im


def con_sombra(im, borde=6):
    w, h = im.size
    lienzo = Image.new("RGBA", (w + 60, h + 60), (0, 0, 0, 0))
    sombra = Image.new("RGBA", (w, h), (11, 42, 74, 110))
    lienzo.paste(sombra, (30 + 6, 30 + 10))
    lienzo = lienzo.filter(ImageFilter.GaussianBlur(10))
    marco = Image.new("RGB", (w + 2, h + 2), (201, 211, 219))
    marco.paste(im, (1, 1))
    lienzo.paste(marco, (30, 30))
    return lienzo


def portada(nombre_archivo, titulo, subtitulo, items, formato, muestras):
    W = H = 1200
    NAVY, GOLD = (11, 42, 74), (201, 162, 39)
    im = Image.new("RGB", (W, H), (246, 248, 250))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 400], fill=NAVY)
    d.text((80, 70), MARCA, font=fuente(26, True), fill=GOLD)
    d.text((80, 140), titulo, font=fuente(66 if len(titulo) < 24 else 52, True), fill=(255, 255, 255))
    d.text((80, 250), subtitulo, font=fuente(30), fill=(201, 211, 219))
    d.rectangle([80, 330, 200, 336], fill=GOLD)
    d.rectangle([0, 400, W, 408], fill=GOLD)
    # collage de formatos reales
    caps = []
    for ruta in muestras[:3]:
        x = recortar(Image.open(ruta).convert("RGB"))
        alto = 400
        x = x.resize((int(x.width * alto / x.height), alto), Image.LANCZOS)
        if x.width > 520:
            x = x.resize((520, int(x.height * 520 / x.width)), Image.LANCZOS)
        caps.append(con_sombra(x))
    solape = 90
    total_w = sum(c.width for c in caps) - solape * (len(caps) - 1)
    if total_w > W - 40:  # reducir para que quepa completo
        f = (W - 40) / total_w
        caps = [c.resize((int(c.width * f), int(c.height * f)), Image.LANCZOS) for c in caps]
        solape = int(solape * f)
        total_w = sum(c.width for c in caps) - solape * (len(caps) - 1)
    x0 = (W - total_w) // 2
    for k, c in enumerate(caps):
        px = x0 + sum(cc.width - solape for cc in caps[:k])
        im.paste(c, (px, 425 + (k % 2) * 12), c)
    # lista de formatos
    y0 = 905
    cols = 2
    por_col = -(-len(items) // cols)
    for i, it in enumerate(items):
        x = 80 + (i // por_col) * 540
        yy = y0 + (i % por_col) * 36
        d.rectangle([x, yy + 9, x + 12, yy + 21], fill=GOLD)
        d.text((x + 28, yy), it, font=fuente(21), fill=(43, 43, 43))
    d.rectangle([0, H - 70, W, H], fill=NAVY)
    extra = "Fórmulas automáticas" if formato == "Excel" else "Campos resaltados para llenar"
    d.text((80, H - 48), f"Editable en {formato}  ·  {extra}  ·  Listo para imprimir  ·  México",
           font=fuente(20, True), fill=(255, 255, 255))
    os.makedirs(PORT, exist_ok=True)
    im.save(os.path.join(PORT, nombre_archivo + ".png"))


def muestras_de(cat, n=3):
    arch = [f for f in listar(cat)]
    elegidos = arch[:n]
    return [os.path.join(PREV, cat, os.path.splitext(f)[0] + ".png") for f in elegidos]


def portadas():
    shutil.rmtree(PORT, ignore_errors=True)
    todos, mu = [], []
    for cat, (nombre, fmt) in CATEGORIAS.items():
        its = [bonito(f) for f in listar(cat)]
        todos += its
        m = muestras_de(cat)
        mu.append(m[0])
        portada(cat, nombre, f"{len(its)} formatos administrativos", its, fmt, m)
    extra = [muestras_de(c, 1)[0] for c in ("5_Documentos_Word",)]
    portada("0_Paquete_Completo", "Paquete Administrativo", f"{len(todos)} formatos · Excel y Word",
            [f"{n} ({len(listar(c))})" for c, (n, _) in CATEGORIAS.items()], "Excel y Word", mu[:2] + extra)


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


if __name__ == "__main__":
    vistas_previas()
    portadas()
    zips()
    print("Listo: vistas_previas/, portadas/, paquetes_zip/")
