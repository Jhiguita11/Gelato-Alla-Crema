import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { orderTotal } from '../data/menu'

const STORAGE_KEY = 'gac.orders.v1'
const COUNTER_KEY = 'gac.counter.v1'
const CIERRES_KEY = 'gac.cierres.v1'

const OrdersContext = createContext(null)

function readOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function readCounter() {
  const raw = Number(localStorage.getItem(COUNTER_KEY))
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

function readCierres() {
  try {
    const raw = localStorage.getItem(CIERRES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState(readOrders)
  const [cierres, setCierres] = useState(readCierres)

  // Persiste en cada cambio.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  }, [orders])

  useEffect(() => {
    localStorage.setItem(CIERRES_KEY, JSON.stringify(cierres))
  }, [cierres])

  // Mantiene sincronizadas varias pestañas / dispositivos del mismo navegador:
  // la caja toma el pedido y la pantalla de cocina se actualiza sola.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setOrders(readOrders())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const addOrder = useCallback(({ table, lines, note, customer, takenBy, paid = false }) => {
    const next = readCounter() + 1
    localStorage.setItem(COUNTER_KEY, String(next))

    const order = {
      id: crypto.randomUUID(),
      code: String(next).padStart(3, '0'),
      table,
      customer: customer?.trim() || '',
      takenBy: takenBy ?? null,
      note: note?.trim() || '',
      lines,
      status: 'pendiente',
      paid,
      createdAt: Date.now(),
      dispatchedAt: null,
      paidAt: paid ? Date.now() : null,
      total: orderTotal({ lines }),
    }
    setOrders((prev) => [order, ...prev])
    return order
  }, [])

  /** Alterna entre pagado y pendiente de pago. */
  const togglePaid = useCallback((id) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, paid: !o.paid, paidAt: o.paid ? null : Date.now() } : o,
      ),
    )
  }, [])

  const dispatchOrder = useCallback((id) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, status: 'despachado', dispatchedAt: Date.now() } : o,
      ),
    )
  }, [])

  const reopenOrder = useCallback((id) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: 'pendiente', dispatchedAt: null } : o)),
    )
  }, [])

  const removeOrder = useCallback((id) => {
    setOrders((prev) => prev.filter((o) => o.id !== id))
  }, [])

  /**
   * Limpia los despachados, pero solo los que ya están pagados: un pedido
   * entregado que todavía debe no se puede perder de la vista.
   */
  const clearDispatched = useCallback(() => {
    setOrders((prev) => prev.filter((o) => !(o.status === 'despachado' && o.paid)))
  }, [])

  /**
   * Cierra la caja: guarda el resumen del día en el historial, borra los
   * pedidos de la jornada y vuelve la numeración a #001.
   * El resumen se calcula afuera (`resumenDelDia`) y llega ya hecho.
   */
  const cerrarCaja = useCallback((resumen) => {
    const cierre = {
      id: crypto.randomUUID(),
      cerradoAt: Date.now(),
      abiertoAt: resumen.desde,
      ...resumen,
    }
    setCierres((prev) => [cierre, ...prev])
    setOrders([])
    localStorage.setItem(COUNTER_KEY, '0')
    return cierre
  }, [])

  const value = useMemo(
    () => ({
      orders,
      cierres,
      cerrarCaja,
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
