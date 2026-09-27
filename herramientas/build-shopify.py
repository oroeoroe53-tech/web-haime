#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera el codigo Shopify (.liquid) a partir del sitio estatico.

Salida:
  shopify/aqualise-pagina-completa.liquid   -> archivo unico, autocontenido (recomendado)
  shopify/sections/aqualise-landing.liquid  -> seccion que usa los assets del tema
  shopify/templates/page.aqualise.liquid    -> plantilla de pagina alternativa
  shopify/assets/*                          -> css, js e imagenes para el tema
"""
import base64, os, re, shutil, json

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RAIZ, 'assets', 'img')
OUT = os.path.join(RAIZ, 'shopify')

FUENTES = ("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@"
           "0,300;0,400;0,500;1,300;1,400&family=Jost:wght@200;300;400;500&display=swap")

# Fotos reales del producto: ya estan alojadas en el CDN de la tienda, asi que en
# Shopify se enlazan desde alli en vez de duplicarlas dentro del tema.
CDN = "https://cdn.shopify.com/s/files/1/1033/2468/0521/files"
FOTOS_TIENDA = {
    "producto-montado.jpg": CDN + "/foto2producto.png?v=1789988488&width=1700&format=jpg&quality=84",
    "producto-despiece.jpg": CDN + "/despiecefotocascos.jpg?v=1789988487&width=1700&quality=88",
}


def fotos_de_la_tienda(cuerpo):
    for nombre, url in FOTOS_TIENDA.items():
        cuerpo = cuerpo.replace('src="assets/img/%s"' % nombre, 'src="%s"' % url)
    return cuerpo


def leer(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def cuerpo_html():
    html = leer(os.path.join(RAIZ, 'index.html'))
    cuerpo = html.split('<body>', 1)[1].rsplit('</body>', 1)[0]
    cuerpo = cuerpo.replace('<script src="assets/js/aqualise.js" defer></script>', '')
    return cuerpo.strip()


def comprimir_svg(txt):
    txt = re.sub(r'<!--.*?-->', '', txt, flags=re.S)
    txt = re.sub(r'>\s+<', '><', txt)
    txt = re.sub(r'\s{2,}', ' ', txt)
    return txt.strip()


def a_data_uri(nombre):
    with open(os.path.join(IMG, nombre + '.svg'), encoding='utf-8') as f:
        datos = comprimir_svg(f.read()).encode('utf-8')
    return 'data:image/svg+xml;base64,' + base64.b64encode(datos).decode('ascii')


ETIQUETA_IMG = re.compile(r'<img src="assets/img/([a-z0-9\-]+)\.svg"[^>]*?alt="([^"]*)"[^>]*>')

CSS_ESCENAS = """
/* ---------- 29. Escenas en linea (version Shopify de un solo archivo) ---------- */
.esc{display:block;width:100%;height:100%;}
.hero-fondo .esc,.lifestyle-panel .esc{position:absolute;inset:0;animation:panoramica 26s var(--ease-suave) infinite;}
.lifestyle-panel .esc{animation:none;}
.marco .esc{transition:transform 1.6s var(--ease);}
.marco:hover .esc{transform:scale(1.045);}
.mosaico .esc{height:auto;aspect-ratio:3/4;transition:transform 1.5s var(--ease);}
.mosaico figure:hover .esc{transform:scale(1.06);}
.tec-visual .esc{height:auto;aspect-ratio:1;}
.accesorio .esc{height:auto;aspect-ratio:1;transition:transform 1.2s var(--ease);}
.accesorio:hover .esc{transform:scale(1.05);}
"""


def incrustar_imagenes(cuerpo):
    """Cada escena se define una sola vez como <symbol> y se reutiliza con <use>."""
    usadas = []
    for nombre in ETIQUETA_IMG.findall(cuerpo):
        if nombre[0] not in usadas:
            usadas.append(nombre[0])

    simbolos = []
    cajas = {}
    for nombre in usadas:
        with open(os.path.join(IMG, nombre + '.svg'), encoding='utf-8') as f:
            svg = comprimir_svg(f.read())
        caja = re.search(r'viewBox="([^"]+)"', svg).group(1)
        interior = svg[svg.index('>') + 1:svg.rindex('</svg>')]
        cajas[nombre] = caja
        simbolos.append('<symbol id="esc-%s" viewBox="%s">%s</symbol>' % (nombre, caja, interior))

    def sustituir(m):
        nombre, alt = m.group(1), m.group(2)
        return ('<svg class="esc" viewBox="%s" preserveAspectRatio="xMidYMid slice" role="img" '
                'aria-label="%s"><use href="#esc-%s"/></svg>' % (cajas[nombre], alt, nombre))

    cuerpo = ETIQUETA_IMG.sub(sustituir, cuerpo)
    return cuerpo.replace('</defs>\n</svg>', '\n'.join(simbolos) + '\n</defs>\n</svg>', 1)


def comprimir_html(txt):
    txt = re.sub(r'<!--(?!\[if).*?-->', '', txt, flags=re.S)
    lineas = [l.strip() for l in txt.split('\n')]
    return '\n'.join(l for l in lineas if l)


def comprimir_css(txt):
    txt = re.sub(r'/\*.*?\*/', '', txt, flags=re.S)
    salida = ''
    for linea in txt.split('\n'):
        linea = linea.strip()
        if not linea:
            continue
        if salida and salida[-1] not in ';{}(,:' and not linea.startswith('}'):
            salida += ' '
        salida += linea
    return salida


def comprimir_js(txt):
    txt = re.sub(r'/\*.*?\*/', '', txt, flags=re.S)
    lineas = []
    for linea in txt.split('\n'):
        linea = re.sub(r'(^|\s)//.*$', '', linea).strip()
        if linea:
            lineas.append(linea)
    return '\n'.join(lineas)


def imagenes_asset_url(cuerpo):
    return re.sub(r'src="assets/img/([a-z0-9\-]+)\.svg"',
                  lambda m: "src=\"{{ 'aqualise-%s.svg' | asset_url }}\"" % m.group(1), cuerpo)


# --- ajustes editables desde el editor de temas -------------------------------
def aplicar_ajustes(cuerpo):
    reemplazos = [
        ('<span class="antetitulo">Conducción ósea · Sumergible 10 ATM</span>',
         '<span class="antetitulo">{{ section.settings.hero_antetitulo | escape }}</span>'),
        ('<h1 class="display">Descubre tu ritmo<br><span class="cursiva">bajo el agua</span></h1>',
         '<h1 class="display">{{ section.settings.hero_titulo | escape }}<br>'
         '<span class="cursiva">{{ section.settings.hero_titulo_2 | escape }}</span></h1>'),
        ('<p class="hero-texto">Dos unidades minúsculas descansan junto a tus oídos. Una banda flexible de titanio '
         'abraza la nuca. No hay cables, no hay tapones, no hay ruido: solo el azul, tu respiración y la música que '
         'viaja por el hueso.</p>',
         '<p class="hero-texto">{{ section.settings.hero_texto | escape | newline_to_br }}</p>'),
        ('<a href="#coleccion" class="btn btn-primario"><span>Descubre tu ritmo bajo el agua</span>',
         '<a href="{{ section.settings.hero_cta_enlace | default: "#coleccion" }}" class="btn btn-primario">'
         '<span>{{ section.settings.hero_cta | escape }}</span>'),
    ]
    for viejo, nuevo in reemplazos:
        if viejo not in cuerpo:
            raise SystemExit('No se encontro el fragmento para sustituir:\n' + viejo[:90])
        cuerpo = cuerpo.replace(viejo, nuevo, 1)
    return cuerpo


BOTON = re.compile(
    r'<button class="btn btn-primario btn-bloque btn-pequeno anadir" type="button" '
    r'data-nombre="([^"]+)" data-variante="([^"]+)" data-precio="(\d+)" data-color="([^"]+)">\s*'
    r'<span>Añadir al carrito</span>(<svg aria-hidden="true"><use href="#i-flecha"/></svg>)\s*</button>')

PRECIO = re.compile(r'<div class="precio">(\d+) €<small>IVA incluido</small></div>')


def conectar_productos(cuerpo):
    """Cada ficha usa el producto real de Shopify si se ha elegido uno."""
    indices = {'n': 0}

    def precio(m):
        indices['n'] += 1
        i = indices['n']
        return (
            '{%%- assign prod_%(i)d = section.settings.producto_%(i)d -%%}\n'
            '            {%%- if prod_%(i)d != blank -%%}\n'
            '              <div class="precio">{{ prod_%(i)d.price | money }}<small>IVA incluido</small></div>\n'
            '            {%%- else -%%}\n'
            '              <div class="precio">%(p)s €<small>IVA incluido</small></div>\n'
            '            {%%- endif -%%}' % {'i': i, 'p': m.group(1)})

    cuerpo = PRECIO.sub(precio, cuerpo)

    indices['n'] = 0

    def boton(m):
        indices['n'] += 1
        i = indices['n']
        nombre, variante, prec, color, flecha = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
        demo = ('<button class="btn btn-primario btn-bloque btn-pequeno anadir" type="button" '
                'data-nombre="%s" data-variante="%s" data-precio="%s" data-color="%s">'
                '<span>Añadir al carrito</span>%s</button>' % (nombre, variante, prec, color, flecha))
        real = ('<form action="{{ routes.cart_add_url }}" method="post" enctype="multipart/form-data">\n'
                '                <input type="hidden" name="id" value="{{ prod_%(i)d.selected_or_first_available_variant.id }}">\n'
                '                <input type="hidden" name="quantity" value="1">\n'
                '                <button class="btn btn-primario btn-bloque btn-pequeno" type="submit">'
                '<span>Añadir al carrito</span>%(f)s</button>\n'
                '              </form>' % {'i': i, 'f': flecha})
        return ('{%%- if prod_%(i)d != blank -%%}\n              %(real)s\n'
                '            {%%- else -%%}\n              %(demo)s\n'
                '            {%%- endif -%%}' % {'i': i, 'real': real, 'demo': demo})

    cuerpo = BOTON.sub(boton, cuerpo)
    return cuerpo


def esquema():
    datos = {
        "name": "AQUALISÉ · Página",
        "tag": "div",
        "class": "aqualise-bloque",
        "settings": [
            {"type": "header", "content": "Portada"},
            {"type": "text", "id": "hero_antetitulo", "label": "Antetítulo",
             "default": "Conducción ósea · Sumergible 10 ATM"},
            {"type": "text", "id": "hero_titulo", "label": "Titular · línea 1", "default": "Descubre tu ritmo"},
            {"type": "text", "id": "hero_titulo_2", "label": "Titular · línea 2 (cursiva)", "default": "bajo el agua"},
            {"type": "textarea", "id": "hero_texto", "label": "Texto de portada",
             "default": ("Dos unidades minúsculas descansan junto a tus oídos. Una banda flexible de titanio abraza "
                         "la nuca. No hay cables, no hay tapones, no hay ruido: solo el azul, tu respiración y la "
                         "música que viaja por el hueso.")},
            {"type": "text", "id": "hero_cta", "label": "Botón principal",
             "default": "Descubre tu ritmo bajo el agua"},
            {"type": "url", "id": "hero_cta_enlace", "label": "Enlace del botón principal"},
            {"type": "header", "content": "Productos reales (opcional)"},
            {"type": "paragraph",
             "content": ("Si eliges productos de tu catálogo, las fichas mostrarán su precio real y el botón "
                         "«Añadir al carrito» usará el carrito de Shopify. Si los dejas vacíos se muestra la "
                         "demostración.")},
            {"type": "product", "id": "producto_1", "label": "Ficha 1 · AQUALISÉ Onda"},
            {"type": "product", "id": "producto_2", "label": "Ficha 2 · AQUALISÉ Marea Pro"},
            {"type": "product", "id": "producto_3", "label": "Ficha 3 · AQUALISÉ Éclat Édition"},
        ],
        "presets": [{"name": "AQUALISÉ · Página completa"}],
    }
    return "{% schema %}\n" + json.dumps(datos, ensure_ascii=False, indent=2) + "\n{% endschema %}\n"


PLANTILLA_CABECERA = """{% comment %}
  ============================================================================
  AQUALISE - @TITULO@
  Auriculares de conduccion osea para nadar.

  @INSTRUCCIONES@
  ============================================================================
{% endcomment %}
"""


def CABECERA(titulo, instrucciones):
    return PLANTILLA_CABECERA.replace('@TITULO@', titulo).replace('@INSTRUCCIONES@', instrucciones)


def escribir(ruta, contenido):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write(contenido)
    print('  %-52s %6.1f KB' % (os.path.relpath(ruta, RAIZ), len(contenido.encode('utf-8')) / 1024))


def main():
    css = leer(os.path.join(RAIZ, 'assets', 'css', 'aqualise.css'))
    js = leer(os.path.join(RAIZ, 'assets', 'js', 'aqualise.js'))
    base = fotos_de_la_tienda(aplicar_ajustes(conectar_productos(cuerpo_html())))

    for marca in ('{{', '{%'):
        for nombre, txt in (('CSS', css), ('JS', js)):
            if marca in txt:
                raise SystemExit('%s contiene %s y rompería Liquid' % (nombre, marca))

    css_min, js_min = comprimir_css(css + CSS_ESCENAS), comprimir_js(js)
    if css_min.count('{') != css_min.count('}'):
        raise SystemExit('El CSS comprimido tiene las llaves descuadradas')
    estilo_inline = ('<style>\n@import url("%s");\n{%% raw %%}\n%s\n{%% endraw %%}\n</style>'
                     % (FUENTES, css_min))
    script_inline = '<script>\n{%% raw %%}\n%s\n{%% endraw %%}\n</script>' % js_min

    print('Generando Shopify Liquid:')

    # --- 1. archivo unico autocontenido --------------------------------------
    unico = (CABECERA('pagina completa en un solo archivo',
                      ('CÓMO USARLO\n'
                          '  1. En Shopify: Tienda online > Temas > ... > Editar código.\n'
                          '  2. En la carpeta «Sections», pulsa «Añadir una nueva sección» y llámala\n'
                          '     aqualise-pagina-completa.\n'
                          '  3. Borra todo el contenido del archivo nuevo y pega este.\n'
                          '  4. Guarda. Ya puedes añadir la sección «AQUALISÉ · Página completa»\n'
                          '     a cualquier página desde el editor de temas.\n\n'
                          '  Todo va incluido: estilos, animaciones e imágenes. No hay que subir nada más.'))
             + '\n' + estilo_inline + '\n\n' + comprimir_html(incrustar_imagenes(base)) + '\n\n' + script_inline + '\n\n' + esquema())
    escribir(os.path.join(OUT, 'aqualise-pagina-completa.liquid'), unico)

    # --- 2. version con assets del tema --------------------------------------
    seccion = (CABECERA('seccion con assets del tema',
                        ('CÓMO USARLO\n'
                          '  1. Sube a la carpeta «Assets» del tema todos los archivos de shopify/assets/.\n'
                          '  2. Crea la sección «aqualise-landing» y pega este archivo.\n'
                          '  3. Opcional: crea la plantilla page.aqualise.liquid que incluimos.'))
               + "\n{{ 'aqualise.css' | asset_url | stylesheet_tag }}\n"
               + '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
               + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
               + '<link href="%s" rel="stylesheet">\n\n' % FUENTES
               + imagenes_asset_url(base) + '\n\n'
               + "{{ 'aqualise.js' | asset_url | script_tag }}\n\n" + esquema())
    escribir(os.path.join(OUT, 'sections', 'aqualise-landing.liquid'), seccion)

    plantilla = (CABECERA('plantilla de pagina',
                          ('CÓMO USARLO\n'
                          '  1. Crea el archivo templates/page.aqualise.liquid con este contenido.\n'
                          '  2. Crea una página en Shopify y asígnale la plantilla «aqualise».'))
                 + "\n{% section 'aqualise-landing' %}\n")
    escribir(os.path.join(OUT, 'templates', 'page.aqualise.liquid'), plantilla)

    # --- 3. assets del tema ---------------------------------------------------
    escribir(os.path.join(OUT, 'assets', 'aqualise.css'), css)
    escribir(os.path.join(OUT, 'assets', 'aqualise.js'), js)
    copiadas = 0
    for f in sorted(os.listdir(IMG)):
        if f.endswith(('.svg', '.jpg')):
            shutil.copyfile(os.path.join(IMG, f), os.path.join(OUT, 'assets', 'aqualise-' + f))
            copiadas += 1
    print('  %-52s %6d archivos' % ('shopify/assets/aqualise-*', copiadas))


if __name__ == '__main__':
    main()
