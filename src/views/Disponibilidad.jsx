import { useState } from 'react'
import { CATEGORIES, formatCOP, precioDesde } from '../data/menu'
import { useDisponibilidad } from '../store/disponibilidad'

/** Colores para la bolita del sabor nuevo. */
const PALETA = [
  '#b8324f', '#f4a3c8', '#f2a03d', '#f3c53f', '#9ede3f', '#cfd94f',
  '#5a3a26', '#9c6b4a', '#c99a5b', '#cdaaf0', '#8ec5e8', '#fbf4e6',
]

/**
 * Pantalla para agotar cosas sobre la marcha: si se acaba un sabor a media
 * tarde, se apaga aquí y desaparece de la toma de pedidos al instante.
 */
export default function Disponibilidad() {
  const {
    catalogo,
    saboresActivos,
    productoAgotado,
    productos,
    esPersonalizado,
    toggleSabor,
    toggleProducto,
    agregarSabor,
    eliminarSabor,
    reabrirDia,
    fecha,
  } = useDisponibilidad()

  const activos = new Set(saboresActivos.map((s) => s.id))
  const agotados = productos.filter((p) => productoAgotado(p.id)).length

  const fechaLegible = fecha
    ? new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : null

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-cacao-900">Disponibilidad</h2>
          <p className="mt-1 text-sm text-cacao-800/60">
            Apaga lo que se vaya acabando. Desaparece de la carta al instante.
            {fechaLegible && <> · Día abierto el {fechaLegible}.</>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm('¿Volver a preguntar qué sabores hay?')) reabrirDia()
          }}
          className="rounded-full border-2 border-crema-200 bg-white px-4 py-2 text-sm font-semibold text-cacao-900 transition hover:border-menta-400"
        >
          Volver a preguntar los sabores
        </button>
      </div>

      {/* Sabores */}
      <section className="mt-8">
        <h3 className="mb-3 flex items-center gap-3 font-display text-lg font-bold text-menta-700">
          Sabores
          <span className="text-sm font-medium text-cacao-800/45">
            {activos.size} de {catalogo.length} disponibles
          </span>
          <span className="h-px flex-1 bg-crema-200" />
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {catalogo.map((sabor) => {
            const activo = activos.has(sabor.id)
            const propio = esPersonalizado(sabor.id)
            return (
              <div
                key={sabor.id}
                className={`flex items-center rounded-xl border-2 pr-1 transition ${
                  activo
                    ? 'border-menta-500 bg-menta-100'
                    : 'border-crema-200 bg-crema-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSabor(sabor.id)}
                  className="flex flex-1 items-center gap-2.5 px-3 py-3 text-left text-sm font-medium"
                >
                  <span
                    className={`h-5 w-5 shrink-0 rounded-full border border-black/10 ${
                      activo ? '' : 'opacity-30 grayscale'
                    }`}
                    style={{ backgroundColor: sabor.color }}
                    aria-hidden="true"
                  />
                  <span
                    className={`truncate ${
                      activo ? 'text-cacao-900' : 'text-cacao-800/40 line-through'
                    }`}
                  >
                    {sabor.name}
                  </span>
                  <span
                    className={`ml-auto shrink-0 text-xs font-bold ${
                      activo ? 'text-menta-500' : 'text-terracota-600'
                    }`}
                  >
                    {activo ? 'Hay' : 'Agotado'}
                  </span>
                </button>
                {propio && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Borrar "${sabor.name}" de la lista de sabores?`)) {
                        eliminarSabor(sabor.id)
                      }
                    }}
                    aria-label={`Borrar ${sabor.name} de la lista`}
                    className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-cacao-800/40 transition hover:bg-terracota-100 hover:text-terracota-600"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <NuevoSabor onAgregar={agregarSabor} />
      </section>

      {/* Productos */}
      <section className="mt-10">
        <h3 className="mb-3 flex items-center gap-3 font-display text-lg font-bold text-menta-700">
          Productos
          {agotados > 0 && (
            <span className="text-sm font-medium text-terracota-600">{agotados} agotados</span>
          )}
          <span className="h-px flex-1 bg-crema-200" />
        </h3>

        {CATEGORIES.map((categoria) => {
          const deLaSeccion = productos.filter((p) => p.category === categoria.id)
          if (deLaSeccion.length === 0) return null
          return (
            <div key={categoria.id} className="mb-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cacao-800/45">
                {categoria.name}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {deLaSeccion.map((producto) => {
                  const agotado = productoAgotado(producto.id)
                  return (
                    <button
                      key={producto.id}
                      type="button"
                      onClick={() => toggleProducto(producto.id)}
                      className={`flex items-center gap-3 rounded-xl border-2 px-3 py-3 text-left transition ${
                        agotado
                          ? 'border-crema-200 bg-crema-100'
                          : 'border-crema-200 bg-white hover:border-menta-400'
                      }`}
                    >
                      <span
                        className={`text-2xl leading-none ${agotado ? 'opacity-30 grayscale' : ''}`}
                        aria-hidden="true"
                      >
                        {producto.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm font-semibold ${
                            agotado ? 'text-cacao-800/40 line-through' : 'text-cacao-900'
                          }`}
                        >
                          {producto.name}
                        </span>
                        <span className="block text-xs text-cacao-800/45">
                          {producto.variantes ? 'desde ' : ''}
                          {formatCOP(precioDesde(producto))}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-xs font-bold ${
                          agotado ? 'text-terracota-600' : 'text-menta-500'
                        }`}
                      >
                        {agotado ? 'Agotado' : 'Hay'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}

/** Formulario para registrar un sabor que llegó nuevo a la vitrina. */
function NuevoSabor({ onAgregar }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(PALETA[0])
  const [error, setError] = useState('')

  function guardar(e) {
    e.preventDefault()
    const problema = onAgregar({ name: nombre, color })
    if (problema) {
      setError(problema)
      return
    }
    setNombre('')
    setColor(PALETA[0])
    setError('')
    setAbierto(false)
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-3 rounded-xl border-2 border-dashed border-crema-300 px-4 py-3 text-sm font-semibold text-cacao-800/60 transition hover:border-menta-400 hover:text-cacao-900"
      >
        + Agregar un sabor nuevo
      </button>
    )
  }

  return (
    <form
      onSubmit={guardar}
      className="animar-entrada mt-3 rounded-2xl border-2 border-menta-400 bg-white p-4"
    >
      <p className="mb-3 font-display text-base font-bold text-cacao-900">Sabor nuevo</p>

      <input
        autoFocus
        value={nombre}
        onChange={(e) => {
          setNombre(e.target.value)
          setError('')
        }}
        placeholder="Ej: Té verde matcha"
        className="w-full rounded-xl border-2 border-crema-200 bg-crema-50 px-3 py-2.5 text-sm text-cacao-900 outline-none transition placeholder:text-cacao-800/35 focus:border-menta-400"
      />

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-cacao-800/55">
        Color
      </p>
      <div className="flex flex-wrap gap-2">
        {PALETA.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Usar el color ${c}`}
            className={`h-8 w-8 rounded-full border-2 transition ${
              color === c ? 'border-cacao-900 scale-110' : 'border-black/10'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-terracota-100 px-3 py-2 text-sm font-medium text-terracota-600">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="rounded-xl bg-menta-700 px-5 py-2.5 text-sm font-bold text-crema-50 transition hover:bg-cacao-800"
        >
          Agregar
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false)
            setNombre('')
            setError('')
          }}
          className="rounded-xl border-2 border-crema-200 px-5 py-2.5 text-sm font-semibold text-cacao-900 transition hover:border-cono-500"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
