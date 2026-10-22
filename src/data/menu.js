/**
 * ── CARTA DE GELATO ALLA CREMA ──────────────────────────────────────────────
 *
 * Transcrita de las fotos de la carta física (carpeta Carta/).
 * Esta es la carta de fábrica. El admin la puede ajustar desde la app (pantalla
 * Carta) sin tocar este archivo: ver `armarCarta` más abajo.
 * Precios en pesos colombianos (COP), sin puntos ni comas.
 *
 * Campos de cada producto:
 *   porciones       → cuántas porciones de helado trae (= cuántos sabores se
 *                     eligen). 0 = no lleva helado.
 *   price           → precio fijo.
 *   variantes       → cuando el producto se vende en dos o más versiones
 *                     (X1/X2, sencilla/especial, con/sin helado). Reemplaza a
 *                     `price` y a `porciones`: cada variante trae los suyos.
 *   variantesTitulo → la pregunta que se le hace al cliente para elegirla.
 *   incluye         → lo que trae la preparación, tal cual dice la carta.
 *   eligeSalsa      → la carta dice "Salsa" genérica, así que el cliente
 *                     escoge cuál.
 *   opciones        → preguntas de una sola respuesta propias del producto
 *                     (el recipiente del cono/vaso/canasta, el licor de la
 *                     Copa Bayles). Son obligatorias.
 *   extras          → preguntas de varias respuestas por cosas que van
 *                     incluidas y no cobran (maní o chips en el cono).
 *                     Son opcionales: se puede seguir sin elegir ninguna.
 *
 * Confirmado con el local: en Concha de helado y Cucurucho manda la etiqueta
 * amarilla escrita a mano, no el precio azul impreso.
 *
 * ⚠️ Todavía sin datos reales:
 *   · Cholado con helado y Salpicón sin helado: ver los ⚠️ más abajo.
 *   · La lista de SABORES: la carta no los enumera, los de abajo son un
 *     supuesto y hay que reemplazarlos por los de la vitrina.
 *   · ADICIONES_EXTRA: la carta no cobra adiciones aparte; si el local sí
 *     cobra, poner aquí el precio.
 */

export const BRAND = {
  name: 'Gelato Alla Crema',
  tagline: 'Helado artesanal · Toma de pedidos',
  // BASE_URL respeta la subcarpeta de GitHub Pages (/gelato-alla-crema/).
  logo: `${import.meta.env.BASE_URL}logo.jpg`,
}

/** Las 5 mesas del local, más la opción de llevar. */
export const TABLES = ['1', '2', '3', '4', '5', 'Para llevar']

/** Quiénes atienden. Cada quien entra con su perfil al empezar el turno. */
export const STAFF = ['Jeremy', 'Mariana', 'Gloria', 'Fredy', 'Carolina']

/**
 * Sabores de la vitrina. Esta es la lista completa que puede haber; cuáles hay
 * *hoy* se decide en la pantalla de apertura y se puede cambiar en
 * Disponibilidad cuando alguno se acabe.
 *
 * El `color` es solo la bolita que se ve al lado del nombre, para que el
 * mesero lo ubique de un vistazo.
 */
export const FLAVORS = [
  { id: 'frutos-rojos', name: 'Frutos rojos', color: '#b8324f' },
  { id: 'vainilla-chips', name: 'Vainilla chips', color: '#efe0bd' },
  { id: 'nucita', name: 'Nucita', color: '#9c6b4a' },
  { id: 'ron-pasas', name: 'Ron pasas', color: '#c9b8a0' },
  { id: 'brownie', name: 'Brownie', color: '#5a3a26' },
  { id: 'arequipe-cafe', name: 'Arequipe café', color: '#b07a45' },
  { id: 'cocada', name: 'Cocada', color: '#f5efe3' },
  { id: 'lulo', name: 'Lulo', color: '#cfd94f' },
  { id: 'maracuya', name: 'Maracuyá', color: '#f3c53f' },
  { id: 'tres-leches', name: '3 leches', color: '#f7e9d0' },
  { id: 'acid-mix', name: 'Acid mix', color: '#9ede3f' },
  { id: 'chicle', name: 'Chicle', color: '#f4a3c8' },
  { id: 'mandarina-limon', name: 'Mandarina limón', color: '#f2a03d' },
  { id: 'yogurt', name: 'Yogurt', color: '#fbf4e6' },
  { id: 'unicornio', name: 'Unicornio', color: '#cdaaf0' },
  { id: 'crema-mani', name: 'Crema maní', color: '#c99a5b' },
]

/** Salsas disponibles cuando la preparación incluye "Salsa". */
export const SAUCES = [
  { id: 'chocolate', name: 'Chocolate' },
  { id: 'arequipe', name: 'Arequipe' },
  { id: 'chicle', name: 'Chicle' },
]

/**
 * Adiciones cobradas aparte, sobre lo que la preparación ya trae.
 * La porción extra de helado vale PRECIO_PORCION; todas las demás, $1.000.
 *
 * Chips de colores, maní, grageas y barquillo NO están aquí a propósito:
 * vienen con el helado y no se cobran.
 */
export const ADICIONES_EXTRA = [
  // `pideSabor` hace que el armado pregunte de qué sabor va la porción extra.
  { id: 'porcion-extra', name: 'Porción extra de helado', price: 3500, pideSabor: true },
  { id: 'queso', name: 'Queso', price: 1000 },
  { id: 'leche-condensada', name: 'Leche condensada', price: 1000 },
  { id: 'chocolate-derretido', name: 'Chocolate derretido', price: 1000 },
  { id: 'chantilly', name: 'Chantilly', price: 1000 },
  { id: 'cereza', name: 'Cereza', price: 1000 },
]

/** Precio de cada porción de helado suelta. Manda toda la escalera de precios
 *  del cono/vaso/canasta y también la adición "Porción extra de helado". */
export const PRECIO_PORCION = 3500

/** Secciones de la carta, en el orden en que se muestran. */
export const CATEGORIES = [
  { id: 'helados', name: 'Cono, vaso o canasta' },
  { id: 'especiales', name: 'Especiales' },
  { id: 'infantiles', name: 'Infantiles' },
  { id: 'casa', name: 'De la Casa' },
  { id: 'bebidas', name: 'Bebidas y postres' },
]

export const PRODUCTS = [
  // ── CONO, VASO O CANASTA ──────────────────────────────────────────────────
  {
    id: 'cono-vaso-canasta',
    name: 'Cono, vaso o canasta',
    category: 'helados',
    icon: '🍦',
    // La escalera sale de $3.500 por porción, que es lo que cuesta la porción
    // suelta. Coincide con los precios impresos en azul de la carta (X1
    // $3.500, X2 $7.000) y con las etiquetas sueltas de $10.500 y $14.000,
    // que resultan ser 3 y 4 porciones.
    variantesTitulo: '¿Cuántas porciones?',
    variantes: [1, 2, 3, 4, 5].map((n) => ({
      id: `x${n}`,
      name: String(n),
      detalle: n === 1 ? 'porción' : 'porciones',
      porciones: n,
      price: n * PRECIO_PORCION,
    })),
    opciones: [
      { id: 'recipiente', titulo: '¿En qué va?', valores: ['Cono', 'Vaso', 'Canasta'] },
    ],
    eligeSalsa: true,
    extras: [
      {
        id: 'topping',
        titulo: '¿Maní o chips de colores?',
        ayuda: 'Van incluidos · puede llevar los dos',
        valores: ['Maní', 'Chips de colores'],
      },
    ],
    incluye: ['Grageas', 'Barquillo'],
  },

  // ── ESPECIALES ────────────────────────────────────────────────────────────
  {
    id: 'waffle-arequipe',
    name: 'Waffle arequipe',
    category: 'especiales',
    icon: '🧇',
    porciones: 1,
    price: 15000,
    incluye: ['Salsa', 'Chips', 'Queso'],
    eligeSalsa: true,
  },
  {
    id: 'brownie',
    name: 'Brownie',
    category: 'especiales',
    icon: '🍫',
    porciones: 1,
    price: 13000,
    incluye: ['Arequipe', 'Chips', 'Barquillo', 'Chantilly'],
  },
  {
    id: 'ensalada-frutas',
    name: 'Ensalada de frutas',
    category: 'especiales',
    icon: '🍓',
    // Las dos etiquetas juntas de la carta ($12.000 y $16.000) son las dos
    // versiones, no un precio viejo y uno nuevo.
    variantesTitulo: '¿Sencilla o especial?',
    variantes: [
      { id: 'sencilla', name: 'Sencilla', detalle: '1 bola de helado', porciones: 1, price: 12000 },
      { id: 'especial', name: 'Especial', detalle: '2 bolas de helado', porciones: 2, price: 16000 },
    ],
    incluye: [
      'Banano', 'Piña', 'Papaya', 'Mango', 'Manzana', 'Cereza', 'Fresa',
      'Crema leche', 'Chantilly', 'Queso', 'Salsa', 'Chips',
    ],
    eligeSalsa: true,
  },
  {
    id: 'concha',
    name: 'Concha de helado',
    category: 'especiales',
    icon: '🍨',
    // Manda la etiqueta a mano, no el precio azul impreso ($3.500 / $7.000).
    variantesTitulo: '¿Cuántas porciones?',
    variantes: [
      { id: 'x1', name: '1 porción', porciones: 1, price: 10500 },
      { id: 'x2', name: '2 porciones', porciones: 2, price: 14000 },
    ],
    incluye: ['Salsa', 'Chips', 'Grageas', 'Barquillo'],
    eligeSalsa: true,
  },
  {
    id: 'copa-bayles',
    name: 'Copa Bayles',
    category: 'especiales',
    icon: '🍸',
    porciones: 2,
    price: 19000,
    incluye: ['Maní', 'Almendras', 'Cereza', 'Barquillo', 'Leche condensada'],
    opciones: [
      { id: 'licor', titulo: 'Licor', valores: ['Crema de whisky', 'Ron', 'Café'] },
    ],
  },

  // ── INFANTILES ────────────────────────────────────────────────────────────
  {
    id: 'gusano-fantasia',
    name: 'Gusano Fantasía',
    category: 'infantiles',
    icon: '🐛',
    porciones: 3,
    price: 13000,
    incluye: ['Chocolores', 'Masmelo', 'Gomitas', 'Salsa'],
    eligeSalsa: true,
  },
  {
    id: 'banana-split',
    name: 'Banana Split',
    category: 'infantiles',
    icon: '🍌',
    porciones: 3,
    price: 12000,
    incluye: ['Banano', 'Chantilly', 'Salsa', 'Barquillo', 'Chips', 'Cereza'],
    eligeSalsa: true,
  },
  {
    id: 'vaso-unicornio',
    name: 'Vaso unicornio',
    category: 'infantiles',
    icon: '🦄',
    porciones: 1,
    price: 11000,
    incluye: ['Chocolores', 'Masmelo', 'Chantilly', 'Grageas', 'Barrilete'],
  },
  {
    id: 'vaso-carrusel',
    name: 'Vaso Carrusel',
    category: 'infantiles',
    icon: '🎠',
    porciones: 1,
    price: 11000,
    incluye: ['Crema leche', 'Chantilly', 'Grageas', 'Chips', 'Banano'],
  },
  // El Cucurucho de la carta quedó absorbido por "Cono, vaso o canasta",
  // que es el mismo producto con el recipiente a elección y hasta 5 porciones.
  {
    id: 'cono-festival',
    name: 'Cono Festival',
    category: 'infantiles',
    icon: '🎉',
    porciones: 2,
    price: 10000,
    incluye: ['Chocolores', 'Sparkies', 'Barrilete', 'Grageas'],
  },

  // ── DE LA CASA ────────────────────────────────────────────────────────────
  {
    id: 'copa-brownie',
    name: 'Copa brownie',
    category: 'casa',
    icon: '🍫',
    porciones: 2,
    price: 14000,
    incluye: ['Salsa', 'Chips', 'Barquillo', 'Chantilly'],
    eligeSalsa: true,
  },
  {
    id: 'copa-queso-arequipe',
    name: 'Copa queso arequipe',
    category: 'casa',
    icon: '🧀',
    porciones: 2,
    price: 13000,
    incluye: ['Queso', 'Chips', 'Salsa', 'Barquillo'],
    eligeSalsa: true,
  },
  {
    id: 'copa-mani',
    name: 'Copa maní',
    category: 'casa',
    icon: '🥜',
    porciones: 2,
    price: 13000,
    incluye: ['Salsa', 'Maní triturado', 'Barquillo'],
    eligeSalsa: true,
  },
  {
    id: 'copa-solo-cafe',
    name: 'Copa solo café',
    category: 'casa',
    icon: '☕',
    porciones: 2,
    price: 13000,
    incluye: ['Crema café', 'Barquillo', 'Chips'],
  },
  {
    id: 'fresas-crema',
    name: 'Fresas con crema',
    category: 'casa',
    icon: '🍓',
    porciones: 1,
    price: 12000,
    incluye: ['Chantilly', 'Salsa', 'Chips', 'Barquillo'],
    eligeSalsa: true,
  },
  {
    id: 'cerezas-crema',
    name: 'Cerezas con crema',
    category: 'casa',
    icon: '🍒',
    porciones: 1,
    price: 12000,
    incluye: ['Chantilly', 'Salsa', 'Chips', 'Barquillo'],
    eligeSalsa: true,
  },
  {
    id: 'malteada',
    name: 'Malteada',
    category: 'casa',
    icon: '🥤',
    porciones: 2,
    price: 13000,
    incluye: ['Chantilly', 'Toppings', 'Cereza', 'Barquillo'],
  },
  {
    id: 'salpicon',
    name: 'Salpicón con helado',
    category: 'casa',
    icon: '🍉',
    variantesTitulo: '¿Con helado?',
    variantes: [
      // $12.000 confirmado con el local para la versión con helado.
      { id: 'con-helado', name: 'Con helado', detalle: '1 porción', porciones: 1, price: 12000 },
      // ⚠️ SUPUESTO: $3.500 menos, la misma diferencia que hay entre X1 y X2
      // en la Concha de helado. Confirmar el precio real.
      { id: 'sin-helado', name: 'Sin helado', porciones: 0, price: 8500 },
    ],
    incluye: ['Lecherita', 'Chantilly', 'Cereza'],
  },
  {
    id: 'cholado',
    name: 'Cholado',
    category: 'casa',
    icon: '🥤',
    variantesTitulo: '¿Con helado?',
    variantes: [
      // $14.000 es la etiqueta a mano de la carta, sobre el impreso de $11.000.
      { id: 'sin-helado', name: 'Sin helado', porciones: 0, price: 14000 },
      // ⚠️ SUPUESTO: $3.500 más, la misma diferencia que hay entre X1 y X2
      // en la Concha de helado. Confirmar el precio real.
      { id: 'con-helado', name: 'Con helado', detalle: '1 porción', porciones: 1, price: 17500 },
    ],
    incluye: [
      'Jarabe rojo', 'Cereza', 'Maracuyá', 'Banano', 'Piña', 'Guanábana',
      'Crema leche', 'Milo', 'Chantilly',
    ],
  },
  {
    id: 'crema-casera',
    name: 'Crema casera',
    category: 'casa',
    icon: '🍧',
    porciones: 0,
    price: 4000,
    incluye: ['Queso', 'Bocadillo'],
  },

  // ── BEBIDAS Y POSTRES ─────────────────────────────────────────────────────
  {
    id: 'paves',
    name: 'Pavé Tique',
    category: 'bebidas',
    icon: '🍮',
    porciones: 0,
    price: 9000,
    incluye: [],
  },
  {
    id: 'jugo',
    name: 'Jugo',
    category: 'bebidas',
    icon: '🧃',
    porciones: 0,
    price: 6000,
    incluye: [],
  },
  {
    id: 'limonada',
    name: 'Limonada',
    category: 'bebidas',
    icon: '🍋',
    porciones: 0,
    price: 6000,
    incluye: [],
  },
]

/**
 * ── CARTA VIGENTE ───────────────────────────────────────────────────────────
 * PRODUCTS es la carta "de fábrica". El admin la puede cambiar desde la app
 * (pantalla Carta): editar, quitar (ocultar) o agregar productos. Esos cambios
 * viven en `estado.carta` como una lista de { id, datos, oculto }:
 *   · datos  → los campos editables del producto (null = sin cambios).
 *   · oculto → quitado de la carta; se puede volver a poner.
 * `armarCarta` junta las dos cosas. Nunca se borra un producto de verdad: los
 * pedidos viejos tienen que poder seguir mostrándolo.
 */

/** Campos que el admin puede editar. El resto (opciones, extras) se conserva. */
export const CAMPOS_EDITABLES = [
  'name', 'icon', 'category', 'price', 'porciones', 'variantes', 'variantesTitulo', 'eligeSalsa', 'incluye',
]

/**
 * Carta vigente: los de fábrica (con sus cambios) y los agregados desde la
 * app, en ese orden. Cada elemento: { producto, oculto, deFabrica, editado }.
 */
export function armarCarta(cambios = []) {
  const porId = new Map(cambios.map((c) => [c.id, c]))
  const deFabrica = PRODUCTS.map((base) => {
    const c = porId.get(base.id)
    return {
      producto: c?.datos ? { ...base, ...c.datos, id: base.id } : base,
      oculto: !!c?.oculto,
      deFabrica: true,
      editado: !!c?.datos,
    }
  })
  const fabrica = new Set(PRODUCTS.map((p) => p.id))
  const nuevos = cambios
    .filter((c) => !fabrica.has(c.id) && c.datos)
    .map((c) => ({ producto: { ...c.datos, id: c.id }, oculto: !!c.oculto, deFabrica: false, editado: false }))
  return [...deFabrica, ...nuevos]
}

// Última carta conocida (la fija DisponibilidadProvider en cada render), para
// las funciones que no pasan por React: precios, descripción, resumen.
let cartaVigente = null

export function fijarCarta(carta) {
  cartaVigente = carta
}

/** Busca un producto por id, aunque esté oculto (los pedidos viejos lo usan). */
export function productoPorId(id) {
  if (cartaVigente) return cartaVigente.find((x) => x.producto.id === id)?.producto ?? null
  return PRODUCTS.find((p) => p.id === id) ?? null
}

/** Formatea un número como precio colombiano: 11000 → "$ 11.000" */
export function formatCOP(value) {
  return `$ ${Math.round(value).toLocaleString('es-CO')}`
}

/** Busca la variante elegida de una línea, si el producto tiene variantes. */
export function varianteDe(product, varianteId) {
  return product?.variantes?.find((v) => v.id === varianteId) ?? null
}

/** Precio base de un producto (el menor, si tiene variantes). */
export function precioDesde(product) {
  if (product.variantes?.length) return Math.min(...product.variantes.map((v) => v.price))
  return product.price ?? 0
}

/** Cuántos sabores hay que elegir para una línea ya configurada. */
export function porcionesDe(product, varianteId) {
  if (product.variantes?.length) return varianteDe(product, varianteId)?.porciones ?? 0
  return product.porciones ?? 0
}

/** Precio de UNA unidad de la línea con la carta de ahora (base + adiciones). */
export function precioUnitario(line) {
  const product = productoPorId(line.productId)
  if (!product) return 0
  let total = product.variantes?.length
    ? (varianteDe(product, line.varianteId)?.price ?? 0)
    : (product.price ?? 0)
  for (const id of line.adicionIds ?? []) {
    total += ADICIONES_EXTRA.find((a) => a.id === id)?.price ?? 0
  }
  return total
}

/**
 * Precio de una línea de pedido. Una línea ya enviada trae su precio
 * congelado (`precio`, ver `congelarLinea`): si el admin cambia el precio a
 * media tarde, lo que ya se vendió no cambia ni en la caja ni en el cierre.
 */
export function lineTotal(line) {
  const unidad = Number.isFinite(line.precio) ? line.precio : precioUnitario(line)
  return unidad * (line.quantity ?? 1)
}

/** Al enviar el pedido: guarda en la línea el nombre y el precio de ese momento. */
export function congelarLinea(line) {
  const product = productoPorId(line.productId)
  const variante = varianteDe(product, line.varianteId)
  return {
    ...line,
    nombre: line.nombre ?? product?.name ?? null,
    icono: line.icono ?? product?.icon ?? null,
    varianteNombre: line.varianteNombre ?? variante?.name ?? null,
    porciones: Number.isFinite(line.porciones)
      ? line.porciones
      : product
        ? porcionesDe(product, line.varianteId)
        : 0,
    precio: Number.isFinite(line.precio) ? line.precio : precioUnitario(line),
  }
}

/** Suma el total de un pedido completo. */
export function orderTotal(order) {
  return (order.lines ?? []).reduce((sum, line) => sum + lineTotal(line), 0)
}
