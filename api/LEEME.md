# API de pagos — Choque de Mundos

Servidor que entrega **folios consecutivos** y guarda cada pago.
Flask + SQLite, con el mismo patrón de blueprints que GR Code.

```
run.py                        arranque
app/config.py                 tarifas y token de administración
app/db.py                     SQLite por defecto, PostgreSQL opcional
app/folios.py                 [consecutivo]-[ESCUELA]-[fecha]
app/modules/pagos/            endpoints y acceso a datos
```

## Por qué es un servicio aparte de GR Code

GR Code **no tiene autenticación**: sus endpoints de tarjetas, gastos,
ganancias y ahorros son CRUD abiertos. Desplegarlo a internet para recibir
los pagos del torneo dejaría esas finanzas personales al alcance de
cualquiera con la URL. Este servicio reutiliza el patrón, no la instancia.

## Levantarlo en local

El proyecto vive en **exFAT**, que no admite symlinks, así que el entorno
virtual no puede crearse dentro de la carpeta. Va en el home:

```bash
python3 -m venv ~/.venvs/ares-pagos
~/.venvs/ares-pagos/bin/pip install -r requirements.txt

cp .env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # pégalo en ADMIN_TOKEN

~/.venvs/ares-pagos/bin/python run.py     # http://127.0.0.1:5055
```

Luego pon `api.url` en `../js/config.js` apuntando al servidor.

## Endpoints

| Método | Ruta | Quién | Para qué |
|---|---|---|---|
| `GET` | `/api/salud` | público | Verificar que responde |
| `POST` | `/api/pagos` | público | Registrar un pago y obtener su folio |
| `GET` | `/api/pagos` | admin | Listar todos (`?estado=pendiente`) |
| `GET` | `/api/pagos/resumen` | admin | Cuánto se ha cobrado y cuánto falta |
| `GET` | `/api/pagos/<folio>` | admin | Ver uno |
| `PATCH` | `/api/pagos/<folio>` | admin | Confirmar o cancelar |

Lo marcado como **admin** exige la cabecera `X-Admin-Token`. Sin el token
configurado esos endpoints responden 503: nunca quedan abiertos por olvido.

```bash
TOKEN=$(grep ADMIN_TOKEN .env | cut -d= -f2)
curl -H "X-Admin-Token: $TOKEN" http://127.0.0.1:5055/api/pagos/resumen

curl -X PATCH -H "X-Admin-Token: $TOKEN" -H 'Content-Type: application/json' \
     -d '{"estado":"confirmado","nota":"SPEI recibido"}' \
     http://127.0.0.1:5055/api/pagos/0001-TESCI-20261106
```

## El monto lo calcula el servidor

El navegador manda solo `procedencia` y `robots`. Las tarifas viven en
`app/config.py` (ajustables por variables de entorno) y el servidor
recalcula precio unitario y total. Un `total` enviado por el cliente se
ignora: ya está probado que un POST con `total: 1` registra el monto real.

Si cambias un precio, cámbialo **en los dos lados**: `.env` del servidor y
`js/config.js` del front, que solo lo usa para mostrarlo en pantalla.

## El folio

```
0042-TESCI-20261106
  │     │       └── fecha, hora del centro de México
  │     └────────── sigla de la escuela, sin acentos
  └──────────────── consecutivo que entrega la base de datos
```

El consecutivo sale de la llave primaria autoincremental, asignada dentro
de la misma transacción que el INSERT. Probado con 60 peticiones
simultáneas: sin huecos y sin repetidos.

La sigla se deduce del nombre (`Tecnológico de Estudios Superiores de
Cuautitlán Izcalli` → `TESCI`, `CECyTEM Nicolás Romero` → `CECYTEM`), para
que el folio quepa en los 40 caracteres del concepto SPEI y no lleve
acentos que algunos bancos rechazan.

## Desplegar

```bash
docker build -t ares-pagos .
docker run -p 5055:5055 --env-file .env -v ares_datos:/datos ares-pagos
```

**El volumen no es opcional.** En Fly.io, Render o Railway el disco es
efímero: sin un volumen montado en `/datos`, la base y todos los folios
desaparecen en cada despliegue.

Al desplegar, en `.env`:

- `ADMIN_TOKEN` — uno nuevo, distinto al de desarrollo.
- `CORS_ORIGINS` — el dominio de la página, no `*`.
- `FLASK_DEBUG=0`.

Para usar PostgreSQL en vez de SQLite, descomenta `psycopg` en
`requirements.txt` y pon `DATABASE_URL`. Usa **su propia base de datos**,
nunca la de GR Code.
