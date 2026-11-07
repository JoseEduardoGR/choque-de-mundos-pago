/* ============================================================
   Choque de Mundos — cobro de la inscripción
   Depende de js/config.js

   Esta página SOLO cobra. El registro de equipos y robots se
   hace por separado, así que aquí basta con saber cuántos
   robots se pagan y a nombre de quién, para poder conciliar.
   ============================================================ */

(function () {
  'use strict';

  const $  = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

  const pesos = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 0
  });

  function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const estado = {
    procedencia: null,          // 'local' | 'externa'
    robots: 1,
    registro: null
  };

  let institucionAutollenada = false;   // ¿el nombre de la escuela lo puso la página?

  /* ==========================================================
     1 · Tarifas y monto
     ========================================================== */

  function tarifaActual() {
    return estado.procedencia ? CONFIG.tarifas[estado.procedencia] : null;
  }

  /** Precio por robot según la tarifa y cuántos robots se pagan. */
  function precioUnitario(procedencia, cuantos) {
    const t = CONFIG.tarifas[procedencia];
    if (!t) return 0;
    if (t.volumen && cuantos >= t.volumen.desdeRobots) return t.volumen.precio;
    return t.precio;
  }

  function totalAPagar() {
    if (!estado.procedencia) return 0;
    return estado.robots * precioUnitario(estado.procedencia, estado.robots);
  }

  /**
   * Con el corte por volumen, llegar al umbral puede salir más barato
   * que quedarse justo debajo. En vez de dejar que la escuela lo
   * descubra sola, se lo decimos.
   */
  function ahorroPorLlegarAlUmbral() {
    const t = tarifaActual();
    if (!t || !t.volumen) return null;

    const n = estado.robots;
    const umbral = t.volumen.desdeRobots;
    if (n === 0 || n >= umbral) return null;

    const ahora = n * t.precio;
    const conUmbral = umbral * t.volumen.precio;
    if (conUmbral >= ahora) return null;

    return { faltan: umbral - n, umbral, conUmbral, ahorro: ahora - conUmbral };
  }

  function pintarTarifas() {
    const contenedor = $('#tarifas');
    const legend = contenedor.querySelector('legend');
    contenedor.innerHTML = '';
    contenedor.appendChild(legend);

    Object.entries(CONFIG.tarifas).forEach(([clave, t]) => {
      const label = document.createElement('label');
      label.className = 'tarifa';
      label.setAttribute('for', `tarifa-${clave}`);

      const escalon = t.volumen
        ? `${pesos.format(t.volumen.precio)} por robot a partir de ${t.volumen.desdeRobots}`
        : 'Mismo precio sin importar cuántos robots traigas';

      label.innerHTML = `
        <input type="radio" name="procedencia" id="tarifa-${clave}" value="${clave}">
        <span class="tarifa__cuerpo">
          <span class="tarifa__nombre">${t.nombre}</span>
          <span class="tarifa__detalle">${t.detalle}</span>
          <span class="tarifa__precio">
            <strong>${pesos.format(t.precio)}</strong>
            <span>por robot</span>
          </span>
          <span class="tarifa__escalon">${escalon}</span>
        </span>`;

      contenedor.appendChild(label);
    });

    $$('input[name="procedencia"]', contenedor).forEach(radio => {
      radio.addEventListener('change', () => {
        estado.procedencia = radio.value;
        ocultarError('#error-tarifa');
        aplicarInstitucionDeTarifa();
        actualizarResumen();
      });
    });
  }

  /**
   * Las tarifas internas ya saben de qué escuela vienen, así que el campo
   * se llena solo. Si el equipo lo edita, respetamos lo que escribió.
   */
  function aplicarInstitucionDeTarifa() {
    const campo = $('#institucion');
    const ayuda = $('#ayuda-institucion');
    const t = tarifaActual();

    if (t && t.institucion) {
      campo.value = t.institucion;
      institucionAutollenada = true;
      ayuda.textContent = 'Se llenó con la tarifa que elegiste. Puedes agregar tu carrera o plantel.';
      campo.removeAttribute('aria-invalid');
      return;
    }

    if (institucionAutollenada) {
      campo.value = '';
      institucionAutollenada = false;
    }
    ayuda.textContent = 'Como la escribiste al registrarte.';
  }

  /* ==========================================================
     2 · Contador de robots
     ========================================================== */

  function fijarRobots(cuantos) {
    const tope = CONFIG.maxRobots || 30;
    estado.robots = Math.min(Math.max(Math.round(cuantos) || 1, 1), tope);
    $('#robots').value = String(estado.robots);
    $('#menos').disabled = estado.robots <= 1;
    $('#mas').disabled = estado.robots >= tope;
    ocultarError('#error-robots');
    actualizarResumen();
  }

  function pintarCuenta() {
    const t = tarifaActual();
    const cuenta = $('#cuenta');
    if (!t) {
      cuenta.textContent = `${estado.robots} robot${estado.robots === 1 ? '' : 's'}`;
      return;
    }
    const unitario = precioUnitario(estado.procedencia, estado.robots);
    cuenta.textContent =
      `${estado.robots} × ${pesos.format(unitario)} = ${pesos.format(totalAPagar())}`;
  }

  /* ==========================================================
     3 · Resumen
     ========================================================== */

  function actualizarResumen() {
    const t = tarifaActual();
    const unitario = estado.procedencia
      ? precioUnitario(estado.procedencia, estado.robots) : 0;

    $('#r-tarifa').textContent   = t ? t.nombre : 'Sin elegir';
    $('#r-escuela').textContent  = $('#institucion').value.trim() || '—';
    $('#r-robots').textContent   = String(estado.robots);
    $('#r-unitario').textContent = t ? pesos.format(unitario) : '—';
    $('#r-total').textContent    = pesos.format(totalAPagar());

    $('#r-nota').textContent = t
      ? 'Los lugares se apartan cuando confirmamos el pago.'
      : 'Elige tu tarifa para ver el costo.';

    pintarCuenta();
    pintarPistaVolumen();
    avisarSiFaltaLiga();
  }

  function pintarPistaVolumen() {
    const pista = $('#pista-volumen');
    const t = tarifaActual();
    pista.classList.remove('pista--lograda');

    if (t && t.volumen && estado.robots >= t.volumen.desdeRobots) {
      pista.hidden = false;
      pista.classList.add('pista--lograda');
      pista.textContent =
        `Tarifa por volumen aplicada: ${pesos.format(t.volumen.precio)} por robot ` +
        `en lugar de ${pesos.format(t.precio)}.`;
      return;
    }

    const oportunidad = ahorroPorLlegarAlUmbral();
    if (!oportunidad) { pista.hidden = true; return; }

    pista.hidden = false;
    pista.textContent =
      `Con ${oportunidad.umbral} robots el total baja a ${pesos.format(oportunidad.conUmbral)}. ` +
      `Te ${oportunidad.faltan === 1 ? 'falta 1 robot' : `faltan ${oportunidad.faltan} robots`} ` +
      `y pagarías ${pesos.format(oportunidad.ahorro)} menos que ahora.`;
  }

  /**
   * Avisa en el propio paso de pago cuando el total no tiene liga en línea,
   * en vez de dejar que la escuela lo descubra hasta la ficha.
   */
  function avisarSiFaltaLiga() {
    const aviso = $('#aviso-metodo');
    if (CONFIG.pasarela.activa === false) { aviso.hidden = true; return; }

    const total = totalAPagar();
    const falta = estado.procedencia && total > 0 && !ligaPorTotal(total);
    aviso.hidden = !falta;
    if (falta) {
      aviso.textContent =
        `Para un total de ${pesos.format(total)} todavía no hay pago en línea. ` +
        `Elige transferencia o escríbenos y te mandamos la liga.`;
    }
  }

  /* ==========================================================
     4 · Validación
     ========================================================== */

  function mostrarError(sel, texto) {
    const nodo = $(sel);
    nodo.textContent = texto;
    nodo.hidden = false;
  }
  function ocultarError(sel) {
    const nodo = $(sel);
    nodo.hidden = true;
    nodo.textContent = '';
  }

  function validar() {
    ['#error-formulario', '#error-tarifa', '#error-robots'].forEach(ocultarError);
    $$('[aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));

    if (!estado.procedencia) {
      mostrarError('#error-tarifa', 'Elige si pagas como alumno del TESCI o como escuela externa.');
      $('#paso-monto').scrollIntoView({ block: 'center' });
      return null;
    }

    if (estado.robots < 1) {
      mostrarError('#error-robots', 'Indica cuántos robots estás pagando.');
      $('#robots').focus();
      return null;
    }

    const texto = sel => $(sel).value.trim();
    const obligatorios = [
      ['#institucion', 'Escribe la escuela o institución que representan.'],
      ['#responsable', 'Escribe el nombre de quien responde por el pago.']
    ];
    for (const [sel, mensaje] of obligatorios) {
      if (!texto(sel)) return fallar(sel, mensaje);
    }

    const correo = texto('#correo');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
      return fallar('#correo', 'Revisa el correo: ahí te confirmamos el pago.');
    }

    const telefono = texto('#telefono').replace(/\D/g, '');
    if (telefono.length !== 10) {
      return fallar('#telefono', 'El WhatsApp va a 10 dígitos, sin lada de país ni espacios.');
    }

    const unitario = precioUnitario(estado.procedencia, estado.robots);

    return {
      procedencia: estado.procedencia,
      tarifa:      CONFIG.tarifas[estado.procedencia],
      institucion: texto('#institucion'),
      responsable: texto('#responsable'),
      equipos:     texto('#equipos'),
      correo,
      telefono,
      cuantos: estado.robots,
      unitario,
      total:  estado.robots * unitario,
      metodo: $('input[name="metodo"]:checked').value,
      fecha:  new Date().toISOString()
    };
  }

  function fallar(sel, mensaje) {
    const campo = $(sel);
    campo.setAttribute('aria-invalid', 'true');
    mostrarError('#error-formulario', mensaje);
    campo.focus();
    return null;
  }

  /* ==========================================================
     5 · Folio
     ========================================================== */

  /* Alfabeto de 32 símbolos sin I, O, 0 ni 1: nadie se equivoca al
     dictarlo por teléfono ni al copiarlo al concepto del banco. */
  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const EPOCA = Date.UTC(2026, 0, 1);

  function base32(numero, largo) {
    let texto = '';
    for (let i = 0; i < largo; i++) {
      texto = ALFABETO[numero % 32] + texto;
      numero = Math.floor(numero / 32);
    }
    return texto;
  }

  /**
   * El folio se arma con el segundo en que se generó más tres caracteres
   * al azar. Sin servidor no hay forma de garantizar que no se repita,
   * pero así dos folios solo chocan si salen en el MISMO segundo y además
   * coincide el azar: una entre 32 768 para ese par.
   */
  function generarFolio(claveTarifa) {
    const segundos = Math.max(0, Math.floor((Date.now() - EPOCA) / 1000)) % (32 ** 5);
    const azar = new Uint32Array(3);
    (window.crypto || window.msCrypto).getRandomValues(azar);

    let cola = '';
    for (let i = 0; i < 3; i++) cola += ALFABETO[azar[i] % 32];

    return `${CONFIG.evento.claveFolio}-${claveTarifa}-${base32(segundos, 5)}-${cola}`;
  }

  /**
   * Pide el folio al servidor, que lo entrega consecutivo y además deja
   * el pago registrado. Si el servidor no está configurado o no responde,
   * seguimos con un folio provisional: más vale cobrar con una referencia
   * imperfecta que dejar a la escuela sin poder pagar.
   */
  async function asignarFolio(pago) {
    const configurada = (CONFIG.api && CONFIG.api.url || '').replace(/\/+$/, '');
    pago.provisional = false;

    // Sin URL configurada usamos la misma carpeta desde la que se sirve la
    // página, no la raíz del dominio: así da igual que esté colgada en
    // /pagos/ detrás de un nginx o directamente en la raíz de un túnel.
    let destino;
    if (configurada) {
      destino = `${configurada}/api/pagos`;
    } else if (location.protocol.startsWith('http')) {
      destino = new URL('api/pagos', document.baseURI).href;
    } else {
      pago.folio = generarFolio(pago.tarifa.clave);
      pago.provisional = true;
      return;
    }

    try {
      const respuesta = await fetch(destino, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedencia: pago.procedencia,
          robots: pago.cuantos,
          institucion: pago.institucion,
          responsable: pago.responsable,
          correo: pago.correo,
          telefono: pago.telefono,
          equipos: pago.equipos,
          metodo: pago.metodo
        })
      });

      if (respuesta.status === 409) {
        cerrarRegistro();
        throw new Error('registro cerrado');
      }
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const datos = await respuesta.json();

      pago.folio = datos.folio;
      pago.consecutivo = datos.consecutivo;
      // El servidor es la autoridad sobre el monto.
      pago.unitario = datos.unitario;
      pago.total = datos.total;
      // Y sobre los datos de la cuenta, que no viajan en el repositorio.
      if (datos.transferencia) pago.transferencia = datos.transferencia;
    } catch (error) {
      if (error.message === 'registro cerrado') throw error;
      console.warn('No se pudo registrar el pago en el servidor:', error);
      pago.folio = generarFolio(pago.tarifa.clave);
      pago.provisional = true;
    }
  }

  /* ==========================================================
     6 · Ficha de pago
     ========================================================== */

  function filaDato(etiqueta, valor, copiable) {
    const boton = copiable
      ? `<button class="copiar" type="button" data-copiar="${escapar(valor)}">Copiar</button>`
      : '<span></span>';
    return `<div class="fila"><dt>${etiqueta}</dt><dd>${escapar(valor)}</dd>${boton}</div>`;
  }

  /**
   * Las ligas de Mercado Pago son de monto fijo, así que se busca la que
   * corresponde al total exacto. Si no existe, se paga por transferencia.
   */
  function ligaPorTotal(total) {
    const ligas = CONFIG.pasarela.ligasPorTotal || {};
    return ligas[total] || '';
  }

  function mostrarFicha(r) {
    const monto = pesos.format(r.total);

    $('#f-folio').textContent = r.folio;
    $('#f-intro').textContent = r.provisional
      ? 'Guarda este folio y mándanos tu comprobante por WhatsApp sin falta: ' +
        'no pudimos registrar tu pago en el sistema, así que este folio es ' +
        'provisional y solo nos llega por ahí.'
      : 'Guarda este folio: va como concepto de tu pago y es lo que nos permite ' +
        'cruzarlo con tus registros. Si todavía no registras a tus robots, hazlo también.';
    $('#ficha__encabezado-estado').hidden = !r.provisional;

    $('#f-datos').innerHTML =
      filaDato('Folio', r.folio, true) +
      filaDato('Tarifa', r.tarifa.nombre) +
      filaDato('Escuela', r.institucion) +
      filaDato('Responsable', r.responsable) +
      (r.equipos ? filaDato('Cubre', r.equipos) : '') +
      filaDato('Robots', String(r.cuantos)) +
      filaDato('Precio por robot', pesos.format(r.unitario)) +
      filaDato('Total a pagar', monto);

    const rutaPasarela = $('#ruta-pasarela');
    const rutaTransfer = $('#ruta-transferencia');
    rutaPasarela.hidden = r.metodo !== 'pasarela';
    rutaTransfer.hidden = r.metodo !== 'transferencia';

    if (r.metodo === 'pasarela') {
      const liga = ligaPorTotal(r.total);
      $('#ruta-pasarela-texto').textContent =
        `Te mandamos a ${CONFIG.pasarela.nombre} para cobrar ${monto}. ${CONFIG.pasarela.metodos}.`;
      $('#pasarela-total').textContent = monto;
      $('#pasarela-folio').textContent = r.folio;

      const boton = $('#boton-pasarela');
      if (liga) {
        boton.href = liga;
        boton.hidden = false;
        $('#aviso-sin-liga').hidden = true;
        $('#instrucciones-pasarela').hidden = false;
      } else {
        boton.hidden = true;
        $('#aviso-sin-liga').hidden = false;
        $('#instrucciones-pasarela').hidden = true;
        rutaTransfer.hidden = false;      // damos la salida alterna
      }
    }

    if (!rutaTransfer.hidden) {
      // Los que manda el servidor ganan sobre los de config.js.
      const t = { ...CONFIG.transferencia, ...(r.transferencia || {}) };
      const publicarCuenta = t.mostrarDatosEnPagina === 'auto'
        ? location.protocol === 'https:'
        : t.mostrarDatosEnPagina === true;

      $('#banco').hidden = !publicarCuenta;
      $('#pedir-datos').hidden = publicarCuenta;
      $('#transferencia-titulo').textContent = publicarCuenta
        ? 'Transfiere a esta cuenta'
        : 'Pide los datos de la cuenta';

      if (publicarCuenta) {
        // Una wallet solo tiene CLABE: la fila de cuenta se omite si viene
        // vacía, en vez de mostrarse en blanco.
        $('#banco').innerHTML = [
          t.banco   && filaDato('Banco', t.banco),
          t.titular && filaDato('Titular', t.titular),
          t.clabe   && filaDato('CLABE', t.clabe, true),
          t.cuenta  && filaDato('Cuenta', t.cuenta, true),
          filaDato('Concepto', r.folio, true),
        ].filter(Boolean).join('');
      } else {
        const peticion =
          `Hola, generé el folio ${r.folio} por ${monto} ` +
          `(${r.institucion}). ¿Me pasan los datos para transferir?`;
        $('#pedir-datos-boton').href =
          `https://wa.me/${CONFIG.contacto.whatsapp}?text=${encodeURIComponent(peticion)}`;
      }

      $('#transferencia-monto').textContent = monto;
      $('#transferencia-folio').textContent = r.folio;
      $('#transferencia-plazo').textContent = `${t.horasParaComprobante} horas`;
    }

    $$('.copiar').forEach(boton => {
      boton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(boton.dataset.copiar);
          boton.textContent = 'Copiado';
          boton.dataset.listo = 'si';
          setTimeout(() => { boton.textContent = 'Copiar'; delete boton.dataset.listo; }, 1800);
        } catch {
          boton.textContent = 'Cópialo a mano';
        }
      });
    });

    // El bloque de subida solo sirve si hay servidor al que subirlo.
    const hayServidor = !r.provisional && baseApi() !== null;
    $('#comprobante').hidden = !hayServidor;
    if (hayServidor) {
      archivoElegido = null;
      $('#soltar').hidden = false;
      $('#soltar').classList.remove('soltar--listo');
      $('#soltar-texto').textContent = 'Toca para elegir la foto, o arrástrala aquí';
      $('#vista-previa').hidden = true;
      $('#estado-subida').hidden = true;
      const boton = $('#enviar-comprobante');
      boton.disabled = true;
      boton.textContent = 'Enviar comprobante';
    }

    $('.portada').hidden = true;
    $('#formulario').hidden = true;
    $('#resumen').hidden = true;
    $('#ficha').hidden = false;
    $('#ficha').focus();
    $('#ficha').scrollIntoView({ block: 'start' });
  }

  function textoResumen(r) {
    return [
      `Pago de inscripción · ${CONFIG.evento.nombre} 2026`,
      `Folio: ${r.folio}`,
      `Tarifa: ${r.tarifa.nombre}`,
      `Escuela: ${r.institucion}`,
      `Responsable: ${r.responsable}`,
      `Contacto: ${r.correo} · ${r.telefono}`,
      r.equipos ? `Cubre: ${r.equipos}` : null,
      '',
      `Robots: ${r.cuantos}`,
      `Precio por robot: ${pesos.format(r.unitario)}`,
      `Total: ${pesos.format(r.total)}`,
      `Forma de pago: ${r.metodo === 'pasarela' ? CONFIG.pasarela.nombre : 'Transferencia / SPEI'}`,
      '',
      'Adjunto mi comprobante de pago.'
    ].filter(l => l !== null).join('\n');
  }

  function descargarFicha(r) {
    const contenido = textoResumen(r).replace(
      'Adjunto mi comprobante de pago.',
      `Enviar comprobante a ${CONFIG.contacto.correo} o al WhatsApp +${CONFIG.contacto.whatsapp}.`
    );
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/plain;charset=utf-8' }));
    const liga = document.createElement('a');
    liga.href = url;
    liga.download = `${r.folio}.txt`;
    liga.click();
    URL.revokeObjectURL(url);
  }

  /* copia opcional del pago a una hoja de cálculo */
  function enviarCopia(r) {
    if (!CONFIG.endpointRegistro) return;
    fetch(CONFIG.endpointRegistro, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folio: r.folio,
        tarifa: r.tarifa.nombre,
        institucion: r.institucion,
        responsable: r.responsable,
        equipos: r.equipos,
        correo: r.correo,
        telefono: r.telefono,
        robots: r.cuantos,
        unitario: r.unitario,
        total: r.total,
        metodo: r.metodo,
        fecha: r.fecha
      })
    }).catch(() => { /* el pago sigue viajando por WhatsApp, correo y la ficha */ });
  }

  /* ==========================================================
     6b · Comprobante
     ========================================================== */

  let archivoElegido = null;

  function baseApi() {
    const configurada = (CONFIG.api && CONFIG.api.url || '').replace(/\/+$/, '');
    if (configurada) return configurada;
    return location.protocol.startsWith('http')
      ? new URL('.', document.baseURI).href.replace(/\/+$/, '')
      : null;
  }

  function dichoEstado(texto, tono) {
    const nodo = $('#estado-subida');
    nodo.hidden = false;
    nodo.textContent = texto;
    nodo.classList.remove('estado-subida--bien', 'estado-subida--mal');
    if (tono) nodo.classList.add(`estado-subida--${tono}`);
  }

  function elegirArchivo(archivo) {
    if (!archivo) return;

    const tipos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!tipos.includes(archivo.type)) {
      dichoEstado('Ese formato no nos sirve. Manda una foto JPG, PNG o WEBP, o un PDF.', 'mal');
      return;
    }
    if (archivo.size > 8 * 1024 * 1024) {
      dichoEstado('La imagen pesa más de 8 MB. Tómala de nuevo o redúcela.', 'mal');
      return;
    }

    archivoElegido = archivo;
    $('#enviar-comprobante').disabled = false;
    $('#soltar').classList.add('soltar--listo');
    $('#soltar-texto').textContent = archivo.name;
    $('#estado-subida').hidden = true;

    const vista = $('#vista-previa');
    if (archivo.type.startsWith('image/')) {
      vista.src = URL.createObjectURL(archivo);
      vista.hidden = false;
    } else {
      vista.hidden = true;
    }
  }

  async function subirComprobante() {
    if (!archivoElegido || !estado.registro) return;

    const base = baseApi();
    if (!base) {
      dichoEstado('No hay servidor configurado: mándanos el comprobante por WhatsApp.', 'mal');
      return;
    }

    const boton = $('#enviar-comprobante');
    boton.disabled = true;
    boton.textContent = 'Enviando…';
    dichoEstado('Subiendo tu comprobante…');

    try {
      const cuerpo = new FormData();
      cuerpo.append('comprobante', archivoElegido);

      const respuesta = await fetch(
        `${base}/api/pagos/${encodeURIComponent(estado.registro.folio)}/comprobante`,
        { method: 'POST', body: cuerpo }
      );
      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) throw new Error(datos.error || `HTTP ${respuesta.status}`);

      dichoEstado(
        'Listo, recibimos tu comprobante. Te confirmamos el registro dentro de ' +
        'las siguientes 24 horas.', 'bien');
      boton.textContent = 'Comprobante enviado';
      $('#soltar').hidden = true;
    } catch (error) {
      dichoEstado(
        `No se pudo subir (${error.message}). Inténtalo otra vez o mándanoslo por WhatsApp.`,
        'mal');
      boton.disabled = false;
      boton.textContent = 'Enviar comprobante';
    }
  }

  function prepararComprobante() {
    const zona = $('#soltar');

    $('#archivo').addEventListener('change', e => elegirArchivo(e.target.files[0]));
    $('#enviar-comprobante').addEventListener('click', subirComprobante);

    ['dragenter', 'dragover'].forEach(evt =>
      zona.addEventListener(evt, e => {
        e.preventDefault();
        zona.classList.add('soltar--encima');
      }));
    ['dragleave', 'drop'].forEach(evt =>
      zona.addEventListener(evt, e => {
        e.preventDefault();
        zona.classList.remove('soltar--encima');
      }));
    zona.addEventListener('drop', e => elegirArchivo(e.dataTransfer.files[0]));
  }

  /* ==========================================================
     7 · Datos fijos y cuenta regresiva
     ========================================================== */

  function pintarDatosFijos() {
    const e = CONFIG.evento;
    $('#dato-fecha').textContent   = e.fecha;
    $('#dato-horario').textContent = e.horario;
    $('#dato-sede').textContent    = e.sede;

    document.title = `Pago de inscripción · ${e.nombre} — ${e.organiza}`;
    $('#pie-institucion').textContent = `${e.organiza} · ${e.institucion}`;

    $('#metodo-pasarela-detalle').textContent = CONFIG.pasarela.metodos + '.';
    $('#metodo-transferencia-detalle').textContent =
      `Desde tu banca en línea a la cuenta del club en ${CONFIG.transferencia.banco}.`;

    $('#pie-whatsapp').href = `https://wa.me/${CONFIG.contacto.whatsapp}`;
    $('#pie-correo').href   = `mailto:${CONFIG.contacto.correo}`;
    $('#pie-correo').textContent = CONFIG.contacto.correo;
    $('#pie-reglamento').href = CONFIG.contacto.reglamentoUrl;

    pintarRecordatorioDeRegistro();
  }

  /** Aquí solo se paga: hay que decir dónde se registra uno. */
  function pintarRecordatorioDeRegistro() {
    const nodo = $('#recordatorio-registro');
    const texto = $('#recordatorio-texto');
    const url = (CONFIG.registro && CONFIG.registro.url) || '';

    if (url) {
      texto.innerHTML =
        `Esta página solo cobra la inscripción. Si aún no registras a tus robots, ` +
        `<a href="${escapar(url)}" target="_blank" rel="noopener">hazlo primero aquí</a>.`;
    } else {
      texto.textContent =
        'Esta página solo cobra la inscripción. Asegúrate de haber llenado ' +
        'el formulario de registro de tus robots antes de pagar.';
    }
    nodo.hidden = false;
  }

  const cierre = new Date(CONFIG.evento.cierreRegistro);

  /**
   * Desglosa lo que falta en meses de calendario y el resto en días,
   * horas, minutos y segundos. Los meses se cuentan avanzando el
   * calendario, no dividiendo entre 30: no todos los meses duran igual.
   */
  function desglosar(hasta) {
    const ahora = new Date();
    let meses = 0;
    const cursor = new Date(ahora);

    for (;;) {
      const siguiente = new Date(cursor);
      siguiente.setMonth(siguiente.getMonth() + 1);
      if (siguiente > hasta) break;
      cursor.setTime(siguiente.getTime());
      meses++;
    }

    let resto = hasta - cursor;
    const dias = Math.floor(resto / 86400000);   resto -= dias * 86400000;
    const horas = Math.floor(resto / 3600000);   resto -= horas * 3600000;
    const minutos = Math.floor(resto / 60000);   resto -= minutos * 60000;
    const segundos = Math.floor(resto / 1000);

    return { meses, dias, horas, minutos, segundos };
  }

  function pintarReloj() {
    const limite = $('#reloj-limite');
    const barra  = $('#barra-estado');
    const texto  = $('#barra-estado-texto');
    const faltan = cierre - Date.now();

    limite.textContent = 'Cierra el ' + cierre.toLocaleString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }) + ' h';

    barra.hidden = false;

    if (faltan <= 0) {
      texto.textContent = 'Registro cerrado';
      barra.classList.add('barra__estado--cerrado');
      cerrarRegistro();
      return false;
    }

    const t = desglosar(cierre);
    const dos = n => String(n).padStart(2, '0');

    $('#bloque-meses').hidden = t.meses < 1;
    $('#c-meses').textContent = t.meses;
    $('#c-dias').textContent = t.dias;
    $('#c-horas').textContent = dos(t.horas);
    $('#c-minutos').textContent = dos(t.minutos);
    $('#c-segundos').textContent = dos(t.segundos);

    const diasTotales = Math.floor(faltan / 86400000);
    texto.textContent = diasTotales > 0
      ? `Registro abierto · faltan ${diasTotales} día${diasTotales === 1 ? '' : 's'}`
      : 'Último día de registro';
    return true;
  }

  /**
   * Pasada la fecha, la página sigue en pie pero deja de aceptar
   * registros: se oculta el formulario y se explica qué pasó.
   */
  function cerrarRegistro() {
    if ($('#cerrado').hidden === false) return;   // ya estaba cerrada

    const cuando = cierre.toLocaleString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    $('#cerrado-texto').textContent =
      `La convocatoria de ${CONFIG.evento.nombre} cerró el ${cuando} h. ` +
      `Ya no es posible generar referencias ni pagar la inscripción.`;
    $('#cerrado-whatsapp').href = `https://wa.me/${CONFIG.contacto.whatsapp}`;
    $('#cerrado-correo').href = `mailto:${CONFIG.contacto.correo}`;
    $('#cerrado-correo').textContent = CONFIG.contacto.correo;

    // El contador deja de contar y lo dice; la portada deja de invitar.
    $('#cuenta-regresiva').hidden = true;
    $('#cuenta-fin').hidden = false;
    $('#ir-al-pago').hidden = true;
    $('.entrada').textContent =
      'La convocatoria ya cerró. Abajo están los datos por si necesitas localizarnos.';

    $('#cerrado').hidden = false;
    $('#formulario').hidden = true;
    $('#resumen').hidden = true;
    $('#ficha').hidden = true;
  }

  /**
   * Mientras la pasarela esté apagada no se ofrece la elección: se cobra
   * por transferencia y se dice con todas sus letras.
   */
  function configurarMetodosDePago() {
    if (CONFIG.pasarela.activa !== false) return;

    $('#metodos').hidden = true;
    $('#metodo-transferencia').checked = true;
    $('#pago-unico').hidden = false;
    const cuentaVisible = CONFIG.transferencia.mostrarDatosEnPagina === 'auto'
      ? location.protocol === 'https:'
      : CONFIG.transferencia.mostrarDatosEnPagina === true;
    $('#pago-unico-texto').textContent = cuentaVisible
      ? `Por ahora la inscripción se paga con una transferencia a la cuenta del club en ` +
        `${CONFIG.transferencia.banco}. Al generar tu referencia te damos los datos y el ` +
        `concepto exacto; tus lugares quedan apartados cuando recibimos tu comprobante.`
      : `Por ahora la inscripción se paga con una transferencia. Al generar tu referencia ` +
        `te damos tu folio y un botón para pedirnos los datos de la cuenta por WhatsApp; ` +
        `tus lugares quedan apartados cuando recibimos tu comprobante.`;
    $('#nota-pago').textContent =
      'Todavía no tenemos pago con tarjeta en línea. Si lo necesitas para un trámite ' +
      'de tu escuela, escríbenos y lo resolvemos contigo.';
  }

  /* ==========================================================
     8 · Arranque
     ========================================================== */

  function iniciar() {
    pintarDatosFijos();
    pintarTarifas();
    configurarMetodosDePago();
    fijarRobots(1);

    if (pintarReloj()) setInterval(pintarReloj, 1000);

    $('#institucion').addEventListener('input', () => {
      institucionAutollenada = false;   // a partir de aquí manda el usuario
      actualizarResumen();
    });

    $('#menos').addEventListener('click', () => fijarRobots(estado.robots - 1));
    $('#mas').addEventListener('click',   () => fijarRobots(estado.robots + 1));
    $('#robots').addEventListener('input', e => {
      const n = parseInt(e.target.value, 10);
      if (!Number.isNaN(n)) fijarRobots(n);
    });
    $('#robots').addEventListener('blur', () => fijarRobots(estado.robots));

    $$('input[name="metodo"]').forEach(radio =>
      radio.addEventListener('change', () => ocultarError('#error-formulario')));

    $('#formulario').addEventListener('submit', async evento => {
      evento.preventDefault();
      const pago = validar();
      if (!pago) return;

      const boton = $('#enviar');
      const textoOriginal = boton.textContent;
      boton.disabled = true;
      boton.textContent = 'Generando tu folio…';

      try {
        await asignarFolio(pago);
        if (pago.folio === undefined) return;
        estado.registro = pago;
        try {
          localStorage.setItem('cdm-ultimo-pago', JSON.stringify({
            folio: pago.folio, institucion: pago.institucion, fecha: pago.fecha
          }));
        } catch { /* modo privado: seguimos sin guardar */ }
        enviarCopia(pago);
        mostrarFicha(pago);
      } catch (error) {
        if (error.message !== 'registro cerrado') {
          mostrarError('#error-formulario',
            'No se pudo generar tu referencia. Inténtalo de nuevo en un momento.');
        }
      } finally {
        boton.disabled = false;
        boton.textContent = textoOriginal;
      }
    });

    prepararComprobante();

    $('#descargar-ficha').addEventListener('click', () => {
      if (estado.registro) descargarFicha(estado.registro);
    });

    $('#volver').addEventListener('click', () => {
      $('#ficha').hidden = true;
      $('.portada').hidden = false;
      $('#formulario').hidden = false;
      $('#resumen').hidden = false;
      $('#paso-monto').scrollIntoView({ block: 'start' });
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
