import { createContext, useCallback, useContext, useMemo } from 'react'
import { useAlmacen } from './almacen'

const STORAGE_KEY = 'gac.turnos.v1'
const VACIO = { activo: null, turnos: [] }

const TurnosContext = createContext(null)

/**
 * Quién está atendiendo y desde cuándo. Cada entrada abre un turno y cada
 * salida lo cierra, así queda registrado cuánto estuvo conectado cada quien.
 */
export function TurnosProvider({ children }) {
  const [estado, actualizar] = useAlmacen(STORAGE_KEY, VACIO)

  const entrar = useCallback(
    (persona) => {
      const turno = { id: crypto.randomUUID(), persona, inicio: Date.now(), fin: null }
      actualizar((prev) => ({ activo: turno, turnos: [...(prev?.turnos ?? []), turno] }))
    },
    [actualizar],
  )

  const salir = useCallback(() => {
    actualizar((prev) => {
      if (!prev?.activo) return prev
      const fin = Date.now()
      return {
        activo: null,
        turnos: prev.turnos.map((t) => (t.id === prev.activo.id ? { ...t, fin } : t)),
      }
    })
  }, [actualizar])

  /** Al cerrar la caja se archiva el día: los turnos arrancan de cero. */
  const reiniciarTurnos = useCallback(() => {
    actualizar((prev) => {
      if (!prev?.activo) return { activo: null, turnos: [] }
      // Quien esté conectado sigue conectado, pero con el turno recién abierto.
      const turno = { ...prev.activo, inicio: Date.now(), fin: null }
      return { activo: turno, turnos: [turno] }
    })
  }, [actualizar])

  const value = useMemo(
    () => ({
      persona: estado?.activo?.persona ?? null,
      desde: estado?.activo?.inicio ?? null,
      turnos: estado?.turnos ?? [],
      entrar,
      salir,
      reiniciarTurnos,
    }),
    [estado, entrar, salir, reiniciarTurnos],
  )

  return <TurnosContext.Provider value={value}>{children}</TurnosContext.Provider>
}

export function useTurnos() {
  const context = useContext(TurnosContext)
  if (!context) throw new Error('useTurnos debe usarse dentro de <TurnosProvider>')
  return context
}
