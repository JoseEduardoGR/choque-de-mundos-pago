/* ============================================================
   Choque de Mundos — configuración del registro
   Edita SOLO este archivo para poner en marcha la página.
   Todo lo marcado con  // ⚠ CAMBIAR  son datos de ejemplo.
   ============================================================ */

const CONFIG = {

  evento: {
    nombre: 'Choque de Mundos',
    subtitulo: 'Torneo de Robótica',
    organiza: 'Club de Robótica ARES',
    institucion: 'Tecnológico de Estudios Superiores de Cuautitlán Izcalli',
    fecha: '11 de diciembre de 2026',
    horario: '8:00 a 17:00 h',
    sede: 'Arco Techo y Estadio de Fútbol del TESCI',
    // Fecha y hora límite para registrarse (zona horaria de la CDMX).
    cierreRegistro: '2026-12-03T23:59:59-06:00',
    // Prefijo de los folios. Cámbialo cada edición del torneo.
    claveFolio: 'CDM26'
  },

  /* ----------------------------------------------------------
     TARIFAS
     Se cobra POR ROBOT. El precio depende de quién inscribe y,
     para escuelas externas, de cuántos robots trae en total.

       local    →  75 por robot, siempre
       externa  → 150 por robot con 1 a 9 robots
                  100 por robot a partir de 10, incluidos los
                  primeros (10 robots = 10 × 100 = $1,000)
     ---------------------------------------------------------- */
  tarifas: {
    local: {
      clave: 'L',
      nombre: 'Alumnos del TESCI',
      detalle: 'Tarifa interna. Presenta tu credencial vigente del TESCI en la inspección técnica.',
      precio: 75,                                    // ⚠ CAMBIAR si sube
      // Al elegir esta tarifa, la escuela se llena sola con este nombre.
      // Quítalo de una tarifa si quieres que el campo siempre vaya vacío.
      institucion: 'Tecnológico de Estudios Superiores de Cuautitlán Izcalli'
    },
    externa: {
      clave: 'E',
      nombre: 'Escuela externa',
      detalle: 'Cualquier institución distinta al TESCI. Entre más robots traigas, menos pagas por cada uno.',
      precio: 150,                                   // ⚠ CAMBIAR si sube
      volumen: {
        desdeRobots: 10,
        precio: 100
      }
    }
  },

  // Tope de robots que se pueden pagar de una vez.
  maxRobots: 30,

  /* ----------------------------------------------------------
     API DE PAGOS
     Con la URL puesta, el folio lo entrega el servidor y es
     CONSECUTIVO: 0001-TESCI-20261106, 0002-..., sin huecos.
     Vacía, la página sigue funcionando sola pero el folio es
     provisional y generado en el navegador.
     En local: http://127.0.0.1:5055
     ---------------------------------------------------------- */
  api: {
    /* La API vive en el servidor, expuesta con HTTPS por Tailscale Funnel.
       Hace falta la URL completa porque la página se sirve desde GitHub
       Pages, que es otro origen.
       Déjala vacía si sirves la página desde el propio servidor. */
    url: 'https://ares-pagos.tail9cb92a.ts.net'
  },

  /* ----------------------------------------------------------
     REGISTRO (se hace por separado)
     Esta página solo cobra. Pon aquí la liga del formulario de
     registro para que nadie pague sin haberse registrado.
     Si la dejas vacía, solo aparece el recordatorio sin liga.
     ---------------------------------------------------------- */
  registro: {
    url: 'https://docs.google.com/forms/d/e/1FAIpQLScgmSba94vGkbrbxYTxdxZtX8nje_HXQHpS8u9tCN_Okiy38A/viewform'
  },

  /* ----------------------------------------------------------
     PAGO POR TRANSFERENCIA / SPEI
     ---------------------------------------------------------- */
  transferencia: {
    /* ¿Se publica la cuenta en la página?
         'auto'  → solo si la página va por HTTPS (recomendado)
         true    → siempre
         false   → nunca, se piden por WhatsApp

       Sobre HTTP plano cualquiera en la misma red puede alterar la CLABE
       en tránsito y desviar los pagos, así que en 'auto' la página se
       protege sola según cómo la estén viendo. */
    mostrarDatosEnPagina: 'auto',

    /* OJO: estos son de ejemplo y NO debes poner aquí los reales.
       Este archivo vive en un repositorio público: una CLABE aquí queda
       indexada y en el historial de git para siempre.
       Los de verdad van en el .env del servidor (BANCO, TITULAR, CLABE,
       CUENTA) y la API los entrega junto con el folio. */
    banco: '',
    titular: '',
    clabe: '',
    cuenta: '',
    // Horas que la escuela tiene para enviar su comprobante.
    horasParaComprobante: 48
  },

  /* ----------------------------------------------------------
     PASARELA DE PAGO — Mercado Pago, ligas de monto fijo

     El Link de Pago de Mercado Pago cobra un monto FIJO, así que
     hace falta una liga por cada total posible. La clave de abajo
     es el total en pesos; el comentario dice a qué corresponde.

     Como varias combinaciones dan el mismo total, una liga sirve
     para las dos: la de $300 cubre tanto 4 locales como 2 externas.

     Estas 15 ligas cubren hasta 10 robots. Arriba de eso la página
     manda a transferencia sola; si quieres cubrir más, agrega la
     clave con el total correspondiente.

     Crear cada liga: Mercado Pago → Cobrar → Link de pago →
     escribe el monto → copia la URL y pégala aquí.
     ---------------------------------------------------------- */
  pasarela: {
    // Ponlo en true cuando tengas las ligas creadas y pegadas abajo.
    // En false, la página cobra solo por transferencia y ni siquiera
    // muestra la opción de pagar en línea.
    activa: false,

    nombre: 'Mercado Pago',
    metodos: 'Tarjeta de crédito o débito, SPEI y efectivo en OXXO',

    ligasPorTotal: {                   // ⚠ CAMBIAR — pega las URLs
      75:   '',      // local 1
      150:  '',      // local 2 · externa 1
      225:  '',      // local 3
      300:  '',      // local 4 · externa 2
      375:  '',      // local 5
      450:  '',      // local 6 · externa 3
      525:  '',      // local 7
      600:  '',      // local 8 · externa 4
      675:  '',      // local 9
      750:  '',      // local 10 · externa 5
      900:  '',      // externa 6
      1000: '',      // externa 10
      1050: '',      // externa 7
      1200: '',      // externa 8
      1350: '',      // externa 9
    }
  },

  /* ----------------------------------------------------------
     CONTACTO
     whatsapp → solo dígitos, con lada de país (52 para México)
     ---------------------------------------------------------- */
  contacto: {
    whatsapp: '525648151705',
    correo: 'clubderoboticaares@gmail.com',
    reglamentoUrl: 'https://drive.google.com/file/d/1kf5VbxCn1G57jgGlr_MffDKINZjrWdpr/view'
  },

  /* ----------------------------------------------------------
     OPCIONAL — copia de cada registro a una hoja de cálculo
     Pega aquí la URL de un formulario Formspree o de un
     Google Apps Script publicado como aplicación web.
     Si lo dejas vacío, el registro solo viaja por WhatsApp,
     correo y la ficha descargable.
     ---------------------------------------------------------- */
  endpointRegistro: ''
};
