"""Endpoints del cobro.

Regla de oro: **el monto lo calcula el servidor**, nunca el navegador.
Si se confiara en el total que manda el cliente, cualquiera podría
editarlo y registrar un pago de un peso.
"""

import re
import secrets
from functools import wraps

from flask import Blueprint, jsonify, request, current_app

from . import repository

bp = Blueprint("pagos", __name__, url_prefix="/api/pagos")

OBLIGATORIOS = ("procedencia", "robots", "institucion", "responsable", "correo", "telefono")
CORREO = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


def solo_admin(vista):
    """Protege lo que no debe ver el público: la lista de pagos y su edición."""
    @wraps(vista)
    def envoltura(*args, **kwargs):
        esperado = current_app.config["ADMIN_TOKEN"]
        if not esperado:
            return jsonify({"error": "ADMIN_TOKEN sin configurar en el servidor"}), 503
        recibido = request.headers.get("X-Admin-Token", "")
        if not secrets.compare_digest(recibido, esperado):
            return jsonify({"error": "no autorizado"}), 401
        return vista(*args, **kwargs)
    return envoltura


def calcular(procedencia: str, robots: int) -> tuple[int, int]:
    """Precio por robot y total, según las tarifas del servidor."""
    tarifas = current_app.config["TARIFAS"]
    t = tarifas[procedencia]
    volumen = t.get("volumen")
    unitario = (
        volumen["precio"]
        if volumen and robots >= volumen["desdeRobots"]
        else t["precio"]
    )
    return unitario, unitario * robots


@bp.post("")
def crear_pago():
    datos = request.get_json(silent=True) or {}

    faltan = [c for c in OBLIGATORIOS if not str(datos.get(c, "")).strip()]
    if faltan:
        return jsonify({"error": f"faltan datos: {', '.join(faltan)}"}), 400

    procedencia = str(datos["procedencia"]).strip()
    if procedencia not in current_app.config["TARIFAS"]:
        return jsonify({"error": "tarifa desconocida"}), 400

    try:
        robots = int(datos["robots"])
    except (TypeError, ValueError):
        return jsonify({"error": "robots debe ser un número"}), 400

    tope = current_app.config["MAX_ROBOTS"]
    if not 1 <= robots <= tope:
        return jsonify({"error": f"robots debe estar entre 1 y {tope}"}), 400

    correo = str(datos["correo"]).strip()
    if not CORREO.match(correo):
        return jsonify({"error": "correo inválido"}), 400

    telefono = re.sub(r"\D", "", str(datos["telefono"]))
    if len(telefono) != 10:
        return jsonify({"error": "el teléfono va a 10 dígitos"}), 400

    metodo = str(datos.get("metodo", "transferencia")).strip()
    if metodo not in ("transferencia", "pasarela"):
        metodo = "transferencia"

    unitario, total = calcular(procedencia, robots)

    pago = repository.crear({
        "procedencia": procedencia,
        "institucion": str(datos["institucion"]).strip()[:120],
        "responsable": str(datos["responsable"]).strip()[:80],
        "correo": correo[:120],
        "telefono": telefono,
        "equipos": str(datos.get("equipos", "")).strip()[:300],
        "robots": robots,
        "unitario": unitario,
        "total": total,
        "metodo": metodo,
    })

    # Al público solo le devolvemos lo suyo, no el renglón completo.
    respuesta = {
        "folio": pago["folio"],
        "consecutivo": pago["consecutivo"],
        "robots": pago["robots"],
        "unitario": pago["unitario"],
        "total": pago["total"],
        "estado": pago["estado"],
        "creado_en": pago["creado_en"],
    }

    # Los datos de la cuenta se entregan junto con el folio, para que no
    # tengan que vivir en el repositorio público de la página.
    banco = current_app.config["TRANSFERENCIA"]
    if banco.get("clabe"):
        respuesta["transferencia"] = banco

    return jsonify(respuesta), 201


@bp.get("")
@solo_admin
def listar_pagos():
    estado = request.args.get("estado")
    if estado and estado not in repository.ESTADOS:
        return jsonify({"error": "estado desconocido"}), 400
    return jsonify(repository.listar(estado))


@bp.get("/resumen")
@solo_admin
def ver_resumen():
    return jsonify(repository.resumen())


@bp.get("/<folio>")
@solo_admin
def ver_pago(folio):
    pago = repository.por_folio(folio)
    if pago is None:
        return jsonify({"error": "no encontrado"}), 404
    return jsonify(pago)


@bp.patch("/<folio>")
@solo_admin
def actualizar_pago(folio):
    datos = request.get_json(silent=True) or {}
    estado = str(datos.get("estado", "")).strip()
    if estado not in repository.ESTADOS:
        return jsonify({"error": f"estado debe ser uno de: {', '.join(repository.ESTADOS)}"}), 400

    pago = repository.cambiar_estado(folio, estado, str(datos.get("nota", ""))[:300])
    if pago is None:
        return jsonify({"error": "no encontrado"}), 404
    return jsonify(pago)
