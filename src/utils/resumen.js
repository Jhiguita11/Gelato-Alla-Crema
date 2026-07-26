import { PRODUCTS, lineTotal, varianteDe } from '../data/menu'
import { catalogoSabores } from '../store/disponibilidad'

/** Cuántas porciones de helado lleva una línea, contando las unidades. */
function porcionesDeLinea(line) {
  const product = PRODUCTS.find((p) => p.id === line.productId)
  const porciones = varianteDe(product, line.varianteId)?.porciones ?? product?.porciones ?? 0
  return porciones * (line.quantity ?? 1)
}

/**
 * Resume todo lo que se ha hecho en el día a partir de los pedidos abiertos.
 * Es una función pura: la usa tanto la pantalla de Caja como el cierre.
 */
export function resumenDelDia(orders, turnos = []) {
  const sabores = catalogoSabores()

  // Cuánto estuvo conectado cada quien, sumando todos sus turnos del día.
  const minutosPorPersona = new Map()
  for (const turno of turnos) {
    const hasta = turno.fin ?? Date.now()
    const minutos = Math.max(0, Math.round((hasta - turno.inicio) / 60000))
    minutosPorPersona.set(turno.persona, (minutosPorPersona.get(turno.persona) ?? 0) + minutos)
  }

  // Qué atendió cada quien. Las mesas se cuentan sin repetir: atender tres
  // veces la mesa 2 es una sola mesa.
  const porPersona = new Map()
  const dato = (nombre) => {
    if (!porPersona.has(nombre)) {
      porPersona.set(nombre, { persona: nombre, pedidos: 0, total: 0, mesas: new Set() })
    }
    return porPersona.get(nombre)
  }
  for (const nombre of minutosPorPersona.keys()) dato(nombre)
  for (const orden of orders) {
    if (!orden.takenBy) continue
    const d = dato(orden.takenBy)
    d.pedidos += 1
    d.total += orden.total
    d.mesas.add(orden.table)
  }

  const total = orders.reduce((s, o) => s + o.total, 0)
  const cobrado = orders.filter((o) => o.paid).reduce((s, o) => s + o.total, 0)

  const porProducto = new Map()
  const porSabor = new Map()
  let unidades = 0
  let porcionesTotales = 0

  for (const orden of orders) {
    for (const linea of orden.lines) {
      const cantidad = linea.quantity ?? 1
      unidades += cantidad

      const producto = PRODUCTS.find((p) => p.id === linea.productId)
      const clave = linea.productId
      const acumulado = porProducto.get(clave) ?? {
        id: clave,
        name: producto?.name ?? clave,
        icon: producto?.icon ?? '🍦',
        cantidad: 0,
        total: 0,
      }
      acumulado.cantidad += cantidad
      acumulado.total += lineTotal(linea)
      porProducto.set(clave, acumulado)

      porcionesTotales += porcionesDeLinea(linea)

      for (const saborId of linea.flavorIds ?? []) {
        const sabor = sabores.find((s) => s.id === saborId)
        const previo = porSabor.get(saborId) ?? {
          id: saborId,
          name: sabor?.name ?? saborId,
          color: sabor?.color ?? '#cccccc',
          porciones: 0,
        }
        previo.porciones += cantidad
        porSabor.set(saborId, previo)
      }
    }
  }

  return {
    pedidos: orders.length,
    unidades,
    porcionesTotales,
    total,
    cobrado,
    porCobrar: total - cobrado,
    pendientes: orders.filter((o) => o.status === 'pendiente').length,
    sinPagar: orders.filter((o) => !o.paid).length,
    // A igual número de unidades manda lo que más plata dejó, para que el
    // orden no quede al azar al principio del día.
    productos: [...porProducto.values()].sort(
      (a, b) => b.cantidad - a.cantidad || b.total - a.total,
    ),
    sabores: [...porSabor.values()].sort(
      (a, b) => b.porciones - a.porciones || a.name.localeCompare(b.name, 'es'),
    ),
    desde: orders.length ? Math.min(...orders.map((o) => o.createdAt)) : null,
    personas: [...porPersona.values()]
      .map((p) => ({
        persona: p.persona,
        pedidos: p.pedidos,
        total: p.total,
        mesas: p.mesas.size,
        minutos: minutosPorPersona.get(p.persona) ?? 0,
      }))
      .sort((a, b) => b.mesas - a.mesas || b.pedidos - a.pedidos),
  }
}

/** 95 → "1 h 35 min" */
export function duracion(minutos) {
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

/** Fecha larga en español: "domingo, 26 de julio". */
export function fechaLarga(timestamp) {
  return new Date(timestamp).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
