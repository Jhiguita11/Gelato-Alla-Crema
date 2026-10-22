import { useEffect } from 'react'
import { useMotor } from '../sync/MotorProvider'

/**
 * Dice si este celular está al día con los demás. Solo existe en modo
 * compartido: en modo local no hay nada que sincronizar.
 */
export default function EstadoSync() {
  const { sync } = useMotor()
  if (sync.modo !== 'compartido') return null

  const { enLinea, pendientes } = sync
  const alDia = enLinea && pendientes === 0
  const texto = alDia
    ? 'En línea'
    : enLinea
      ? `Enviando ${pendientes}…`
      : pendientes > 0
        ? `Sin internet · ${pendientes} por enviar`
        : 'Sin internet'

  return (
    <span
      role="status"
      title={
        alDia
          ? 'Todos los celulares ven lo mismo.'
          : 'Puedes seguir tomando pedidos: se envían solos cuando vuelva la conexión.'
      }
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        alDia ? 'text-menta-700' : 'bg-cono-500/15 text-cono-600'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${alDia ? 'bg-menta-500' : 'animate-pulse bg-cono-500'}`}
      />
      <span className={alDia ? 'sr-only sm:not-sr-only' : ''}>{texto}</span>
    </span>
  )
}

/** Aviso cuando el servidor rechazó un cambio (p. ej. otro celular ya cerró la caja). */
export function AvisoSync() {
  const { sync } = useMotor()
  const { aviso, cerrarAviso } = sync

  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(cerrarAviso, 8000)
    return () => clearTimeout(id)
  }, [aviso, cerrarAviso])

  if (sync.modo !== 'compartido' || !aviso) return null
  return (
    <div
      role="alert"
      className="animar-entrada fixed inset-x-3 top-20 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-terracota-600 px-4 py-3 text-sm font-medium text-crema-50 shadow-xl"
    >
      <p className="flex-1">{aviso}</p>
      <button type="button" onClick={cerrarAviso} aria-label="Cerrar aviso" className="px-1">
        ✕
      </button>
    </div>
  )
}
