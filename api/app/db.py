"""Acceso a la base de datos.

SQLite por defecto: un archivo, cero servicios que administrar y
transacciones de verdad, que es lo único que hace falta para que el
consecutivo del folio no se repita ni se salte.

Si algún día crece, basta con poner DATABASE_URL apuntando a PostgreSQL
(el mismo servidor de GR Code sirve, pero en SU PROPIA base de datos).
"""

import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

ESQUEMA_SQLITE = """
CREATE TABLE IF NOT EXISTS pagos (
    consecutivo  INTEGER PRIMARY KEY AUTOINCREMENT,
    folio        TEXT    NOT NULL UNIQUE,
    procedencia  TEXT    NOT NULL,
    institucion  TEXT    NOT NULL,
    responsable  TEXT    NOT NULL,
    correo       TEXT    NOT NULL,
    telefono     TEXT    NOT NULL,
    equipos      TEXT    NOT NULL DEFAULT '',
    robots       INTEGER NOT NULL,
    unitario     INTEGER NOT NULL,
    total        INTEGER NOT NULL,
    metodo       TEXT    NOT NULL,
    estado       TEXT    NOT NULL DEFAULT 'pendiente',
    nota         TEXT    NOT NULL DEFAULT '',
    creado_en    TEXT    NOT NULL,
    confirmado_en TEXT   NOT NULL DEFAULT '',
    comprobante  TEXT    NOT NULL DEFAULT '',
    comprobante_en TEXT  NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_institucion ON pagos(institucion);
"""

ESQUEMA_POSTGRES = """
CREATE TABLE IF NOT EXISTS pagos (
    consecutivo  BIGSERIAL PRIMARY KEY,
    folio        TEXT    NOT NULL UNIQUE,
    procedencia  TEXT    NOT NULL,
    institucion  TEXT    NOT NULL,
    responsable  TEXT    NOT NULL,
    correo       TEXT    NOT NULL,
    telefono     TEXT    NOT NULL,
    equipos      TEXT    NOT NULL DEFAULT '',
    robots       INTEGER NOT NULL,
    unitario     INTEGER NOT NULL,
    total        INTEGER NOT NULL,
    metodo       TEXT    NOT NULL,
    estado       TEXT    NOT NULL DEFAULT 'pendiente',
    nota         TEXT    NOT NULL DEFAULT '',
    creado_en    TEXT    NOT NULL,
    confirmado_en TEXT   NOT NULL DEFAULT '',
    comprobante  TEXT    NOT NULL DEFAULT '',
    comprobante_en TEXT  NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_institucion ON pagos(institucion);
"""

_candado = threading.Lock()
_pool = None


def url_base_datos() -> str:
    return os.environ.get("DATABASE_URL", "").strip()


def usa_postgres() -> bool:
    return url_base_datos().startswith(("postgres://", "postgresql://"))


def ruta_sqlite() -> Path:
    return Path(os.environ.get("SQLITE_PATH", BASE_DIR / "datos" / "pagos.db"))


def _pool_postgres():
    global _pool
    if _pool is None:
        from psycopg_pool import ConnectionPool
        _pool = ConnectionPool(
            url_base_datos(),
            max_size=int(os.environ.get("DB_POOL_MAX", "10")),
            open=True,
        )
    return _pool


@contextmanager
def conexion():
    """Entrega una conexión con transacción, en SQLite o en PostgreSQL."""
    if usa_postgres():
        with _pool_postgres().connection() as conn:
            yield conn
        return

    archivo = ruta_sqlite()
    archivo.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(archivo, timeout=15, isolation_level=None)
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=15000")
        yield conn
    finally:
        conn.close()


# Columnas añadidas después de la primera versión de la tabla.
COLUMNAS_NUEVAS = (("comprobante", "TEXT"), ("comprobante_en", "TEXT"))


def preparar() -> None:
    """Crea la tabla si no existe y agrega columnas nuevas. Al arrancar."""
    with _candado, conexion() as conn:
        esquema = ESQUEMA_POSTGRES if usa_postgres() else ESQUEMA_SQLITE
        if usa_postgres():
            for sentencia in filter(str.strip, esquema.split(";")):
                conn.execute(sentencia)
            conn.commit()
        else:
            conn.executescript(esquema)

        # Migración simple: agregar lo que falte sin tocar los datos.
        for nombre, tipo in COLUMNAS_NUEVAS:
            try:
                conn.execute(
                    f"ALTER TABLE pagos ADD COLUMN {nombre} {tipo} NOT NULL DEFAULT ''"
                )
            except Exception:
                pass          # ya existía
        if usa_postgres():
            conn.commit()


def marcador() -> str:
    """El marcador de parámetros cambia entre los dos motores."""
    return "%s" if usa_postgres() else "?"
