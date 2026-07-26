import { useState } from 'react'
import { useDisponibilidad } from '../store/disponibilidad'

/**
 * Pantalla de apertura: aparece la primera vez que se abre la app cada día
 * y pregunta qué sabores hay en la vitrina. Lo que no se marque no se puede
 * pedir hasta que se habilite en Disponibilidad.
 */
export default function AperturaDia() {
  const { abrirDia, catalogo } = useDisponibilidad()
  const [elegidos, setElegidos] = useState(() => catalogo.map((f) => f.id))

  const hoy = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  function alternar(id) {
    setElegidos((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-cacao-900/60 p-0 backdrop-blur-sm sm:p-6">
      <div className="animar-entrada flex max-h-dvh w-full max-w-2xl flex-col overflow-hidden bg-crema-50 shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        <header className="border-b border-crema-200 bg-white px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-cacao-800/50">
            {hoy}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-cacao-900">
            ¿Qué sabores hay hoy?
          </h2>
          <p className="mt-1 text-sm text-cacao-800/60">
            Marca los que estén en la vitrina. Los que dejes sin marcar no se van a poder pedir.
          </p>
        </header>

        <div className="scroll-suave flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setElegidos(catalogo.map((f) => f.id))}
              className="rounded-full border-2 border-crema-200 bg-white px-4 py-2 text-sm font-semibold text-cacao-900 transition hover:border-menta-400"
            >
              Marcar todos
            </button>
            <button
              type="button"
              onClick={() => setElegidos([])}
              className="rounded-full border-2 border-crema-200 bg-white px-4 py-2 text-sm font-semibold text-cacao-900 transition hover:border-cono-500"
            >
              Ninguno
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {catalogo.map((sabor) => {
              const activo = elegidos.includes(sabor.id)
              return (
                <button
                  key={sabor.id}
                  type="button"
                  onClick={() => alternar(sabor.id)}
                  className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-3 text-left text-sm font-medium transition ${
                    activo
                      ? 'border-menta-500 bg-menta-100 text-cacao-900'
                      : 'border-crema-200 bg-white text-cacao-800/45'
                  }`}
                >
                  <span
                    className={`h-5 w-5 shrink-0 rounded-full border border-black/10 transition ${
                      activo ? '' : 'opacity-30 grayscale'
                    }`}
                    style={{ backgroundColor: sabor.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{sabor.name}</span>
                  {activo && <span className="ml-auto text-menta-500">✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-crema-200 bg-white px-6 py-4">
          <p className="text-sm text-cacao-800/60">
            <span className="font-display text-xl font-bold text-cacao-900">
              {elegidos.length}
            </span>{' '}
            de {catalogo.length} sabores
          </p>
          <button
            type="button"
            disabled={elegidos.length === 0}
            onClick={() => abrirDia(elegidos)}
            className="rounded-2xl bg-menta-700 px-6 py-3.5 text-sm font-bold text-crema-50 shadow-lg shadow-cacao-900/15 transition enabled:hover:bg-cacao-800 disabled:cursor-not-allowed disabled:bg-crema-300 disabled:text-cacao-900/40 disabled:shadow-none"
          >
            {elegidos.length === 0 ? 'Marca al menos uno' : 'Empezar el día'}
          </button>
        </footer>
      </div>
    </div>
  )
}
