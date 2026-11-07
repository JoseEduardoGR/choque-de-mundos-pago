# Choque de Mundos — página de pago

Página estática para **cobrar la inscripción** al torneo de robótica del Club
ARES (TESCI, 11 de diciembre de 2026).

**Esta página no registra equipos.** El registro de robots, categorías e
integrantes se hace por separado; aquí la escuela solo calcula lo que debe,
obtiene una referencia y los datos para transferir. Pon la liga del formulario
de registro en `registro.url` (`js/config.js`) para que aparezca el recordatorio
con enlace arriba del formulario.

```
index.html          la página
css/estilos.css     estilos
js/config.js        ← lo que tienes que editar
js/app.js           cálculo del monto, folio y datos de pago
img/                logo, banner y convocatoria
api/                servidor de folios y registro de pagos (ver api/LEEME.md)
```

## En línea

| | |
|---|---|
| Página | https://joseeduardogr.github.io/choque-de-mundos-pago/ |
| API | https://ares-pagos.tail9cb92a.ts.net |
| Repositorio | https://github.com/JoseEduardoGR/choque-de-mundos-pago |

La página vive en GitHub Pages (HTTPS, URL fija) y la API en el servidor,
expuesta por **Tailscale Funnel**, que le da HTTPS sin dominio ni abrir
puertos. Se eligió Tailscale porque la red desde la que se trabaja bloquea
`trycloudflare.com`.

Para actualizar la página basta con `git push`: GitHub republica sola.

## Dónde vive

| Pieza | Dónde |
|---|---|
| Servidor | Oracle Cloud · `ubuntu@129.146.170.252` |
| API | `/home/ubuntu/ares_pagos` · systemd `ares_pagos` · `127.0.0.1:4503` |
| Página | `/home/ubuntu/ares_pagos/web` |
| Base de datos | `/home/ubuntu/ares_pagos/datos/pagos.db` (SQLite) |
| Comprobantes | `/home/ubuntu/ares_pagos/datos/comprobantes/` |
| Túnel | servicio systemd `ares_tunel` (Tailscale userspace) |
| Token de admin | `/home/ubuntu/ares_pagos/.env` |

Dos servicios systemd, los dos `enabled`: arrancan solos tras un reinicio
y se levantan de nuevo si se caen (`Restart=always`).

| Servicio | Qué hace |
|---|---|
| `ares_pagos` | La API y la página, en `127.0.0.1:4503` |
| `ares_tunel` | Tailscale en userspace, que publica el 4503 con HTTPS |

```bash
ssh -i ~/.keys/ssh-key-2026-05-28.key ubuntu@129.146.170.252
systemctl status ares_pagos ares_tunel
sudo systemctl restart ares_pagos      # tras cambiar código o .env
```

La configuración del Funnel vive en el estado de Tailscale
(`~/.tailscale`), así que se restaura sola al arrancar el servicio: no hay
que volver a ejecutar `tailscale funnel`. Verificado parando y arrancando
ambos servicios en frío.

Para actualizar la página o la API después de editarlas aquí:

```bash
tar czf - index.html css js img | ssh -i ~/.keys/ssh-key-2026-05-28.key \
  ubuntu@129.146.170.252 'tar xzf - -C ~/ares_pagos/web'
```

## El cierre del registro

El registro cierra el **3 de diciembre de 2026 a las 23:59** (hora del
centro). La portada muestra una cuenta regresiva con meses, días, horas,
minutos y segundos; los meses solo aparecen cuando falta más de uno.

Pasada esa fecha la página **no se elimina**: se oculta el formulario y
aparece un aviso de convocatoria cerrada con los datos de contacto. El
contador deja de contar y dice "Registro cerrado".

La fecha vive en dos lugares y **los dos deben coincidir**:

- `evento.cierreRegistro` en `js/config.js` — lo que ve el visitante.
- `CIERRE_REGISTRO` en el `.env` del servidor — la que de verdad manda.
  El API responde 409 a cualquier intento posterior, así que no sirve de
  nada saltarse la página.

## El comprobante se sube desde la página

Al generar su folio, la escuela ve un recuadro para subir la foto o captura
de su transferencia. El archivo se guarda en el servidor con el nombre del
folio (`0042-TESCI-20261107.jpg`) y queda ligado al pago.

- Se aceptan JPG, PNG, WEBP y PDF, hasta 8 MB.
- El tipo se valida por los **primeros bytes**, no por la extensión: un
  `.jpg` que no sea imagen se rechaza.
- El nombre lo pone el servidor, nunca el navegador.
- Descargarlo exige el token: `GET /api/pagos/<folio>/comprobante`.

**Es la única forma de entregarlo.** Se quitaron a propósito los botones de
mandarlo por WhatsApp o por correo: así todo comprobante queda ligado a su
folio en la base, sin pasos manuales que se pierdan en una conversación.

### Qué revisar al conciliar

```bash
TOKEN=...   # de ~/ares_pagos/.env en el servidor
curl -H "X-Admin-Token: $TOKEN" https://ares-pagos.tail9cb92a.ts.net/api/pagos/resumen
```

El resumen incluye `con_comprobante` y `sin_comprobante`: los segundos son
los que hay que perseguir.

## Los datos bancarios NO van en este repositorio

El repositorio es público. Una CLABE aquí queda indexada y en el historial
de git para siempre, así que los datos reales viven en el `.env` del
servidor y la API los entrega junto con el folio:

```bash
# en ~/ares_pagos/.env del servidor
BANCO=...
TITULAR=...
CLABE=...
CUENTA=...
```

Luego `sudo systemctl restart ares_pagos`. En `js/config.js` esos campos
deben quedarse vacíos.

## Dos modos de funcionar

**Con servidor** (`api.url` puesta en `js/config.js`): el folio es
**consecutivo** — `0001-TESCI-20261106`, `0002-…` — y cada pago queda
guardado en la base. Es el modo recomendado. Arranca el servidor con las
instrucciones de `api/LEEME.md`.

**Sin servidor** (`api.url` vacía): la página sigue funcionando sola y se
sube a cualquier hosting estático, pero el folio se genera en el navegador,
no es consecutivo y nada se guarda. La ficha avisa que es provisional.

Si el servidor está configurado pero no responde, la página no deja tirado
a nadie: genera un folio provisional, lo marca como tal y pide el
comprobante por WhatsApp.

---

## 1. Cómo se cobra

Se cobra **por robot**. Un pago cubre todos los robots de una escuela bajo un
mismo folio.

| Quién inscribe | Robots | Precio por robot | Ejemplo |
|---|---|---|---|
| Alumnos del TESCI | cualquiera | **$75** | 12 robots = $900 |
| Escuela externa | 1 a 9 | **$150** | 9 robots = $1,350 |
| Escuela externa | 10 o más | **$100** (a todos) | 10 robots = $1,000 |

> **Ojo con el escalón.** Como la tarifa de $100 se aplica a todos los robots,
> 10 robots ($1,000) salen más baratos que 9 ($1,350). De hecho desde 7 robots
> ya conviene llegar a 10. La página avisa de esto cuando pasa
> (*"Con 10 robots el total baja a $1,000…"*) para que nadie reclame después.
>
> Si prefieres que nunca baje el total al agregar robots, cambia el cálculo a
> escalonado: los primeros 10 a $150 y del 11 en adelante a $100. Dímelo y lo ajusto.

Todo esto vive en `tarifas` dentro de `js/config.js`.

---

## 2. Lo que falta por llenar

Todo en `js/config.js`, marcado con `// ⚠ CAMBIAR`.

| Dato | Dónde | Hoy tiene |
|---|---|---|
| Ligas de pago (15) | `pasarela.ligasPorTotal` | vacías, y la pasarela apagada |
| Banco, titular, CLABE, cuenta | `transferencia` | datos de ejemplo |
| WhatsApp y correo del club | `contacto` | datos de ejemplo |
| URL del reglamento | `contacto.reglamentoUrl` | `#` |
| Liga del formulario de registro | `registro.url` | vacía |
| Tope de robots por pago | `maxRobots` | 30 |

Las tarifas ($75 / $150 / $100) ya están con los valores que diste.

---

## 2b. Encender la pasarela más adelante (Mercado Pago)

Esta sección es para cuando quieras activar el cobro con tarjeta. Mientras
tanto no tienes que hacer nada de aquí.

Mercado Pago se eligió porque **su cuenta personal se abre solo con INE**, sin
RFC ni actividad empresarial. A cambio, su Link de Pago es de **monto fijo**,
así que hace falta una liga por cada total posible.

Como varios totales se repiten entre tarifas, **una liga sirve para las dos**:
la de $300 cubre tanto 4 alumnos del TESCI como 2 robots de escuela externa.
Por eso son 15 ligas y no 60.

### Las 15 ligas que hay que crear

| Monto de la liga | Cubre |
|---|---|
| **$75** | 1 local |
| **$150** | 2 locales · 1 externo |
| **$225** | 3 locales |
| **$300** | 4 locales · 2 externos |
| **$375** | 5 locales |
| **$450** | 6 locales · 3 externos |
| **$525** | 7 locales |
| **$600** | 8 locales · 4 externos |
| **$675** | 9 locales |
| **$750** | 10 locales · 5 externos |
| **$900** | 6 externos |
| **$1,000** | 10 externos |
| **$1,050** | 7 externos |
| **$1,200** | 8 externos |
| **$1,350** | 9 externos |

Cubren hasta 10 robots. Arriba de eso la página manda a transferencia sola; si
quieres cubrir más, agrega la clave con su total en `pasarela.ligasPorTotal`.

### Cómo crear cada una

0. Pon `pasarela.activa: true` en `js/config.js`.
1. En la app de Mercado Pago: **Cobrar → Link de pago**.
2. Escribe el monto de la tabla. Nómbrala algo como *"Choque de Mundos — $300"*
   para reconocerla después.
3. Copia la URL y pégala en su renglón de `pasarela.ligasPorTotal`
   en `js/config.js`. El renglón ya está escrito con su monto y su comentario:
   solo pones la URL entre las comillas.

### Lo que debes saber

- **El folio no viaja con el pago.** Con ligas fijas no hay campo de
  referencia, así que la página le pide a la escuela que mande el comprobante
  con su folio por WhatsApp. Es el paso que te permite identificar quién pagó:
  no lo quites de las instrucciones.
- **Sin RFC aplican retenciones** de ISR e IVA sobre lo que cobres, además de
  la comisión (3.49% + $4 MXN al instante, 2.95% + $4 a 30 días, más IVA).
  Confirma los porcentajes con un contador antes de fijar los precios.
- **Si un total no tiene liga**, la página lo avisa desde el paso de pago y
  manda a transferencia. Nunca deja a nadie atorado.

---

## 3. Qué pasa cuando alguien paga

1. Elige su tarifa y cuántos robots paga. El total se calcula al momento.
2. Captura la escuela, el responsable, su contacto y, opcionalmente, los
   nombres de los equipos o robots que cubre el pago. Ese campo es lo que te
   permite cruzar el pago con los registros hechos aparte.
3. Genera un folio, por ejemplo `CDM26-E-7K2Q` (`CDM26` + `L`/`E` según la
   tarifa + 4 caracteres al azar).
4. Obtiene los datos bancarios con el folio como concepto, y envía su
   comprobante por WhatsApp o correo con un mensaje ya redactado, o descarga
   la ficha en `.txt`.

### Cómo conciliar

El folio es tuyo para rastrear el dinero; los campos **Escuela** y **Cubre**
son los que amarran ese dinero con los registros. Si una escuela paga 8 robots,
en *Cubre* debería escribir los 8 nombres. Vale la pena decirlo también en el
formulario de registro, para que usen los mismos nombres en los dos lados.

### Importante: dónde quedan los pagos

**La página no guarda los pagos en ningún lado.** Como es estática, los
datos te llegan por el WhatsApp o el correo que manda el equipo. Si quieres
que además caigan solos en una hoja de cálculo, llena `endpointRegistro`:

- **Formspree** — crea un formulario gratis en formspree.io y pega la URL
  `https://formspree.io/f/xxxxxxx`.
- **Google Sheets** — publica un Apps Script como aplicación web que escriba
  en tu hoja y pega la URL `https://script.google.com/macros/s/.../exec`.

Sin eso, lleva el control a mano con los comprobantes que te lleguen.

---

## 4. Probar en local

```bash
python3 -m http.server 8777
```

Y abre `http://localhost:8777`.

---

## 5. Cosas que conviene revisar antes de publicar

- [ ] Datos bancarios reales: es la única forma de pago activa hoy
- [ ] Liga del formulario de registro en `registro.url`
- [ ] Decidir si el escalón de 9 → 10 robots se queda como está
- [ ] CLABE a 18 dígitos, verificada con una transferencia de prueba
- [ ] WhatsApp con lada de país y sin espacios (`525512345678`)
- [ ] URL del reglamento
- [ ] Decidir a nombre de quién va la cuenta que recibe las inscripciones
- [ ] Dejar claro en el formulario de registro que el pago se hace en esta página
