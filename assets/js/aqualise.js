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
})();
