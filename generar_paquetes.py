#!/usr/bin/env python3
"""Genera vistas previas (PNG), portadas de producto (PNG) y paquetes ZIP.
Requiere: LibreOffice (soffice), pdftoppm, Pillow. Ejecutar después de generar_plantillas.py
y generar_documentos_word.py."""
import os, shutil, subprocess, tempfile, zipfile
from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.abspath(__file__))
PLANT = os.path.join(RAIZ, "plantillas")
PREV = os.path.join(RAIZ, "vistas_previas")
PORT = os.path.join(RAIZ, "portadas")
ZIPS = os.path.join(RAIZ, "paquetes_zip")
MARCA = "TU MARCA"  # <- cambia por el nombre de tu tienda
AZUL, CLARO, GRIS = (31, 78, 120), (221, 235, 247), (89, 89, 89)
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
           "Cotizacion": "Cotización", "Cotizaciones": "Cotizaciones", "Minuta de Reunion": "Minuta de Reunión",
           "Prestacion": "Prestación", "Renuncia Voluntaria": "Renuncia Voluntaria", "Entrega Recepcion": "Entrega-Recepción",
           "Administrativa": "Administrativa", "Confidencialidad": "Confidencialidad"}


def bonito(archivo):
    t = os.path.splitext(archivo)[0].split("_", 1)[1].replace("_", " ")
    for a, b in ACENTOS.items():
        t = t.replace(a, b)
    return t


def listar(cat):
    return sorted(f for f in os.listdir(os.path.join(PLANT, cat)) if f.endswith((".xlsx", ".docx")))


def vistas_previas():
    shutil.rmtree(PREV, ignore_errors=True)
    for cat in CATEGORIAS:
        os.makedirs(os.path.join(PREV, cat))
        with tempfile.TemporaryDirectory() as tmp:
            for f in listar(cat):
                subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", tmp,
                                os.path.join(PLANT, cat, f)], capture_output=True)
                pdf = os.path.join(tmp, os.path.splitext(f)[0] + ".pdf")
                subprocess.run(["pdftoppm", "-png", "-r", "80", "-f", "1", "-l", "1", "-singlefile", pdf,
                                os.path.join(PREV, cat, os.path.splitext(f)[0])], check=True)


def portada(nombre_archivo, titulo, subtitulo, items, formato):
    W = H = 1200
    im = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 330], fill=AZUL)
    d.text((70, 60), MARCA, font=fuente(34, True), fill=(255, 255, 255))
    d.text((70, 130), titulo, font=fuente(62 if len(titulo) < 26 else 50, True), fill=(255, 255, 255))
    d.text((70, 235), subtitulo, font=fuente(30), fill=CLARO)
    y = 390
    cols = 2 if len(items) > 7 else 1
    por_col = -(-len(items) // cols)
    paso = min(100, 640 // por_col)
    for i, it in enumerate(items):
        x = 70 + (i // por_col) * 560
        yy = y + (i % por_col) * paso
        d.ellipse([x, yy + 8, x + 22, yy + 30], fill=AZUL)
        d.text((x + 38, yy), it, font=fuente(23 if cols == 2 else 34), fill=(40, 40, 40))
    d.rectangle([0, H - 150, W, H], fill=CLARO)
    d.text((70, H - 125), f"Archivos editables en {formato}", font=fuente(32, True), fill=AZUL)
    extra = "Fórmulas automáticas" if formato == "Excel" else "Campos resaltados para llenar"
    d.text((70, H - 75), f"{extra} · Listos para imprimir · México", font=fuente(26), fill=GRIS)
    os.makedirs(PORT, exist_ok=True)
    im.save(os.path.join(PORT, nombre_archivo + ".png"))


def portadas():
    shutil.rmtree(PORT, ignore_errors=True)
    todos = []
    for cat, (nombre, fmt) in CATEGORIAS.items():
        its = [bonito(f) for f in listar(cat)]
        todos += its
        portada(cat, nombre, f"{len(its)} formatos administrativos", its, fmt)
    portada("0_Paquete_Completo", "Paquete Administrativo", f"{len(todos)} formatos · Excel y Word",
            [f"{n} ({len(listar(c))})" for c, (n, _) in CATEGORIAS.items()], "Excel y Word")


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
