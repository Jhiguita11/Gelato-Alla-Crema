import { useState } from 'react'
import ProductoBuilder from '../components/ProductoBuilder'
import {
  CATEGORIES,
  TABLES,
  formatCOP,
  lineTotal,
  orderTotal,
  precioDesde,
} from '../data/menu'
import { useDisponibilidad } from '../store/disponibilidad'
import { useOrders } from '../store/orders'
import { useTurnos } from '../store/turnos'
import { describirLinea, hora } from '../utils/describir'

export default function NuevoPedido({ onEnviado }) {
  const { addOrder, agregarAPedido, pedidosDeLaMesa } = useOrders()
  const { productoAgotado, productos } = useDisponibilidad()
  const { persona } = useTurnos()

  const [productoActivo, setProductoActivo] = useState(null)
  const [lineas, setLineas] = useState([])
  const [mesa, setMesa] = useState(null)
  const [nombre, setNombre] = useState('')
  const [pagado, setPagado] = useState(false)
  const [nota, setNota] = useState('')
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [error, setError] = useState('')
  // Pedidos que ya tiene la mesa: antes de enviar se pregunta si es la misma
  // gente (se agrega a su pedido) o gente nueva (pedido aparte).
  const [preguntaMesa, setPreguntaMesa] = useState(null)

  const total = orderTotal({ lines: lineas })
  const unidades = lineas.reduce((n, l) => n + (l.quantity ?? 1), 0)

  function agregarLinea(linea) {
    setLineas((prev) => [...prev, { ...linea, uid: crypto.randomUUID() }])
    setProductoActivo(null)
    setError('')
  }

  function enviarPedido() {
    if (lineas.length === 0) {
      setError('Agrega al menos un producto.')
      return
    }
    if (!mesa) {
      setError('Selecciona la mesa.')
      setCarritoAbierto(true)
      return
    }
    const abiertos = pedidosDeLaMesa(mesa)
    if (abiertos.length > 0) {
      setCarritoAbierto(false)
      setPreguntaMesa(abiertos)
      return
    }
    enviarComoNuevo()
  }

  function enviarComoNuevo() {
    const pedido = addOrder({ table: mesa, lines: lineas, note: nota, customer: nombre, takenBy: persona, paid: pagado })
    terminar(pedido, false)
  }

  function agregarAlExistente(id) {
    const pedido = agregarAPedido(id, { lines: lineas, takenBy: persona, paid: pagado, note: nota })
    terminar(pedido, true)
  }

  function terminar(pedido, agregado) {
    setPreguntaMesa(null)
    setLineas([])
    setMesa(null)
    setNombre('')
    setPagado(false)
    setNota('')
    setError('')
    setCarritoAbierto(false)
    onEnviado?.(pedido, { agregado })
  }

  return (
    <>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-32 pt-6 lg:grid-cols-[1fr_380px] lg:pb-10">
        <section>
          <h2 className="font-display text-2xl font-bold text-cacao-900">Carta</h2>
          <p className="mt-1 text-sm text-cacao-800/60">
            Toca un producto para armarlo paso a paso.
          </p>

          {CATEGORIES.map((categoria) => {
            const deLaSeccion = productos.filter((p) => p.category === categoria.id)
            if (deLaSeccion.length === 0) return null
            return (
              <div key={categoria.id} className="mt-7">
                <h3 className="mb-3 flex items-center gap-3 font-display text-lg font-bold text-menta-700">
                  {categoria.name}
                  <span className="h-px flex-1 bg-crema-200" />
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {deLaSeccion.map((producto) => {
                    const agotado = productoAgotado(producto.id)
                    return (
                    <button
                      key={producto.id}
                      type="button"
                      disabled={agotado}
                      onClick={() => setProductoActivo(producto)}
                      className={`group flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition ${
                        agotado
                          ? 'cursor-not-allowed border-crema-200 bg-crema-100'
                          : 'border-crema-200 bg-white hover:-translate-y-0.5 hover:border-menta-400 hover:shadow-lg hover:shadow-cacao-900/5'
                      }`}
                    >
                      <span
                        className={`text-3xl leading-none ${agotado ? 'opacity-30 grayscale' : ''}`}
                        aria-hidden="true"
                      >
                        {producto.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={`font-display text-base font-bold ${
                              agotado ? 'text-cacao-800/40 line-through' : 'text-cacao-900'
                            }`}
                          >
                            {producto.name}
                          </span>
                          {agotado && (
                            <span className="rounded-full bg-terracota-100 px-2 py-0.5 text-[11px] font-bold text-terracota-600">
                              Agotado
                            </span>
                          )}
                        </span>
                        {producto.incluye?.length > 0 && (
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-cacao-800/55">
                            {producto.incluye.join(' · ')}
                          </span>
                        )}
                        <span className="mt-2 flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-menta-700">
                            {producto.variantes ? 'desde ' : ''}
                            {precioDesde(producto) > 0 ? formatCOP(precioDesde(producto)) : '—'}
                          </span>
                          {producto.porciones > 0 && (
                            <span className="text-xs text-cacao-800/45">
                              {producto.porciones}{' '}
                              {producto.porciones === 1 ? 'porción' : 'porciones'}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <PanelPedido
              lineas={lineas}
              mesa={mesa}
              setMesa={setMesa}
              nombre={nombre}
              setNombre={setNombre}
              pagado={pagado}
              setPagado={setPagado}
              nota={nota}
              setNota={setNota}
              total={total}
              error={error}
              onQuitar={(uid) => setLineas((prev) => prev.filter((l) => l.uid !== uid))}
              onEnviar={enviarPedido}
            />
          </div>
        </aside>
      </div>

      {/* Barra inferior (móvil) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-crema-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setCarritoAbierto(true)}
          className="flex w-full items-center justify-between rounded-2xl bg-menta-700 px-5 py-3.5 text-crema-50 shadow-lg shadow-cacao-900/20"
        >
          <span className="text-sm font-semibold">
            {unidades === 0
              ? 'Pedido vacío'
              : `${unidades} ${unidades === 1 ? 'producto' : 'productos'}${mesa ? ` · Mesa ${mesa}` : ''}`}
          </span>
          <span className="font-display text-lg font-bold">{formatCOP(total)}</span>
        </button>
      </div>

      {preguntaMesa && (
        <PreguntaMismaGente
          mesa={mesa}
          pedidos={preguntaMesa}
          totalNuevo={total}
          onAgregar={agregarAlExistente}
          onNuevo={enviarComoNuevo}
          onCancelar={() => setPreguntaMesa(null)}
        />
      )}

      {carritoAbierto && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-cacao-900/45 backdrop-blur-sm lg:hidden"
          onClick={() => setCarritoAbierto(false)}
        >
          <div
            className="animar-entrada max-h-[88vh] w-full overflow-hidden rounded-t-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <PanelPedido
              lineas={lineas}
              mesa={mesa}
              setMesa={setMesa}
              nombre={nombre}
              setNombre={setNombre}
              pagado={pagado}
              setPagado={setPagado}
              nota={nota}
              setNota={setNota}
              total={total}
              error={error}
              onQuitar={(uid) => setLineas((prev) => prev.filter((l) => l.uid !== uid))}
              onEnviar={enviarPedido}
              onCerrar={() => setCarritoAbierto(false)}
            />
          </div>
        </div>
      )}

      {productoActivo && (
        <ProductoBuilder
          product={productoActivo}
          onAdd={agregarLinea}
          onClose={() => setProductoActivo(null)}
        />
      )}
    </>
  )
}

function PanelPedido({
  lineas,
  mesa,
  setMesa,
  nombre,
  setNombre,
  pagado,
  setPagado,
  nota,
  setNota,
  total,
  error,
  onQuitar,
  onEnviar,
  onCerrar,
}) {
  return (
    <div className="flex max-h-[88vh] flex-col overflow-hidden rounded-3xl border-2 border-crema-200 bg-white shadow-xl shadow-cacao-900/5">
      <header className="flex items-center justify-between border-b border-crema-200 px-5 py-4">
        <h2 className="font-display text-lg font-bold text-cacao-900">Pedido actual</h2>
        {onCerrar ? (
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-8 w-8 place-items-center rounded-full text-cacao-800/50 hover:bg-crema-100"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        ) : (
          <span className="text-xs text-cacao-800/50">
            {lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'}
          </span>
        )}
      </header>

      <div className="scroll-suave flex-1 overflow-y-auto px-5 py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cacao-800/55">Mesa</p>
        <div className="flex flex-wrap gap-1.5">
          {TABLES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMesa(t === mesa ? null : t)}
              className={`min-w-12 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition sm:min-w-10 sm:py-2 ${
                mesa === t
                  ? 'border-cono-500 bg-cono-500 text-white'
                  : 'border-crema-200 bg-crema-50 text-cacao-900 hover:border-cono-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-cacao-800/55">
          A nombre de <span className="font-normal normal-case">· opcional</span>
        </p>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Juliana"
          className="w-full rounded-xl border-2 border-crema-200 bg-crema-50 px-3 py-2.5 text-sm text-cacao-900 outline-none transition placeholder:text-cacao-800/35 focus:border-menta-400"
        />

        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-cacao-800/55">
          Productos
        </p>
        {lineas.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-crema-200 px-4 py-8 text-center text-sm text-cacao-800/45">
            Aún no hay productos.
            <br />
            Elige uno de la carta.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {lineas.map((linea) => {
              const d = describirLinea(linea)
              return (
                <li
                  key={linea.uid}
                  className="animar-entrada rounded-2xl border border-crema-200 bg-crema-50 p-3"
                >
                  <div className="flex items-start gap-2">
                    <span aria-hidden="true">{d.icono}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-cacao-900">
                        {d.cantidad > 1 && <span className="text-terracota-600">{d.cantidad}× </span>}
                        {d.titulo}
                      </p>
                      <DetalleLinea d={d} />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-bold text-cacao-900">
                        {formatCOP(lineTotal(linea))}
                      </span>
                      <button
                        type="button"
                        onClick={() => onQuitar(linea.uid)}
                        className="text-xs font-medium text-terracota-600 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-cacao-800/55">
          Pago
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPagado(false)}
            className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
              !pagado
                ? 'border-cacao-600 bg-cacao-100 text-cacao-900'
                : 'border-crema-200 bg-crema-50 text-cacao-800/50 hover:border-cacao-600'
            }`}
          >
            Pendiente de pago
          </button>
          <button
            type="button"
            onClick={() => setPagado(true)}
            className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
              pagado
                ? 'border-menta-500 bg-menta-100 text-cacao-900'
                : 'border-crema-200 bg-crema-50 text-cacao-800/50 hover:border-menta-500'
            }`}
          >
            Pagado
          </button>
        </div>

        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-cacao-800/55">
          Nota para cocina
        </p>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="Ej: sin maní, alergia · servir de último"
          className="w-full resize-none rounded-xl border-2 border-crema-200 bg-crema-50 px-3 py-2 text-sm text-cacao-900 outline-none transition placeholder:text-cacao-800/35 focus:border-menta-400"
        />
      </div>

      <footer className="border-t border-crema-200 bg-white px-5 py-4">
        {error && (
          <p className="mb-3 rounded-xl bg-terracota-100 px-3 py-2 text-sm font-medium text-terracota-600">
            {error}
          </p>
        )}
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide text-cacao-800/55">
            Total
          </span>
          <span className="font-display text-3xl font-bold text-cacao-900">{formatCOP(total)}</span>
        </div>
        <button
          type="button"
          onClick={onEnviar}
          disabled={lineas.length === 0}
          className="w-full rounded-2xl bg-cono-500 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-cono-500/25 transition enabled:hover:bg-cono-600 disabled:cursor-not-allowed disabled:bg-crema-300 disabled:text-cacao-900/40 disabled:shadow-none"
        >
          Enviar a pedidos pendientes
        </button>
      </footer>
    </div>
  )
}

export function DetalleLinea({ d, className = '' }) {
  const partes = [...d.opciones]
  if (d.sabores.length) {
    partes.push({
      etiqueta: d.sabores.length === 1 ? 'Sabor' : 'Sabores',
      valor: d.sabores.join(', '),
    })
  }
  if (d.salsa) partes.push({ etiqueta: 'Salsa', valor: d.salsa })
  partes.push(...d.extras)
  if (d.adiciones.length) partes.push({ etiqueta: 'Adición', valor: d.adiciones.join(', ') })

  if (partes.length === 0) return null

  return (
    <ul className={`mt-1 space-y-0.5 text-xs text-cacao-800/70 ${className}`}>
      {partes.map((p) => (
        <li key={p.etiqueta}>
          <span className="font-medium text-cacao-800/50">{p.etiqueta}:</span> {p.valor}
        </li>
      ))}
    </ul>
  )
}

/**
 * La mesa ya tiene pedido: ¿es la misma gente pidiendo algo más (se agrega a
 * su cuenta) o gente nueva que se sentó (pedido aparte)?
 */
function PreguntaMismaGente({ mesa, pedidos, totalNuevo, onAgregar, onNuevo, onCancelar }) {
  const estado = (p) =>
    p.status === 'despachado' ? 'Entregado' : p.status === 'listo' ? 'Listo para recoger' : 'En preparación'
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-cacao-900/50 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-labelledby="pregunta-mesa"
        className="animar-entrada w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="px-5 pb-2 pt-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-cono-600">Mesa {mesa}</p>
          <h3 id="pregunta-mesa" className="mt-1 font-display text-2xl font-bold leading-tight text-cacao-900">
            Esta mesa ya tiene pedido. ¿Es la misma gente?
          </h3>
          <p className="mt-2 text-sm text-cacao-800/60">
            Si es la misma gente, lo nuevo ({formatCOP(totalNuevo)}) se suma a su cuenta y el pedido vuelve a
            cocina. Lo que ya se entregó queda tachado.
          </p>
        </div>

        <div className="space-y-2 px-5 py-3">
          {pedidos.map((p) => {
            const debe = p.paid ? 0 : p.total - (p.abonado ?? 0)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onAgregar(p.id)}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-menta-500 bg-menta-100/60 px-4 py-3.5 text-left transition hover:bg-menta-100"
              >
                <span className="text-2xl" aria-hidden="true">
                  ➕
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold text-cacao-900">
                    Sí, agregar al {p.code ? `#${p.code}` : 'pedido'}
                  </span>
                  <span className="block truncate text-xs text-cacao-800/60">
                    {[p.customer, p.takenBy, hora(p.rondaAt ?? p.createdAt), estado(p)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs font-semibold text-cacao-800/70">
                  {formatCOP(p.total)}
                  <span className={`block ${debe > 0 ? 'text-terracota-600' : 'text-menta-700'}`}>
                    {debe > 0 ? `debe ${formatCOP(debe)}` : 'pagado'}
                  </span>
                </span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={onNuevo}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-crema-200 px-4 py-3.5 text-left transition hover:border-cono-500"
          >
            <span className="text-2xl" aria-hidden="true">
              🧾
            </span>
            <span>
              <span className="block text-base font-bold text-cacao-900">No, es gente nueva</span>
              <span className="block text-xs text-cacao-800/60">Pedido aparte, con su propia cuenta</span>
            </span>
          </button>
        </div>

        <div className="px-5 pb-5 pt-1">
          <button
            type="button"
            onClick={onCancelar}
            className="w-full rounded-2xl py-2.5 text-sm font-semibold text-cacao-800/55 transition hover:text-cacao-900"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
