import { createContext, useCallback, useContext, useMemo } from 'react'
import { orderTotal } from '../data/menu'
import { useMotor } from '../sync/MotorProvider'

const OrdersContext = createContext(null)

/**
 * Pedidos de la jornada e historial de cierres. Los datos y dónde se guardan
 * (este navegador o el servidor compartido) los maneja el motor: aquí solo se
 * traduce cada acción de la pantalla a una operación (ver sync/estado.js).
 */
export function OrdersProvider({ children }) {
  const { estado, ejecutar } = useMotor()
  const orders = estado.pedidos
  const cierres = estado.cierres

  const addOrder = useCallback(
    ({ table, lines, note, customer, takenBy, paid = false }) => {
      const ahora = Date.now()
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

  /** Alterna entre pagado y pendiente de pago. */
  const togglePaid = useCallback(
    (id) => {
      const pedido = orders.find((o) => o.id === id)
      if (pedido) ejecutar({ tipo: 'marcarPago', id, paid: !pedido.paid, at: Date.now() })
    },
    [orders, ejecutar],
  )

  const dispatchOrder = useCallback(
    (id) => ejecutar({ tipo: 'despachar', id, at: Date.now() }),
    [ejecutar],
  )

  const reopenOrder = useCallback((id) => ejecutar({ tipo: 'reabrir', id }), [ejecutar])

  const removeOrder = useCallback((id) => ejecutar({ tipo: 'borrarPedido', id }), [ejecutar])

  /**
   * Limpia los despachados, pero solo los que ya están pagados: un pedido
   * entregado que todavía debe no se puede perder de la vista.
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
