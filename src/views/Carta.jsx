import { useState } from 'react'
import { CATEGORIES, formatCOP, precioDesde } from '../data/menu'
import { textoPorciones, validarProducto } from '../utils/carta'
import { useDisponibilidad } from '../store/disponibilidad'

/**
 * Carta (solo admin): agregar, editar y quitar productos. Los cambios llegan
 * a todos los celulares al instante. Quitar = ocultar: el producto deja de
 * salir en la toma de pedidos, pero los pedidos que ya lo tienen siguen
 * mostrándolo, y se puede volver a poner.
 */
export default function Carta() {
  const { carta, guardarProducto, ocultarProducto, restaurarProducto } = useDisponibilidad()
  const [editando, setEditando] = useState(null) // { item } | { nuevo: true }

  const visibles = carta.filter((x) => !x.oculto)
  const quitados = carta.filter((x) => x.oculto)

  const restaurar = (item) => {
    if (confirm(`¿Dejar "${item.producto.name}" como venía en la carta original?`)) {
      restaurarProducto(item.producto.id)
      setEditando(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-cacao-900">Editar carta</h2>
          <p className="mt-1 text-sm text-cacao-800/60">
            Agrega, edita o quita productos. Los cambios llegan a todos los celulares al instante.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando({ nuevo: true })}
          className="rounded-2xl bg-menta-700 px-5 py-3 text-sm font-bold text-crema-50 shadow-md shadow-menta-700/20 transition hover:bg-menta-800"
        >
          + Agregar producto
        </button>
      </div>

      {CATEGORIES.map((categoria) => {
        const items = visibles.filter((x) => x.producto.category === categoria.id)
        if (items.length === 0) return null
        return (
          <section key={categoria.id} className="mt-8">
            <h3 className="mb-3 flex items-center gap-3 font-display text-lg font-bold text-menta-700">
              {categoria.name}
              <span className="text-sm font-medium text-cacao-800/45">{items.length}</span>
              <span className="h-px flex-1 bg-crema-200" />
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <FilaProducto
                  key={item.producto.id}
                  item={item}
                  onEditar={() => setEditando({ item })}
                  onQuitar={() => {
                    if (
                      confirm(
                        `¿Quitar "${item.producto.name}" de la carta?\n\n` +
                          'Deja de salir al tomar pedidos. Los pedidos que ya lo tienen no cambian, y lo puedes volver a poner cuando quieras.',
                      )
                    )
                      ocultarProducto(item.producto.id, true)
                  }}
                />
              ))}
            </div>
          </section>
        )
      })}

      {quitados.length > 0 && (
        <section className="mt-10">
          <h3 className="mb-3 flex items-center gap-3 font-display text-lg font-bold text-cacao-800/60">
            Quitados de la carta
            <span className="text-sm font-medium text-cacao-800/45">{quitados.length}</span>
            <span className="h-px flex-1 bg-crema-200" />
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quitados.map((item) => (
              <div
                key={item.producto.id}
                className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-crema-300 bg-crema-100 px-4 py-3"
              >
                <span className="text-2xl opacity-40 grayscale" aria-hidden="true">
                  {item.producto.icon}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-cacao-800/50 line-through">
                  {item.producto.name}
                </span>
                <button
                  type="button"
                  onClick={() => ocultarProducto(item.producto.id, false)}
                  className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-bold text-menta-700 ring-1 ring-crema-200 transition hover:ring-menta-400"
                >
                  Volver a poner
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {editando && (
        <EditorProducto
          item={editando.item ?? null}
          carta={carta}
          onCancelar={() => setEditando(null)}
          onRestaurar={editando.item ? () => restaurar(editando.item) : null}
          onGuardar={(producto) => {
            guardarProducto(producto)
            setEditando(null)
          }}
        />
      )}
    </div>
  )
}

/** "1" + "porción" → "1 porción"; "Sencilla" se queda igual. */
function nombreVersion(v) {
  if (!/^\d+$/.test(v.name) || !v.detalle) return v.name
  return v.detalle.startsWith(v.name) ? v.detalle : `${v.name} ${v.detalle}`
}

function FilaProducto({ item, onEditar, onQuitar }) {
  const p = item.producto
  return (
    <div className="flex flex-col rounded-2xl border-2 border-crema-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden="true">
          {p.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-display text-base font-bold text-cacao-900">{p.name}</span>
            {!item.deFabrica && (
              <span className="rounded-full bg-menta-100 px-2 py-0.5 text-[11px] font-bold uppercase text-menta-700">
                Nuevo
              </span>
            )}
            {item.editado && (
              <span className="rounded-full bg-cono-100 px-2 py-0.5 text-[11px] font-bold uppercase text-cono-600">
                Editado
              </span>
            )}
          </p>
          <p className="mt-1 text-sm font-semibold text-menta-700">
            {p.variantes?.length
              ? p.variantes.map((v) => `${nombreVersion(v)}: ${formatCOP(v.price)}`).join(' · ')
              : formatCOP(precioDesde(p))}
          </p>
          {p.incluye?.length > 0 && (
            <p className="mt-1 line-clamp-2 text-xs text-cacao-800/55">{p.incluye.join(' · ')}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onEditar}
          className="flex-1 rounded-xl border-2 border-crema-200 py-2 text-sm font-bold text-cacao-900 transition hover:border-menta-400"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onQuitar}
          aria-label={`Quitar ${p.name} de la carta`}
          className="rounded-xl border-2 border-crema-200 px-3 py-2 text-sm font-semibold text-terracota-600 transition hover:border-terracota-600"
        >
          Quitar
        </button>
      </div>
    </div>
  )
}

// ── Editor ───────────────────────────────────────────────────────────────────

const ICONOS = [
  '🍦', '🍨', '🍧', '🧁', '🍰', '🍫', '🍪', '🍩', '🧇', '🍮', '🍓', '🍌',
  '🍒', '🍉', '🍋', '🥭', '🍍', '🥜', '🧀', '☕', '🥤', '🧃', '🥛', '🍸', '🎉', '🦄',
]

function formularioDesde(p) {
  const conVersiones = !!p?.variantes?.length
  return {
    name: p?.name ?? '',
    icon: p?.icon ?? '🍨',
    category: p?.category ?? CATEGORIES[0].id,
    conVersiones,
    price: !conVersiones && p?.price ? String(p.price) : '',
    porciones: !conVersiones ? (p?.porciones ?? 0) : 1,
    variantesTitulo: p?.variantesTitulo ?? '¿Qué tamaño?',
    variantes: conVersiones
      ? p.variantes.map((v) => ({ id: v.id, name: v.name, porciones: v.porciones ?? 0, price: String(v.price) }))
      : [
          { id: null, name: '', porciones: 1, price: '' },
          { id: null, name: '', porciones: 2, price: '' },
        ],
    eligeSalsa: !!p?.eligeSalsa,
    incluye: (p?.incluye ?? []).join(', '),
  }
}

function EditorProducto({ item, carta, onGuardar, onCancelar, onRestaurar }) {
  const [f, setF] = useState(() => formularioDesde(item?.producto))
  const [error, setError] = useState('')
  const poner = (cambio) => {
    setF((prev) => ({ ...prev, ...cambio }))
    setError('')
  }
  const ponerVersion = (i, cambio) =>
    poner({ variantes: f.variantes.map((v, j) => (j === i ? { ...v, ...cambio } : v)) })

  function guardar(e) {
    e.preventDefault()
    const r = validarProducto(f, { item, carta })
    if (r.error) setError(r.error)
    else onGuardar(r.producto)
  }

  const puedeRestaurar = item?.deFabrica && item.editado

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-cacao-900/50 backdrop-blur-sm sm:items-center sm:p-6">
      <form
        onSubmit={guardar}
        aria-label={item ? `Editar ${item.producto.name}` : 'Producto nuevo'}
        className="animar-entrada flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-center justify-between border-b border-crema-200 px-5 py-4">
          <h3 className="font-display text-xl font-bold text-cacao-900">
            {item ? `Editar ${item.producto.name}` : 'Producto nuevo'}
          </h3>
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Cerrar"
            className="grid h-9 w-9 place-items-center rounded-full text-cacao-800/50 transition hover:bg-crema-100"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <Campo etiqueta="Nombre" htmlFor="carta-nombre">
            <input
              id="carta-nombre"
              autoFocus={!item}
              value={f.name}
              onChange={(e) => poner({ name: e.target.value })}
              placeholder="Ej: Affogato"
              maxLength={40}
              className={entrada}
            />
          </Campo>

          <Campo etiqueta="Ícono">
            <div className="flex flex-wrap gap-1.5">
              {ICONOS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => poner({ icon: ic })}
                  aria-label={`Usar ${ic}`}
                  aria-pressed={f.icon === ic}
                  className={`grid h-10 w-10 place-items-center rounded-xl text-2xl transition ${
                    f.icon === ic ? 'bg-menta-100 ring-2 ring-menta-500' : 'hover:bg-crema-100'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </Campo>

          <Campo etiqueta="Sección de la carta">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Opcion key={c.id} activa={f.category === c.id} onClick={() => poner({ category: c.id })}>
                  {c.name}
                </Opcion>
              ))}
            </div>
          </Campo>

          <Campo etiqueta="Precio">
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-crema-100 p-1">
              {[
                [false, 'Precio único'],
                [true, 'Con versiones'],
              ].map(([valor, texto]) => (
                <button
                  key={texto}
                  type="button"
                  onClick={() => poner({ conVersiones: valor })}
                  aria-pressed={f.conVersiones === valor}
                  className={`rounded-xl py-2.5 text-sm font-bold transition ${
                    f.conVersiones === valor ? 'bg-white text-cacao-900 shadow-sm' : 'text-cacao-800/55'
                  }`}
                >
                  {texto}
                </button>
              ))}
            </div>

            {!f.conVersiones ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-cacao-800/60">Precio ($)</span>
                  <input
                    id="carta-precio"
                    inputMode="numeric"
                    value={f.price}
                    onChange={(e) => poner({ price: e.target.value })}
                    placeholder="12000"
                    className={entrada}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-cacao-800/60">
                    Porciones de helado
                  </span>
                  <SelectorPorciones valor={f.porciones} onCambio={(n) => poner({ porciones: n })} />
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-cacao-800/60">
                    Pregunta para el cliente
                  </span>
                  <input
                    value={f.variantesTitulo}
                    onChange={(e) => poner({ variantesTitulo: e.target.value })}
                    placeholder="¿Qué tamaño?"
                    className={entrada}
                  />
                </label>
                {f.variantes.map((v, i) => (
                  <div key={i} className="rounded-2xl border-2 border-crema-200 p-3" data-version={i}>
                    <div className="flex items-center gap-2">
                      <input
                        aria-label={`Nombre de la versión ${i + 1}`}
                        value={v.name}
                        onChange={(e) => ponerVersion(i, { name: e.target.value })}
                        placeholder={i === 0 ? 'Sencilla' : i === 1 ? 'Especial' : 'Versión'}
                        className={`${entradaBase} min-w-0 flex-1`}
                      />
                      <input
                        aria-label={`Precio de la versión ${i + 1}`}
                        inputMode="numeric"
                        value={v.price}
                        onChange={(e) => ponerVersion(i, { price: e.target.value })}
                        placeholder="$"
                        className={`${entradaBase} w-28 shrink-0 sm:w-32`}
                      />
                      {f.variantes.length > 2 && (
                        <button
                          type="button"
                          onClick={() => poner({ variantes: f.variantes.filter((_, j) => j !== i) })}
                          aria-label={`Quitar la versión ${i + 1}`}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-cacao-800/40 transition hover:bg-terracota-100 hover:text-terracota-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-cacao-800/60">
                      Porciones de helado
                      <SelectorPorciones
                        valor={v.porciones}
                        onCambio={(n) => ponerVersion(i, { porciones: n })}
                        pequeno
                      />
                    </div>
                  </div>
                ))}
                {f.variantes.length < 6 && (
                  <button
                    type="button"
                    onClick={() =>
                      poner({ variantes: [...f.variantes, { id: null, name: '', porciones: 1, price: '' }] })
                    }
                    className="w-full rounded-xl border-2 border-dashed border-crema-300 py-2.5 text-sm font-semibold text-cacao-800/60 transition hover:border-menta-400 hover:text-cacao-900"
                  >
                    + Otra versión
                  </button>
                )}
              </div>
            )}
          </Campo>

          <label className="flex items-center gap-3 rounded-2xl border-2 border-crema-200 px-4 py-3">
            <input
              type="checkbox"
              checked={f.eligeSalsa}
              onChange={(e) => poner({ eligeSalsa: e.target.checked })}
              className="h-5 w-5 accent-menta-700"
            />
            <span className="text-sm font-semibold text-cacao-900">
              El cliente elige la salsa
              <span className="block text-xs font-normal text-cacao-800/55">Chocolate, arequipe o chicle</span>
            </span>
          </label>

          <Campo etiqueta="Qué incluye" ayuda="Separado por comas. Sale debajo del nombre en la carta." htmlFor="carta-incluye">
            <input
              id="carta-incluye"
              value={f.incluye}
              onChange={(e) => poner({ incluye: e.target.value })}
              placeholder="Chantilly, Cereza, Barquillo"
              className={entrada}
            />
          </Campo>

          {error && (
            <p role="alert" className="rounded-xl bg-terracota-100 px-3 py-2.5 text-sm font-semibold text-terracota-600">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-crema-200 px-5 py-4">
          <button
            type="submit"
            className="flex-1 rounded-2xl bg-menta-700 px-5 py-3.5 text-base font-bold text-crema-50 transition hover:bg-menta-800"
          >
            {item ? 'Guardar cambios' : 'Agregar a la carta'}
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-2xl border-2 border-crema-200 px-5 py-3 text-sm font-semibold text-cacao-900 transition hover:border-cono-500"
          >
            Cancelar
          </button>
          {puedeRestaurar && (
            <button
              type="button"
              onClick={onRestaurar}
              className="w-full pt-1 text-sm font-semibold text-cacao-800/55 underline-offset-2 hover:text-terracota-600 hover:underline"
            >
              Volver a como venía en la carta original
            </button>
          )}
        </footer>
      </form>
    </div>
  )
}

const entradaBase =
  'rounded-xl border-2 border-crema-200 bg-crema-50 px-3 py-2.5 text-base text-cacao-900 outline-none transition placeholder:text-cacao-800/35 focus:border-menta-400'
const entrada = `w-full ${entradaBase}`

function Campo({ etiqueta, ayuda, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-xs font-bold uppercase tracking-wide text-cacao-800/55">
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="mt-1.5 text-xs text-cacao-800/45">{ayuda}</p>}
    </div>
  )
}

function Opcion({ activa, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`rounded-full border-2 px-3.5 py-2 text-sm font-semibold transition ${
        activa ? 'border-menta-700 bg-menta-700 text-crema-50' : 'border-crema-200 bg-white text-cacao-900 hover:border-menta-400'
      }`}
    >
      {children}
    </button>
  )
}

/** 0 a 5 porciones. 0 = no lleva helado (no se preguntan sabores). */
function SelectorPorciones({ valor, onCambio, pequeno }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Porciones de helado">
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onCambio(n)}
          aria-pressed={Number(valor) === n}
          title={n === 0 ? 'No lleva helado' : textoPorciones(n)}
          className={`grid place-items-center rounded-lg font-bold transition ${pequeno ? 'h-8 w-8 text-xs' : 'h-11 flex-1 text-sm'} ${
            Number(valor) === n ? 'bg-menta-700 text-crema-50' : 'bg-crema-100 text-cacao-800/70 hover:bg-crema-200'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
