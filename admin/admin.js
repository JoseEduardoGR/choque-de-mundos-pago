/* ============================================================
   Panel de pagos — Choque de Mundos
   Lee la API con el token de administración, que nunca sale de
   este navegador.
   ============================================================ */

(function () {
  'use strict';

  const $  = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

  const pesos = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 0
  });

  /* La API es el mismo servidor si el panel se sirve desde ahí; si se abre
     desde GitHub Pages, hay que apuntar al túnel. */
  const API = location.hostname.endsWith('github.io')
    ? 'https://ares-pagos.tail9cb92a.ts.net'
    : location.origin;

  const LLAVE = 'cdm-token-admin';
  let token = '';
  let pagos = [];
  let filtro = '';
  let busqueda = '';

  function escapar(t) {
    return String(t ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function pedir(ruta, opciones = {}) {
    const respuesta = await fetch(API + ruta, {
      ...opciones,
      headers: { ...(opciones.headers || {}), 'X-Admin-Token': token }
    });
    if (respuesta.status === 401) throw new Error('token incorrecto');
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return respuesta;
  }

  /* ── Entrada ───────────────────────────────────────────── */

  async function entrar(desdeMemoria) {
    const nodo = $('#error-acceso');
    nodo.hidden = true;
    token = desdeMemoria || $('#token').value.trim();
    if (!token) return;

    try {
      await pedir('/api/pagos/resumen');
      try { localStorage.setItem(LLAVE, token); } catch {}
      $('#acceso').hidden = true;
      $('#tablero').hidden = false;
      $('#salir').hidden = false;
      await cargar();
    } catch (error) {
      token = '';
      if (!desdeMemoria) {
        nodo.textContent = error.message === 'token incorrecto'
          ? 'Ese token no es el correcto.'
          : `No se pudo conectar con el servidor (${error.message}).`;
        nodo.hidden = false;
      }
    }
  }

  function salir() {
    try { localStorage.removeItem(LLAVE); } catch {}
    token = '';
    pagos = [];
    $('#tablero').hidden = true;
    $('#salir').hidden = true;
    $('#acceso').hidden = false;
    $('#token').value = '';
  }

  /* ── Datos ─────────────────────────────────────────────── */

  async function cargar() {
    const aviso = $('#error-tabla');
    aviso.hidden = true;
    try {
      const [lista, resumen] = await Promise.all([
        pedir('/api/pagos').then(r => r.json()),
        pedir('/api/pagos/resumen').then(r => r.json())
      ]);
      pagos = lista;
      pintarCifras(resumen);
      pintarTabla();
    } catch (error) {
      aviso.textContent = `No se pudieron cargar los pagos: ${error.message}`;
      aviso.hidden = false;
    }
  }

  function pintarCifras(r) {
    const tarjetas = [
      ['Cobrado', pesos.format(r.monto_confirmado), `${r.confirmados} confirmados`, 'bien'],
      ['Por cobrar', pesos.format(r.monto_pendiente), `${r.pendientes} pendientes`, 'ojo'],
      ['Robots pagados', r.robots_confirmados, 'ya confirmados', ''],
      ['Sin comprobante', r.sin_comprobante, 'hay que perseguirlos',
        r.sin_comprobante > 0 ? 'alerta' : '']
    ];
    $('#cifras').innerHTML = tarjetas.map(([t, v, p, tono]) => `
      <div class="cifra ${tono ? 'cifra--' + tono : ''}">
        <span class="cifra__titulo">${t}</span>
        <strong class="cifra__valor">${v}</strong>
        <span class="cifra__pie">${p}</span>
      </div>`).join('');
  }

  function visibles() {
    return pagos.filter(p => {
      if (filtro === 'sin-comprobante' && p.comprobante) return false;
      if (filtro && filtro !== 'sin-comprobante' && p.estado !== filtro) return false;
      if (!busqueda) return true;
      const heno = `${p.folio} ${p.institucion} ${p.responsable} ${p.correo} ${p.equipos}`.toLowerCase();
      return heno.includes(busqueda);
    });
  }

  function fecha(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    });
  }

  function pintarTabla() {
    const lista = visibles();
    $('#vacio').hidden = lista.length > 0;

    $('#filas').innerHTML = lista.map(p => `
      <tr data-folio="${escapar(p.folio)}">
        <td>
          <span class="folio">${escapar(p.folio)}</span>
          <span class="sub">${fecha(p.creado_en)}</span>
        </td>
        <td>
          ${escapar(p.institucion)}
          <span class="sub">${p.procedencia === 'local' ? 'TESCI' : 'externa'}${
            p.equipos ? ' · ' + escapar(p.equipos) : ''}</span>
        </td>
        <td>${escapar(p.responsable)}</td>
        <td>
          <a href="mailto:${escapar(p.correo)}">${escapar(p.correo)}</a>
          <span class="sub"><a href="https://wa.me/52${escapar(p.telefono)}" target="_blank" rel="noopener">${escapar(p.telefono)}</a></span>
        </td>
        <td class="n">${p.robots}</td>
        <td class="n">
          <strong>${pesos.format(p.total)}</strong>
          <span class="sub">${pesos.format(p.unitario)} c/u</span>
        </td>
        <td>
          ${p.comprobante
            ? `<button class="enlace" type="button" data-ver="${escapar(p.folio)}">Ver foto</button>
               <span class="sub">${fecha(p.comprobante_en)}</span>`
            : '<span class="falta">sin subir</span>'}
        </td>
        <td><span class="marca marca--${p.estado}">${p.estado}</span>
          ${p.nota ? `<span class="sub">${escapar(p.nota)}</span>` : ''}</td>
        <td class="acciones">
          ${p.estado !== 'confirmado'
            ? `<button class="boton boton--primario boton--chico" type="button" data-confirmar="${escapar(p.folio)}">Confirmar</button>` : ''}
          ${p.estado !== 'cancelado'
            ? `<button class="boton boton--texto" type="button" data-cancelar="${escapar(p.folio)}">Cancelar</button>` : ''}
          ${p.estado !== 'pendiente'
            ? `<button class="boton boton--texto" type="button" data-reabrir="${escapar(p.folio)}">Reabrir</button>` : ''}
        </td>
      </tr>`).join('');
  }

  /* ── Acciones ──────────────────────────────────────────── */

  async function cambiar(folio, estado) {
    const etiquetas = { confirmado: 'confirmar', cancelado: 'cancelar', pendiente: 'reabrir' };
    if (!confirm(`¿Seguro que quieres ${etiquetas[estado]} el pago ${folio}?`)) return;

    const nota = estado === 'confirmado'
      ? (prompt('Nota opcional (por ejemplo: "SPEI recibido 7-nov")', '') ?? '')
      : '';
    try {
      await pedir(`/api/pagos/${encodeURIComponent(folio)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, nota })
      });
      await cargar();
    } catch (error) {
      alert(`No se pudo actualizar: ${error.message}`);
    }
  }

  async function verComprobante(folio) {
    const caja = $('#visor-contenido');
    $('#visor-titulo').textContent = `Comprobante · ${folio}`;
    caja.innerHTML = '<p class="cargando">Cargando…</p>';
    $('#visor').hidden = false;

    try {
      // La imagen necesita el token en la cabecera, así que no se puede
      // poner en un <img src> directo: se baja y se muestra desde memoria.
      const respuesta = await pedir(`/api/pagos/${encodeURIComponent(folio)}/comprobante`);
      const blob = await respuesta.blob();
      const url = URL.createObjectURL(blob);

      caja.innerHTML = blob.type === 'application/pdf'
        ? `<iframe src="${url}" title="Comprobante"></iframe>`
        : `<img src="${url}" alt="Comprobante de ${escapar(folio)}">`;
      caja.innerHTML += `<p class="visor__pie">
        <a href="${url}" download="${escapar(folio)}">Descargar archivo</a></p>`;
    } catch (error) {
      caja.innerHTML = `<p class="cargando">No se pudo abrir: ${escapar(error.message)}</p>`;
    }
  }

  function exportarCsv() {
    const columnas = ['folio', 'creado_en', 'procedencia', 'institucion', 'responsable',
      'correo', 'telefono', 'equipos', 'robots', 'unitario', 'total',
      'estado', 'comprobante', 'comprobante_en', 'confirmado_en', 'nota'];

    const escapaCampo = v => {
      const t = String(v ?? '');
      return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const lineas = [columnas.join(',')];
    visibles().forEach(p => lineas.push(columnas.map(c => escapaCampo(p[c])).join(',')));

    // BOM para que Excel respete los acentos
    const blob = new Blob(['﻿' + lineas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const liga = document.createElement('a');
    liga.href = URL.createObjectURL(blob);
    liga.download = `pagos-choque-de-mundos-${new Date().toISOString().slice(0, 10)}.csv`;
    liga.click();
    URL.revokeObjectURL(liga.href);
  }

  /* ── Arranque ──────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    $('#entrar').addEventListener('click', () => entrar());
    $('#token').addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
    $('#salir').addEventListener('click', salir);
    $('#refrescar').addEventListener('click', cargar);
    $('#exportar').addEventListener('click', exportarCsv);

    $('#buscador').addEventListener('input', e => {
      busqueda = e.target.value.trim().toLowerCase();
      pintarTabla();
    });

    $$('#filtros .filtro').forEach(boton => {
      boton.addEventListener('click', () => {
        $$('#filtros .filtro').forEach(b => b.classList.remove('filtro--activo'));
        boton.classList.add('filtro--activo');
        filtro = boton.dataset.estado;
        pintarTabla();
      });
    });

    $('#filas').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.ver) verComprobante(b.dataset.ver);
      if (b.dataset.confirmar) cambiar(b.dataset.confirmar, 'confirmado');
      if (b.dataset.cancelar) cambiar(b.dataset.cancelar, 'cancelado');
      if (b.dataset.reabrir) cambiar(b.dataset.reabrir, 'pendiente');
    });

    const cerrar = () => { $('#visor').hidden = true; $('#visor-contenido').innerHTML = ''; };
    $('#cerrar-visor').addEventListener('click', cerrar);
    $('#visor').addEventListener('click', e => { if (e.target.id === 'visor') cerrar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });

    let guardado = '';
    try { guardado = localStorage.getItem(LLAVE) || ''; } catch {}
    if (guardado) entrar(guardado);
  });
})();
