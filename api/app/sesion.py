"""Entrada al panel con usuario y contraseña.

La contraseña nunca se guarda: en el servidor solo vive su hash scrypt.
Al entrar se entrega un token firmado con HMAC que caduca solo; se firma
en vez de guardarse en memoria para que funcione con varios workers de
gunicorn sin estado compartido.
"""

import base64
import hashlib
import hmac
import secrets
import time

from flask import current_app
from werkzeug.security import check_password_hash

DURACION_HORAS = 12


def _secreto() -> bytes:
    return current_app.config["SECRET_KEY"].encode()


def credenciales_ok(usuario: str, contrasena: str) -> bool:
    esperado = current_app.config["ADMIN_USUARIO"]
    hash_guardado = current_app.config["ADMIN_HASH"]
    if not esperado or not hash_guardado:
        return False

    # Se comprueban las dos cosas siempre, aunque el usuario ya no cuadre:
    # así el tiempo de respuesta no delata si el usuario existe.
    usuario_ok = hmac.compare_digest(usuario, esperado)
    clave_ok = check_password_hash(hash_guardado, contrasena)
    return usuario_ok and clave_ok


def crear_token(usuario: str) -> tuple[str, int]:
    expira = int(time.time()) + DURACION_HORAS * 3600
    cuerpo = f"{usuario}:{expira}:{secrets.token_urlsafe(8)}"
    firma = hmac.new(_secreto(), cuerpo.encode(), hashlib.sha256).hexdigest()
    crudo = base64.urlsafe_b64encode(cuerpo.encode()).decode().rstrip("=")
    return f"{crudo}.{firma}", expira


def token_valido(token: str) -> bool:
    try:
        crudo, firma = token.split(".", 1)
        relleno = "=" * (-len(crudo) % 4)
        cuerpo = base64.urlsafe_b64decode(crudo + relleno).decode()
        usuario, expira, _ = cuerpo.split(":", 2)
    except (ValueError, UnicodeDecodeError):
        return False

    esperada = hmac.new(_secreto(), cuerpo.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(firma, esperada):
        return False
    if int(expira) < time.time():
        return False
    return hmac.compare_digest(usuario, current_app.config["ADMIN_USUARIO"])
