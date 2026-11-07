"""Lectura y escritura de pagos.

El consecutivo y el folio se asignan dentro de UNA sola transacción, así
que dos escuelas que envíen al mismo tiempo reciben números distintos y
seguidos, sin huecos.
"""

from datetime import datetime, timezone

from ... import folios
from ...db import conexion, marcador, usa_postgres

CAMPOS = (
    "consecutivo", "folio", "procedencia", "institucion", "responsable",
    "correo", "telefono", "equipos", "robots", "unitario", "total",
    "metodo", "estado", "nota", "creado_en", "confirmado_en",
    "comprobante", "comprobante_en",
)

ESTADOS = ("pendiente", "confirmado", "cancelado")


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _a_dict(fila) -> dict:
    return dict(zip(CAMPOS, fila))


def _seleccion() -> str:
    return f"SELECT {', '.join(CAMPOS)} FROM pagos"


def crear(datos: dict) -> dict:
    """Inserta el pago y le asigna su folio consecutivo.

    El INSERT devuelve el consecutivo que asignó la base; con él se arma
    el folio y se guarda en la misma transacción. Si algo falla, no queda
    ni el renglón ni el número consumido a medias.
    """
    m = marcador()
    columnas = (
        "folio", "procedencia", "institucion", "responsable", "correo",
        "telefono", "equipos", "robots", "unitario", "total", "metodo",
        "estado", "nota", "creado_en", "confirmado_en",
    )
    valores = (
        "",                              # el folio se escribe al saber el consecutivo
        datos["procedencia"],
        datos["institucion"],
        datos["responsable"],
        datos["correo"],
        datos["telefono"],
        datos.get("equipos", ""),
        int(datos["robots"]),
        int(datos["unitario"]),
        int(datos["total"]),
        datos["metodo"],
        "pendiente",
        "",
        _ahora(),
        "",
    )
    inserta = (
        f"INSERT INTO pagos ({', '.join(columnas)}) "
        f"VALUES ({', '.join([m] * len(columnas))})"
    )

    with conexion() as conn:
        if usa_postgres():
            cur = conn.execute(inserta + " RETURNING consecutivo", valores)
            consecutivo = cur.fetchone()[0]
        else:
            conn.execute("BEGIN IMMEDIATE")
            cur = conn.execute(inserta, valores)
            consecutivo = cur.lastrowid

        folio = folios.armar_folio(consecutivo, datos["institucion"])
        conn.execute(
            f"UPDATE pagos SET folio = {m} WHERE consecutivo = {m}",
            (folio, consecutivo),
        )
        conn.commit()

        fila = conn.execute(
            f"{_seleccion()} WHERE consecutivo = {m}", (consecutivo,)
        ).fetchone()
        return _a_dict(fila)


def listar(estado: str | None = None) -> list[dict]:
    m = marcador()
    with conexion() as conn:
        if estado:
            filas = conn.execute(
                f"{_seleccion()} WHERE estado = {m} ORDER BY consecutivo", (estado,)
            ).fetchall()
        else:
            filas = conn.execute(f"{_seleccion()} ORDER BY consecutivo").fetchall()
        return [_a_dict(f) for f in filas]


def por_folio(folio: str) -> dict | None:
    m = marcador()
    with conexion() as conn:
        fila = conn.execute(f"{_seleccion()} WHERE folio = {m}", (folio,)).fetchone()
        return _a_dict(fila) if fila else None


def cambiar_estado(folio: str, estado: str, nota: str = "") -> dict | None:
    m = marcador()
    confirmado = _ahora() if estado == "confirmado" else ""
    with conexion() as conn:
        conn.execute(
            f"UPDATE pagos SET estado = {m}, nota = {m}, confirmado_en = {m} "
            f"WHERE folio = {m}",
            (estado, nota, confirmado, folio),
        )
        conn.commit()
        fila = conn.execute(f"{_seleccion()} WHERE folio = {m}", (folio,)).fetchone()
        return _a_dict(fila) if fila else None


def guardar_comprobante(folio: str, archivo: str) -> dict | None:
    """Deja anotado el archivo recibido para ese folio."""
    m = marcador()
    with conexion() as conn:
        conn.execute(
            f"UPDATE pagos SET comprobante = {m}, comprobante_en = {m} WHERE folio = {m}",
            (archivo, _ahora(), folio),
        )
        conn.commit()
        fila = conn.execute(f"{_seleccion()} WHERE folio = {m}", (folio,)).fetchone()
        return _a_dict(fila) if fila else None


def resumen() -> dict:
    """Cuánto se ha cobrado y cuánto falta, para conciliar de un vistazo."""
    pagos = listar()
    def suma(estado):
        return sum(p["total"] for p in pagos if p["estado"] == estado)
    return {
        "pagos": len(pagos),
        "pendientes": sum(1 for p in pagos if p["estado"] == "pendiente"),
        "confirmados": sum(1 for p in pagos if p["estado"] == "confirmado"),
        "robots_confirmados": sum(
            p["robots"] for p in pagos if p["estado"] == "confirmado"
        ),
        "monto_confirmado": suma("confirmado"),
        "monto_pendiente": suma("pendiente"),
        "con_comprobante": sum(1 for p in pagos if p["comprobante"]),
        "sin_comprobante": sum(1 for p in pagos if not p["comprobante"]),
    }
