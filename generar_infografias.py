#!/usr/bin/env python3
"""Campaña de 10 infografías (1080x1350, 1080x1080, 1080x1920): cada tema con su propia composición.
Estructura comercial: problema (titular) -> riesgo -> lo que hacemos -> beneficio -> acción específica.
Sin cifras inventadas: los estados son cualitativos (Documentado, Por validar, En seguimiento, Atención requerida)."""
import base64
import io
import math
import os

import qrcode

from generar_marketing import CFG, ICONOS, LOGO_B64, captura

FORMATOS = {"1350": (1080, 1350), "1080": (1080, 1080), "1920": (1080, 1920)}
NAVY, TEAL, CORAL, GOLD, BLUE, GREEN = "#0B2A4A", "#12A0A8", "#E4572E", "#E69F00", "#2A6FBA", "#3DAE6B"
MARCA = CFG.get("marca") or "SISTEMA ADMINISTRATIVO"
LEMA = CFG.get("lema", "")

# métricas por formato (px): margen lateral, margen superior, tipografías y alto de la barra de acción
M = {
    "1350": dict(px=64, top=54, h1=62, meta=26, body=25, cta=250, bottom=0, qr=104, btn=27, ct=22, chip=21),
    "1080": dict(px=56, top=42, h1=52, meta=22, body=22, cta=214, bottom=0, qr=0, btn=25, ct=20, chip=21),
    "1920": dict(px=64, top=150, h1=84, meta=32, body=31, cta=380, bottom=165, qr=112, btn=34, ct=28, chip=27),
}

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,'Liberation Sans',Helvetica,sans-serif;width:%W%px;height:%H%px;overflow:hidden}
.dark{--bg1:#071d35;--bg2:#0B2A4A;--bg3:#134a6c;--tx:#ffffff;--tx2:#E3EBF2;--line:rgba(255,255,255,.28);--card:rgba(255,255,255,.10);--accent:%ACC%;--hl:#E69F00}
.light{--bg1:#F6F8FB;--bg2:#EEF2F6;--bg3:#E4EBF2;--tx:#0B2A4A;--tx2:#33475A;--line:rgba(11,42,74,.25);--card:#ffffff;--accent:%ACC%;--hl:#8A5E00}
.w{width:%W%px;height:%H%px;position:relative;display:flex;flex-direction:column;padding:%TOP%px %PX%px %PB%px;background:linear-gradient(160deg,var(--bg1) 0%,var(--bg2) 55%,var(--bg3) 100%);color:var(--tx);overflow:hidden}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:%GAP1%px}
.wm{font-weight:800;letter-spacing:.14em;font-size:%WM%px;color:var(--hl);display:flex;align-items:center;gap:10px}
.wm:before{content:"";width:8px;height:28px;background:var(--hl)}
.plate{background:#fff;border-radius:14px;padding:8px 18px;display:inline-flex;align-items:center;box-shadow:0 3px 14px rgba(0,0,0,.28)}
.logo{height:%LOGO%px;width:auto;display:block}
.kick{font-size:%KK%px;font-weight:800;letter-spacing:.14em;color:%ACCT%;text-transform:uppercase}
h1{font-size:%H1%px;line-height:1.07;font-weight:800;letter-spacing:-.01em;color:var(--tx)}
h1 em{font-style:normal;color:var(--hl)}
.meta{margin-top:%GAP2%px;display:flex;flex-direction:column;gap:10px}
.meta div{font-size:%META%px;line-height:1.28;color:var(--tx2)}
.meta b{display:inline-block;font-size:%MB%px;letter-spacing:.12em;padding:3px 12px;border-radius:6px;margin-right:12px;vertical-align:2px;color:#fff;background:#C9402A}
.meta b.g{background:var(--accent);color:%ONACC%}
.vis{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;margin:%GAP3%px 0}
.vis svg{width:100%;height:100%}
.chips{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:%GAP4%px}
.chip{font-size:%CHIP%px;font-weight:800;color:var(--tx);border:2px solid var(--line);border-radius:999px;padding:8px 18px}
.chip i{font-style:normal;color:%ACCT%;margin-right:8px}
.auth{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;font-size:20px;color:var(--tx2);font-weight:700}
.auth span:not(:last-child):after{content:"•";margin-left:10px;color:var(--hl)}
.cta{position:absolute;left:0;right:0;bottom:%BOT%px;height:%CTA%px;background:#051526;border-top:5px solid #E69F00;padding:%CP%px %PX%px;display:flex;flex-direction:column;justify-content:center;gap:%CG%px;color:#fff}
.cta .row{display:flex;align-items:center;justify-content:space-between;gap:24px}
.btn{background:#E69F00;color:#0B2A4A;font-weight:800;font-size:%BTN%px;line-height:1.15;padding:%BP%px 34px;border-radius:999px}
.cta .note{font-size:%CT%px;color:#E3EBF2;margin-top:8px}
.cta .ct{font-size:%CT%px;font-weight:700;color:#fff;line-height:1.5}
.cta .ct span{color:#E69F00;margin:0 8px}
.qrw{display:flex;flex-direction:column;align-items:center;gap:6px;flex:none;width:%QRW%px;text-align:center}.qrw small{font-size:20px;line-height:1.15;color:#E3EBF2}
.w:after{content:'';position:absolute;left:0;right:0;bottom:0;height:%BOT%px;background:#051526}
.qr{width:%QR%px;height:%QR%px;border-radius:12px;background:#fff;padding:6px;flex:none}
.icb{width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;flex:none;background:var(--accent);color:%ONACC%}
.icb svg,.ic svg{width:60%;height:60%;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ig svg{width:100%;height:100%;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.chipst{font-weight:800;border-radius:999px;padding:6px 18px;font-size:%CHIP%px;white-space:nowrap}
.s-doc{background:#12A0A8;color:#0B2A4A}.s-val{background:#E69F00;color:#0B2A4A}.s-seg{background:#2A6FBA;color:#fff}.s-att{background:#C9402A;color:#fff}.s-ok{background:#3DAE6B;color:#fff}
"""

# --------------------------------------------------------------------------- íconos (un solo estilo: línea 2px, 24x24)
ICO = dict(ICONOS)
ICO.update({
    "cfdi": '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 14l2 2 4-4"/></svg>',
    "moneda": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.2 1.2-2 2.5-2s2.5.8 2.5 2-1.2 1.6-2.5 2-2.5.8-2.5 2 1.2 2 2.5 2 2.5-.8 2.5-2"/></svg>',
    "casco": '<svg viewBox="0 0 24 24"><path d="M5 15c0-4.2 3-8 7-8s7 3.8 7 8"/><path d="M3 15h18v3H3z"/><path d="M12 7v8"/></svg>',
    "plano": '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M9 4v16M14 14l3 3M17 14l-3 3"/></svg>',
    "carpeta": '<svg viewBox="0 0 24 24"><path d="M3 7h6l2 2h10v10H3z"/></svg>',
    "cronograma": '<svg viewBox="0 0 24 24"><path d="M4 6h8M8 12h10M6 18h12"/><circle cx="4" cy="6" r="0.5"/></svg>',
    "fabrica": '<svg viewBox="0 0 24 24"><path d="M3 20V9l6 4V9l6 4V5h4v15z"/></svg>',
    "candado": '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    "tablero": '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 14v-3M11 14V8M15 14v-5M8 21h8"/></svg>',
    "nomina": '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    "meta": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-6"/></svg>',
    "alerta": '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
})


def ic(n, extra=""):
    return f'<div class="icb" style="{extra}">{ICO[n]}</div>'


def ic_svg(n, x, y, s, color="#fff"):
    """Ícono dentro de un SVG (escala s px)."""
    inner = ICO[n].replace('<svg viewBox="0 0 24 24">', "").replace("</svg>", "")
    k = s / 24
    return (f'<g transform="translate({x - s / 2},{y - s / 2}) scale({k})" stroke="{color}" fill="none" stroke-width="{2}" '
            f'stroke-linecap="round" stroke-linejoin="round">{inner}</g>')


def t(x, y, s, size=26, w=700, fill="var(--tx)", anchor="start", extra=""):
    lineas = s.split("\n")
    out = f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{fill}" text-anchor="{anchor}" font-family="Arial,Liberation Sans,sans-serif" {extra}>'
    for i, ln in enumerate(lineas):
        out += f'<tspan x="{x}" dy="{0 if i == 0 else size * 1.18}">{ln}</tspan>'
    return out + "</text>"


# --------------------------------------------------------------------------- marco común
def marca_html():
    if LOGO_B64:
        return f'<span class="plate"><img class="logo" src="{LOGO_B64}" alt="{MARCA}"></span>'
    return f'<div class="wm">{MARCA}</div>'


def qr_b64():
    if not CFG.get("qr_whatsapp") or not CFG.get("whatsapp"):
        return ""
    q = qrcode.QRCode(border=1, box_size=8, error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(f"https://wa.me/{CFG['whatsapp']}?text=" + "Hola%2C%20quiero%20una%20revisi%C3%B3n%20de%20mi%20operaci%C3%B3n%20administrativa")
    q.make(fit=True)
    buf = io.BytesIO()
    q.make_image(fill_color="#0B2A4A", back_color="white").save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _lum(h):
    h = h.lstrip("#")
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contraste(a, b):
    la, lb = sorted([_lum(a), _lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def sobre(fondo):
    """Color de texto (blanco o azul marino) con mayor contraste sobre `fondo`."""
    return "#FFFFFF" if contraste("#FFFFFF", fondo) >= contraste("#0B2A4A", fondo) else "#0B2A4A"


TEXTO_CLARO = {TEAL: "#0A7C82", GOLD: "#8A5E00", BLUE: "#2A6FBA", CORAL: "#B8321F"}   # acentos legibles sobre fondo claro

QR = qr_b64()
AUTORIDAD = ["Metodología de 4 pasos", "Reporte semanal", "Responsable asignado", "Expediente final"]


def pagina(fmt, d):
    """d: dict con tema, acento, kicker, h1 (por formato), riesgo, hacemos, benef(lista), cta, visual(html)."""
    w, h = FORMATOS[fmt]
    m = M[fmt]
    acc = d["acento"]
    css = (CSS.replace("%W%", str(w)).replace("%H%", str(h)).replace("%ACC%", acc).replace("%ACCT%", (TEXTO_CLARO.get(acc, acc) if d["tema"] == "light" else acc)).replace("%ONACC%", sobre(acc)).replace("%TOP%", str(m["top"])).replace("%PX%", str(m["px"]))
           .replace("%PB%", str(m["cta"] + m["bottom"] + 24)).replace("%BOT%", str(m["bottom"])).replace("%GAP1%", "26" if fmt != "1920" else "46").replace("%WM%", "24" if fmt != "1920" else "30").replace("%LOGO%", {"1350": "62", "1080": "58", "1920": "84"}[fmt])
           .replace("%KK%", "19" if fmt != "1920" else "25").replace("%H1%", str(m["h1"])).replace("%GAP2%", "20" if fmt != "1920" else "30")
           .replace("%META%", str(m["meta"])).replace("%MB%", "17" if fmt != "1920" else "22").replace("%GAP3%", "10" if fmt != "1920" else "18")
           .replace("%CHIP%", str(m["chip"])).replace("%GAP4%", "10").replace("%CTA%", str(m["cta"])).replace("%CP%", "20" if fmt != "1920" else "34")
           .replace("%CG%", "12" if fmt != "1920" else "20").replace("%BTN%", str(m["btn"])).replace("%BP%", "16" if fmt != "1920" else "26")
           .replace("%CT%", str(m["ct"])).replace("%QR%", str(m["qr"] or 120)).replace("%QRW%", str(max(150, (m["qr"] or 120) + 30))))
    # bloque 'meta': riesgo + lo que hacemos (en 1080 solo el riesgo y una línea)
    meta = f'<div><b>RIESGO</b>{d["riesgo"]}</div>'
    if fmt == "1350":
        meta += f'<div><b class="g">LO QUE HACEMOS</b>{d["hacemos"]}</div>'
    # beneficios (chips) — no en cuadrado
    ben = ""
    if fmt != "1080":
        ben = '<div class="chips">' + "".join(f'<div class="chip"><i>✓</i>{b}</div>' for b in d["benef"][: (3 if fmt == "1350" else 3)]) + "</div>"
    aut = ""
    if fmt == "1350":
        aut = '<div class="auth">' + "".join(f"<span>{a}</span>" for a in AUTORIDAD) + "</div>"
    contacto_linea = f'{CFG.get("correo", "")}<span>·</span>WhatsApp {CFG.get("telefono", "")}'
    if fmt == "1920":
        contacto_html = f'<div class="ct">{CFG.get("correo", "")}<br>WhatsApp {CFG.get("telefono", "")}</div>'
    else:
        contacto_html = f'<div class="ct">{contacto_linea}</div>'
    qr_html = f'<div class="qrw"><img class="qr" src="{QR}"><small>Escanea para escribir por WhatsApp</small></div>' if (QR and m["qr"]) else ""
    cta = (f'<div class="cta"><div class="row"><div><div class="btn">{d["cta"]} →</div><div class="note">Respuesta inicial para conocer tu operación.</div></div>{qr_html if fmt == "1350" else ""}</div>'
           f'{"<div class=row>" + contacto_html + qr_html + "</div>" if fmt == "1920" else contacto_html}</div>')
    return (f'<!doctype html><html lang="es"><head><meta charset="utf-8"><style>{css}</style></head><body><div class="w {d["tema"]}">'
            f'<div class="top">{marca_html()}<span class="kick">{d["kicker"]}</span></div><h1>{d["h1"][fmt]}</h1><div class="meta">{meta}</div>'
            f'<div class="vis">{d["visual"](fmt)}</div>{ben}{aut}{cta}</div>'
            f'<script>const v=document.querySelector(".vis"),c=v.firstElementChild;const k=Math.min(1,v.clientHeight/c.scrollHeight,v.clientWidth/c.scrollWidth);'
            f'if(k<1&&c.tagName.toLowerCase()!="svg"){{c.style.transform="scale("+k+")";c.style.transformOrigin="center center";}}</script></body></html>')


# --------------------------------------------------------------------------- composiciones
def vis_ciclo(fmt):
    cx, cy, r = 500, 330, 205
    nodos = [("ORDENAR", "doc", TEAL), ("PLANEAR", "cal", BLUE), ("EJECUTAR", "check", GOLD), ("CERRAR", "flag", CORAL), ("APRENDER\nY MEJORAR", "loop", GREEN)]
    pos = [(cx + r * math.cos(math.radians(-90 + 72 * i)), cy + r * math.sin(math.radians(-90 + 72 * i))) for i in range(5)]
    s = '<svg viewBox="0 0 1000 660" preserveAspectRatio="xMidYMid meet">'
    s += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="var(--hl)" stroke-width="5" stroke-opacity=".7"/>'
    for i in range(5):  # flechas sobre el aro, sentido horario
        a = -90 + 72 * i + 36
        x, y = cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))
        s += f'<polygon points="0,-15 26,0 0,15" fill="var(--hl)" transform="translate({x:.1f},{y:.1f}) rotate({a + 90:.1f})"/>'
    for (x, y), (lab, ico, col) in zip(pos, nodos):
        s += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="54" fill="{col}" stroke="var(--bg2)" stroke-width="6"/>' + ic_svg(ico, x, y, 52, "#0B2A4A" if col == GOLD else "#fff")
    lab = [(pos[0][0] + 74, pos[0][1] + 10, "start"), (pos[1][0] + 70, pos[1][1] + 6, "start"), (pos[2][0] + 66, pos[2][1] + 70, "start"),
           (pos[3][0] - 66, pos[3][1] + 70, "end"), (pos[4][0] - 70, pos[4][1] + 6, "end")]
    for (x, y, an), (txt, _, _) in zip(lab, nodos):
        s += t(x, y, txt, 30, 800, "var(--tx)", an)
    s += f'<circle cx="{cx}" cy="{cy}" r="128" fill="var(--card)" stroke="var(--line)" stroke-width="2"/>'
    s += t(cx, cy - 40, "CADA PENDIENTE", 25, 800, "var(--hl)", "middle")
    for i, ln in enumerate(["Responsable", "Fecha", "Evidencia", "Siguiente acción"]):
        s += t(cx, cy + 4 + i * 33, ln, 27, 700, "var(--tx)", "middle")
    return s + "</svg>"


def vis_embudo(fmt):
    pasos = ["1 · FACTURA EMITIDA", "2 · FECHA DE VENCIMIENTO", "3 · SEGUIMIENTO", "4 · COMPROMISO DE PAGO", "5 · APLICACIÓN DEL PAGO", "6 · CONCILIACIÓN"]
    cols = ["#0B2A4A", "#1B4F8A", BLUE, TEAL, "#1F9E8F", GOLD]
    s = '<svg viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid meet">'
    y = 6
    for i, (p, c) in enumerate(zip(pasos, cols)):
        wt, wb = 980 - i * 86, 980 - (i + 1) * 86 + 6
        pts = f"{500 - wt / 2},{y} {500 + wt / 2},{y} {500 + wb / 2},{y + 92} {500 - wb / 2},{y + 92}"
        s += f'<polygon points="{pts}" fill="{c}"/>'
        s += t(500, y + 58, p, 30, 800, "#0B2A4A" if c == GOLD else "#fff", "middle")
        y += 102
    return s + "</svg>"


def vis_linea(fmt):
    pasos = [("SEMANA 1", "Diagnóstico y documentos", "Procesos, accesos y expediente inicial", "doc", TEAL), ("SEMANA 2", "Prioridades y responsables", "Calendario y matriz de responsables", "cal", BLUE),
             ("SEMANA 3", "Ejecución y seguimiento", "Controles en operación con semáforos", "check", GOLD), ("SEMANA 4", "Primer reporte", "Plan de continuidad a 90 días", "flag", CORAL)]
    vert = fmt == "1920"
    n = "" 
    if vert:
        filas = "".join(
            f'<div style="display:flex;gap:26px;align-items:center;margin-bottom:22px"><div style="width:96px;height:96px;border-radius:50%;background:{c};display:flex;align-items:center;justify-content:center;flex:none;'
            f'box-shadow:0 0 0 8px var(--bg2)"><div class="ig" style="width:52px;height:52px;color:{"#0B2A4A" if c == GOLD else "#fff"}">{ICO[i]}</div></div>'
            f'<div><div style="font-size:24px;font-weight:800;letter-spacing:.12em;color:var(--hl)">{a}</div><div style="font-size:38px;font-weight:800;line-height:1.1">{b}</div><div style="font-size:27px;color:var(--tx2)">{d}</div></div></div>'
            for a, b, d, i, c in pasos)
        return (f'<div style="position:relative;width:100%"><div style="position:absolute;left:47px;top:40px;bottom:60px;width:6px;background:linear-gradient(var(--accent),var(--hl),#E4572E)"></div>{filas}</div>')
    cols = "".join(
        f'<div style="flex:1;text-align:center;padding:0 8px"><div style="width:{96 if fmt=="1350" else 78}px;height:{96 if fmt=="1350" else 78}px;margin:0 auto;border-radius:50%;background:{c};display:flex;align-items:center;justify-content:center;'
        f'box-shadow:0 0 0 8px var(--bg2)"><div class="ig" style="width:52%;height:52%;color:{"#0B2A4A" if c == GOLD else "#fff"}">{ICO[i]}</div></div>'
        f'<div style="margin-top:18px;font-size:19px;font-weight:800;letter-spacing:.12em;color:var(--hl)">{a}</div>'
        f'<div style="font-size:{29 if fmt=="1350" else 24}px;font-weight:800;line-height:1.12;margin-top:6px">{b}</div>'
        f'{"<div style=font-size:22px;color:var(--tx2);margin-top:8px;line-height:1.25>" + d + "</div>" if fmt == "1350" else ""}</div>'
        for a, b, d, i, c in pasos)
    banda = ('<div style="margin-top:26px;background:var(--hl);color:#0B2A4A;border-radius:14px;padding:18px 24px;font-size:27px;font-weight:800;text-align:center">'
             'De información dispersa a una operación con seguimiento semanal.</div>') if fmt == "1350" else ""
    return (f'<div style="width:100%"><div style="position:relative"><div style="position:absolute;left:6%;right:6%;top:{47 if fmt=="1350" else 38}px;height:6px;background:linear-gradient(90deg,var(--accent),var(--hl),#E4572E)"></div>'
            f'<div style="display:flex;position:relative">{cols}</div></div>{banda}</div>')


def vis_epr(fmt):
    cols = [("ENTRADAS", [("people", "Asistencia e incidencias"), ("nomina", "Sueldos y percepciones"), ("doc", "Altas, bajas y vacaciones")]),
            ("PROCESO", [("chart", "Cálculo y revisión"), ("check", "Validación y autorización"), ("cash", "Dispersión del pago")]),
            ("RESULTADO", [("cfdi", "Recibos CFDI timbrados"), ("carpeta", "Evidencia por periodo"), ("tablero", "Reporte para dirección")])]
    vert = False
    story = fmt == "1920"
    def col(titulo, items, k):
        filas = "".join(f'<div style="display:flex;gap:{16 if not story else 12}px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line);{"flex-direction:column;text-align:center" if story else ""}"><div class="icb" style="width:{56 if not story else 62}px;height:{56 if not story else 62}px;border-radius:14px;'
                        f'background:{["#2A6FBA", "#12A0A8", "#E69F00"][k]};color:{"#0B2A4A" if k == 2 else "#fff"}">{ICO[i]}</div><div style="font-size:{25 if not story else 28}px;font-weight:700;line-height:1.18">{tx}</div></div>'
                        for i, tx in items[: (3 if fmt == "1350" else 2)])
        return (f'<div style="flex:1;min-width:0"><div style="font-size:{22 if not vert else 28}px;font-weight:800;letter-spacing:.14em;color:#fff;background:{["#2A6FBA", "#12A0A8", "#C77F00"][k]};padding:10px 18px;border-radius:10px 10px 0 0">{titulo}</div>'
                f'<div style="background:var(--card);padding:6px 18px 6px;border:1px solid var(--line);border-top:0;border-radius:0 0 12px 12px">{filas}</div></div>')
    flecha = lambda: f'<div style="display:flex;align-items:center;justify-content:center;font-size:{44 if not vert else 52}px;color:var(--hl);font-weight:800;{"width:46px" if not vert else "height:56px"}">{"▶" if not vert else "▼"}</div>'
    cuerpo = flecha().join(col(a, b, k) for k, (a, b) in enumerate(cols))
    return f'<div style="width:100%;display:flex;flex-direction:{"column" if vert else "row"};align-items:stretch">{cuerpo}</div>'


def vis_checklist(fmt):
    filas = [("cfdi", "Constancia fiscal y opinión de cumplimiento", "Documentado", "s-doc"), ("chart", "Cálculo de impuestos y cuotas IMSS", "Por validar", "s-val"),
             ("check", "Pago de impuestos y acuses", "En seguimiento", "s-seg"), ("people", "Altas, bajas y modificaciones IMSS", "Atención requerida", "s-att"),
             ("carpeta", "Expediente fiscal y laboral por mes", "Documentado", "s-doc")]
    vert = fmt == "1920"
    n = 5 if fmt == "1350" else (3 if vert else 4)
    h = "".join(f'<div style="display:flex;align-items:center;gap:18px;padding:{14 if not vert else 20}px 0;border-bottom:2px solid var(--line)">'
                f'<div style="width:{44 if not vert else 60}px;height:{44 if not vert else 60}px;border:3px solid var(--hl);border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none;color:var(--hl);font-size:{30 if not vert else 40}px;font-weight:800">✓</div>'
                f'<div style="flex:1;font-size:{26 if not vert else 34}px;font-weight:700;line-height:1.18">{tx}</div><div class="chipst {cl}" style="{"font-size:34px;padding:10px 22px;white-space:normal;text-align:center;font-size:26px" if vert else ""}">{st}</div></div>'
                for _, tx, st, cl in filas[:n])
    return f'<div style="width:100%;border-top:2px solid var(--line)">{h}</div>'


def vis_carriles(fmt):
    s = '<svg viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid meet"><defs><marker id="ar" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12z" fill="#E69F00"/></marker></defs>'
    cols = [("SOLICITANTE", 128), ("COMPRAS", 376), ("DIRECCIÓN", 624), ("ALMACÉN Y FINANZAS", 872)]
    for nom, x in cols:
        s += f'<rect x="{x - 118}" y="4" width="236" height="642" rx="14" fill="var(--card)" stroke="var(--line)"/>'
        s += f'<rect x="{x - 118}" y="4" width="236" height="46" rx="14" fill="#0B2A4A"/>' + t(x, 35, nom, 21, 800, "#fff", "middle")
    def nodo(x, y, txt, col="#2A6FBA"):
        return f'<rect x="{x - 106}" y="{y}" width="212" height="84" rx="14" fill="{col}"/>' + t(x, y + 36, txt, 25, 800, "#fff", "middle")
    s += nodo(128, 80, "1 · Requisición\nautorizada", TEAL)
    s += nodo(376, 176, "2 · Tres cotizaciones\ny comparativo", BLUE)
    s += f'<polygon points="624,268 726,334 624,400 522,334" fill="#E69F00"/>' + t(624, 330, "3 · Autoriza", 23, 800, "#0B2A4A", "middle") + t(624, 357, "dirección", 23, 800, "#0B2A4A", "middle")
    s += nodo(376, 372, "4 · Orden de\ncompra", BLUE)
    s += nodo(872, 372, "5 · Recepción y\nentrada", "#1F9E8F")
    s += nodo(872, 500, "6 · Conciliación\n3 vías y pago", "#1F9E8F")
    s += nodo(624, 500, "7 · Cierre y\nexpediente", "#C77F00")
    A = 'fill="none" stroke="#E69F00" stroke-width="5" marker-end="url(#ar)"'
    for pth in ("M128 164 V218 H270", "M482 218 H624 V268", "M522 334 H376 V372", "M482 414 H766", "M872 456 V500", "M766 542 H730"):
        s += f'<path d="{pth}" {A}/>'
    return s + "</svg>"


def vis_tablero(fmt):
    estados = [("Actividades de la semana", "En seguimiento", "s-seg"), ("Pendientes críticos", "Atención requerida", "s-att"), ("Riesgos abiertos", "Riesgo alto", "s-att"),
               ("Decisiones para dirección", "Pendiente de autorización", "s-val"), ("Documentos del expediente", "Documentado", "s-doc")]
    vert = fmt == "1920"
    n = 5 if fmt == "1350" else (3 if vert else 4)
    filas = "".join(f'<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:{14 if not vert else 20}px 0;border-bottom:1px solid var(--line)"><div style="font-size:{26 if not vert else 34}px;font-weight:700">{a}</div>'
                    f'<div class="chipst {c}" style="{"font-size:26px" if vert else ""}">{b}</div></div>' for a, b, c in estados[:n])
    luz = (f'<div style="width:{150 if not vert else 190}px;flex:none;background:#051526;border-radius:30px;padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:20px;border:3px solid var(--line)">'
           f'<div style="width:{84 if not vert else 110}px;height:{84 if not vert else 110}px;border-radius:50%;background:#3DAE6B;opacity:.28"></div>'
           f'<div style="width:{84 if not vert else 110}px;height:{84 if not vert else 110}px;border-radius:50%;background:#E69F00;box-shadow:0 0 36px #E69F00"></div>'
           f'<div style="width:{84 if not vert else 110}px;height:{84 if not vert else 110}px;border-radius:50%;background:#E4572E;opacity:.28"></div></div>')
    return (f'<div style="width:100%;display:flex;gap:30px;align-items:center">{luz}<div style="flex:1"><div style="font-size:{21 if not vert else 28}px;font-weight:800;letter-spacing:.14em;color:var(--hl);margin-bottom:6px">'
            f'SEMÁFORO GENERAL · ATENCIÓN</div>{filas}</div></div>')


def vis_antes(fmt):
    sin = ["Pendientes sin responsable ni fecha", "Cifras que no concilian", "Evidencia dispersa en correos", "Cliente sin acta de aceptación"]
    con = ["Cada pendiente con dueño y fecha", "Presupuesto, costos y facturación cuadrados", "Expediente completo y localizable", "Acta de entrega-recepción firmada"]
    vert = fmt == "1920"
    n = 4 if fmt == "1350" else 3
    def panel(titulo, items, col, simbolo):
        filas = "".join(f'<div style="display:flex;gap:14px;align-items:flex-start;padding:{10 if not vert else 16}px 0;font-size:{25 if not vert else 33}px;font-weight:700;line-height:1.22"><span style="color:{col};font-weight:800;font-size:{30 if not vert else 40}px;line-height:1">{simbolo}</span>{tx}</div>' for tx in items[:n])
        return (f'<div style="flex:1;border:4px solid {col};border-radius:18px;background:var(--card);overflow:hidden"><div style="background:{col};color:#fff;font-weight:800;letter-spacing:.14em;font-size:{24 if not vert else 32}px;padding:12px 20px">{titulo}</div>'
                f'<div style="padding:8px 22px">{filas}</div></div>')
    fl = f'<div style="display:flex;align-items:center;justify-content:center;font-size:{52 if not vert else 60}px;color:var(--hl);font-weight:800;{"width:50px" if not vert else "height:60px"}">{"▶" if not vert else "▼"}</div>'
    return f'<div style="width:100%;display:flex;flex-direction:{"column" if vert else "row"};align-items:stretch">{panel("SIN CIERRE", sin, CORAL, "✕")}{fl}{panel("CON CIERRE", con, TEAL, "✓")}</div>'


def vis_piramide(fmt):
    niv = [("4 · DIRECCIÓN", "Riesgos, decisiones y cierre", GOLD, "#0B2A4A"), ("3 · CONTROL FINANCIERO", "Facturación, pagos y conciliación", TEAL, "#fff"),
           ("2 · EJECUCIÓN", "Compras, contratistas, avances y cambios", BLUE, "#fff"), ("1 · BASE DOCUMENTAL", "Contratos, órdenes, estimaciones y evidencias", "#2E5C8A", "#fff")]
    s = '<svg viewBox="0 0 1000 556" preserveAspectRatio="xMidYMid meet">'
    y, apex, base, alto = 4, 440, 980, 130
    for i, (a_, b_, c, tc) in enumerate(niv):
        w1 = apex + (base - apex) * i / 4
        w2 = apex + (base - apex) * (i + 1) / 4
        s += f'<polygon points="{500 - w1 / 2},{y} {500 + w1 / 2},{y} {500 + w2 / 2},{y + alto} {500 - w2 / 2},{y + alto}" fill="{c}" stroke="var(--bg2)" stroke-width="6"/>'
        s += t(500, y + alto / 2 - 2, a_, 27, 800, tc, "middle") + t(500, y + alto / 2 + 32, b_, 23, 400, tc, "middle")
        y += alto + 8
    return s + "</svg>"


def vis_matriz(fmt):
    filas = [("shop", "COMPRAS Y PROVEEDORES", "Requisiciones, cotizaciones y órdenes", "Compras", "Cuadro comparativo y OC"), ("people", "PERSONAL Y NÓMINA", "Asistencia, altas y pago de nómina", "Recursos humanos", "Recibos CFDI y asistencia"),
             ("shield", "FISCAL E IMSS", "Declaraciones, cuotas y acuses", "Finanzas", "Acuses y expediente"), ("tablero", "REPORTES PARA DIRECCIÓN", "Avance, riesgos y decisiones", "Administración", "Reporte semanal")]
    ICO["shop"] = ICO["cart"]
    vert = fmt == "1920"
    cab = ["ÁREA", "QUÉ SE CONTROLA", "RESPONSABLE", "EVIDENCIA"] if not vert else ["ÁREA", "QUÉ SE CONTROLA", "EVIDENCIA"]
    cols = "1.1fr 1.4fr .9fr 1.1fr" if not vert else "1.2fr 1.3fr 1fr"
    h = f'<div style="display:grid;grid-template-columns:{cols};background:#0B2A4A;color:#fff;border-radius:10px 10px 0 0">' + "".join(f'<div style="padding:12px 14px;font-size:{19 if not vert else 24}px;font-weight:800;letter-spacing:.1em">{c}</div>' for c in cab) + "</div>"
    n = 4 if fmt != "1920" else 3
    r = ""
    for k, (i, a, b, c, d) in enumerate(filas[:n]):
        celdas = [f'<div style="display:flex;gap:12px;align-items:center"><div class="icb" style="width:{44 if not vert else 58}px;height:{44 if not vert else 58}px;border-radius:12px">{ICO[i]}</div><b style="font-size:{21 if not vert else 28}px;line-height:1.1">{a}</b></div>',
                  f'<span style="font-size:{22 if not vert else 29}px">{b}</span>']
        if not vert:
            celdas.append(f'<span style="font-size:22px">{c}</span>')
        celdas.append(f'<span style="font-size:{22 if not vert else 29}px;font-weight:700">{d}</span>')
        r += (f'<div style="display:grid;grid-template-columns:{cols};align-items:center;background:{"#fff" if k % 2 == 0 else "#F1F5F9"};border:1px solid var(--line);border-top:0;color:#0B2A4A">' +
              "".join(f'<div style="padding:{14 if not vert else 22}px 14px">{x}</div>' for x in celdas) + "</div>")
    return f'<div style="width:100%">{h}{r}</div>'


PIEZAS = [
    dict(id="01_Operacion_bajo_control", tema="dark", acento=GOLD, kicker="Control operativo", visual=vis_ciclo,
         h1={"1350": "Si tu operación depende de <em>recordatorios</em>, ya necesitas un <em>sistema de control</em>.", "1080": "Si tu operación depende de recordatorios, necesitas un <em>sistema de control</em>.", "1920": "¿Tu operación depende de <em>recordatorios</em>?"},
         riesgo="pendientes que nadie atiende hasta que se vuelven problema.", hacemos="ordenamos, planeamos, ejecutamos y cerramos con evidencia.",
         benef=["Dueño por pendiente", "Fecha y evidencia", "Siguiente acción"], cta="Agenda un diagnóstico de control operativo",
         leyenda="Si tu operación depende de recordatorios, ya necesitas un sistema de control: ordenar, planear, ejecutar, cerrar y aprender. Cada pendiente con responsable, fecha, evidencia y siguiente acción."),
    dict(id="02_Facturacion_y_cobranza", tema="light", acento=TEAL, kicker="Facturación y cobranza", visual=vis_embudo,
         h1={"1350": "Facturar no es cobrar. Controla tu <em>cartera</em> antes de que afecte tu operación.", "1080": "Facturar no es cobrar. Controla tu <em>cartera</em> a tiempo.", "1920": "Facturar <em>no es cobrar</em>."},
         riesgo="lo que se factura y no se cobra se convierte en riesgo.", hacemos="damos seguimiento a cada factura hasta su conciliación.",
         benef=["Cartera visible", "Compromisos de pago", "Bancos conciliados"], cta="Solicita una revisión de tu cartera y cobranza",
         leyenda="Facturar no es cobrar. De la factura emitida a la conciliación: seguimiento, compromiso de pago y aplicación. Solicita una revisión de tu cartera y cobranza."),
    dict(id="03_Plan_de_30_dias", tema="dark", acento=TEAL, kicker="Implementación en 30 días", visual=vis_linea,
         h1={"1350": "<em>30 días</em> para saber qué está pendiente, quién lo atiende y cómo se cierra.", "1080": "<em>30 días</em> para saber qué está pendiente y quién lo atiende.", "1920": "<em>30 días</em> para saber qué pasa en tu operación."},
         riesgo="seguir operando con información dispersa y sin responsables.", hacemos="te acompañamos semana a semana hasta el primer reporte.",
         benef=["Prioridades claras", "Responsable por tarea", "Reporte semanal"], cta="Inicia tu diagnóstico administrativo",
         leyenda="30 días para saber qué está pendiente, quién lo atiende y cómo se cierra: diagnóstico, prioridades, ejecución y primer reporte para dirección."),
    dict(id="04_Nomina_sin_sorpresas", tema="light", acento=BLUE, kicker="Nómina", visual=vis_epr,
         h1={"1350": "Una nómina sin evidencia es un <em>riesgo laboral</em> esperando una revisión.", "1080": "Nómina sin evidencia: un <em>riesgo laboral</em> pendiente.", "1920": "Nómina sin evidencia = <em>riesgo laboral</em>."},
         riesgo="diferencias de pago, recibos faltantes y observaciones del IMSS.", hacemos="validamos entradas, controlamos el cálculo y archivamos la evidencia.",
         benef=["Incidencias validadas", "Recibos CFDI", "Evidencia por periodo"], cta="Identifica tus pendientes críticos de nómina",
         leyenda="Una nómina sin evidencia es un riesgo laboral. Entradas validadas, proceso controlado y resultados documentados, periodo por periodo."),
    dict(id="05_Fiscal_e_IMSS", tema="dark", acento=GOLD, kicker="Fiscal e IMSS", visual=vis_checklist,
         h1={"1350": "Cumplir no es presentar a tiempo: es poder <em>demostrarlo</em>.", "1080": "Cumplir es presentar a tiempo y poder <em>demostrarlo</em>.", "1920": "Cumplir es poder <em>demostrarlo</em>."},
         riesgo="multas, recargos y revisiones sin expediente que te respalde.", hacemos="llevamos el calendario, los acuses y el expediente por mes.",
         benef=["Obligaciones con dueño", "Acuses a la mano", "Estado visible"], cta="Evalúa el control documental de tu empresa",
         leyenda="Cumplir no es solo presentar a tiempo: es poder demostrarlo. Documentos al día, pagos con acuse y expediente por mes."),
    dict(id="06_Compras_y_proyectos", tema="light", acento=BLUE, kicker="Compras y proyectos", visual=vis_carriles,
         h1={"1350": "Cada compra <em>autorizada</em>, comparada y documentada. Sin sorpresas al cierre.", "1080": "Compras <em>autorizadas</em>, comparadas y documentadas.", "1920": "Compras sin sorpresas al <em>cierre</em>."},
         riesgo="compras sin respaldo y sobrecostos que aparecen al final.", hacemos="definimos la ruta de aprobación y concilias orden, entrada y factura.",
         benef=["Quién autoriza", "Tres cotizaciones", "Conciliación 3 vías"], cta="Ordena tu administración en 30 días",
         leyenda="Compras y proyectos bajo control: requisición, comparativo, autorización, orden, recepción y conciliación de tres vías."),
    dict(id="07_Reporte_para_direccion", tema="dark", acento=TEAL, kicker="Reporte para dirección", visual=vis_tablero,
         h1={"1350": "Dirección no necesita más datos: necesita saber <em>qué decidir hoy</em>.", "1080": "Dirección necesita saber <em>qué decidir hoy</em>.", "1920": "¿Qué debe <em>decidir</em> dirección hoy?"},
         riesgo="decidir tarde o a ciegas porque la información llega dispersa.", hacemos="convertimos tu operación en un tablero semanal con semáforos.",
         benef=["Pendientes críticos", "Riesgos con dueño", "Decisiones con fecha"], cta="Recibe una ruta de control para tu empresa",
         leyenda="Dirección no necesita más datos: necesita saber qué decidir hoy. Tablero semanal con semáforos, riesgos y decisiones requeridas."),
    dict(id="08_Cierre_de_proyectos", tema="light", acento=CORAL, kicker="Cierre de proyectos", visual=vis_antes,
         h1={"1350": "Un proyecto no termina al entregar. Termina al <em>cerrar bien</em>.", "1080": "Un proyecto termina al <em>cerrar bien</em>, no al entregar.", "1920": "Entregar no es <em>cerrar</em>."},
         riesgo="proyectos entregados que siguen abiertos en cifras y documentos.", hacemos="llevamos el cierre administrativo con evidencia y conciliación.",
         benef=["Acta firmada", "Cifras conciliadas", "Expediente final"], cta="Hablemos de tu proyecto",
         leyenda="Un proyecto no termina al entregar: termina al cerrar bien. Acta firmada, cifras conciliadas, pendientes en cero y expediente completo."),
    dict(id="09_Construccion_control_de_obra", tema="dark", acento=GOLD, kicker="Para constructoras", visual=vis_piramide,
         h1={"1350": "Una obra se controla desde el <em>expediente</em>, no solo desde el avance físico.", "1080": "Una obra se controla desde el <em>expediente</em>.", "1920": "Tu obra se controla desde el <em>expediente</em>."},
         riesgo="estimaciones sin cobrar, contratistas sin liquidar y cierres sin respaldo.", hacemos="ordenamos compras, estimaciones, facturación y expediente de obra.",
         benef=["Estimaciones al día", "Contratistas en orden", "Cierre documentado"], cta="Revisa el control administrativo de tu obra",
         leyenda="Para constructoras: control de compras, contratistas, estimaciones, facturación y expediente de obra. Una obra bien construida necesita una administración bien documentada."),
    dict(id="10_Industria_continuidad_operativa", tema="light", acento=TEAL, kicker="Para empresas industriales", visual=vis_matriz,
         h1={"1350": "Si compras, personal y cumplimiento dependen de <em>personas clave</em>, tu continuidad también.", "1080": "Si todo depende de <em>personas clave</em>, tu continuidad también.", "1920": "¿Tu operación depende de <em>personas clave</em>?"},
         riesgo="paros, retrasos y observaciones cuando falta la persona que sabía cómo.", hacemos="documentamos procesos, responsables y evidencias de cada área.",
         benef=["Procesos documentados", "Dueño por área", "Reportes a dirección"], cta="Agenda una revisión de tu operación",
         leyenda="Para industria: continuidad operativa con compras, proveedores, personal, cumplimiento y reportes para dirección documentados y con responsable."),
]


def generar(OUT):
    import shutil
    tmp = os.path.join(OUT, "_tmp_info")
    os.makedirs(tmp, exist_ok=True)
    for fmt, (w, h) in FORMATOS.items():
        carpeta = os.path.join(OUT, "infografias", f"{w}x{h}")
        os.makedirs(carpeta, exist_ok=True)
        for d in PIEZAS:
            ruta = os.path.join(tmp, f"{d['id']}_{fmt}.html")
            open(ruta, "w", encoding="utf-8").write(pagina(fmt, d))
            captura(ruta, os.path.join(carpeta, d["id"] + ".png"), w, h)
    shutil.rmtree(tmp)
    return PIEZAS
