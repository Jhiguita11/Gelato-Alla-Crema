import { createContext, useCallback, useContext, useMemo } from 'react'
import { congelarLinea, orderTotal } from '../data/menu'
import { useMotor } from '../sync/MotorProvider'

const OrdersContext = createContext(null)

/**
 * Pedidos que ESTE equipo marcó como listos: a quien lo marcó no hay que
 * avisarle que está listo (ver components/AvisosPedidos.jsx).
 */
export const marcadosAqui = new Set()

/**
 * Pedidos de la jornada e historial de cierres. Los datos y dónde se guardan
 * (este navegador o el servidor compartido) los maneja el motor: aquí solo se
 * traduce cada acción de la pantalla a una operación (ver sync/estado.js).
 */
export function OrdersProvider({ children }) {
  const { estado, ejecutar, turnoActivo } = useMotor()
  // `todos` incluye los anulados (para que el resumen los reporte aparte);
  // `orders`, lo que existe para trabajar: sin anulados. Los "limpiados"
  // (ocultos) siguen aquí porque cuentan en la caja; la lista los filtra.
  const todos = estado.pedidos
  const orders = useMemo(() => todos.filter((o) => !o.anuladoAt), [todos])
  const cierres = estado.cierres

  const addOrder = useCallback(
    ({ table, lines, note, customer, takenBy, paid = false }) => {
      const ahora = Date.now()
      // Nombre y precio quedan fijos en el pedido: si después el admin cambia
      // la carta, lo vendido no cambia (ver congelarLinea en data/menu.js).
      lines = lines.map(congelarLinea)
      const pedido = {
        id: crypto.randomUUID(),
        table,
        customer: customer?.trim() || '',
        takenBy: takenBy ?? null,
        note: note?.trim() || '',
        lines,
        status: 'pendiente',
        paid,
        createdAt: ahora,
        dispatchedAt: null,
        paidAt: paid ? ahora : null,
        total: orderTotal({ lines }),
      }
      const despues = ejecutar({ tipo: 'crearPedido', pedido })
      // En modo local ya trae su número; en el compartido lo pone el servidor
      // y mientras tanto viene con code: null.
      return despues.pedidos.find((p) => p.id === pedido.id) ?? { ...pedido, code: null }
    },
    [ejecutar],
  )

  /**
   * La misma gente de la mesa pide algo más: lo agrega a su pedido (ver
   * 'agregarAPedido' en sync/estado.js). Devuelve el pedido actualizado.
   */
  const agregarAPedido = useCallback(
    (id, { lines, takenBy, paid = false, note = '' }) => {
      const at = Date.now()
      // Cada línea nueva lleva la hora de la ronda: así la tarjeta sabe qué es
      // lo recién agregado. uid nuevo por si la línea venía de otro lado.
      const lineas = lines.map((l) => congelarLinea({ ...l, uid: l.uid ?? crypto.randomUUID(), agregadaAt: at }))
      const despues = ejecutar({
        tipo: 'agregarAPedido',
        id,
        lineas,
        monto: orderTotal({ lines: lineas }),
        pagado: paid,
        at,
        por: takenBy ?? null,
        nota: note.trim(),
      })
      return despues.pedidos.find((p) => p.id === id)
    },
    [ejecutar],
  )

  /**
   * Pedidos de la jornada a los que se podría agregar algo para esta mesa:
   * los no anulados de esa mesa, el más reciente primero (máximo 3). "Para
   * llevar" siempre es un pedido aparte.
   */
  const pedidosDeLaMesa = useCallback(
    (mesa) => {
      if (!mesa || mesa === 'Para llevar') return []
      return orders
        .filter((o) => o.table === mesa)
        .sort((a, b) => (b.rondaAt ?? b.createdAt) - (a.rondaAt ?? a.createdAt))
        .slice(0, 3)
    },
    [orders],
  )

  /** Alterna entre pagado y pendiente de pago. */
  const togglePaid = useCallback(
    (id) => {
      const pedido = orders.find((o) => o.id === id)
      if (pedido) ejecutar({ tipo: 'marcarPago', id, paid: !pedido.paid, at: Date.now() })
    },
    [orders, ejecutar],
  )

  /** Cocina: el pedido está listo para que el mesero lo recoja. */
  const markReady = useCallback(
    (id) => {
      marcadosAqui.add(id)
      return ejecutar({ tipo: 'marcarListo', id, at: Date.now() })
    },
    [ejecutar],
  )

  const dispatchOrder = useCallback(
    (id) => ejecutar({ tipo: 'despachar', id, at: Date.now() }),
    [ejecutar],
  )

  const reopenOrder = useCallback((id) => ejecutar({ tipo: 'reabrir', id }), [ejecutar])

  /** Anula el pedido: deja de contar, pero queda registro de quién y cuándo. */
  const removeOrder = useCallback(
    (id) => ejecutar({ tipo: 'borrarPedido', id, at: Date.now(), por: turnoActivo?.persona ?? null }),
    [ejecutar, turnoActivo],
  )

  /**
   * Quita de la lista los despachados que ya están pagados (siguen contando en
   * la caja). Un pedido entregado que todavía debe no se puede perder de vista.
   */
  const clearDispatched = useCallback(() => ejecutar({ tipo: 'limpiarDespachados' }), [ejecutar])

  /**
   * Cierra la caja: guarda el resumen del día en el historial, borra los
   * pedidos de la jornada, vuelve la numeración a #001 y reinicia los turnos
   * de quien siga conectado. El resumen llega hecho (`resumenDelDia`).
   */
  const cerrarCaja = useCallback(
    (resumen) => {
      const ahora = Date.now()
      const cierre = {
        id: crypto.randomUUID(),
        cerradoAt: ahora,
        abiertoAt: resumen.desde,
        ...resumen,
      }
      ejecutar({
        tipo: 'cerrarCaja',
        jornadaId: estado.jornada.id,
        nuevaJornadaId: crypto.randomUUID(),
        cierre,
        at: ahora,
      })
      return cierre
    },
    [ejecutar, estado.jornada.id],
  )

  /** Agrega cierres de un respaldo sin duplicar los que ya están. */
  const importarCierres = useCallback(
    (importados) => ejecutar({ tipo: 'importarCierres', cierres: importados }),
    [ejecutar],
  )

  const value = useMemo(
    () => ({
      orders,
      todos,
      cierres,
      cerrarCaja,
      importarCierres,
      addOrder,
      agregarAPedido,
      pedidosDeLaMesa,
      dispatchOrder,
      reopenOrder,
      markReady,
      togglePaid,
      removeOrder,
      clearDispatched,
    }),
    [
      orders,
      todos,
      cierres,
      cerrarCaja,
      importarCierres,
      addOrder,
      agregarAPedido,
      pedidosDeLaMesa,
      dispatchOrder,
      reopenOrder,
      markReady,
      togglePaid,
      removeOrder,
      clearDispatched,
    ],
  )

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (!context) throw new Error('useOrders debe usarse dentro de <OrdersProvider>')
  return context
}
