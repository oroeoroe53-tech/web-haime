/* ==========================================================================
   AQUALISÉ — Interacciones
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var euros = function (n) {
    return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
  };

  /* ---------- 1. Cabecera fija ---------- */
  var cabecera = $('#cabecera');
  var alScroll = function () {
    if (!cabecera) return;
    cabecera.classList.toggle('fija', window.scrollY > 40);
  };
  window.addEventListener('scroll', alScroll, { passive: true });
  alScroll();

  /* ---------- 2. Cinta de ventajas en bucle ---------- */
  var pista = $('#avisoPista');
  if (pista) { pista.innerHTML += pista.innerHTML; }

  /* ---------- 3. Revelado al entrar en pantalla ---------- */
  var revelables = $$('.revelar, .revelar-escala, .escalonado');
  if ('IntersectionObserver' in window && !reducido) {
    var ob = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); ob.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revelables.forEach(function (el) { ob.observe(el); });
  } else {
    revelables.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ---------- 4. Cifras que ascienden ---------- */
  var animarCifra = function (el) {
    var destino = parseFloat(el.getAttribute('data-cifra'));
    var sufijo = el.getAttribute('data-sufijo') || '';
    var inicio = null, dur = 1600;
    var paso = function (t) {
      if (!inicio) inicio = t;
      var p = Math.min((t - inicio) / dur, 1);
      var suave = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(destino * suave) + sufijo;
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };
  var cifras = $$('[data-cifra]');
  if ('IntersectionObserver' in window && !reducido) {
    var obC = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { animarCifra(e.target); obC.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    cifras.forEach(function (el) { obC.observe(el); });
  } else {
    cifras.forEach(function (el) {
      el.textContent = el.getAttribute('data-cifra') + (el.getAttribute('data-sufijo') || '');
    });
  }

  /* ---------- 5. Acabados ---------- */
  var ACABADOS = {
    nacar: {
      titulo: 'Nácar',
      etiqueta: 'Nácar · acabado mate sedoso',
      texto: 'El blanco cálido de la porcelana marina. Desaparece bajo la luz de la piscina y no muestra una sola huella.',
      precio: 489, gradiente: 'car-nacar'
    },
    laguna: {
      titulo: 'Laguna',
      etiqueta: 'Laguna · azul translúcido',
      texto: 'El azul exacto del agua a mediodía. Un degradado translúcido que se aclara en el borde y se vuelve profundo en el centro.',
      precio: 489, gradiente: 'car-laguna'
    },
    titanio: {
      titulo: 'Titanio Nocturno',
      etiqueta: 'Titanio Nocturno · anodizado profundo',
      texto: 'Titanio anodizado en un gris casi negro, con el arco pulido a espejo. El más discreto dentro del agua y el más rotundo fuera.',
      precio: 529, gradiente: 'car-titanio'
    },
    champan: {
      titulo: 'Champán Pálido',
      etiqueta: 'Champán Pálido · edición Éclat',
      texto: 'Un dorado pálido, casi arena, reservado a la Éclat Édition. Cada pieza lleva su número grabado en el interior del arco.',
      precio: 560, gradiente: 'car-champan'
    }
  };

  var piezas = $$('.acabado-pieza');
  var muestras = $$('.muestra');
  var elTitulo = $('#tituloAcabado');
  var elTexto = $('#textoAcabado');
  var elNombre = $('#nombreAcabado');
  var elPrecio = $('#precioAcabado');
  var elPlazo = $('#plazoAcabado');
  var btnAcabado = $('#anadirAcabado');

  var pintarAcabado = function (clave) {
    var a = ACABADOS[clave];
    if (!a) return;
    piezas.forEach(function (p) {
      var activa = p.getAttribute('data-acabado') === clave;
      p.classList.toggle('visible', activa);
      p.setAttribute('aria-hidden', activa ? 'false' : 'true');
    });
    muestras.forEach(function (m) {
      m.setAttribute('aria-pressed', m.getAttribute('data-acabado') === clave ? 'true' : 'false');
    });
    if (elTitulo) elTitulo.textContent = a.titulo;
    if (elTexto) elTexto.textContent = a.texto;
    if (elNombre) elNombre.textContent = a.etiqueta;
    if (elPrecio) elPrecio.textContent = euros(a.precio);
    if (elPlazo) elPlazo.textContent = euros(Math.round(a.precio / 4 * 100) / 100);
    if (btnAcabado) {
      btnAcabado.setAttribute('data-variante', a.titulo);
      btnAcabado.setAttribute('data-precio', String(a.precio));
      btnAcabado.setAttribute('data-color', a.gradiente);
      btnAcabado.setAttribute('data-nombre', clave === 'champan' ? 'AQUALISÉ Éclat Édition' : 'AQUALISÉ Marea Pro');
    }
  };
  muestras.forEach(function (m) {
    m.addEventListener('click', function () { pintarAcabado(m.getAttribute('data-acabado')); });
  });

  /* ---------- 6. Carrito ---------- */
  var carrito = $('#carrito');
  var telon = $('#telon');
  var cuerpo = $('#carritoCuerpo');
  var vacio = $('#carritoVacio');
  var total = $('#carritoTotal');
  var contador = $('#contadorCarrito');
  var lineas = [];

  var abrirCarrito = function () {
    if (!carrito) return;
    carrito.classList.add('abierto');
    carrito.setAttribute('aria-hidden', 'false');
    if (telon) telon.classList.add('abierto');
    document.body.classList.add('sin-scroll');
  };
  var cerrarCarrito = function () {
    if (!carrito) return;
    carrito.classList.remove('abierto');
    carrito.setAttribute('aria-hidden', 'true');
    if (telon) telon.classList.remove('abierto');
    document.body.classList.remove('sin-scroll');
  };

  var pintarCarrito = function () {
    if (!cuerpo) return;
    $$('.linea-carrito', cuerpo).forEach(function (l) { l.remove(); });
    var suma = 0, unidades = 0;
    lineas.forEach(function (l) {
      suma += l.precio * l.cantidad;
      unidades += l.cantidad;
      var div = document.createElement('div');
      div.className = 'linea-carrito';
      div.innerHTML =
        '<span class="mini"><svg viewBox="0 0 620 400" style="--carcasa:url(#' + l.color + ')"><use href="#pieza-aqualise"></use></svg></span>' +
        '<span><b></b><span></span></span>' +
        '<em></em>';
      $('b', div).textContent = l.nombre;
      $('span span', div).textContent = l.variante + ' · ' + l.cantidad + ' ud.';
      $('em', div).textContent = euros(l.precio * l.cantidad);
      cuerpo.appendChild(div);
    });
    if (vacio) vacio.style.display = lineas.length ? 'none' : 'block';
    if (total) total.textContent = euros(suma);
    if (contador) {
      contador.textContent = String(unidades);
      contador.classList.toggle('activo', unidades > 0);
    }
  };

  var brindis = $('#brindis');
  var brindisTexto = $('#brindisTexto');
  var temporizador = null;
  var avisar = function (mensaje) {
    if (!brindis) return;
    if (brindisTexto) brindisTexto.textContent = mensaje;
    brindis.classList.add('visible');
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { brindis.classList.remove('visible'); }, 3200);
  };

  $$('.anadir').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var nombre = btn.getAttribute('data-nombre');
      var variante = btn.getAttribute('data-variante');
      var precio = parseFloat(btn.getAttribute('data-precio'));
      var color = btn.getAttribute('data-color') || 'car-nacar';
      var existente = null;
      lineas.forEach(function (l) {
        if (l.nombre === nombre && l.variante === variante) existente = l;
      });
      if (existente) { existente.cantidad += 1; }
      else { lineas.push({ nombre: nombre, variante: variante, precio: precio, color: color, cantidad: 1 }); }
      pintarCarrito();
      avisar(nombre + ' añadido a tu bolsa');
      abrirCarrito();
    });
  });

  var btnAbrir = $('#abrirCarrito');
  if (btnAbrir) btnAbrir.addEventListener('click', abrirCarrito);
  var btnCerrar = $('#cerrarCarrito');
  if (btnCerrar) btnCerrar.addEventListener('click', cerrarCarrito);
  if (telon) telon.addEventListener('click', cerrarCarrito);

  /* ---------- 7. Menú móvil ---------- */
  var menu = $('#menuMovil');
  var abrirMenu = $('#abrirMenu');
  var cerrarMenu = $('#cerrarMenu');
  var alternarMenu = function (abierto) {
    if (!menu) return;
    menu.classList.toggle('abierto', abierto);
    document.body.classList.toggle('sin-scroll', abierto);
  };
  if (abrirMenu) abrirMenu.addEventListener('click', function () { alternarMenu(true); });
  if (cerrarMenu) cerrarMenu.addEventListener('click', function () { alternarMenu(false); });
  if (menu) {
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { alternarMenu(false); });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { cerrarCarrito(); alternarMenu(false); }
  });

  /* ---------- 8. Boletín ---------- */
  var form = $('#formBoletin');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var campo = $('input[type=email]', form);
      if (!campo || !campo.value || campo.value.indexOf('@') === -1) {
        avisar('Introduce un correo electrónico válido');
        if (campo) campo.focus();
        return;
      }
      var ok = $('#boletinOk');
      if (ok) ok.classList.add('visible');
      form.style.display = 'none';
      avisar('Te has suscrito a la carta de inmersión');
    });
  }

  /* ---------- 9. Parallax suave del hero ---------- */
  var heroFondo = $('.hero-fondo');
  var heroCaja = $('.hero-caja');
  if (heroFondo && !reducido) {
    var pendiente = false;
    window.addEventListener('scroll', function () {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        if (y < window.innerHeight * 1.2) {
          heroFondo.style.transform = 'translate3d(0,' + (y * 0.16) + 'px,0)';
          if (heroCaja) {
            heroCaja.style.transform = 'translate3d(0,' + (y * 0.06) + 'px,0)';
            heroCaja.style.opacity = String(Math.max(0, 1 - y / 620));
          }
        }
        pendiente = false;
      });
    }, { passive: true });
  }

  /* ---------- 10. Despiece animado con el scroll ---------- */
  var NS = 'http://www.w3.org/2000/svg';

  var PIEZAS = [
    { nombre: 'CARCASA EXTERIOR', detalle: 'Aluminio 6063 anodizado', dibujo:
      '<rect x="-66" y="-42" width="132" height="84" rx="42" fill="url(#dp-cromo)"/>' +
      '<rect x="-66" y="-42" width="132" height="84" rx="42" fill="none" stroke="#9FB8C2" stroke-width="2" opacity=".6"/>' +
      '<path d="M-48-28c18-7 46-8 70-4" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" fill="none" opacity=".8"/>' +
      '<g opacity=".4" fill="#8FA9B3"><circle cx="34" cy="30" r="3.4"/><circle cx="48" cy="24" r="3.4"/></g>' },

    { nombre: 'JUNTA DE SELLADO', detalle: 'Silicona · 10 ATM', dibujo:
      '<ellipse rx="56" ry="37" fill="none" stroke="url(#dp-junta)" stroke-width="14"/>' +
      '<ellipse rx="56" ry="37" fill="none" stroke="#FFFFFF" stroke-width="3.5" opacity=".38"/>' },

    { nombre: 'TRANSDUCTOR ÓSEO', detalle: '14 mm · Vibra Pure', dibujo:
      '<ellipse rx="54" ry="36" fill="url(#dp-disco)"/>' +
      '<ellipse rx="54" ry="36" fill="none" stroke="#9FB8C2" stroke-width="3"/>' +
      '<ellipse rx="36" ry="24" fill="none" stroke="#8FA9B3" stroke-width="2.6" opacity=".7"/>' +
      '<ellipse rx="20" ry="13" fill="#CFE6EE"/>' +
      '<circle r="9" fill="#2E9BB8"/><circle r="3.5" fill="#EAF9FD"/>' },

    { nombre: 'BOBINA DE VOZ', detalle: 'Cobre de 0,06 mm', dibujo:
      '<ellipse rx="46" ry="31" fill="none" stroke="url(#dp-cobre)" stroke-width="15"/>' +
      '<ellipse rx="46" ry="31" fill="none" stroke="#F0CB9A" stroke-width="2" opacity=".5"/>' +
      '<ellipse rx="39" ry="25" fill="none" stroke="#9A6630" stroke-width="2" opacity=".35"/>' },

    { nombre: 'IMÁN DE NEODIMIO', detalle: 'N52 de alta densidad', dibujo:
      '<ellipse rx="42" ry="28" fill="url(#dp-iman)"/>' +
      '<ellipse rx="42" ry="28" fill="none" stroke="#7C93A0" stroke-width="2" opacity=".45"/>' +
      '<ellipse rx="20" ry="13" fill="#0B2B36"/>' +
      '<path d="M-26-14c10-6 30-8 44-4" stroke="#A8C0CA" stroke-width="3" stroke-linecap="round" fill="none" opacity=".3"/>' },

    { nombre: 'PLACA HYDROSENSE', detalle: 'Sensor de presión', dibujo:
      '<rect x="-60" y="-35" width="120" height="70" rx="18" fill="url(#dp-placa)"/>' +
      '<rect x="-60" y="-35" width="120" height="70" rx="18" fill="none" stroke="#2E9BB8" stroke-width="1.6" opacity=".45"/>' +
      '<g stroke="#C6AC79" stroke-width="1.6" fill="none" opacity=".75">' +
      '<path d="M-44-18h30v14h22"/><path d="M-44 6h18v14h40"/><path d="M12-22v14h30"/></g>' +
      '<rect x="-15" y="-12" width="32" height="23" rx="4" fill="#0A3B44" stroke="#C6AC79" stroke-width="1.2" opacity=".9"/>' +
      '<g fill="#C6AC79" opacity=".75"><rect x="-42" y="16" width="11" height="6" rx="2"/><rect x="28" y="-30" width="11" height="6" rx="2"/></g>' },

    { nombre: 'BATERÍA', detalle: '14 h · carga en 12 min', dibujo:
      '<rect x="-52" y="-27" width="104" height="54" rx="15" fill="url(#dp-bat)"/>' +
      '<rect x="-52" y="-27" width="104" height="54" rx="15" fill="none" stroke="#9AB4BE" stroke-width="2" opacity=".65"/>' +
      '<rect x="-38" y="-11" width="58" height="22" rx="7" fill="#46B6CE" opacity=".75"/>' +
      '<rect x="26" y="-7" width="12" height="14" rx="4" fill="#9AB4BE" opacity=".75"/>' },

    { nombre: 'CARCASA INTERIOR', detalle: 'Contacto con el pómulo', dibujo:
      '<rect x="-64" y="-41" width="128" height="82" rx="41" fill="url(#dp-interior)"/>' +
      '<rect x="-64" y="-41" width="128" height="82" rx="41" fill="none" stroke="#B4CCD5" stroke-width="2" opacity=".65"/>' +
      '<ellipse rx="32" ry="21" fill="#DCEDF3"/>' +
      '<ellipse rx="32" ry="21" fill="none" stroke="#A8C0CA" stroke-width="2" opacity=".55"/>' +
      '<circle r="6" fill="#2E9BB8" opacity=".8"/>' }
  ];

  var contPiezas = $('#despiecePiezas');
  var pistaD = $('#despiecePista');

  if (contPiezas && pistaD) {
    var escenaD = $('#despieceEscena');
    var ejeD = $('#despieceEje');
    var bandaD = $('#despieceBanda');
    var izqD = $('#despieceIzquierda');
    var barraD = $('#despieceBarra');
    var bloquesD = $$('.despiece-bloque');

    var CX = 700, CY = 486;
    var svgD = $('#despieceSvg');
    var mqD = window.matchMedia('(max-width: 900px)');
    var CAJA_MONTADA = [170, 110, 620, 460];
    var CAJA_ABIERTA = [612, 384, 492, 1010];
    var mezcla = function (a, b, t) { return a + (b - a) * t; };

    var etiquetaSvg = function (pz, arriba) {
      var horizontal = arriba
        ? '<g class="pieza-etiqueta et-h"><path d="M0-56v-26" fill="none"/>' +
          '<text y="-106" text-anchor="middle" class="et-nombre">' + pz.nombre + '</text>' +
          '<text y="-86" text-anchor="middle" class="et-detalle">' + pz.detalle + '</text></g>'
        : '<g class="pieza-etiqueta et-h"><path d="M0 56v26" fill="none"/>' +
          '<text y="106" text-anchor="middle" class="et-nombre">' + pz.nombre + '</text>' +
          '<text y="128" text-anchor="middle" class="et-detalle">' + pz.detalle + '</text></g>';
      var vertical = '<g class="pieza-etiqueta et-v"><path d="M72 0h26" fill="none"/>' +
        '<text x="108" y="-4" class="et-nombre">' + pz.nombre + '</text>' +
        '<text x="108" y="18" class="et-detalle">' + pz.detalle + '</text></g>';
      return horizontal + vertical;
    };

    var gruposPieza = PIEZAS.map(function (pz, i) {
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'pieza');
      g.setAttribute('transform', 'translate(' + CX + ' ' + CY + ')');
      g.innerHTML = '<g transform="rotate(-12) scale(1.08)">' + pz.dibujo + '</g>' + etiquetaSvg(pz, i % 2 === 1);
      contPiezas.appendChild(g);
      return g;
    });

    var etiquetasD = $$('.pieza-etiqueta', $('#despieceSvg'));

    var limitar = function (t) { return t < 0 ? 0 : (t > 1 ? 1 : t); };
    var suave = function (t) { t = limitar(t); return t * t * (3 - 2 * t); };
    var tramo = function (p, a, b) { return suave((p - a) / (b - a)); };

    var faseActiva = function (nombre, activo) {
      bloquesD.forEach(function (b) {
        if (b.getAttribute('data-fase') === nombre) b.classList.toggle('activo', activo);
      });
    };

    var pintarDespiece = function (p) {
      var abre = tramo(p, 0.08, 0.42) * (1 - tramo(p, 0.80, 0.96));
      var entra = 1 - tramo(p, 0.02, 0.18);
      var cierra = tramo(p, 0.85, 0.96);
      var movil = mqD.matches;
      var paso = movil ? 78 : 112;
      var dirx = movil ? 0.05 : 0.99;
      var diry = movil ? 0.9987 : -0.139;

      if (movil) {
        var caja = CAJA_MONTADA.map(function (v, n) { return mezcla(v, CAJA_ABIERTA[n], abre).toFixed(1); });
        svgD.setAttribute('viewBox', caja.join(' '));
        escenaD.setAttribute('transform', 'translate(0 0)');
        bandaD.setAttribute('transform', 'translate(0 ' + (-70 * abre).toFixed(2) + ')');
        izqD.setAttribute('transform', 'translate(' + (-70 * abre).toFixed(2) + ' 0)');
        bandaD.style.opacity = izqD.style.opacity = (1 - abre).toFixed(3);
      } else {
        svgD.setAttribute('viewBox', '0 0 1200 760');
        bandaD.style.opacity = izqD.style.opacity = '1';
        var k = (1 - 0.30 * abre) * (1 - 0.20 * cierra) * (1 - 0.06 * entra);
        var tx = -80 * abre + 150 * entra;
        var ty = -34 * entra - 150 * cierra - 44 * abre;
        escenaD.setAttribute('transform',
          'translate(' + (600 * (1 - k) + tx).toFixed(2) + ' ' + (420 * (1 - k) + ty).toFixed(2) + ') scale(' + k.toFixed(4) + ')');
        bandaD.setAttribute('transform', 'translate(' + (-50 * abre).toFixed(2) + ' ' + (-110 * abre).toFixed(2) + ')');
        izqD.setAttribute('transform', 'translate(' + (-130 * abre).toFixed(2) + ' ' + (30 * abre).toFixed(2) + ')');
      }

      gruposPieza.forEach(function (g, i) {
        var d = i * paso * abre;
        g.setAttribute('transform',
          'translate(' + (CX + d * dirx).toFixed(2) + ' ' + (CY + d * diry).toFixed(2) + ')');
      });

      var opEt = tramo(p, 0.24, 0.42) * (1 - tramo(p, 0.80, 0.90));
      etiquetasD.forEach(function (e) { e.style.opacity = opEt; });
      if (ejeD) ejeD.style.opacity = opEt * 0.5;
      if (barraD) barraD.style.height = (p * 100).toFixed(1) + '%';

      faseActiva('intro', p < 0.12);
      faseActiva('1', p >= 0.34 && p < 0.52);
      faseActiva('2', p >= 0.52 && p < 0.675);
      faseActiva('3', p >= 0.675 && p < 0.815);
      faseActiva('final', p >= 0.93);
    };

    if (reducido) {
      pintarDespiece(0.5);
      etiquetasD.forEach(function (e) { e.style.opacity = 1; });
      bloquesD.forEach(function (b) { b.classList.add('activo'); });
    } else {
      var pendienteD = false;
      var alScrollDespiece = function () {
        if (pendienteD) return;
        pendienteD = true;
        requestAnimationFrame(function () {
          var r = pistaD.getBoundingClientRect();
          var total = r.height - window.innerHeight;
          pintarDespiece(total > 0 ? limitar(-r.top / total) : 0);
          pendienteD = false;
        });
      };
      window.addEventListener('scroll', alScrollDespiece, { passive: true });
      window.addEventListener('resize', alScrollDespiece);
      alScrollDespiece();
    }
  }

})();
