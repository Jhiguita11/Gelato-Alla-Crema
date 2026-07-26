/**
 * ── CARTA DE GELATO ALLA CREMA ──────────────────────────────────────────────
 *
 * Transcrita de las fotos de la carta física (carpeta Carta/).
 * Este es el ÚNICO archivo que hay que tocar para cambiar la carta.
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
  if (product.variantes) return Math.min(...product.variantes.map((v) => v.price))
  return product.price
}

/** Cuántos sabores hay que elegir para una línea ya configurada. */
export function porcionesDe(product, varianteId) {
  if (product.variantes) return varianteDe(product, varianteId)?.porciones ?? 0
  return product.porciones ?? 0
}

/** Calcula el precio de una línea de pedido. */
export function lineTotal(line) {
  const product = PRODUCTS.find((p) => p.id === line.productId)
  if (!product) return 0

  let total = product.variantes
    ? (varianteDe(product, line.varianteId)?.price ?? 0)
    : (product.price ?? 0)

  for (const id of line.adicionIds ?? []) {
    total += ADICIONES_EXTRA.find((a) => a.id === id)?.price ?? 0
  }
  return total * (line.quantity ?? 1)
}

/** Suma el total de un pedido completo. */
export function orderTotal(order) {
  return (order.lines ?? []).reduce((sum, line) => sum + lineTotal(line), 0)
}
