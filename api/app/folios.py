"""Armado del folio: [consecutivo]-[ESCUELA]-[fecha].

El consecutivo lo entrega la base de datos, así que nunca se repite ni
se salta. Aquí solo se arma el texto legible que va como concepto de la
transferencia, donde el banco acepta 40 caracteres y rechaza acentos.
"""

import re
import unicodedata
from datetime import datetime, timezone, timedelta

# Hora del centro de México: la fecha del folio debe ser la local, no UTC.
ZONA_MX = timezone(timedelta(hours=-6))

# Palabras que no aportan nada a una sigla.
VACIAS = {"DE", "DEL", "LA", "LAS", "EL", "LOS", "Y", "EN", "A", "NUM", "NO"}

LARGO_MAX_SIGLA = 10


def _sin_acentos(texto: str) -> str:
    descompuesto = unicodedata.normalize("NFD", texto)
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")


def sigla_de_escuela(nombre: str) -> str:
    """Reduce el nombre de una escuela a una sigla corta y sin acentos.

    'Tecnológico de Estudios Superiores de Cuautitlán Izcalli' -> 'TESCI'
    'CBTIS 120 — Cuautitlán'                                   -> 'CBTIS120'
    'Colegio Simón Bolívar'                                    -> 'CSB'
    """
    limpio = _sin_acentos(nombre or "").strip()
    if not limpio:
        return "SINESC"

    palabras = [p for p in re.split(r"[^A-Za-z0-9]+", limpio) if p]
    if not palabras:
        return "SINESC"

    # 1. Si ya trae una sigla, esa manda. Cuenta como sigla la palabra
    #    con varias mayúsculas después de la primera letra: además de
    #    CBTIS o UNAM, atrapa las mixtas como CECyTEM o CBTis.
    for i, palabra in enumerate(palabras):
        mayusculas_internas = sum(1 for c in palabra[1:] if c.isupper())
        if len(palabra) >= 3 and palabra.isalpha() and mayusculas_internas >= 2:
            sigla = palabra.upper()
            # Pega el número que venga justo después: CBTIS 120 -> CBTIS120
            if i + 1 < len(palabras) and palabras[i + 1].isdigit():
                sigla += palabras[i + 1]
            return sigla[:LARGO_MAX_SIGLA]

    # 2. Si no, iniciales de las palabras con significado.
    iniciales = "".join(
        p[0] for p in palabras
        if p.isalpha() and p.upper() not in VACIAS and len(p) >= 3
    ).upper()
    if len(iniciales) >= 2:
        return iniciales[:LARGO_MAX_SIGLA]

    # 3. Último recurso: las primeras letras del nombre.
    return re.sub(r"[^A-Za-z0-9]", "", limpio).upper()[:LARGO_MAX_SIGLA] or "SINESC"


def fecha_folio(momento: datetime | None = None) -> str:
    """AAAAMMDD en hora del centro de México."""
    ahora = momento or datetime.now(ZONA_MX)
    if ahora.tzinfo is None:
        ahora = ahora.replace(tzinfo=ZONA_MX)
    return ahora.astimezone(ZONA_MX).strftime("%Y%m%d")


def armar_folio(consecutivo: int, escuela: str, momento: datetime | None = None) -> str:
    """0042-TESCI-20261106"""
    return f"{consecutivo:04d}-{sigla_de_escuela(escuela)}-{fecha_folio(momento)}"
