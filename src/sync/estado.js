/**
 * Estado de la heladería y las operaciones que lo cambian.
 *
 * Es el mismo para los dos modos de la app:
 *  - local: todo vive en el navegador (como siempre); cada operación se aplica
 *    y se guarda de una.
 *  - compartido: lo que se ve es lo último que mandó el servidor MÁS las
 *    operaciones que este celular todavía no ha podido subir (sin internet,
 *    por ejemplo), aplicadas encima con esta misma función.
 *
 * Por eso `aplicarOp` es pura y sin sorpresas: misma entrada, misma salida, y
 * si una operación no cambia nada devuelve el MISMO objeto (así nadie guarda ni
 * re-renderiza en balde). Todas las operaciones son idempotentes: aplicar dos
 * veces la misma da lo mismo que aplicarla una, porque la cola puede
 * reintentar.
 */
import { fusionarCierres } from '../utils/respaldo'

export function estadoVacio() {
  return {
    // La jornada es el "día de caja": va de un cierre al siguiente.
    jornada: { id: null, contador: 0, abiertaAt: null },
    pedidos: [], // de la jornada actual, el más nuevo primero
    cierres: [], // historial, el más reciente primero
    turnos: [], // de la jornada actual
    vitrina: { fecha: null, sabores: [], productosAgotados: [], saboresExtra: [] },
    // Cambios del admin a la carta de fábrica: [{ id, datos, oculto }]
    // (ver armarCarta en data/menu.js).
    carta: [],
  }
}

export const codigoDe = (n) => String(n).padStart(3, '0')

function cambiarPedido(estado, id, fn) {
  let cambio = false
  const pedidos = estado.pedidos.map((p) => {
    if (p.id !== id) return p
    const nuevo = fn(p)
    if (nuevo !== p) cambio = true
    return nuevo
  })
  return cambio ? { ...estado, pedidos } : estado
}

function conLista(lista, valor, incluir) {
  const esta = lista.includes(valor)
  if (incluir === esta) return lista
  return incluir ? [...lista, valor] : lista.filter((v) => v !== valor)
}

/**
 * Aplica una operación.
 * `asignarCodigo`: en modo local el número del pedido (#001…) se pone aquí; en
 * modo compartido lo pone el servidor, para que dos celulares nunca repitan
 * número, y mientras tanto el pedido queda con `code: null` ("por enviar").
 */
export function aplicarOp(estado, op, { asignarCodigo = true } = {}) {
  switch (op.tipo) {
    case 'crearPedido': {
      if (estado.pedidos.some((p) => p.id === op.pedido.id)) return estado
      const contador = asignarCodigo ? estado.jornada.contador + 1 : estado.jornada.contador
      const pedido = { ...op.pedido, code: asignarCodigo ? codigoDe(contador) : null }
      return {
        ...estado,
        jornada: { ...estado.jornada, contador },
        pedidos: [pedido, ...estado.pedidos],
      }
    }

    // Pagado = todo cobrado; sin pagar = nada cobrado. En los dos casos se
    // olvida lo abonado (ver agregarAPedido).
    case 'marcarPago':
      return cambiarPedido(estado, op.id, (p) =>
        p.paid === op.paid && !p.abonado
          ? p
          : { ...p, paid: op.paid, paidAt: op.paid ? op.at : null, abonado: null },
      )

    // La misma gente de la mesa pide algo más: se agrega al pedido que ya
    // tienen en vez de abrir otro.
    //  · Lo que ya se entregó queda marcado (entregadaAt) para tacharlo; lo
    //    que estaba listo sin entregar, como lista (listaAt).
    //  · El pedido vuelve a preparación y a la cola, con la hora de esta ronda.
    //  · El cobro se recalcula: lo que ya pagaron queda como abonado y lo
    //    nuevo se suma a lo que deben (o a lo pagado, si lo pagan de una).
    // El servidor hace exactamente lo mismo en agregar_al_pedido().
    case 'agregarAPedido':
      return cambiarPedido(estado, op.id, (p) => {
        if (p.anuladoAt || op.lineas.length === 0) return p
        if (p.lines.some((l) => l.uid === op.lineas[0].uid)) return p // reintento
        const lineasPrevias =
          p.status === 'despachado'
            ? p.lines.map((l) => (l.entregadaAt ? l : { ...l, entregadaAt: p.dispatchedAt ?? op.at }))
            : p.status === 'listo'
              ? p.lines.map((l) => (l.entregadaAt || l.listaAt ? l : { ...l, listaAt: p.listoAt ?? op.at }))
              : p.lines
        const yaPagado = p.paid ? p.total : (p.abonado ?? 0)
        const total = p.total + op.monto
        const abonado = yaPagado + (op.pagado ? op.monto : 0)
        const paid = abonado >= total
        return {
          ...p,
          lines: [...lineasPrevias, ...op.lineas],
          // La nota de la ronda nueva se suma a la que ya tenía.
          note: [p.note, op.nota].filter(Boolean).join(' · '),
          total,
          status: 'pendiente',
          listoAt: null,
          dispatchedAt: null,
          oculto: false,
          rondaAt: op.at,
          rondaPor: op.por ?? null,
          paid,
          paidAt: paid ? (p.paidAt ?? op.at) : null,
          abonado: paid || abonado === 0 ? null : abonado,
        }
      })

    // Flujo de un pedido: pendiente (en preparación) → listo (para recoger)
    // → despachado (entregado en la mesa).
    case 'marcarListo':
      return cambiarPedido(estado, op.id, (p) =>
        p.status !== 'pendiente' ? p : { ...p, status: 'listo', listoAt: op.at },
      )

    case 'despachar':
      return cambiarPedido(estado, op.id, (p) =>
        p.status === 'despachado' ? p : { ...p, status: 'despachado', dispatchedAt: op.at },
      )

    // Vuelve a preparación (desde listo o entregado).
    case 'reabrir':
      return cambiarPedido(estado, op.id, (p) =>
        p.status === 'pendiente'
          ? p
          : { ...p, status: 'pendiente', dispatchedAt: null, listoAt: null },
      )

    // Eliminar un pedido lo ANULA: deja de contar en la caja, pero queda
    // registro de quién y cuándo (el admin lo ve en los reportes). Así nadie
    // puede hacer desaparecer una venta cobrada.
    case 'borrarPedido':
      return cambiarPedido(estado, op.id, (p) =>
        p.anuladoAt ? p : { ...p, anuladoAt: op.at ?? Date.now(), anuladoPor: op.por ?? null },
      )

    // "Limpiar" OCULTA de la lista los entregados Y cobrados, pero siguen
    // contando en la caja (antes se borraban y la venta desaparecía del día).
    case 'limpiarDespachados': {
      let cambio = false
      const pedidos = estado.pedidos.map((p) => {
        if (p.oculto || p.anuladoAt || p.status !== 'despachado' || !p.paid) return p
        cambio = true
        return { ...p, oculto: true }
      })
      return cambio ? { ...estado, pedidos } : estado
    }

    case 'cerrarCaja': {
      // Ya se cerró (reintento de la cola, u otro celular se adelantó).
      if (estado.cierres.some((c) => c.id === op.cierre.id)) return estado
      if (estado.jornada.id !== op.jornadaId) return estado
      return {
        ...estado,
        cierres: [op.cierre, ...estado.cierres],
        pedidos: [],
        jornada: { id: op.nuevaJornadaId, contador: 0, abiertaAt: op.at },
        // Quien siga conectado sigue conectado, pero el turno arranca de cero
        // en el día nuevo.
        turnos: estado.turnos.filter((t) => !t.fin).map((t) => ({ ...t, inicio: op.at })),
      }
    }

    case 'importarCierres': {
      const cierres = fusionarCierres(estado.cierres, op.cierres)
      return cierres.length === estado.cierres.length ? estado : { ...estado, cierres }
    }

    case 'entrar':
      if (estado.turnos.some((t) => t.id === op.turno.id)) return estado
      return { ...estado, turnos: [...estado.turnos, op.turno] }

    case 'salir': {
      let cambio = false
      const turnos = estado.turnos.map((t) => {
        if (t.id !== op.id || t.fin) return t
        cambio = true
        return { ...t, fin: op.fin }
      })
      return cambio ? { ...estado, turnos } : estado
    }

    case 'abrirDia':
      return {
        ...estado,
        vitrina: { ...estado.vitrina, fecha: op.fecha, sabores: op.sabores, productosAgotados: [] },
      }

    case 'reabrirDia':
      if (!estado.vitrina.fecha && !estado.vitrina.sabores.length) return estado
      return {
        ...estado,
        vitrina: { ...estado.vitrina, fecha: null, sabores: [], productosAgotados: [] },
      }

    // Explícito (activo: sí/no) y no "alternar": si dos celulares tocan el
    // mismo sabor a la vez, el resultado es el que ambos querían ver.
    case 'marcarSabor': {
      if (!estado.vitrina.fecha) return estado
      const sabores = conLista(estado.vitrina.sabores, op.id, op.activo)
      return sabores === estado.vitrina.sabores
        ? estado
        : { ...estado, vitrina: { ...estado.vitrina, sabores } }
    }

    case 'marcarProducto': {
      if (!estado.vitrina.fecha) return estado
      const productosAgotados = conLista(estado.vitrina.productosAgotados, op.id, op.agotado)
      return productosAgotados === estado.vitrina.productosAgotados
        ? estado
        : { ...estado, vitrina: { ...estado.vitrina, productosAgotados } }
    }

    case 'agregarSaborExtra': {
      const { vitrina } = estado
      if (vitrina.saboresExtra.some((s) => s.id === op.sabor.id)) return estado
      return {
        ...estado,
        vitrina: {
          ...vitrina,
          saboresExtra: [...vitrina.saboresExtra, op.sabor],
          // Llegó hoy: queda disponible de una, sin esperar a mañana.
          sabores: vitrina.fecha ? conLista(vitrina.sabores, op.sabor.id, true) : vitrina.sabores,
        },
      }
    }

    case 'eliminarSaborExtra': {
      const { vitrina } = estado
      if (!vitrina.saboresExtra.some((s) => s.id === op.id)) return estado
      return {
        ...estado,
        vitrina: {
          ...vitrina,
          saboresExtra: vitrina.saboresExtra.filter((s) => s.id !== op.id),
          sabores: vitrina.sabores.filter((s) => s !== op.id),
        },
      }
    }

    // ── Carta (solo admin; el servidor lo vuelve a revisar) ────────────────
    // Guarda los campos editables de un producto, nuevo o de fábrica. No toca
    // si está oculto: editar y quitar son cosas aparte.
    case 'guardarProducto': {
      const { id, ...datos } = op.producto
      const previo = estado.carta.find((c) => c.id === id)
      if (previo && JSON.stringify(previo.datos) === JSON.stringify(datos)) return estado
      const fila = { id, datos, oculto: previo?.oculto ?? false }
      return {
        ...estado,
        carta: previo ? estado.carta.map((c) => (c.id === id ? fila : c)) : [...estado.carta, fila],
      }
    }

    // Quitar de la carta = ocultar. Nunca se borra: los pedidos lo nombran.
    case 'ocultarProducto': {
      const previo = estado.carta.find((c) => c.id === op.id)
      if ((previo?.oculto ?? false) === op.oculto) return estado
      const fila = { id: op.id, datos: previo?.datos ?? null, oculto: op.oculto }
      return {
        ...estado,
        carta: previo ? estado.carta.map((c) => (c.id === op.id ? fila : c)) : [...estado.carta, fila],
      }
    }

    // Un producto de fábrica vuelve a como venía (sin cambios y visible).
    case 'restaurarProducto': {
      if (!estado.carta.some((c) => c.id === op.id)) return estado
      return { ...estado, carta: estado.carta.filter((c) => c.id !== op.id) }
    }

    default:
      throw new Error(`Operación desconocida: ${op.tipo}`)
  }
}

/** Lo que se ve: el estado del servidor con lo pendiente de subir encima. */
export function aplicarPendientes(base, pendientes) {
  return pendientes.reduce((e, op) => aplicarOp(e, op, { asignarCodigo: false }), base)
}
