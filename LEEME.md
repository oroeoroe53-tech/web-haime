# AQUALISÉ — Web de comercio electrónico de lujo

Sitio completo, en español (España), para **AQUALISÉ**, marca ficticia de auriculares
de **conducción ósea** para nadar: dos unidades compactas junto a los oídos unidas por
una banda flexible de titanio tras la nuca. Sumergibles, seguros y con un sonido
excepcional bajo el agua.

---

## 1. Ver la web al instante

Abre **`index.html`** en cualquier navegador. No necesita servidor ni instalación.

---

## 2. Verlo en Shopify

### Opción A — un solo archivo (la más rápida)

1. Shopify → **Tienda online → Temas → ⋯ → Editar código**.
2. En la carpeta **Sections**, pulsa **Añadir una nueva sección** y llámala
   `aqualise-pagina-completa`.
3. Borra el contenido del archivo nuevo y pega **`shopify/aqualise-pagina-completa.liquid`**.
4. Guarda.
5. Ve al **editor de temas**, abre la página donde quieras verlo y **añade la sección**
   «AQUALISÉ · Página completa».

Ese archivo lleva dentro los estilos, las animaciones y todas las imágenes. No hay que
subir nada más. Ocupa unos 118 KB, por debajo del límite de 256 KB por archivo Liquid
que impone Shopify.

### Opción B — estructura de tema (más mantenible)

1. Sube a la carpeta **Assets** del tema todo el contenido de **`shopify/assets/`**
   (`aqualise.css`, `aqualise.js` y las diez imágenes `aqualise-*.svg`).
2. Crea la sección `aqualise-landing` con **`shopify/sections/aqualise-landing.liquid`**.
3. Opcional: crea la plantilla `page.aqualise.liquid` con
   **`shopify/templates/page.aqualise.liquid`**, crea una página en Shopify y asígnale
   la plantilla «aqualise».

### Ajustes editables desde el editor de temas

Ambas versiones incluyen `{% schema %}` con:

- Antetítulo, titular (dos líneas), texto y botón de la portada.
- **Tres selectores de producto.** Si eliges productos reales de tu catálogo, las fichas
  muestran su precio con el formato de tu tienda (`| money`) y el botón
  «Añadir al carrito» envía al carrito real de Shopify (`{{ routes.cart_add_url }}`).
  Si los dejas vacíos, funciona la demostración con el carrito lateral animado.

---

## 3. Estructura

```
index.html                                  Sitio completo (versión estática)
assets/css/aqualise.css                     Sistema de diseño
assets/js/aqualise.js                       Interacciones (sin dependencias)
assets/img/                                 Logotipo e ilustraciones originales en SVG
shopify/aqualise-pagina-completa.liquid     Shopify · archivo único autocontenido
shopify/sections/aqualise-landing.liquid    Shopify · sección con assets del tema
shopify/templates/page.aqualise.liquid      Shopify · plantilla de página
shopify/assets/                             Shopify · css, js e imágenes del tema
herramientas/build-shopify.py               Regenera el código Liquid desde el sitio
```

Para regenerar el Liquid después de tocar el HTML, el CSS o el JS:

```bash
python3 herramientas/build-shopify.py
```

---

## 4. Identidad visual

**Logotipo.** Emblema original: un arco que representa a la vez la banda de los
auriculares y la cresta de una ola, rematado por las dos unidades de conducción ósea,
sobre una onda de agua y dentro de un círculo fino. Degradado cromo-aqua.
Archivos: `logo-aqualise.svg` (lockup), `logo-mark.svg` (emblema), `favicon.svg`.

**Paleta** — agua de piscina luminosa, cristal y cromo:

| Uso | Color |
|---|---|
| Tinta | `#0B2B36` |
| Aqua profundo | `#0B4354` · `#0E5C6E` |
| Aqua marca | `#1C8CA8` · `#2E9BB8` |
| Aqua luz | `#46B6CE` · `#7FCBE0` · `#A8DCE8` |
| Espuma | `#EAF7FA` · `#F7FCFD` |
| Cromo | `#FFFFFF` → `#DCEAEF` → `#A8BFC8` |
| Champán (edición limitada) | `#C6AC79` |

**Tipografía.** *Cormorant Garamond* (display, pesos ligeros) + *Jost* (texto y
microtipografía con mucho interletrado). Se cargan desde Google Fonts.

**Acabados del producto:** Nácar, Laguna, Titanio Nocturno y Champán Pálido.

---

## 5. Secciones

Aviso superior en bucle · cabecera fija · portada · **despiece animado con el scroll** ·
franja de prensa · manifiesto · colección de tres modelos · selector de acabados
interactivo · seis beneficios · tecnología · panel de estilo de vida y mosaico ·
testimonios · accesorios · Club Aqualisé (membresía) · boletín · pie completo ·
carrito lateral · menú móvil.

### Despiece animado (`#anatomia`)

Al estilo de las páginas de producto de Apple, pero sin secuencia de fotogramas: el
producto es vectorial y se anima de forma continua.

- Contenedor fijado en pantalla durante 520 vh de recorrido.
- El scroll controla un valor de 0 a 1 que **desmonta y vuelve a montar** el auricular:
  la banda se separa, la unidad izquierda se aparta y las **ocho piezas** de la unidad
  derecha se abren en abanico con sus etiquetas (carcasa exterior, junta de sellado,
  transductor óseo, bobina de voz, imán de neodimio, placa HydroSense, batería y
  carcasa interior). Al final se vuelve a cerrar en una sola pieza.
- Tres bloques de texto entran y salen en puntos concretos del recorrido.
- En escritorio el abanico es horizontal; **en móvil pasa a vertical** y el `viewBox`
  del SVG se reencuadra solo, con las etiquetas a la derecha de cada pieza.
- Peso: unos kilobytes. No descarga ni una imagen (la referencia que inspiró esto
  carga 192 JPG, 10,3 MB).
- Con `prefers-reduced-motion` se muestra el despiece completo, estático y sin scroll.

Las piezas se definen en el array `PIEZAS` de `assets/js/aqualise.js`: cambiar un
nombre, un detalle o un dibujo es editar una línea de ese array.

---

## 6. Detalles técnicos

- Sin dependencias ni compilación: HTML, CSS y JavaScript nativo.
- Animaciones con `IntersectionObserver`, contadores, parallax y transiciones suaves.
- Respeta `prefers-reduced-motion`.
- Accesibilidad: `aria-label`, `aria-pressed`, `aria-hidden`, foco visible, cierre con `Esc`.
- Responsive de 320 px en adelante.
- Precios formateados con `toLocaleString('es-ES')`.

---

## 7. Aviso

AQUALISÉ es una **marca ficticia** creada para este proyecto. Los nombres de medios
(Áurea, Nautis Review, Piscina & Diseño, Luxe Ibérica, Mar Interior), los testimonios,
el teléfono, la dirección y los precios son inventados.

Las imágenes son **ilustraciones vectoriales originales en SVG** creadas para este
encargo (escenas subacuáticas, piscina de lujo, macro del transductor y renders de
producto), no fotografías. Se pueden sustituir por fotografía real cambiando los
archivos de `assets/img/` sin tocar el resto del código.
