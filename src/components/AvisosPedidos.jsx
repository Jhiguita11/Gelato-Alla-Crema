import { useEffect, useRef, useState } from 'react'
import { BRAND } from '../data/menu'
import { marcadosAqui, useOrders } from '../store/orders'
import { useTurnos } from '../store/turnos'
import { leer, escribir } from '../store/almacen'
import { pedidosListosPara, pedidosNuevos, tituloPedido } from '../utils/avisos'
import {
  activarSonido,
  alCambiarSonido,
  sonarPedidoListo,
  sonarPedidoNuevo,
  sonidoBloqueado,
} from '../utils/sonido'

const AVISOS_DESCARTADOS = 'gac.avisos-descartados.v1'

/**
 * Suena cuando entra un pedido nuevo a la cola. Se usa SOLO en la pantalla de
 * Pedidos: el celular que la tenga abierta (la cocina) es el que suena.
 * Devuelve los ids recién llegados, para resaltarlos un momento.
 */
export function useSonidoPedidosNuevos(pedidos) {
  const anteriores = useRef(null)
  const [recientes, setRecientes] = useState(() => new Set())

  useEffect(() => {
    const nuevos = pedidosNuevos(anteriores.current, pedidos)
    anteriores.current = pedidos
    if (!nuevos.length) return
    sonarPedidoNuevo()
    setRecientes((r) => new Set([...r, ...nuevos.map((p) => p.id)]))
    const id = setTimeout(() => {
      setRecientes((r) => {
        const resto = new Set(r)
        nuevos.forEach((p) => resto.delete(p.id))
        return resto
      })
    }, 12000)
    return () => clearTimeout(id)
  }, [pedidos])

  return recientes
}

/** Si el audio sigue bloqueado (nadie ha tocado la pantalla todavía). */
export function useSonidoBloqueado() {
  const [bloqueado, setBloqueado] = useState(sonidoBloqueado)
  useEffect(() => alCambiarSonido(() => setBloqueado(sonidoBloqueado())), [])
  return bloqueado
}

/** Notificación del sistema, solo si la app no está a la vista. */
async function notificarSistema(pedido) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible') return
  const titulo = 'Pedido listo para recoger'
  const opciones = {
    body: tituloPedido(pedido),
    tag: `listo-${pedido.id}`, // uno por pedido, sin duplicar
    icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
    badge: `${import.meta.env.BASE_URL}icons/icon-192.png`,
    vibrate: [200, 100, 200, 100, 400],
    renotify: true,
  }
  try {
    const registro = await navigator.serviceWorker?.getRegistration()
    if (registro) return registro.showNotification(titulo, opciones)
    new Notification(titulo, opciones)
  } catch {
    // Sin notificación del sistema: igual quedan el sonido y el aviso en pantalla.
  }
}

/**
 * Avisa al mesero cuando un pedido que tomó está listo para recoger: sonido,
 * vibración, aviso en pantalla (con botón "Entregado") y notificación del
 * sistema si la app está en segundo plano. Va montado en toda la app, así le
 * llega esté en la pantalla que esté.
 */
export function AvisosListos() {
  const { orders, dispatchOrder } = useOrders()
  const { persona } = useTurnos()
  const anteriores = useRef(null)
  const [avisos, setAvisos] = useState([])

  useEffect(() => {
    const listos = pedidosListosPara(anteriores.current, orders, persona, marcadosAqui)
    anteriores.current = orders
    if (!listos.length) return
    sonarPedidoListo()
    navigator.vibrate?.([200, 100, 200, 100, 400])
    listos.forEach(notificarSistema)
    setAvisos((a) => [...a.filter((x) => !listos.some((l) => l.id === x)), ...listos.map((l) => l.id)])
  }, [orders, persona])

  // Si el pedido ya se entregó (en este u otro celular), su aviso se va solo.
  const visibles = avisos
    .map((id) => orders.find((o) => o.id === id))
    .filter((p) => p && p.status === 'listo')

  if (!visibles.length) return null
  return (
    <div className="fixed inset-x-3 top-3 z-[85] mx-auto flex max-w-md flex-col gap-2">
      {visibles.map((p) => (
        <div
          key={p.id}
          role="alert"
          className="animar-entrada flex items-center gap-3 rounded-2xl border-2 border-menta-500 bg-white px-4 py-3 shadow-2xl"
        >
          <span className="text-2xl" aria-hidden="true">
            🔔
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-cacao-900">Listo para recoger</p>
            <p className="truncate text-sm text-cacao-800/70">{tituloPedido(p)}</p>
          </div>
          <button
            type="button"
            onClick={() => dispatchOrder(p.id)}
            className="shrink-0 rounded-xl bg-menta-700 px-3 py-2 text-sm font-bold text-crema-50 transition hover:bg-menta-800"
          >
            Entregado
          </button>
          <button
            type="button"
            onClick={() => setAvisos((a) => a.filter((x) => x !== p.id))}
            aria-label="Cerrar aviso"
            className="shrink-0 px-1 text-cacao-800/50 hover:text-cacao-900"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

/**
 * Pide una vez permiso para las notificaciones y desbloquea el sonido. Sin
 * esto, el navegador no deja avisar ni sonar.
 */
export function BarraActivarAvisos() {
  const { persona } = useTurnos()
  const bloqueado = useSonidoBloqueado()
  const [permiso, setPermiso] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported',
  )
  const [descartado, setDescartado] = useState(() => Boolean(leer(AVISOS_DESCARTADOS, false)))

  const faltaPermiso = permiso === 'default'
  if (!persona || descartado || (!faltaPermiso && !bloqueado)) return null

  async function activar() {
    activarSonido()
    if (faltaPermiso) {
      try {
        setPermiso(await Notification.requestPermission())
      } catch {
        setPermiso('denied')
      }
    }
  }

  return (
    <div className="border-b border-menta-500/30 bg-menta-100">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm">
        <img src={BRAND.logo} alt="" className="h-6 w-6 rounded-full" />
        <p className="flex-1 text-cacao-900">
          {faltaPermiso
            ? 'Activa los avisos para enterarte con sonido cuando un pedido esté listo o llegue uno nuevo.'
            : 'Toca para activar el sonido de los avisos.'}
        </p>
        <button
          type="button"
          onClick={activar}
          className="rounded-xl bg-menta-700 px-3 py-1.5 font-bold text-crema-50 transition hover:bg-menta-800"
        >
          Activar
        </button>
        {faltaPermiso && (
          <button
            type="button"
            onClick={() => {
              escribir(AVISOS_DESCARTADOS, true)
              setDescartado(true)
            }}
            className="px-2 py-1.5 font-semibold text-cacao-800/55"
          >
            Ahora no
          </button>
        )}
      </div>
    </div>
  )
}
