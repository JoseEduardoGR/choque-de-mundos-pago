FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# SQLite vive aquí. En Fly.io / Render monta un volumen en /datos
# o el archivo se pierde en cada despliegue.
ENV SQLITE_PATH=/datos/pagos.db
VOLUME ["/datos"]

EXPOSE 5055
CMD ["gunicorn", "--bind", "0.0.0.0:5055", "--workers", "2", "--timeout", "60", "run:app"]
