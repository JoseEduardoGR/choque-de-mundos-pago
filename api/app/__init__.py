import os
from pathlib import Path

from flask import Flask, jsonify, redirect, send_from_directory
from flask_cors import CORS

from . import db
from .config import Config

# A dónde mandar a quien llegue a la raíz del servidor. La página vive en
# GitHub Pages; aquí solo corre la API.
PAGINA = os.environ.get(
    "PAGINA_URL", "https://joseeduardogr.github.io/choque-de-mundos-pago/"
)

# Carpeta con la página, solo si se quiere servir desde aquí. Normalmente
# no existe: la página la publica GitHub Pages.
WEB_DIR = Path(os.environ.get("WEB_DIR", Path(__file__).resolve().parent.parent / "web"))


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    # Tope de subida: un comprobante es una foto, no un video.
    app.config["MAX_CONTENT_LENGTH"] = app.config["MAX_COMPROBANTE_MB"] * 1024 * 1024
    app.config["COMPROBANTES_DIR"].mkdir(parents=True, exist_ok=True)

    @app.errorhandler(413)
    def muy_grande(_):
        tope = app.config["MAX_COMPROBANTE_MB"]
        return jsonify({"error": f"el archivo pasa de {tope} MB"}), 413

    db.preparar()

    from .modules.pagos.routes import bp as pagos_bp
    app.register_blueprint(pagos_bp)

    @app.get("/api/salud")
    def salud():
        return jsonify({
            "estado": "ok",
            "motor": "postgres" if db.usa_postgres() else "sqlite",
            "admin_configurado": bool(
                app.config["ADMIN_TOKEN"] or app.config["ADMIN_HASH"]
            ),
            "sirve_pagina": WEB_DIR.is_dir(),
        })

    if not WEB_DIR.is_dir():
        # Sin carpeta web, quien llegue a la raíz va a la página de verdad
        # en vez de encontrarse un 404.
        @app.get("/")
        def a_la_pagina():
            return redirect(PAGINA, code=302)

    if WEB_DIR.is_dir():
        @app.get("/")
        def portada():
            return send_from_directory(WEB_DIR, "index.html")

        @app.get("/<path:recurso>")
        def estaticos(recurso):
            destino = WEB_DIR / recurso
            if destino.is_file():
                return send_from_directory(WEB_DIR, recurso)
            # Carpetas con su propio index, como /admin/
            if destino.is_dir() and (destino / "index.html").is_file():
                return send_from_directory(destino, "index.html")
            return send_from_directory(WEB_DIR, "index.html")

    return app
