import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR.parent / ".env")


class Config:
    DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"

    # Dominios que pueden llamar a la API. En producción pon el tuyo:
    # CORS_ORIGINS=https://pagos.tudominio.mx
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

    # Token para listar y confirmar pagos. Sin esto, esos endpoints
    # responden 503: nunca quedan abiertos por olvido.
    ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "").strip()

    MAX_ROBOTS = int(os.environ.get("MAX_ROBOTS", "30"))

    # Comprobantes que suben las escuelas.
    COMPROBANTES_DIR = Path(
        os.environ.get("COMPROBANTES_DIR", BASE_DIR.parent / "datos" / "comprobantes")
    )
    MAX_COMPROBANTE_MB = int(os.environ.get("MAX_COMPROBANTE_MB", "8"))

    # Datos bancarios. Viven AQUÍ y no en el repositorio: la página es
    # pública en GitHub y una CLABE en un repo queda indexada y en el
    # historial para siempre. El servidor los entrega al generar el folio.
    TRANSFERENCIA = {
        "banco": os.environ.get("BANCO", ""),
        "titular": os.environ.get("TITULAR", ""),
        "clabe": os.environ.get("CLABE", ""),
        "cuenta": os.environ.get("CUENTA", ""),
    }

    # Las tarifas viven AQUÍ, no en el navegador: el monto se calcula
    # en el servidor para que nadie lo edite desde el inspector.
    TARIFAS = {
        "local": {
            "clave": "L",
            "nombre": "Alumnos del TESCI",
            "precio": int(os.environ.get("PRECIO_LOCAL", "75")),
        },
        "externa": {
            "clave": "E",
            "nombre": "Escuela externa",
            "precio": int(os.environ.get("PRECIO_EXTERNA", "150")),
            "volumen": {
                "desdeRobots": int(os.environ.get("VOLUMEN_DESDE", "10")),
                "precio": int(os.environ.get("PRECIO_VOLUMEN", "100")),
            },
        },
    }
