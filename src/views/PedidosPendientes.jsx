import { useEffect, useMemo, useState } from 'react'
import { useSonidoBloqueado, useSonidoPedidosNuevos } from '../components/AvisosPedidos'
import { DetalleLinea } from './NuevoPedido'
import { formatCOP, lineTotal } from '../data/menu'
import { useOrders } from '../store/orders'
import { useMotor } from '../sync/MotorProvider'
import { espera } from '../utils/avisos'
import { describirLinea, haceCuanto, hora } from '../utils/describir'
import { activarSonido } from '../utils/sonido'

/**
 * Cola de pedidos. Un pedido pasa por tres estados:
 *   En preparación → Listo para recoger → Entregado
 * Cocina marca "Listo" y al mesero que lo tomó le llega el aviso; el mesero
 * marca "Entregado" cuando lo lleva a la mesa.
 *
 * Todo se ordena por llegada: el que se pidió primero va primero.
 */
const FILTROS = [
  { id: 'preparacion', label: 'En preparación', test: (o) => o.status === 'pendiente' },
  { id: 'listos', label: 'Listos para recoger', test: (o) => o.status === 'listo' },
  { id: 'entregados', label: 'Entregados', test: (o) => o.status === 'despachado' },
  // Cruza los estados a propósito: un pedido ya entregado puede seguir
  // debiendo, y es justo el que se pierde de vista.
  { id: 'sin-pagar', label: 'Sin pagar', test: (o) => !o.paid },
  { id: 'todos', label: 'Todos', test: () => true },
]

const porLlegada = (a, b) => a.createdAt - b.createdAt

export default function PedidosPendientes() {
  const {
    orders: activos,
    markReady,
    dispatchOrder,
    reopenOrder,
    togglePaid,
    removeOrder,
    clearDispatched,
  } = useOrders()
  const { rol } = useMotor()
  const [filtro, setFiltro] = useState('preparacion')

  // Los "limpiados" siguen contando en la caja, pero ya no estorban aquí.
  const orders = useMemo(() => activos.filter((o) => !o.oculto), [activos])

  // Suena cuando entra un pedido nuevo, solo mientras esta pantalla esté abierta.
  const recientes = useSonidoPedidosNuevos(orders)
  const sonidoBloqueado = useSonidoBloqueado()

  // Refresca los tiempos de espera sin recargar.
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

  const enPreparacion = useMemo(
    () => orders.filter((o) => o.status === 'pendiente').sort(porLlegada),
    [orders],
  )
  const listos = orders.filter((o) => o.status === 'listo')
  const entregados = orders.filter((o) => o.status === 'despachado')
  const cerrados = entregados.filter((o) => o.paid) // entregados Y pagados

  // Puesto en la fila de cocina: 1º es el que más lleva esperando.
  const puesto = useMemo(
    () => new Map(enPreparacion.map((o, i) => [o.id, i + 1])),
    [enPreparacion],
  )

  const visibles = useMemo(() => {
    const test = FILTROS.find((f) => f.id === filtro)?.test ?? (() => true)
    return orders.filter(test).sort(porLlegada)
  }, [orders, filtro])

  const porCobrar = orders.filter((o) => !o.paid).reduce((sum, o) => sum + o.total, 0)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6">
      {/* Indicadores */}
      <div
        className={`grid grid-cols-3 gap-3 ${rol === 'admin' ? 'sm:grid-cols-4' : ''}`}
      >
        <Indicador valor={enPreparacion.length} etiqueta="En preparación" acento="menta" />
        <Indicador valor={listos.length} etiqueta="Listos para recoger" acento="cono" />
        <Indicador valor={entregados.length} etiqueta="Entregados" />
        {/* El monto total es una cifra del día: solo para el admin. Cada pedido
            sí muestra su precio, que hace falta para cobrarlo. */}
        {rol === 'admin' && (
          <Indicador valor={formatCOP(porCobrar)} etiqueta="Por cobrar" pequeno />
        )}
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-cacao-800/55">
        <span className="font-semibold text-menta-700">En preparación</span>→
        <span className="font-semibold text-cono-600">Listo para recoger</span>→
        <span className="font-semibold text-cacao-800/70">Entregado</span>
        <span className="ml-1">· El que se pidió primero va primero.</span>
      </p>

      {sonidoBloqueado && (
        <button
          type="button"
          onClick={activarSonido}
          className="mt-4 flex w-full items-center gap-2 rounded-2xl border-2 border-dashed border-cono-500 bg-cono-500/10 px-4 py-3 text-left text-sm font-semibold text-cacao-900"
        >
          <span aria-hidden="true">🔇</span>
          El sonido de pedidos nuevos está apagado. Toca aquí para activarlo.
        </button>
      )}

      {/* Filtros */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => {
            const activo = filtro === f.id
            const conteo = orders.filter(f.test).length
            const cobro = f.id === 'sin-pagar'
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${
                  activo
                    ? cobro
                      ? 'border-cacao-600 bg-cacao-600 text-white'
                      : 'border-menta-700 bg-menta-700 text-crema-50'
                    : f.id === 'listos' && conteo > 0
                      ? 'border-cono-500 bg-cono-500/15 text-cacao-900'
                      : cobro && conteo > 0
                        ? 'border-cacao-600 bg-cacao-100 text-cacao-900'
                        : 'border-crema-200 bg-white text-cacao-900 hover:border-menta-400'
                }`}
              >
                {f.label}
                <span className={`ml-1.5 ${activo ? 'opacity-70' : 'text-cacao-800/45'}`}>
                  {conteo}
                </span>
              </button>
            )
          })}
        </div>

        {cerrados.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `¿Quitar de la lista ${cerrados.length} pedidos ya entregados y pagados?\n\n` +
                    'Siguen contando en la caja del día.',
                )
              ) {
                clearDispatched()
              }
            }}
            className="text-sm font-medium text-cacao-800/55 underline-offset-2 hover:text-terracota-600 hover:underline"
          >
            Limpiar entregados y pagados
          </button>
        )}
      </div>

      {/* Lista */}
      {visibles.length === 0 ? (
        <div className="mt-10 rounded-3xl border-2 border-dashed border-crema-200 px-6 py-16 text-center">
          <p className="text-4xl" aria-hidden="true">
            🍨
          </p>
          <p className="mt-3 font-display text-lg font-bold text-cacao-900">
            {
              {
                preparacion: 'No hay nada en preparación',
                listos: 'No hay pedidos esperando para recoger',
                entregados: 'Todavía no se ha entregado nada',
                'sin-pagar': 'Todo está cobrado',
              }[filtro] ?? 'Nada por aquí'
            }
          </p>
          <p className="mt-1 text-sm text-cacao-800/55">
            {filtro === 'sin-pagar'
              ? 'No queda ningún pedido debiendo.'
              : 'Cuando llegue un pedido nuevo va a sonar y aparece aquí.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((pedido) => (
            <TarjetaPedido
              key={pedido.id}
              pedido={pedido}
              puesto={puesto.get(pedido.id)}
              reciente={recientes.has(pedido.id)}
              ahora={ahora}
              onListo={() => markReady(pedido.id)}
              onEntregado={() => dispatchOrder(pedido.id)}
              onReabrir={() => reopenOrder(pedido.id)}
              onTogglePago={() => togglePaid(pedido.id)}
              onAnular={() => {
                const nombre = pedido.code ? `#${pedido.code}` : 'sin número'
                if (
                  confirm(
                    `¿Anular el pedido ${nombre}?\n\n` +
                      'No contará en la caja. Queda registrado para el administrador.',
                  )
                )
                  removeOrder(pedido.id)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Indicador({ valor, etiqueta, acento, pequeno }) {
  const color =
    acento === 'cono' ? 'text-cono-600' : acento === 'menta' ? 'text-menta-700' : 'text-cacao-900'
  return (
    <div className="rounded-2xl border-2 border-crema-200 bg-white px-4 py-3.5">
      <p
        className={`font-display font-bold ${color} ${pequeno ? 'text-xl' : 'text-3xl'} leading-tight`}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-cacao-800/50">
        {etiqueta}
      </p>
    </div>
  )
}

const COLOR_ESPERA = {
  bien: 'bg-menta-500 text-white',
  atento: 'bg-cono-500 text-white',
  tarde: 'bg-terracota-600 text-white animate-pulse',
}

function TarjetaPedido({
  pedido,
  puesto,
  reciente,
  ahora,
  onListo,
  onEntregado,
  onReabrir,
  onTogglePago,
  onAnular,
}) {
  const enPreparacion = pedido.status === 'pendiente'
  const listo = pedido.status === 'listo'
  const entregado = pedido.status === 'despachado'
  const e = espera(pedido.createdAt, ahora)

  const cabecera = entregado
    ? 'bg-crema-100 text-cacao-900'
    : listo
      ? 'bg-cono-500 text-white'
      : 'bg-menta-800 text-crema-50'

  return (
    <article
      className={`animar-entrada flex flex-col overflow-hidden rounded-3xl border-2 bg-white shadow-sm transition ${
        entregado
          ? 'border-crema-200 opacity-70'
          : listo
            ? 'border-cono-500'
            : 'border-menta-800/30 shadow-cacao-900/5'
      } ${reciente ? 'ring-4 ring-cono-500/60' : ''}`}
    >
      <header className={`flex items-center gap-3 px-4 py-3 ${cabecera}`}>
        {enPreparacion && puesto && (
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-crema-50 font-display text-lg font-bold text-menta-800"
            title={`${puesto}º en la fila`}
          >
            {puesto}º
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-display text-2xl font-bold leading-none">
              {pedido.table === 'Para llevar' ? 'Para llevar' : `Mesa ${pedido.table}`}
            </span>
            {pedido.code ? (
              <span className="text-sm font-semibold opacity-80">#{pedido.code}</span>
            ) : (
              // Tomado sin internet: el número lo pone el servidor al subirlo.
              <span className="text-sm font-semibold opacity-60" title="Por enviar">
                #···
              </span>
            )}
            {reciente && (
              <span className="rounded-full bg-crema-50 px-2 py-0.5 text-[11px] font-bold uppercase text-cono-600">
                Nuevo
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs opacity-80">
            {[pedido.customer, pedido.takenBy && `Tomó: ${pedido.takenBy}`, hora(pedido.createdAt)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {enPreparacion ? (
            <span
              className={`inline-block rounded-xl px-2.5 py-1 font-display text-lg font-bold leading-none ${COLOR_ESPERA[e.nivel]}`}
              title="Tiempo de espera"
            >
              {e.minutos} min
            </span>
          ) : listo ? (
            <span className="text-xs font-bold">Listo {haceCuanto(pedido.listoAt ?? ahora)}</span>
          ) : (
            <span className="text-xs">Entregado {hora(pedido.dispatchedAt)}</span>
          )}
          {!pedido.paid && (
            <span className="mt-1 block text-[11px] font-bold uppercase tracking-wide opacity-90">
              Sin pagar
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-3 px-4 py-3.5">
        {pedido.lines.map((linea, i) => {
          const d = describirLinea(linea)
          return (
            <div key={linea.uid ?? i} className="flex items-start gap-2.5">
              <span className="text-xl leading-none" aria-hidden="true">
                {d.icono}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-cacao-900">
                  {d.cantidad > 1 && <span className="text-terracota-600">{d.cantidad}× </span>}
                  {d.titulo}
                  {d.porciones && (
                    <span className="font-normal text-cacao-800/60"> · {d.porciones}</span>
                  )}
                </p>
                <DetalleLinea d={d} className="text-sm" />
              </div>
              <span className="shrink-0 text-sm font-semibold text-cacao-800/70">
                {formatCOP(lineTotal(linea))}
              </span>
            </div>
          )
        })}

        {pedido.note && (
          <p className="rounded-xl border-2 border-cacao-600/40 bg-cacao-100 px-3 py-2 text-sm text-cacao-900">
            <span className="font-bold">Nota:</span> {pedido.note}
          </p>
        )}
      </div>

      <footer className="border-t border-crema-200 px-4 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onTogglePago}
            className={`flex-1 rounded-xl border-2 px-3 py-2 text-left text-sm font-bold transition ${
              pedido.paid
                ? 'border-menta-500 bg-menta-100 text-cacao-900 hover:border-cacao-600'
                : 'border-cacao-600 bg-cacao-100 text-cacao-900 hover:border-menta-500'
            }`}
            title={pedido.paid ? 'Marcar sin pagar' : 'Marcar pagado'}
          >
            {pedido.paid ? '✓ Pagado' : '● Sin pagar · tocar para cobrar'}
          </button>
          <span className="shrink-0 font-display text-xl font-bold text-cacao-900">
            {formatCOP(pedido.total)}
          </span>
        </div>

        {enPreparacion && (
          <>
            <button
              type="button"
              onClick={onListo}
              className="w-full rounded-xl bg-cono-500 px-4 py-3.5 text-base font-bold text-white shadow-md shadow-cono-500/25 transition hover:bg-cono-600"
            >
              🔔 Listo para recoger
            </button>
            <div className="mt-2 flex justify-between text-xs font-semibold">
              <button type="button" onClick={onEntregado} className="text-cacao-800/55 hover:text-menta-700">
                Ya se entregó
              </button>
              <button type="button" onClick={onAnular} className="text-cacao-800/45 hover:text-terracota-600">
                Anular
              </button>
            </div>
          </>
        )}

        {listo && (
          <>
            <button
              type="button"
              onClick={onEntregado}
              className="w-full rounded-xl bg-menta-700 px-4 py-3.5 text-base font-bold text-crema-50 shadow-md shadow-menta-700/25 transition hover:bg-menta-800"
            >
              ✓ Entregado en la mesa
            </button>
            <div className="mt-2 flex justify-between text-xs font-semibold">
              <button type="button" onClick={onReabrir} className="text-cacao-800/55 hover:text-menta-700">
                Volver a preparación
              </button>
              <button type="button" onClick={onAnular} className="text-cacao-800/45 hover:text-terracota-600">
                Anular
              </button>
            </div>
          </>
        )}

        {entregado && (
          <div className="flex items-center gap-2">
            <span className="flex-1 rounded-xl bg-menta-100 px-3 py-2.5 text-center text-xs font-semibold text-menta-700">
              ✓ Entregado {haceCuanto(pedido.dispatchedAt)}
            </span>
            <button
              type="button"
              onClick={onReabrir}
              className="rounded-xl border-2 border-crema-200 px-3 py-2.5 text-xs font-semibold text-cacao-900 transition hover:border-menta-400"
            >
              Reabrir
            </button>
            <button
              type="button"
              onClick={onAnular}
              aria-label={`Anular pedido ${pedido.code ?? 'sin número'}`}
              className="rounded-xl border-2 border-crema-200 px-3 py-2.5 text-xs font-semibold text-terracota-600 transition hover:border-cono-500"
            >
              ✕
            </button>
          </div>
        )}
      </footer>
    </article>
  )
}
