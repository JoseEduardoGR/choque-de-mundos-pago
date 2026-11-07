import os
from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from . import db
from .config import Config

# Carpeta con la página. Si existe, la sirve el mismo servidor que la API:
# así ambas comparten origen y basta un solo túnel, sin nginx de por medio.
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
            "admin_configurado": bool(app.config["ADMIN_TOKEN"]),
            "pagina": WEB_DIR.is_dir(),
        })

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
