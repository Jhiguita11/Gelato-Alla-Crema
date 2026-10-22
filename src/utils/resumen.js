import { ADICIONES_EXTRA, PRODUCTS, lineTotal, varianteDe } from '../data/menu'
import { catalogoSabores } from './catalogo'

/**
 * Sabores de UNA unidad de la línea: los del producto más los de las
 * adiciones que llevan sabor (la porción extra de helado). La porción extra
 * guarda su sabor aparte, en `adicionSabores`, así que hay que sumarla aquí o
 * se pierde de la cuenta de qué reponer.
 *
 * Solo cuenta el sabor de una adición si la adición sigue marcada: si alguien
 * la quitó después de elegirle sabor, `adicionSabores` puede conservarlo.
 */
export function saboresDeLinea(line) {
  const extras = ADICIONES_EXTRA.filter((a) => a.pideSabor)
    .filter((a) => (line.adicionIds ?? []).includes(a.id))
    .map((a) => line.adicionSabores?.[a.id])
    .filter(Boolean)
  return [...(line.flavorIds ?? []), ...extras]
}

/** Cuántas porciones de helado lleva una línea, contando las unidades. */
export function porcionesDeLinea(line) {
  const product = PRODUCTS.find((p) => p.id === line.productId)
  const base = varianteDe(product, line.varianteId)?.porciones ?? product?.porciones ?? 0
  const extras = ADICIONES_EXTRA.filter(
    (a) => a.pideSabor && (line.adicionIds ?? []).includes(a.id),
  ).length
  return (base + extras) * (line.quantity ?? 1)
}

/**
 * Resume todo lo que se ha hecho en el día a partir de los pedidos abiertos.
 * Es una función pura: la usa tanto la pantalla de Caja como el cierre.
 */
export function resumenDelDia(todos, turnos = []) {
  const sabores = catalogoSabores()
  // Los anulados no cuentan para nada, pero se reportan aparte. Los ocultos
  // ("limpiados" de la lista) sí cuentan: son ventas.
  const orders = todos.filter((o) => !o.anuladoAt)
  const anulados = todos.filter((o) => o.anuladoAt)

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

      for (const saborId of saboresDeLinea(linea)) {
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
    anulados: anulados.length,
    totalAnulado: anulados.reduce((s, o) => s + o.total, 0),
    // Sin entregar: en preparación o listos para recoger.
    pendientes: orders.filter((o) => o.status !== 'despachado').length,
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
