import { useEffect, useMemo, useState } from 'react'
import { useSonidoBloqueado, useSonidoPedidosNuevos } from '../components/AvisosPedidos'
import { formatCOP } from '../data/menu'
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
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
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

/*
 * ── Tarjeta de un pedido ────────────────────────────────────────────────────
 * Se lee de arriba a abajo en tres zonas:
 *   1. Dónde va y cuánto lleva: mesa + puesto en la fila + minutos esperando.
 *   2. Qué preparar: cada línea en grande, los sabores como fichas de color y
 *      la nota como alerta (es lo que más se pasa por alto).
 *   3. Qué hacer: un solo botón grande según el estado; abajo, en pequeño, el
 *      número, quién lo tomó, la hora y el pago (una sola vez).
 * El estado no depende solo del color: la barra de pasos lo dice con texto.
 */

const PASOS = [
  { id: 'pendiente', label: 'Preparando' },
  { id: 'listo', label: 'Listo' },
  { id: 'despachado', label: 'Entregado' },
]

const COLOR_ESPERA = {
  bien: 'text-menta-700',
  atento: 'text-cono-600',
  tarde: 'text-terracota-600 animate-pulse',
}

function PasosEstado({ status }) {
  const actual = PASOS.findIndex((p) => p.id === status)
  return (
    <ol
      className="flex items-center gap-1.5 border-b border-crema-200 px-4 py-3 text-xs sm:gap-2 sm:px-5 sm:text-sm"
      aria-label={`Estado: ${PASOS[actual]?.label ?? ''}`}
    >
      {PASOS.map((paso, i) => {
        const hecho = i < actual
        const ahora = i === actual
        return (
          <li key={paso.id} className="flex flex-1 items-center gap-1.5 last:flex-none sm:gap-2">
            <span
              aria-hidden="true"
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                ahora
                  ? status === 'listo'
                    ? 'bg-cono-500 text-white'
                    : status === 'despachado'
                      ? 'bg-menta-700 text-crema-50'
                      : 'bg-menta-800 text-crema-50'
                  : hecho
                    ? 'bg-menta-100 text-menta-700'
                    : 'border-2 border-crema-200 text-cacao-800/30'
              }`}
            >
              {hecho ? '✓' : i + 1}
            </span>
            <span
              className={`whitespace-nowrap ${
                ahora ? 'font-bold text-cacao-900' : 'font-medium text-cacao-800/45'
              }`}
              aria-current={ahora ? 'step' : undefined}
            >
              {paso.label}
            </span>
            {i < PASOS.length - 1 && (
              <span
                aria-hidden="true"
                className={`h-0.5 min-w-3 flex-1 rounded-full ${hecho ? 'bg-menta-500' : 'bg-crema-200'}`}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Ficha de un sabor con su color. Los sabores claros llevan borde para verse. */
function ChipSabor({ sabor }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border-2 border-crema-200 bg-crema-50 px-3.5 py-1.5 text-base font-semibold text-cacao-900">
      <span
        aria-hidden="true"
        className="h-4 w-4 shrink-0 rounded-full border border-cacao-900/15"
        style={{ backgroundColor: sabor.color ?? 'var(--color-crema-300)' }}
      />
      {sabor.nombre}
      {sabor.n > 1 && <span className="font-bold text-terracota-600">×{sabor.n}</span>}
    </span>
  )
}

function LineaComanda({ linea }) {
  const d = describirLinea(linea)
  // "Cono, vaso o canasta" no le dice a cocina qué servir: si se eligió el
  // recipiente, ese es el título ("Vaso · 3 porciones"). Las demás opciones
  // (licor…) van como etiquetas junto al título.
  const recipiente = linea.opciones?.recipiente
  const titulo = recipiente ?? d.titulo
  const etiquetas = d.opciones.filter((o) => o.valor !== recipiente).map((o) => o.valor)
  // Lo que va encima o aparte, en una sola línea secundaria.
  const encima = [
    d.salsa && `Salsa ${d.salsa.toLowerCase()}`,
    ...d.extras.map((e) => `${e.etiqueta}: ${e.valor}`),
    d.adiciones.length > 0 && `Adición: ${d.adiciones.join(', ')}`,
  ].filter(Boolean)

  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 text-3xl leading-none" aria-hidden="true">
        {d.icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-bold leading-snug text-cacao-900">
          <span className={d.cantidad > 1 ? 'text-terracota-600' : 'text-cacao-800/50'}>
            {d.cantidad} ×{' '}
          </span>
          {titulo}
          {d.porciones && (
            <span className="font-semibold text-cacao-800/60"> · {d.porciones}</span>
          )}
        </p>
        {etiquetas.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {etiquetas.map((t) => (
              <span
                key={t}
                className="rounded-lg bg-cacao-100 px-2.5 py-1 text-sm font-bold uppercase tracking-wide text-cacao-800"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {d.saboresDetalle.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {d.saboresDetalle.map((s) => (
              <ChipSabor key={s.id} sabor={s} />
            ))}
          </div>
        )}
        {encima.length > 0 && (
          <p className="mt-2 text-base font-medium text-cacao-800/75">{encima.join(' · ')}</p>
        )}
      </div>
    </li>
  )
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
  const paraLlevar = pedido.table === 'Para llevar'

  return (
    <article
      className={`animar-entrada flex flex-col overflow-hidden rounded-3xl border-[3px] bg-white shadow-sm transition ${
        entregado
          ? 'border-crema-200 opacity-75'
          : listo
            ? 'border-cono-500 shadow-lg shadow-cono-500/15'
            : 'border-menta-700/40 shadow-cacao-900/5'
      } ${reciente ? 'ring-4 ring-cono-500/60' : ''}`}
    >
      <PasosEstado status={pedido.status} />

      {/* 1 · Dónde va y cuánto lleva */}
      <header className="flex items-center gap-4 px-5 pb-2 pt-4">
        {enPreparacion && puesto && (
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-menta-800 font-display text-2xl font-bold text-crema-50"
            title={`${puesto}º en la fila`}
          >
            {puesto}º
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-4xl font-bold leading-none text-cacao-900">
              {paraLlevar ? 'Para llevar' : `Mesa ${pedido.table}`}
            </h3>
            {reciente && (
              <span className="rounded-full bg-cono-500 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
                Nuevo
              </span>
            )}
          </div>
          {pedido.customer && (
            <p className="mt-1.5 truncate text-lg text-cacao-800/70">Para {pedido.customer}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {enPreparacion ? (
            <>
              <p
                className={`font-display text-4xl font-bold leading-none ${COLOR_ESPERA[e.nivel]}`}
                title="Tiempo de espera"
              >
                {e.minutos}
                <span className="text-lg"> min</span>
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-cacao-800/45">
                esperando
              </p>
            </>
          ) : listo ? (
            <>
              <p className="font-display text-xl font-bold leading-tight text-cono-600">
                🔔 Para recoger
              </p>
              <p className="mt-1 text-sm text-cacao-800/55">
                listo {haceCuanto(pedido.listoAt ?? ahora)}
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-menta-700">
              ✓ Entregado
              <br />
              <span className="font-normal text-cacao-800/55">{haceCuanto(pedido.dispatchedAt)}</span>
            </p>
          )}
        </div>
      </header>

      {/* 2 · Qué preparar */}
      <div className="flex-1 px-5 pb-4 pt-3">
        <ul className="space-y-4">
          {pedido.lines.map((linea, i) => (
            <LineaComanda key={linea.uid ?? i} linea={linea} />
          ))}
        </ul>

        {pedido.note && (
          <p className="mt-4 flex items-start gap-2.5 rounded-2xl border-2 border-cono-500 bg-cono-100 px-4 py-3 text-lg font-semibold leading-snug text-cacao-900">
            <span aria-hidden="true">⚠️</span>
            <span>
              <span className="sr-only">Nota: </span>
              {pedido.note}
            </span>
          </p>
        )}
      </div>

      {/* 3 · Qué hacer */}
      <footer className="border-t-2 border-dashed border-crema-200 px-5 pb-4 pt-4">
        {enPreparacion && (
          <>
            <button
              type="button"
              onClick={onListo}
              className="w-full rounded-2xl bg-cono-500 px-4 py-5 text-xl font-bold text-white shadow-md shadow-cono-500/25 transition hover:bg-cono-600 active:scale-[0.99]"
            >
              🔔 Listo para recoger
            </button>
            <div className="mt-3 flex justify-between text-sm font-semibold">
              <button type="button" onClick={onEntregado} className="py-1 text-cacao-800/55 hover:text-menta-700">
                Ya se entregó
              </button>
              <button type="button" onClick={onAnular} className="py-1 text-cacao-800/45 hover:text-terracota-600">
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
              className="w-full rounded-2xl bg-menta-700 px-4 py-5 text-xl font-bold text-crema-50 shadow-md shadow-menta-700/25 transition hover:bg-menta-800 active:scale-[0.99]"
            >
              ✓ Entregado en la mesa
            </button>
            <div className="mt-3 flex justify-between text-sm font-semibold">
              <button type="button" onClick={onReabrir} className="py-1 text-cacao-800/55 hover:text-menta-700">
                Volver a preparación
              </button>
              <button type="button" onClick={onAnular} className="py-1 text-cacao-800/45 hover:text-terracota-600">
                Anular
              </button>
            </div>
          </>
        )}

        {entregado && (
          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
            <button
              type="button"
              onClick={onReabrir}
              className="rounded-xl border-2 border-crema-200 px-4 py-2.5 text-cacao-900 transition hover:border-menta-400"
            >
              Reabrir
            </button>
            <button
              type="button"
              onClick={onAnular}
              aria-label={`Anular pedido ${pedido.code ?? 'sin número'}`}
              className="py-1 text-cacao-800/45 hover:text-terracota-600"
            >
              Anular
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-sm text-cacao-800/55">
            {pedido.code ? (
              <span className="font-semibold text-cacao-800/80">#{pedido.code}</span>
            ) : (
              // Tomado sin internet: el número lo pone el servidor al subirlo.
              <span className="font-semibold" title="Por enviar">
                #···
              </span>
            )}
            {[pedido.takenBy, hora(pedido.createdAt)].filter(Boolean).map((t) => ` · ${t}`)}
          </p>
          <button
            type="button"
            onClick={onTogglePago}
            title={pedido.paid ? 'Marcar sin pagar' : 'Marcar pagado'}
            className={`shrink-0 rounded-full border-2 px-4 py-2 text-base font-bold transition ${
              pedido.paid
                ? 'border-menta-500 bg-menta-100 text-menta-800 hover:border-cacao-600'
                : 'border-terracota-600 bg-terracota-100 text-terracota-600 hover:border-menta-500'
            }`}
          >
            {pedido.paid ? `✓ Pagado ${formatCOP(pedido.total)}` : `Debe ${formatCOP(pedido.total)}`}
          </button>
        </div>
      </footer>
    </article>
  )
}
