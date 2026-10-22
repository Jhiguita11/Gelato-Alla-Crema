import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Cada cuánto se revisa si hay una versión nueva publicada. La app puede
// quedar abierta todo el día en el celular sin recargarse nunca.
const REVISAR_CADA_MS = 30 * 60 * 1000

/**
 * Avisa cuando hay una versión nueva de la app o cuando ya quedó lista para
 * usarse sin internet. No recarga sola: si hay un pedido a medio armar se
 * perdería, así que el mesero decide cuándo tocar "Actualizar".
 */
export default function AvisoActualizacion() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    offlineReady: [listaSinInternet, setListaSinInternet],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return
      setInterval(() => {
        if (navigator.onLine) registro.update().catch(() => {})
      }, REVISAR_CADA_MS)
    },
  })

  // "Ya funciona sin internet" es solo informativo: se va solo para no tapar
  // botones. El de versión nueva se queda hasta que alguien decida.
  useEffect(() => {
    if (!listaSinInternet) return
    const id = setTimeout(() => setListaSinInternet(false), 4000)
    return () => clearTimeout(id)
  }, [listaSinInternet, setListaSinInternet])

  if (!hayVersionNueva && !listaSinInternet) return null

  const cerrar = () => {
    setHayVersionNueva(false)
    setListaSinInternet(false)
  }

  return (
    // Por encima de todas las ventanas (¿Quién entra?, apertura del día,
    // documento): si quedara debajo, no se podría tocar "Actualizar".
    <div
      role="status"
      className="animar-entrada fixed inset-x-3 bottom-24 z-[90] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-cacao-900 px-4 py-3 text-sm text-crema-50 shadow-xl sm:bottom-6"
    >
      <p className="flex-1">
        {hayVersionNueva
          ? 'Hay una versión nueva de la app.'
          : 'Lista: la app ya funciona sin internet.'}
      </p>
      {hayVersionNueva && (
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="rounded-xl bg-menta-500 px-3 py-1.5 font-bold text-cacao-900 transition hover:bg-menta-100"
        >
          Actualizar
        </button>
      )}
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar aviso"
        className="rounded-lg px-2 py-1 text-crema-50/70 transition hover:text-crema-50"
      >
        ✕
      </button>
    </div>
  )
}
