/**
 * Reglas del formulario de la carta (pantalla Carta, solo admin). Aparte de la
 * vista para poder probarlas sin React.
 */

/** "Té verde matcha" → "te-verde-matcha" */
export function aSlug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

/** Un id que no choque con los que ya hay (incluidos los quitados). */
function idLibre(base, usados) {
  const raiz = base || 'producto'
  if (!usados.has(raiz)) return raiz
  for (let i = 2; ; i++) if (!usados.has(`${raiz}-${i}`)) return `${raiz}-${i}`
}

export const textoPorciones = (n) => (n > 0 ? `${n} ${n === 1 ? 'porción' : 'porciones'}` : undefined)

/** Convierte lo que escribe el admin ("12.000", "12000") en número entero. */
export const aPesos = (v) => Number(String(v).replace(/[^\d]/g, ''))

/**
 * Revisa el formulario y arma el producto a guardar. Devuelve { producto } o
 * { error }. Las versiones que ya existían conservan su id (así un pedido que
 * se está armando con esa versión no se rompe al guardar).
 */
export function validarProducto(f, { item, carta }) {
  const name = f.name.trim().replace(/\s+/g, ' ')
  if (!name) return { error: 'Escribe el nombre del producto.' }
  if (name.length > 40) return { error: 'El nombre es muy largo (máximo 40 letras).' }
  const repetido = carta.find(
    (x) => !x.oculto && x.producto.id !== item?.producto.id && x.producto.name.toLowerCase() === name.toLowerCase(),
  )
  if (repetido) return { error: `Ya hay un producto que se llama "${repetido.producto.name}".` }

  const incluye = f.incluye
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const base = {
    name,
    icon: f.icon,
    category: f.category,
    eligeSalsa: f.eligeSalsa,
    incluye,
  }

  let campos
  if (!f.conVersiones) {
    const price = aPesos(f.price)
    if (!price || price < 100) return { error: 'Escribe el precio (en pesos, por ejemplo 12000).' }
    if (price > 1_000_000) return { error: 'Ese precio parece un error: revisa los ceros.' }
    campos = { price, porciones: Number(f.porciones) || 0, variantes: null, variantesTitulo: null }
  } else {
    const filas = f.variantes.map((v) => ({ ...v, name: v.name.trim() }))
    if (filas.length < 2) return { error: 'Con versiones hacen falta al menos dos (si no, usa precio único).' }
    if (filas.some((v) => !v.name)) return { error: 'Ponle nombre a cada versión (por ejemplo Sencilla, Especial).' }
    const nombres = new Set(filas.map((v) => v.name.toLowerCase()))
    if (nombres.size !== filas.length) return { error: 'Hay dos versiones con el mismo nombre.' }
    const usados = new Set(filas.map((v) => v.id).filter(Boolean))
    const variantes = []
    for (const v of filas) {
      const price = aPesos(v.price)
      if (!price || price < 100) return { error: `Escribe el precio de "${v.name}".` }
      if (price > 1_000_000) return { error: `El precio de "${v.name}" parece un error: revisa los ceros.` }
      let id = v.id
      if (!id) {
        id = idLibre(aSlug(v.name) || 'v', usados)
        usados.add(id)
      }
      const porciones = Number(v.porciones) || 0
      variantes.push({ id, name: v.name, detalle: textoPorciones(porciones), porciones, price })
    }
    const variantesTitulo = f.variantesTitulo.trim() || '¿Qué versión?'
    campos = { price: null, porciones: 0, variantes, variantesTitulo }
  }

  const id = item?.producto.id ?? idLibre(aSlug(name), new Set(carta.map((x) => x.producto.id)))
  return { producto: { id, ...base, ...campos } }
}

