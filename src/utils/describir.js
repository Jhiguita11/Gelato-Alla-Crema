import { ADICIONES_EXTRA, PRODUCTS, SAUCES, varianteDe } from '../data/menu'
import { catalogoSabores } from '../store/disponibilidad'

const nombre = (lista, id) => lista.find((x) => x.id === id)?.name ?? id

/** Convierte una línea de pedido en texto legible para caja y cocina. */
export function describirLinea(line) {
  const product = PRODUCTS.find((p) => p.id === line.productId)

  // Agrupa sabores repetidos: ['mora','mora'] → "2× Mora"
  const conteo = {}
  for (const id of line.flavorIds ?? []) conteo[id] = (conteo[id] ?? 0) + 1
  const catalogo = catalogoSabores()
  const sabores = Object.entries(conteo).map(([id, n]) =>
    n > 1 ? `${n}× ${nombre(catalogo, id)}` : nombre(catalogo, id),
  )

  const variante = varianteDe(product, line.varianteId)
  const porciones = variante?.porciones ?? product?.porciones ?? 0

  // Las opciones propias del producto (recipiente, licor) se muestran con el
  // título con el que se preguntaron, sin el signo de interrogación.
  const limpiar = (titulo) => titulo.replace(/^¿|\?$/g, '')

  const opciones = (product?.opciones ?? [])
    .map((o) => ({ etiqueta: limpiar(o.titulo), valor: line.opciones?.[o.id] }))
    .filter((o) => o.valor)

  // Los extras incluidos (maní, chips) se listan como "Lleva: Maní, Chips".
  const extras = (product?.extras ?? [])
    .map((e) => ({ etiqueta: 'Lleva', valor: (line.extras?.[e.id] ?? []).join(', ') }))
    .filter((e) => e.valor)

  return {
    titulo: product?.name ?? 'Producto',
    icono: product?.icon ?? '🍦',
    porciones: porciones > 0 ? `${porciones} ${porciones === 1 ? 'porción' : 'porciones'}` : null,
    variante: variante?.name ?? null,
    opciones,
    extras,
    sabores,
    salsa: line.sauceId ? nombre(SAUCES, line.sauceId) : null,
    // La porción extra se nombra con su sabor: "Porción extra (Lulo)".
    adiciones: (line.adicionIds ?? []).map((id) => {
      const saborId = line.adicionSabores?.[id]
      const base = nombre(ADICIONES_EXTRA, id)
      return saborId ? `${base} (${nombre(catalogo, saborId)})` : base
    }),
    cantidad: line.quantity ?? 1,
  }
}

/** Hace cuánto pasó algo, en texto corto: "hace 4 min". */
export function haceCuanto(timestamp) {
  const minutos = Math.floor((Date.now() - timestamp) / 60000)
  if (minutos < 1) return 'ahora mismo'
  if (minutos === 1) return 'hace 1 min'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  return horas === 1 ? 'hace 1 h' : `hace ${horas} h`
}

/** Hora del día: "3:42 p. m." */
export function hora(timestamp) {
  return new Date(timestamp).toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
  })
}
