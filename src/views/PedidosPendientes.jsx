import { useEffect, useMemo, useState } from 'react'
import { DetalleLinea } from './NuevoPedido'
import { formatCOP, lineTotal } from '../data/menu'
import { useOrders } from '../store/orders'
import { useMotor } from '../sync/MotorProvider'
import { describirLinea, haceCuanto, hora } from '../utils/describir'

const FILTROS = [
  { id: 'pendiente', label: 'Pendientes', test: (o) => o.status === 'pendiente' },
  { id: 'despachado', label: 'Despachados', test: (o) => o.status === 'despachado' },
  // Sin pagar cruza el estado de despacho a propósito: un pedido ya entregado
  // puede seguir debiendo, y es justo el que se pierde de vista.
  { id: 'sin-pagar', label: 'Sin pagar', test: (o) => !o.paid },
  { id: 'todos', label: 'Todos', test: () => true },
]

export default function PedidosPendientes() {
  const { orders: activos, dispatchOrder, reopenOrder, togglePaid, removeOrder, clearDispatched } =
    useOrders()
  const { rol } = useMotor()
  // Los "limpiados" siguen contando en la caja, pero ya no estorban aquí.
  const orders = useMemo(() => activos.filter((o) => !o.oculto), [activos])
  const [filtro, setFiltro] = useState('pendiente')

  // Refresca los "hace X min" sin recargar la página.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const pendientes = orders.filter((o) => o.status === 'pendiente')
  const despachados = orders.filter((o) => o.status === 'despachado')
  const cerrados = despachados.filter((o) => o.paid) // despachados Y pagados

  const visibles = useMemo(() => {
    const test = FILTROS.find((f) => f.id === filtro)?.test ?? (() => true)
    const lista = orders.filter(test)

    // En la lista de cobro manda la antigüedad de la deuda, no el despacho.
    if (filtro === 'sin-pagar') {
      return [...lista].sort((a, b) => a.createdAt - b.createdAt)
    }

    // En las demás, primero lo que falta por despachar, y de lo más antiguo
    // a lo más nuevo (se atiende en orden de llegada).
    return [...lista].sort((a, b) =>
      a.status === b.status
        ? a.status === 'pendiente'
          ? a.createdAt - b.createdAt
          : b.dispatchedAt - a.dispatchedAt
        : a.status === 'pendiente'
          ? -1
          : 1,
    )
  }, [orders, filtro])

  const porCobrar = orders.filter((o) => !o.paid).reduce((sum, o) => sum + o.total, 0)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6">
      {/* Indicadores */}
      <div
        className={`grid grid-cols-2 gap-3 ${rol === 'admin' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}
      >
        <Indicador valor={pendientes.length} etiqueta="Pendientes" acento="cono" />
        <Indicador valor={despachados.length} etiqueta="Despachados" acento="menta" />
        <Indicador
          valor={orders.filter((o) => !o.paid).length}
          etiqueta="Sin pagar"
          acento="cacao"
        />
        {/* El monto total es una cifra del día: solo para el admin. Cada pedido
            sí muestra su precio, que hace falta para cobrarlo. */}
        {rol === 'admin' && (
          <Indicador valor={formatCOP(porCobrar)} etiqueta="Por cobrar" pequeno />
        )}
      </div>

      {/* Filtros */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
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
                  `¿Quitar de la lista ${cerrados.length} pedidos ya despachados y pagados?\n\n` +
                    'Siguen contando en la caja del día.',
                )
              ) {
                clearDispatched()
              }
            }}
            className="text-sm font-medium text-cacao-800/55 underline-offset-2 hover:text-terracota-600 hover:underline"
          >
            Limpiar despachados y pagados
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
            {filtro === 'pendiente'
              ? 'No hay pedidos pendientes'
              : filtro === 'sin-pagar'
                ? 'Todo está cobrado'
                : 'Nada por aquí'}
          </p>
          <p className="mt-1 text-sm text-cacao-800/55">
            {filtro === 'sin-pagar'
              ? 'No queda ningún pedido debiendo.'
              : 'Los pedidos que envíes desde la carta aparecen en esta pantalla.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((pedido) => (
            <TarjetaPedido
              key={pedido.id}
              pedido={pedido}
              onDespachar={() => dispatchOrder(pedido.id)}
              onReabrir={() => reopenOrder(pedido.id)}
              onTogglePago={() => togglePaid(pedido.id)}
              onEliminar={() => {
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
    acento === 'cono'
      ? 'text-cono-600'
      : acento === 'menta'
        ? 'text-menta-500'
        : acento === 'cacao'
          ? 'text-cacao-600'
          : 'text-cacao-900'
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

function TarjetaPedido({ pedido, onDespachar, onReabrir, onTogglePago, onEliminar }) {
  const despachado = pedido.status === 'despachado'

  return (
    <article
      className={`animar-entrada flex flex-col overflow-hidden rounded-3xl border-2 bg-white shadow-sm transition ${
        despachado ? 'border-crema-200 opacity-70' : 'border-menta-800/30 shadow-cacao-900/5'
      }`}
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3 ${
          despachado ? 'bg-crema-100' : 'bg-menta-800 text-crema-50'
        }`}
      >
        <div className="flex flex-wrap items-baseline gap-2">
          {pedido.code ? (
            <span className="font-display text-lg font-bold">#{pedido.code}</span>
          ) : (
            // Tomado sin internet: el número lo pone el servidor al subirlo.
            <span className="font-display text-lg font-bold opacity-70" title="Por enviar">
              #···
            </span>
          )}
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${
              despachado ? 'bg-crema-200 text-cacao-900' : 'bg-cono-500 text-white'
            }`}
          >
            {pedido.table === 'Para llevar' ? 'Para llevar' : `Mesa ${pedido.table}`}
          </span>
          {pedido.customer && (
            <span
              className={`whitespace-nowrap text-sm font-semibold ${
                despachado ? 'text-cacao-900' : 'text-crema-50'
              }`}
            >
              {pedido.customer}
            </span>
          )}
          {!pedido.paid && (
            <span className="whitespace-nowrap rounded-full bg-cacao-600 px-2 py-0.5 text-xs font-bold text-white">
              Sin pagar
            </span>
          )}
        </div>
        <span
          className={`whitespace-nowrap text-xs ${despachado ? 'text-cacao-800/55' : 'text-crema-50/65'}`}
        >
          {hora(pedido.createdAt)} · {haceCuanto(pedido.createdAt)}
        </span>
      </header>

      <div className="flex-1 space-y-2.5 px-4 py-3.5">
        {pedido.lines.map((linea, i) => {
          const d = describirLinea(linea)
          return (
            <div key={linea.uid ?? i} className="flex items-start gap-2.5">
              <span className="text-lg leading-none" aria-hidden="true">
                {d.icono}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cacao-900">
                  {d.cantidad > 1 && <span className="text-terracota-600">{d.cantidad}× </span>}
                  {d.titulo}
                  {d.porciones && (
                    <span className="font-normal text-cacao-800/60"> · {d.porciones}</span>
                  )}
                </p>
                <DetalleLinea d={d} />
              </div>
              <span className="shrink-0 text-sm font-semibold text-cacao-800/70">
                {formatCOP(lineTotal(linea))}
              </span>
            </div>
          )
        })}

        {pedido.note && (
          <p className="rounded-xl bg-cacao-100 px-3 py-2 text-xs text-cacao-900">
            <span className="font-bold">Nota:</span> {pedido.note}
          </p>
        )}
      </div>

      <footer className="border-t border-crema-200 px-4 py-3">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-cacao-800/50">
            Total
          </span>
          <span className="font-display text-xl font-bold text-cacao-900">
            {formatCOP(pedido.total)}
          </span>
        </div>

        {/* Estado de pago: se puede cambiar en cualquier momento */}
        <button
          type="button"
          onClick={onTogglePago}
          className={`mb-3 flex w-full items-center justify-between rounded-xl border-2 px-3 py-2.5 text-left transition ${
            pedido.paid
              ? 'border-menta-500 bg-menta-100 hover:border-cacao-600'
              : 'border-cacao-600 bg-cacao-100 hover:border-menta-500'
          }`}
        >
          <span className="text-sm font-bold text-cacao-900">
            {pedido.paid ? '✓ Pagado' : '● Pendiente de pago'}
          </span>
          <span className="text-xs font-medium text-cacao-800/55">
            {pedido.paid ? 'Marcar sin pagar' : 'Marcar pagado'}
          </span>
        </button>

        {despachado ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 rounded-xl bg-menta-100 px-3 py-2.5 text-center text-xs font-semibold text-menta-700">
              ✓ Despachado {haceCuanto(pedido.dispatchedAt)}
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
              onClick={onEliminar}
              aria-label={`Eliminar pedido ${pedido.code ?? 'sin número'}`}
              className="rounded-xl border-2 border-crema-200 px-3 py-2.5 text-xs font-semibold text-terracota-600 transition hover:border-cono-500"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDespachar}
            className="w-full rounded-xl bg-menta-500 px-4 py-3 text-sm font-bold text-white shadow-md shadow-menta-500/25 transition hover:bg-menta-700"
          >
            Marcar como despachado
          </button>
        )}
      </footer>
    </article>
  )
}
