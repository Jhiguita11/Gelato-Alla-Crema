import { BRAND, STAFF } from '../data/menu'
import { useTurnos } from '../store/turnos'

/** Iniciales para el círculo del perfil: "Mariana" → "MA". */
const iniciales = (nombre) => nombre.slice(0, 2).toUpperCase()

/**
 * Primera pantalla del día: quién entra a atender. Abre su turno y no deja
 * pasar hasta que alguien se identifique, para que todo pedido quede a nombre
 * de quien lo tomó.
 */
export default function Entrada() {
  const { entrar } = useTurnos()

  const hoy = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-cacao-900/70 p-0 backdrop-blur-sm sm:p-6">
      <div className="animar-entrada flex max-h-dvh w-full max-w-xl flex-col overflow-hidden bg-crema-50 shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        <header className="flex items-center gap-4 border-b border-crema-200 bg-white px-6 py-5">
          <img
            src={BRAND.logo}
            alt=""
            width="56"
            height="56"
            className="h-14 w-14 shrink-0 rounded-full border-2 border-cacao-800 object-cover"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cacao-800/50">
              {hoy}
            </p>
            <h2 className="mt-0.5 font-display text-2xl font-bold text-cacao-900">
              ¿Quién entra?
            </h2>
          </div>
        </header>

        <div className="scroll-suave flex-1 overflow-y-auto px-6 py-6">
          <p className="mb-4 text-sm text-cacao-800/60">
            Toca tu nombre para abrir el turno. Los pedidos que tomes quedan a tu nombre.
          </p>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {STAFF.map((persona) => (
              <button
                key={persona}
                type="button"
                onClick={() => entrar(persona)}
                className="flex items-center gap-3.5 rounded-2xl border-2 border-crema-200 bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-menta-400 hover:shadow-lg hover:shadow-cacao-900/5"
              >
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-menta-700 font-display text-base font-bold text-crema-50"
                  aria-hidden="true"
                >
                  {iniciales(persona)}
                </span>
                <span className="font-display text-lg font-bold text-cacao-900">{persona}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
