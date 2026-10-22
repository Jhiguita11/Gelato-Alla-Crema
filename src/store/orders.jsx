import { createContext, useCallback, useContext, useMemo } from 'react'
import { orderTotal } from '../data/menu'
import { fusionarCierres } from '../utils/respaldo'
import { leer, escribir, useAlmacen } from './almacen'

const STORAGE_KEY = 'gac.orders.v1'
const COUNTER_KEY = 'gac.counter.v1'
const CIERRES_KEY = 'gac.cierres.v1'

const OrdersContext = createContext(null)

function readCounter() {
  const raw = Number(leer(COUNTER_KEY, 0))
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

export function OrdersProvider({ children }) {
  // Pedidos y cierres se comparten entre pestañas: la caja toma el pedido y la
  // pantalla de cocina (otra pestaña del mismo equipo) se actualiza sola.
  // Cada cambio parte de lo último guardado; ver store/almacen.js.
  const [orders, actualizarOrders] = useAlmacen(STORAGE_KEY, [])
  const [cierres, actualizarCierres] = useAlmacen(CIERRES_KEY, [])

  const addOrder = useCallback(
    ({ table, lines, note, customer, takenBy, paid = false }) => {
      let order
      actualizarOrders((prev) => {
        // El consecutivo se toma en el mismo paso en que se guarda el pedido.
        const next = readCounter() + 1
        escribir(COUNTER_KEY, next)
        const ahora = Date.now()
        order = {
          id: crypto.randomUUID(),
          code: String(next).padStart(3, '0'),
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
        return [order, ...prev]
      })
      return order
    },
    [actualizarOrders],
  )

  /** Cambia un pedido por id, sobre la versión guardada más reciente. */
  const cambiar = useCallback(
    (id, fn) =>
      actualizarOrders((prev) =>
        prev.some((o) => o.id === id) ? prev.map((o) => (o.id === id ? fn(o) : o)) : prev,
      ),
    [actualizarOrders],
  )

  /** Alterna entre pagado y pendiente de pago. */
  const togglePaid = useCallback(
    (id) => cambiar(id, (o) => ({ ...o, paid: !o.paid, paidAt: o.paid ? null : Date.now() })),
    [cambiar],
  )

  const dispatchOrder = useCallback(
    (id) => cambiar(id, (o) => ({ ...o, status: 'despachado', dispatchedAt: Date.now() })),
    [cambiar],
  )

  const reopenOrder = useCallback(
    (id) => cambiar(id, (o) => ({ ...o, status: 'pendiente', dispatchedAt: null })),
    [cambiar],
  )

  const removeOrder = useCallback(
    (id) => actualizarOrders((prev) => prev.filter((o) => o.id !== id)),
    [actualizarOrders],
  )

  /**
   * Limpia los despachados, pero solo los que ya están pagados: un pedido
   * entregado que todavía debe no se puede perder de la vista.
   */
  const clearDispatched = useCallback(
    () => actualizarOrders((prev) => prev.filter((o) => !(o.status === 'despachado' && o.paid))),
    [actualizarOrders],
  )

  /**
   * Cierra la caja: guarda el resumen del día en el historial, borra los
   * pedidos de la jornada y vuelve la numeración a #001.
   * El resumen se calcula afuera (`resumenDelDia`) y llega ya hecho.
   */
  const cerrarCaja = useCallback(
    (resumen) => {
      const cierre = {
        id: crypto.randomUUID(),
        cerradoAt: Date.now(),
        abiertoAt: resumen.desde,
        ...resumen,
      }
      actualizarCierres((prev) => [cierre, ...prev])
      actualizarOrders(() => [])
      escribir(COUNTER_KEY, 0)
      return cierre
    },
    [actualizarCierres, actualizarOrders],
  )

  /** Agrega cierres de un respaldo sin duplicar los que ya están. */
  const importarCierres = useCallback(
    (importados) => actualizarCierres((prev) => fusionarCierres(prev, importados)),
    [actualizarCierres],
  )

  const value = useMemo(
    () => ({
      orders,
      cierres,
      cerrarCaja,
      importarCierres,
      addOrder,
      dispatchOrder,
      reopenOrder,
      togglePaid,
      removeOrder,
      clearDispatched,
    }),
    [
      orders,
      cierres,
      cerrarCaja,
      importarCierres,
      addOrder,
      dispatchOrder,
      reopenOrder,
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
