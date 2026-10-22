#!/usr/bin/env python3
"""Extrae los criterios de aceptación (Gherkin) de las historias y genera
los artefactos de prueba de la fase 5.

Entradas : docs/01-requerimientos/historias/M01..M10-*.md
Salidas  : docs/03-pruebas/features/HU-nn.feature
           docs/03-pruebas/casos-de-prueba.md

Uso (desde la raíz del repo o desde cualquier carpeta):
    python3 docs/03-pruebas/scripts/extraer_casos.py [--check]

--check  solo valida (IDs y conteos) sin escribir archivos.
Sale con código 1 si hay inconsistencias (CA duplicado, faltante, sin
escenario, HU sin prioridad/sprint o conteo distinto).
Solo usa la biblioteca estándar. La salida es determinista.
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, OrderedDict
from dataclasses import dataclass, field
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
HISTORIAS = RAIZ / "docs" / "01-requerimientos" / "historias"
SALIDA = RAIZ / "docs" / "03-pruebas"
FEATURES = SALIDA / "features"
CASOS_MD = SALIDA / "casos-de-prueba.md"

RE_MODULO = re.compile(r"^M(\d{2})-.*\.md$")
RE_TITULO_MOD = re.compile(r"^#\s+M\d{2}\s+—\s+(.+)$")
RE_CU = re.compile(r"^###\s+(CU-\d+\.\d+)\s+—\s+(.+?)\s+·\s+(RF-\d+)\s+·\s+HU-(\d+)")
RE_HISTORIA = re.compile(r"^>\s*(\*\*Como\*\*.*)$")
RE_CA = re.compile(r"^\s*#\s*CA-(\d+)\.(\d+)\s*(.*)$")
RE_ESC = re.compile(r"^\s*(Escenario|Esquema del escenario):\s*(.+)$")
RE_FILA_RESUMEN = re.compile(
    r"^\|\s*HU-(\d+)[^|]*\|\s*RF-\d+\s*\|\s*CU-[\d.]+\s*\|\s*([MSCW])\s*\|\s*(S\d)\s*\|"
)

# ---------------------------------------------------------------- reglas
# Clasificación heurística, documentada en casos-de-prueba.md §Reglas.
RE_LIMITE = re.compile(
    r"límite|limite|vigencia|más de 14 días|14 días|redondeo|empate|impar|"
    r"número par|un solo precio|10 %|máximo|mínimo de|exactamente|umbral|"
    r"semana de transición|incompletos|excedidos",
    re.I,
)
RE_NEGATIVO = re.compile(
    r"validaci|error|excepci|permiso|aislamiento|conflicto|falla|inválid|"
    r"invalid|sin más|sin precio|cambio de estructura|robots|ilegible|"
    r"bloqueo|vencid|no cumple|insuficiente|ya existe|duplicad|rechaz",
    re.I,
)
# Historias cuyo núcleo es un cálculo puro (motor, reparto, mediana, escalado).
HU_UNITARIAS = {"07", "20", "21", "36"}
RE_UNITARIA = re.compile(
    r"conversión|redondeo|mediana|puntaje|empate|par de precios|"
    r"número par|impar|escalado|pesos por defecto|novedad 0",
    re.I,
)
RE_E2E = re.compile(r"sin conexión|modo avión|offline|compartir|whatsapp", re.I)
# Parcial = automatizable con dobles (push, FCM, OCR, share nativo) y
# verificación manual complementaria en dispositivo o por el PO.
RE_PARCIAL = re.compile(
    r"fcm|web push|notificaci|recordatorio|ticket|foto|compartir nativo|"
    r"el po compara|aprobado por el po",
    re.I,
)


@dataclass
class Caso:
    modulo: int
    hu: str
    ca_k: int
    etiqueta: str          # texto del comentario # CA-nn.k <etiqueta>
    palabra: str           # Escenario | Esquema del escenario
    titulo: str
    lineas: list[str] = field(default_factory=list)  # pasos (sin comentario)
    prioridad: str = ""
    sprint: str = ""

    @property
    def ca(self) -> str:
        return f"CA-{self.hu}.{self.ca_k}"

    @property
    def pf(self) -> str:
        return f"PF-M{self.modulo}-{self.hu}.{self.ca_k}"

    @property
    def texto(self) -> str:
        return " ".join([self.etiqueta, self.titulo, *self.lineas])

    @property
    def tipo(self) -> str:
        cab = f"{self.etiqueta} {self.titulo}"
        if RE_LIMITE.search(cab) or self.palabra.startswith("Esquema"):
            return "límite"
        if RE_NEGATIVO.search(cab):
            return "negativo"
        return "funcional"

    @property
    def nivel(self) -> str:
        if RE_E2E.search(self.texto):
            return "E2E"
        if self.hu in HU_UNITARIAS or RE_UNITARIA.search(f"{self.etiqueta} {self.titulo}"):
            return "unitaria"
        if self.etiqueta.lower().startswith("flujo principal"):
            return "E2E"
        return "integración"

    @property
    def automatizable(self) -> str:
        return "Parcial" if RE_PARCIAL.search(self.texto) else "Sí"

    @property
    def regresion(self) -> bool:
        return self.prioridad == "M"


@dataclass
class Historia:
    modulo: int
    modulo_nombre: str
    hu: str
    cu: str
    rf: str
    nombre: str
    narrativa: str = ""
    caracteristica: str = ""
    casos: list[Caso] = field(default_factory=list)
    prioridad: str = ""
    sprint: str = ""


# ---------------------------------------------------------------- parseo
def parsear_modulo(ruta: Path, errores: list[str]) -> tuple[list[Historia], int]:
    modulo = int(RE_MODULO.match(ruta.name).group(1))
    lineas = ruta.read_text(encoding="utf-8").splitlines()
    nombre_mod = ruta.stem
    historias: "OrderedDict[str, Historia]" = OrderedDict()
    resumen: dict[str, tuple[str, str]] = {}
    actual: Historia | None = None
    en_gherkin = False
    pendiente_ca: tuple[int, int, str] | None = None
    caso: Caso | None = None
    escenarios_crudos = 0

    for n, linea in enumerate(lineas, 1):
        if m := RE_TITULO_MOD.match(linea):
            nombre_mod = m.group(1).strip()
        if en_gherkin:
            if linea.strip() == "```":
                en_gherkin = False
                caso = None
                if pendiente_ca:
                    errores.append(f"{ruta.name}:{n}: CA-{pendiente_ca[0]:02d}.{pendiente_ca[1]} sin escenario")
                    pendiente_ca = None
                continue
            if m := RE_CA.match(linea):
                if pendiente_ca:
                    errores.append(f"{ruta.name}:{n}: comentario CA previo sin escenario")
                pendiente_ca = (int(m.group(1)), int(m.group(2)), m.group(3).strip())
                caso = None
                continue
            if m := RE_ESC.match(linea):
                escenarios_crudos += 1
                if not pendiente_ca:
                    errores.append(f"{ruta.name}:{n}: escenario sin comentario CA: {m.group(2)}")
                    caso = None
                    continue
                hu_ca, k, etq = pendiente_ca
                pendiente_ca = None
                if actual is None or int(actual.hu) != hu_ca:
                    errores.append(
                        f"{ruta.name}:{n}: CA-{hu_ca:02d}.{k} está bajo "
                        f"HU-{actual.hu if actual else '??'}"
                    )
                caso = Caso(modulo, f"{hu_ca:02d}", k, etq, m.group(1), m.group(2).strip())
                actual.casos.append(caso)
                continue
            if linea.startswith("Característica:") and actual:
                actual.caracteristica = linea.split(":", 1)[1].strip()
                continue
            if caso is not None and linea.strip():
                caso.lineas.append(linea.rstrip())
            elif caso is not None:
                caso.lineas.append("")
            continue

        if linea.strip() == "```gherkin":
            en_gherkin = True
            caso = None
            continue
        if m := RE_CU.match(linea):
            hu = f"{int(m.group(4)):02d}"
            actual = Historia(modulo, nombre_mod, hu, m.group(1), m.group(3), m.group(2).strip())
            if hu in historias:
                errores.append(f"{ruta.name}:{n}: HU-{hu} duplicada")
            historias[hu] = actual
            continue
        if (m := RE_HISTORIA.match(linea)) and actual:
            actual.narrativa = re.sub(r"\*\*", "", m.group(1)).strip()
            continue
        if m := RE_FILA_RESUMEN.match(linea):
            resumen[f"{int(m.group(1)):02d}"] = (m.group(2), m.group(3))

    for h in historias.values():
        if h.hu not in resumen:
            errores.append(f"{ruta.name}: HU-{h.hu} no está en la tabla resumen")
            continue
        h.prioridad, h.sprint = resumen[h.hu]
        for c in h.casos:
            c.prioridad, c.sprint = h.prioridad, h.sprint
            # quita líneas vacías finales
        for c in h.casos:
            while c.lineas and not c.lineas[-1].strip():
                c.lineas.pop()
        ks = [c.ca_k for c in h.casos]
        for k, cnt in Counter(ks).items():
            if cnt > 1:
                errores.append(f"{ruta.name}: CA-{h.hu}.{k} duplicado")
        if ks:
            faltan = sorted(set(range(1, max(ks) + 1)) - set(ks))
            for k in faltan:
                errores.append(f"{ruta.name}: falta CA-{h.hu}.{k}")
        if ks != sorted(ks):
            errores.append(f"{ruta.name}: HU-{h.hu} con CA fuera de orden {ks}")
        if len(ks) < 3:
            errores.append(f"{ruta.name}: HU-{h.hu} tiene {len(ks)} CA (DoR pide ≥ 3)")
    for hu in resumen:
        if hu not in historias:
            errores.append(f"{ruta.name}: HU-{hu} en resumen sin caso de uso")
    return list(historias.values()), escenarios_crudos


# ---------------------------------------------------------------- salida
def feature(h: Historia) -> str:
    out = [
        "# language: es",
        f"# Generado por docs/03-pruebas/scripts/extraer_casos.py — no editar a mano.",
        f"# Fuente: docs/01-requerimientos/historias/M{h.modulo:02d} · {h.cu} · {h.rf}",
        f"@HU-{h.hu} @M{h.modulo:02d} @{h.sprint} @prioridad-{h.prioridad}",
        f"Característica: HU-{h.hu} {h.caracteristica or h.nombre}",
    ]
    if h.narrativa:
        out.append(f"  {h.narrativa}")
    for c in h.casos:
        tags = [f"@{c.ca}", f"@{c.sprint}", f"@prioridad-{c.prioridad}",
                f"@{quitar_tilde(c.tipo)}", f"@{quitar_tilde(c.nivel).lower()}"]
        if c.regresion:
            tags.append("@regresion")
        if c.automatizable != "Sí":
            tags.append("@manual-parcial")
        out += ["", f"  # {c.ca} {c.etiqueta} · {c.pf}".rstrip(),
                "  " + " ".join(tags),
                f"  {c.palabra}: {c.titulo}"]
        out += c.lineas
    return "\n".join(out) + "\n"


def quitar_tilde(s: str) -> str:
    return s.translate(str.maketrans("áéíóúÁÉÍÓÚ", "aeiouAEIOU"))


def tabla_conteo(titulo: str, filas: list[tuple[str, ...]], cab: tuple[str, ...]) -> list[str]:
    out = [f"### {titulo}", "", "| " + " | ".join(cab) + " |", "|" + "---|" * len(cab)]
    out += ["| " + " | ".join(f) + " |" for f in filas]
    return out + [""]


def casos_md(historias: list[Historia], crudos: int) -> str:
    casos = [c for h in historias for c in h.casos]
    modulos: "OrderedDict[int, list[Historia]]" = OrderedDict()
    for h in historias:
        modulos.setdefault(h.modulo, []).append(h)
    sprints = sorted({c.sprint for c in casos})
    total_reg = sum(c.regresion for c in casos)

    o: list[str] = []
    o += [
        "# Casos de prueba funcionales — Menú Familiar",
        "",
        "| Campo | Valor |",
        "|---|---|",
        "| Documento | CP-MF-001 |",
        "| Base | CUH-MF-001 v1.1 (historias M01–M10), SRS-MF-001 v1.3 |",
        "| Fase del ciclo de vida | 5. Pruebas |",
        "| Generado por | `docs/03-pruebas/scripts/extraer_casos.py` (no editar a mano; regenerar) |",
        f"| Casos | **{len(casos)}** (= {crudos} escenarios Gherkin en las historias) |",
        f"| Casos de regresión (`@regresion`, prioridad M) | **{total_reg}** |",
        "",
        "Cada caso `PF-Mx-nn.k` corresponde al criterio de aceptación `CA-nn.k` de la historia `HU-nn` "
        "y se ejecuta desde `features/HU-nn.feature`. Los pasos completos están en el `.feature`.",
        "",
        "## 1. Resumen",
        "",
    ]
    # por módulo
    filas = []
    for m, hs in modulos.items():
        cs = [c for h in hs for c in h.casos]
        t = Counter(c.tipo for c in cs)
        filas.append((f"M{m:02d} {hs[0].modulo_nombre}", str(len(hs)), str(len(cs)),
                      str(t["funcional"]), str(t["negativo"]), str(t["límite"]),
                      str(sum(c.regresion for c in cs))))
    t = Counter(c.tipo for c in casos)
    filas.append(("**Total**", f"**{len(historias)}**", f"**{len(casos)}**",
                  f"**{t['funcional']}**", f"**{t['negativo']}**", f"**{t['límite']}**",
                  f"**{total_reg}**"))
    o += tabla_conteo("1.1 Por módulo", filas,
                      ("Módulo", "HU", "Casos", "Funcional", "Negativo", "Límite", "@regresion"))
    # por nivel
    nv = Counter(c.nivel for c in casos)
    au = Counter(c.automatizable for c in casos)
    o += tabla_conteo("1.2 Por nivel y automatización",
                      [(n, str(nv[n]), f"{100 * nv[n] / len(casos):.0f} %")
                       for n in ("unitaria", "integración", "E2E")]
                      + [(f"Automatizable: {a}", str(au[a]), f"{100 * au[a] / len(casos):.0f} %")
                         for a in ("Sí", "Parcial")],
                      ("Clasificación", "Casos", "%"))
    # regresión acumulada
    filas, acum, acum_total = [], 0, 0
    for s in sprints:
        nuevos = sum(1 for c in casos if c.sprint == s and c.regresion)
        nuevos_tot = sum(1 for c in casos if c.sprint == s)
        acum += nuevos
        acum_total += nuevos_tot
        hus = sorted({c.hu for c in casos if c.sprint == s and c.regresion})
        filas.append((s, str(nuevos_tot), str(nuevos), str(acum), str(acum_total),
                      ", ".join(f"HU-{x}" for x in hus) or "—"))
    o += tabla_conteo("1.3 Suite de regresión acumulada por sprint", filas,
                      ("Sprint", "Casos nuevos", "Nuevos @regresion", "@regresion acumulados",
                       "Casos totales acumulados", "HU que aportan a regresión"))
    o += [
        "Al cierre de cada sprint se ejecutan los casos del sprint más la suite `@regresion` acumulada:",
        "`npx cucumber-js --tags \"@regresion or @S4\"` (o el filtro equivalente de Playwright `--grep`).",
        "",
        "## 2. Reglas de clasificación",
        "",
        "| Columna | Regla (heurística revisable por QA) |",
        "|---|---|",
        "| Tipo | **límite** si la etiqueta del CA o el título cita un umbral (vigencia de 14 días, 10 %, "
        "redondeo, empate, par/impar, máximos) o es un `Esquema del escenario`; **negativo** si es "
        "validación, error, excepción, permisos, aislamiento, conflicto o falla; si no, **funcional**. |",
        "| Nivel | **E2E** si involucra modo sin conexión o compartir, o es el flujo principal; **unitaria** "
        "si es cálculo puro (HU-07, HU-20, HU-21, HU-36, conversiones, mediana, empates); si no, "
        "**integración** (API NestJS + PostgreSQL con Supertest). |",
        "| Automatizable | **Parcial** cuando depende de push/FCM, ticket/foto, compartir nativo o revisión "
        "del PO: se automatiza con dobles y se completa con verificación manual; si no, **Sí**. |",
        "| Prioridad / Sprint | Tabla resumen (§3) de cada módulo. Prioridad M → `@regresion`. |",
        "",
        "## 3. Casos por módulo",
        "",
    ]
    for m, hs in modulos.items():
        cs = [c for h in hs for c in h.casos]
        o += [f"### M{m:02d} — {hs[0].modulo_nombre} ({len(cs)} casos, "
              f"{sum(c.regresion for c in cs)} @regresion)", "",
              "| PF | HU | Escenario | Tipo | Nivel | Automatizable | Sprint | Prioridad |",
              "|---|---|---|---|---|---|---|---|"]
        for h in hs:
            for c in h.casos:
                esc = c.titulo.replace("|", "\\|")
                o.append(f"| {c.pf} | HU-{c.hu} | {esc} | {c.tipo} | {c.nivel} | "
                         f"{c.automatizable} | {c.sprint} | {c.prioridad} |")
        o.append("")
    return "\n".join(o)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="solo validar")
    args = ap.parse_args()

    errores: list[str] = []
    historias: list[Historia] = []
    crudos = 0
    archivos = sorted(p for p in HISTORIAS.glob("M*.md") if RE_MODULO.match(p.name))
    if not archivos:
        print(f"No hay módulos en {HISTORIAS}", file=sys.stderr)
        return 1
    for ruta in archivos:
        hs, n = parsear_modulo(ruta, errores)
        historias += sorted(hs, key=lambda h: h.hu)
        crudos += n
    casos = [c for h in historias for c in h.casos]
    ids = Counter(c.ca for c in casos)
    errores += [f"{ca} aparece {n} veces en el proyecto" for ca, n in ids.items() if n > 1]
    if len(casos) != crudos:
        errores.append(f"Casos extraídos {len(casos)} ≠ escenarios Gherkin {crudos}")

    if not args.check:
        FEATURES.mkdir(parents=True, exist_ok=True)
        for viejo in FEATURES.glob("HU-*.feature"):
            viejo.unlink()
        for h in historias:
            (FEATURES / f"HU-{h.hu}.feature").write_text(feature(h), encoding="utf-8")
        CASOS_MD.write_text(casos_md(historias, crudos), encoding="utf-8")

    por_mod = Counter(f"M{c.modulo:02d}" for c in casos)
    print(f"Módulos: {len(archivos)} · HU: {len(historias)} · escenarios Gherkin: {crudos} · "
          f"casos: {len(casos)} · @regresion: {sum(c.regresion for c in casos)}")
    print("Por módulo: " + ", ".join(f"{k}={v}" for k, v in sorted(por_mod.items())))
    if errores:
        print("INCONSISTENCIAS:", file=sys.stderr)
        for e in errores:
            print(f"  - {e}", file=sys.stderr)
        return 1
    print("Sin inconsistencias de IDs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
